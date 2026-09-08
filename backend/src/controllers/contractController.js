const { pool } = require('../config/database');
const { generateId } = require('../utils/helpers');
const { auditLog } = require('../utils/auditLog');
const {
  REMINDER_DAYS_BEFORE,
  calculateEndDate,
  calculatePkwtYear,
  deriveContractState,
} = require('../utils/contractHelper');

const CONTRACT_TYPES = ['PKWT', 'PKWTT', 'DAILY_WORKER'];
const ALLOWED_DURATIONS = [3, 6, 12];
const RESIGN_REASONS = ['resign', 'tidak_lanjut_kontrak', 'phk', 'pensiun', 'lainnya'];

// Kontrak aktif setiap karyawan = baris dengan sequence_no tertinggi.
// Dipakai berkali-kali, jadi disatukan di sini agar list & rekap konsisten.
const LATEST_CONTRACT_JOIN = `
  LEFT JOIN employment_contracts c ON c.user_id = u.id
    AND c.sequence_no = (
      SELECT MAX(c2.sequence_no) FROM employment_contracts c2 WHERE c2.user_id = u.id
    )
`;

// ── LIST KARYAWAN + STATUS HUBUNGAN KERJA ────────────────────────────────────
// Satu baris per karyawan dengan kontrak aktifnya. Kolom turunan (sisa hari,
// tahun PKWT, label status) dihitung di sini, tidak disimpan di DB.
const getContracts = async (req, res) => {
  try {
    const { search, status, penempatan, instansi, expiring, include_inactive } = req.query;

    const where = [];
    const params = [];

    // Default hanya karyawan aktif; HR bisa menampilkan yang sudah keluar juga.
    if (include_inactive !== 'true') where.push('u.is_active = TRUE');
    if (search) {
      where.push('(u.name LIKE ? OR u.employee_id LIKE ? OR u.email LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (status && CONTRACT_TYPES.includes(status)) {
      where.push('c.contract_type = ?');
      params.push(status);
    }
    if (penempatan) { where.push('u.penempatan = ?'); params.push(penempatan); }
    if (instansi)   { where.push('u.instansi = ?');   params.push(instansi); }

    const [rows] = await pool.query(`
      SELECT
        u.id, u.name, u.employee_id, u.email, u.position, u.department,
        u.penempatan, u.instansi, u.join_date, u.is_active,
        u.has_skck, u.has_formjobs, u.resign_date, u.resign_reason,
        -- Akun yang password-nya masih NULL berarti karyawan belum membuat kata
        -- sandi lewat tautan aktivasi. Dipakai tabel untuk menandai & menawarkan
        -- kirim ulang aktivasi.
        (u.password IS NULL) AS pending_activation,
        c.id AS contract_id, c.contract_type, c.duration_months, c.pkwt_year,
        c.start_date, c.end_date, c.sequence_no, c.status AS contract_status,
        c.is_signed, c.signed_at, c.note
      FROM users u
      ${LATEST_CONTRACT_JOIN}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY (c.end_date IS NULL), c.end_date ASC, u.name ASC
    `, params);

    let contracts = rows.map(r => ({ ...r, ...deriveContractState(r) }));

    // Filter turunan — tidak bisa di SQL karena dihitung di aplikasi
    if (expiring === 'true') contracts = contracts.filter(c => c.is_expiring_soon);

    res.json({
      success: true,
      contracts,
      summary: {
        total: contracts.length,
        pkwt: contracts.filter(c => c.contract_type === 'PKWT').length,
        pkwtt: contracts.filter(c => c.contract_type === 'PKWTT').length,
        daily_worker: contracts.filter(c => c.contract_type === 'DAILY_WORKER').length,
        no_contract: contracts.filter(c => !c.contract_id).length,
        expiring_soon: contracts.filter(c => c.is_expiring_soon).length,
        expired: contracts.filter(c => c.is_expired).length,
      },
    });
  } catch (err) {
    console.error('[getContracts]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── RIWAYAT KONTRAK SATU KARYAWAN ────────────────────────────────────────────
// Semua periode kontrak, terbaru dulu. Histori tidak pernah dihapus saat perpanjangan.
const getContractHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const [users] = await pool.query(
      `SELECT id, name, employee_id, position, department, penempatan, instansi,
              join_date, is_active, has_skck, has_formjobs, resign_date, resign_reason
       FROM users WHERE id = ?`,
      [userId]
    );
    if (!users.length) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });

    const [history] = await pool.query(
      'SELECT * FROM employment_contracts WHERE user_id = ? ORDER BY sequence_no DESC',
      [userId]
    );

    res.json({
      success: true,
      employee: users[0],
      history: history.map(h => ({ ...h, ...deriveContractState(h) })),
    });
  } catch (err) {
    console.error('[getContractHistory]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── BUAT / PERPANJANG KONTRAK ────────────────────────────────────────────────
// Selalu INSERT baris baru. Kontrak sebelumnya ditandai 'renewed' agar histori
// perpanjangan tetap tersimpan utuh — tidak pernah di-update in-place.
const createContract = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { user_id, contract_type, duration_months, start_date, note, is_signed } = req.body;

    if (!user_id || !contract_type || !start_date) {
      return res.status(400).json({ success: false, message: 'Karyawan, jenis kontrak, dan tanggal mulai wajib diisi' });
    }
    if (!CONTRACT_TYPES.includes(contract_type)) {
      return res.status(400).json({ success: false, message: 'Jenis kontrak tidak valid' });
    }

    // PKWT wajib berdurasi; PKWTT (permanen) & Daily Worker tidak berdurasi.
    let months = null;
    if (contract_type === 'PKWT') {
      months = Number(duration_months);
      if (!ALLOWED_DURATIONS.includes(months)) {
        return res.status(400).json({ success: false, message: 'Durasi PKWT harus 3, 6, atau 12 bulan' });
      }
    }

    const [users] = await conn.query('SELECT id, name FROM users WHERE id = ?', [user_id]);
    if (!users.length) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });

    await conn.beginTransaction();

    // Urutan kontrak & akumulasi bulan PKWT sebelumnya — dasar hitung tahun ke-berapa.
    const [prev] = await conn.query(
      `SELECT COALESCE(MAX(sequence_no), 0) AS max_seq,
              COALESCE(SUM(CASE WHEN contract_type = 'PKWT' THEN duration_months ELSE 0 END), 0) AS pkwt_months
       FROM employment_contracts WHERE user_id = ? FOR UPDATE`,
      [user_id]
    );
    const sequenceNo = Number(prev[0].max_seq) + 1;
    const previousPkwtMonths = Number(prev[0].pkwt_months);

    // Kontrak lama ditutup sebagai 'renewed' — barisnya tetap ada sebagai histori.
    await conn.query(
      "UPDATE employment_contracts SET status = 'renewed' WHERE user_id = ? AND status = 'active'",
      [user_id]
    );

    const endDate = contract_type === 'PKWT' ? calculateEndDate(start_date, months) : null;
    const pkwtYear = contract_type === 'PKWT' ? calculatePkwtYear(previousPkwtMonths) : null;

    const id = generateId();
    await conn.query(
      `INSERT INTO employment_contracts
        (id, user_id, contract_type, duration_months, pkwt_year, start_date, end_date,
         sequence_no, status, is_signed, signed_at, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      [id, user_id, contract_type, months, pkwtYear, start_date, endDate, sequenceNo,
       is_signed ? 1 : 0, is_signed ? new Date() : null, note || null, req.user.id]
    );

    await conn.commit();

    await auditLog(req, sequenceNo > 1 ? 'RENEW_CONTRACT' : 'CREATE_CONTRACT', 'employment_contract', id,
      `${sequenceNo > 1 ? 'Perpanjangan' : 'Kontrak baru'} ${contract_type} untuk ${users[0].name}` +
      (endDate ? ` s/d ${endDate}` : ''));

    res.status(201).json({
      success: true,
      message: sequenceNo > 1 ? 'Kontrak berhasil diperpanjang' : 'Kontrak berhasil dibuat',
      contract: { id, end_date: endDate, pkwt_year: pkwtYear, sequence_no: sequenceNo },
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[createContract]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  } finally {
    conn.release();
  }
};

// ── UPDATE KONTRAK ───────────────────────────────────────────────────────────
// Untuk koreksi salah input, bukan perpanjangan. End date & tahun PKWT selalu
// dihitung ulang sistem agar tidak bisa dipaksa manual dari client.
const updateContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { contract_type, duration_months, start_date, note, is_signed } = req.body;

    const [rows] = await pool.query('SELECT * FROM employment_contracts WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kontrak tidak ditemukan' });
    const current = rows[0];

    const type = contract_type || current.contract_type;
    if (!CONTRACT_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'Jenis kontrak tidak valid' });
    }

    let months = null;
    if (type === 'PKWT') {
      months = Number(duration_months ?? current.duration_months);
      if (!ALLOWED_DURATIONS.includes(months)) {
        return res.status(400).json({ success: false, message: 'Durasi PKWT harus 3, 6, atau 12 bulan' });
      }
    }

    const startDate = start_date || current.start_date;
    const endDate = type === 'PKWT' ? calculateEndDate(startDate, months) : null;

    // Tahun PKWT dihitung ulang dari kontrak PKWT SEBELUM kontrak ini.
    const [prev] = await pool.query(
      `SELECT COALESCE(SUM(duration_months), 0) AS pkwt_months
       FROM employment_contracts
       WHERE user_id = ? AND contract_type = 'PKWT' AND sequence_no < ?`,
      [current.user_id, current.sequence_no]
    );
    const pkwtYear = type === 'PKWT' ? calculatePkwtYear(Number(prev[0].pkwt_months)) : null;

    const signed = is_signed === undefined ? current.is_signed : (is_signed ? 1 : 0);
    // Kalau tanggal berakhir bergeser, reminder H-14 dibuka lagi supaya HR tetap
    // diingatkan untuk periode yang baru.
    const resetReminder = String(current.end_date || '') !== String(endDate || '');

    await pool.query(
      `UPDATE employment_contracts
       SET contract_type = ?, duration_months = ?, pkwt_year = ?, start_date = ?, end_date = ?,
           is_signed = ?, signed_at = ?, note = ?,
           reminder_sent_at = ${resetReminder ? 'NULL' : 'reminder_sent_at'}
       WHERE id = ?`,
      [type, months, pkwtYear, startDate, endDate, signed,
       signed ? (current.signed_at || new Date()) : null, note ?? current.note, id]
    );

    await auditLog(req, 'UPDATE_CONTRACT', 'employment_contract', id, `Perbarui kontrak ${type}`);
    res.json({ success: true, message: 'Kontrak berhasil diperbarui', end_date: endDate, pkwt_year: pkwtYear });
  } catch (err) {
    console.error('[updateContract]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── HAPUS KONTRAK ────────────────────────────────────────────────────────────
// Hanya kontrak terakhir yang boleh dihapus, supaya urutan histori & perhitungan
// tahun PKWT kontrak sesudahnya tidak rusak. Kontrak sebelumnya dibuka kembali.
const deleteContract = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const [rows] = await conn.query('SELECT * FROM employment_contracts WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kontrak tidak ditemukan' });
    const contract = rows[0];

    const [maxRow] = await conn.query(
      'SELECT MAX(sequence_no) AS max_seq FROM employment_contracts WHERE user_id = ?',
      [contract.user_id]
    );
    if (Number(maxRow[0].max_seq) !== contract.sequence_no) {
      return res.status(400).json({
        success: false,
        message: 'Hanya kontrak terakhir yang bisa dihapus. Histori kontrak sebelumnya harus tetap tersimpan.',
      });
    }

    await conn.beginTransaction();
    await conn.query('DELETE FROM employment_contracts WHERE id = ?', [id]);
    // Kontrak sebelumnya kembali menjadi kontrak aktif
    await conn.query(
      "UPDATE employment_contracts SET status = 'active' WHERE user_id = ? AND sequence_no = ?",
      [contract.user_id, contract.sequence_no - 1]
    );
    await conn.commit();

    await auditLog(req, 'DELETE_CONTRACT', 'employment_contract', id, `Hapus kontrak ${contract.contract_type}`);
    res.json({ success: true, message: 'Kontrak berhasil dihapus' });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[deleteContract]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  } finally {
    conn.release();
  }
};

// ── DATA KEPEGAWAIAN (penempatan, instansi, checklist berkas) ────────────────
const updateEmployment = async (req, res) => {
  try {
    const { userId } = req.params;
    const { penempatan, instansi, has_skck, has_formjobs, join_date, position } = req.body;

    const [users] = await pool.query('SELECT id, name FROM users WHERE id = ?', [userId]);
    if (!users.length) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });

    const fields = [];
    const params = [];
    if (penempatan !== undefined)   { fields.push('penempatan = ?');   params.push(penempatan || null); }
    if (instansi !== undefined)     { fields.push('instansi = ?');     params.push(instansi || null); }
    if (position !== undefined)     { fields.push('position = ?');     params.push(position || null); }
    if (has_skck !== undefined)     { fields.push('has_skck = ?');     params.push(has_skck ? 1 : 0); }
    if (has_formjobs !== undefined) { fields.push('has_formjobs = ?'); params.push(has_formjobs ? 1 : 0); }
    if (join_date !== undefined)    { fields.push('join_date = ?');    params.push(join_date || null); }

    if (!fields.length) return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah' });

    params.push(userId);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);

    await auditLog(req, 'UPDATE_EMPLOYMENT', 'user', userId, `Perbarui data kepegawaian ${users[0].name}`);
    res.json({ success: true, message: 'Data kepegawaian berhasil diperbarui' });
  } catch (err) {
    console.error('[updateEmployment]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── TANDAI KARYAWAN KELUAR (turn over) ───────────────────────────────────────
// Dipakai rekap tahunan untuk menghitung turn over. Kontrak aktif ditutup
// sebagai 'terminated', bukan dihapus.
const terminateEmployee = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { userId } = req.params;
    const { resign_date, resign_reason, resign_note } = req.body;

    if (!resign_date || !RESIGN_REASONS.includes(resign_reason)) {
      return res.status(400).json({ success: false, message: 'Tanggal dan alasan keluar wajib diisi dengan benar' });
    }

    const [users] = await conn.query('SELECT id, name FROM users WHERE id = ?', [userId]);
    if (!users.length) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });

    await conn.beginTransaction();
    await conn.query(
      'UPDATE users SET resign_date = ?, resign_reason = ?, resign_note = ?, is_active = FALSE WHERE id = ?',
      [resign_date, resign_reason, resign_note || null, userId]
    );
    await conn.query(
      "UPDATE employment_contracts SET status = 'terminated' WHERE user_id = ? AND status = 'active'",
      [userId]
    );
    await conn.commit();

    await auditLog(req, 'TERMINATE_EMPLOYEE', 'user', userId,
      `${users[0].name} keluar (${resign_reason}) per ${resign_date}`);
    res.json({ success: true, message: 'Data karyawan keluar berhasil disimpan' });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[terminateEmployee]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  } finally {
    conn.release();
  }
};

// ── AKTIFKAN KEMBALI KARYAWAN ────────────────────────────────────────────────
const reactivateEmployee = async (req, res) => {
  try {
    const { userId } = req.params;
    const [users] = await pool.query('SELECT id, name FROM users WHERE id = ?', [userId]);
    if (!users.length) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });

    await pool.query(
      'UPDATE users SET resign_date = NULL, resign_reason = NULL, resign_note = NULL, is_active = TRUE WHERE id = ?',
      [userId]
    );
    await auditLog(req, 'REACTIVATE_EMPLOYEE', 'user', userId, `Aktifkan kembali ${users[0].name}`);
    res.json({ success: true, message: 'Karyawan berhasil diaktifkan kembali' });
  } catch (err) {
    console.error('[reactivateEmployee]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── KONTRAK AKAN BERAKHIR (widget dashboard) ─────────────────────────────────
const getExpiringContracts = async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || REMINDER_DAYS_BEFORE, 1), 365);

    const [rows] = await pool.query(`
      SELECT
        u.id, u.name, u.employee_id, u.position, u.penempatan, u.instansi,
        c.id AS contract_id, c.contract_type, c.duration_months, c.pkwt_year,
        c.start_date, c.end_date, c.is_signed
      FROM users u
      ${LATEST_CONTRACT_JOIN}
      WHERE u.is_active = TRUE
        AND c.status = 'active'
        AND c.end_date IS NOT NULL
        AND c.end_date >= CURDATE()
        AND c.end_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY c.end_date ASC
    `, [days]);

    res.json({
      success: true,
      threshold_days: days,
      count: rows.length,
      contracts: rows.map(r => ({ ...r, ...deriveContractState(r) })),
    });
  } catch (err) {
    console.error('[getExpiringContracts]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── CARI KARYAWAN (autocomplete form kontrak) ────────────────────────────────
// Dipakai kolom cari saat HR menambahkan kontrak: HR mengetik nama, sistem
// menawarkan karyawan yang SUDAH terdaftar. Tujuannya supaya kontrak selalu
// terkait ke akun karyawan sungguhan, bukan nama yang diketik bebas (yang akan
// membuat data ganda dan merusak rekap turn over serta reminder H-14).
const searchEmployees = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const withoutContract = req.query.without_contract === 'true';

    const params = [];
    const where = ['u.is_active = TRUE'];
    if (q) {
      where.push('(u.name LIKE ? OR u.email LIKE ? OR u.employee_id LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const [rows] = await pool.query(`
      SELECT
        u.id, u.name, u.email, u.employee_id, u.position, u.penempatan, u.instansi, u.join_date,
        c.id AS contract_id, c.contract_type, c.pkwt_year, c.end_date
      FROM users u
      ${LATEST_CONTRACT_JOIN}
      WHERE ${where.join(' AND ')}
      ${withoutContract ? 'HAVING contract_id IS NULL' : ''}
      ORDER BY u.name ASC
      LIMIT 15
    `, params);

    res.json({
      success: true,
      employees: rows.map(r => ({ ...r, has_contract: !!r.contract_id })),
    });
  } catch (err) {
    console.error('[searchEmployees]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── DAFTARKAN KARYAWAN BARU + KONTRAK PERTAMA ────────────────────────────────
// Satu langkah untuk HR: akun karyawan dibuat, email aktivasi terkirim, dan
// kontrak pertamanya langsung tercatat. Akun dibuat lewat jalur yang sama
// dengan menu Karyawan (password NULL + token aktivasi), jadi karyawan ini
// otomatis muncul juga di menu Karyawan — satu data, dua pintu masuk.
const createEmployeeWithContract = async (req, res) => {
  const conn = await pool.getConnection();
  let committed = false;
  try {
    const {
      name, email, phone, employee_id, position, penempatan, instansi, join_date,
      has_skck, has_formjobs, send_invitation,
      contract_type, duration_months, start_date, note, is_signed,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Nama dan email wajib diisi' });
    }
    if (!contract_type || !CONTRACT_TYPES.includes(contract_type)) {
      return res.status(400).json({ success: false, message: 'Jenis kontrak tidak valid' });
    }

    let months = null;
    if (contract_type === 'PKWT') {
      months = Number(duration_months);
      if (!ALLOWED_DURATIONS.includes(months)) {
        return res.status(400).json({ success: false, message: 'Durasi PKWT harus 3, 6, atau 12 bulan' });
      }
    }

    const [dupEmail] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (dupEmail.length) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar sebagai karyawan' });
    }
    if (employee_id) {
      const [dupNik] = await conn.query('SELECT id FROM users WHERE employee_id = ?', [employee_id]);
      if (dupNik.length) {
        return res.status(400).json({ success: false, message: 'ID Karyawan sudah digunakan' });
      }
    }

    // Tanggal mulai kontrak default mengikuti tanggal masuk kerja
    const contractStart = start_date || join_date;
    if (!contractStart) {
      return res.status(400).json({ success: false, message: 'Tanggal masuk kerja wajib diisi' });
    }

    await conn.beginTransaction();

    const userId = generateId();
    const activationToken = generateId();
    const tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari

    await conn.query(
      `INSERT INTO users
        (id, name, email, password, phone, role, position, penempatan, instansi, employee_id,
         join_date, has_skck, has_formjobs, is_verified, otp_code, otp_expires)
       VALUES (?, ?, ?, NULL, ?, 'employee', ?, ?, ?, ?, ?, ?, ?, FALSE, ?, ?)`,
      [userId, name, email, phone || null, position || null, penempatan || null, instansi || null,
       employee_id || null, join_date || null, has_skck ? 1 : 0, has_formjobs ? 1 : 0,
       activationToken, tokenExpires]
    );

    const endDate = contract_type === 'PKWT' ? calculateEndDate(contractStart, months) : null;
    // Karyawan baru: belum punya kontrak PKWT sebelumnya, jadi selalu tahun ke-1.
    const pkwtYear = contract_type === 'PKWT' ? calculatePkwtYear(0) : null;

    const contractId = generateId();
    await conn.query(
      `INSERT INTO employment_contracts
        (id, user_id, contract_type, duration_months, pkwt_year, start_date, end_date,
         sequence_no, status, is_signed, signed_at, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?, ?, ?)`,
      [contractId, userId, contract_type, months, pkwtYear, contractStart, endDate,
       is_signed ? 1 : 0, is_signed ? new Date() : null, note || null, req.user.id]
    );

    await conn.commit();
    committed = true;

    // Email undangan dikirim SETELAH commit — kegagalan kirim email tidak boleh
    // membatalkan data yang sudah tersimpan (pola yang sama dipakai createUser).
    let emailSent = false;
    if (send_invitation !== false && send_invitation !== 'false') {
      try {
        const { sendInvitationEmail } = require('./userController');
        const activationLink = `${process.env.WEB_URL || 'http://localhost:3000'}/activate/${activationToken}`;
        await sendInvitationEmail(email, name, activationLink);
        emailSent = true;
      } catch (emailErr) {
        console.error('[createEmployeeWithContract] gagal kirim email undangan:', emailErr.message);
      }
    }

    await auditLog(req, 'CREATE_EMPLOYEE_CONTRACT', 'user', userId,
      `Daftar karyawan baru ${name} (${email}) + kontrak ${contract_type}` + (endDate ? ` s/d ${endDate}` : ''));

    res.status(201).json({
      success: true,
      message: emailSent
        ? 'Karyawan & kontrak berhasil dibuat. Email aktivasi telah dikirim.'
        : (send_invitation === false || send_invitation === 'false')
          ? 'Karyawan & kontrak berhasil dibuat.'
          : 'Karyawan & kontrak berhasil dibuat, tetapi email aktivasi gagal terkirim.',
      user_id: userId,
      email_sent: emailSent,
      activation_token: activationToken,
      // Tautan lengkap dikembalikan supaya HR bisa menyalin & mengirimnya sendiri
      // (mis. lewat WhatsApp) saat email tidak dikirim atau gagal terkirim.
      activation_link: `${process.env.WEB_URL || 'http://localhost:3000'}/activate/${activationToken}`,
      contract: { id: contractId, end_date: endDate, pkwt_year: pkwtYear },
    });
  } catch (err) {
    if (!committed) await conn.rollback().catch(() => {});
    console.error('[createEmployeeWithContract]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  } finally {
    conn.release();
  }
};

// ── KIRIM ULANG AKTIVASI ─────────────────────────────────────────────────────
// Token aktivasi hanya berlaku 7 hari. Kalau karyawan belum sempat membukanya,
// HR perlu jalan untuk membuat token baru — tanpa ini akun yang tokennya
// kedaluwarsa tidak bisa diaktifkan sama sekali (harus dihapus & didaftar ulang).
// Token lama otomatis batal karena kolomnya ditimpa.
const resendActivation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { send_email } = req.body;

    const [users] = await pool.query(
      'SELECT id, name, email, password, is_verified FROM users WHERE id = ?',
      [userId]
    );
    if (!users.length) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });
    const user = users[0];

    // Akun yang sudah punya password berarti sudah diaktifkan karyawannya.
    // Menerbitkan token baru untuknya sama saja memberi jalan reset password
    // lewat pintu belakang, jadi ditolak — pakai fitur lupa password.
    if (user.password !== null) {
      return res.status(400).json({
        success: false,
        message: 'Akun ini sudah aktif. Gunakan fitur lupa password jika karyawan lupa kata sandinya.',
      });
    }

    const activationToken = generateId();
    const tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'UPDATE users SET otp_code = ?, otp_expires = ? WHERE id = ?',
      [activationToken, tokenExpires, userId]
    );

    const activationLink = `${process.env.WEB_URL || 'http://localhost:3000'}/activate/${activationToken}`;

    let emailSent = false;
    if (send_email !== false && send_email !== 'false') {
      try {
        const { sendInvitationEmail } = require('./userController');
        await sendInvitationEmail(user.email, user.name, activationLink);
        emailSent = true;
      } catch (emailErr) {
        console.error('[resendActivation] gagal kirim email:', emailErr.message);
      }
    }

    await auditLog(req, 'RESEND_ACTIVATION', 'user', userId,
      `Kirim ulang aktivasi untuk ${user.name}${emailSent ? ' (email terkirim)' : ' (tautan disalin manual)'}`);

    res.json({
      success: true,
      message: emailSent
        ? 'Email aktivasi berhasil dikirim ulang.'
        : (send_email === false || send_email === 'false')
          ? 'Tautan aktivasi baru berhasil dibuat.'
          : 'Tautan aktivasi baru dibuat, tetapi email gagal terkirim. Silakan salin tautannya.',
      email_sent: emailSent,
      activation_link: activationLink,
      expires_at: tokenExpires,
    });
  } catch (err) {
    console.error('[resendActivation]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── MASTER PENEMPATAN & INSTANSI (dropdown form) ─────────────────────────────
const getMasterData = async (req, res) => {
  try {
    const [placements]   = await pool.query('SELECT * FROM work_placements WHERE is_active = TRUE ORDER BY name ASC');
    const [institutions] = await pool.query('SELECT * FROM work_institutions WHERE is_active = TRUE ORDER BY name ASC');
    const [positions]    = await pool.query('SELECT DISTINCT name FROM positions WHERE is_active = TRUE ORDER BY name ASC');

    res.json({
      success: true,
      placements,
      institutions,
      positions: positions.map(p => p.name),
      durations: ALLOWED_DURATIONS,
      contract_types: CONTRACT_TYPES,
    });
  } catch (err) {
    console.error('[getMasterData]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = {
  getContracts,
  searchEmployees,
  createEmployeeWithContract,
  resendActivation,
  getContractHistory,
  createContract,
  updateContract,
  deleteContract,
  updateEmployment,
  terminateEmployee,
  reactivateEmployee,
  getExpiringContracts,
  getMasterData,
};
