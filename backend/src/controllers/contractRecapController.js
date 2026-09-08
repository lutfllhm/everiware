const { pool } = require('../config/database');
const { deriveContractState } = require('../utils/contractHelper');

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const RESIGN_LABELS = {
  resign: 'Resign',
  tidak_lanjut_kontrak: 'Tidak Lanjut Kontrak',
  phk: 'PHK',
  pensiun: 'Pensiun',
  lainnya: 'Lainnya',
};

// ── REKAP TAHUNAN ────────────────────────────────────────────────────────────
// Karyawan baru = join_date di tahun tsb. Turn over = resign_date di tahun tsb.
// Semua angka dihitung dari data mentah agar rekap tidak pernah basi.
const getYearlyRecap = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();

    // Karyawan baru per bulan
    const [hires] = await pool.query(
      `SELECT MONTH(join_date) AS month, COUNT(*) AS total
       FROM users
       WHERE YEAR(join_date) = ?
       GROUP BY MONTH(join_date)`,
      [year]
    );

    // Karyawan keluar per bulan + alasannya
    const [exits] = await pool.query(
      `SELECT MONTH(resign_date) AS month, resign_reason, COUNT(*) AS total
       FROM users
       WHERE YEAR(resign_date) = ?
       GROUP BY MONTH(resign_date), resign_reason`,
      [year]
    );

    // Tren bulanan: masuk vs keluar berdampingan
    const monthly = MONTH_LABELS.map((label, i) => {
      const monthNo = i + 1;
      const masuk = Number(hires.find(h => Number(h.month) === monthNo)?.total || 0);
      const keluar = exits
        .filter(e => Number(e.month) === monthNo)
        .reduce((sum, e) => sum + Number(e.total), 0);
      return { month: label, month_no: monthNo, karyawan_baru: masuk, turn_over: keluar, net: masuk - keluar };
    });

    const totalHires = monthly.reduce((s, m) => s + m.karyawan_baru, 0);
    const totalExits = monthly.reduce((s, m) => s + m.turn_over, 0);

    // Rincian alasan keluar (untuk pie chart)
    const reasonMap = {};
    for (const e of exits) {
      const key = e.resign_reason || 'lainnya';
      reasonMap[key] = (reasonMap[key] || 0) + Number(e.total);
    }
    const byReason = Object.entries(reasonMap).map(([key, total]) => ({
      key,
      label: RESIGN_LABELS[key] || key,
      total,
    })).sort((a, b) => b.total - a.total);

    // Komposisi status hubungan kerja karyawan aktif saat ini
    const [statusRows] = await pool.query(`
      SELECT COALESCE(c.contract_type, 'BELUM_ADA') AS contract_type, COUNT(*) AS total
      FROM users u
      LEFT JOIN employment_contracts c ON c.user_id = u.id
        AND c.sequence_no = (SELECT MAX(c2.sequence_no) FROM employment_contracts c2 WHERE c2.user_id = u.id)
      WHERE u.is_active = TRUE
      GROUP BY COALESCE(c.contract_type, 'BELUM_ADA')
    `);
    const STATUS_LABELS = { PKWT: 'PKWT', PKWTT: 'PKWTT', DAILY_WORKER: 'Daily Worker', BELUM_ADA: 'Belum Ada Kontrak' };
    const byStatus = statusRows.map(r => ({
      key: r.contract_type,
      label: STATUS_LABELS[r.contract_type] || r.contract_type,
      total: Number(r.total),
    }));

    // Sebaran karyawan aktif per penempatan
    const [placementRows] = await pool.query(`
      SELECT COALESCE(penempatan, 'Belum Diisi') AS penempatan, COUNT(*) AS total
      FROM users WHERE is_active = TRUE
      GROUP BY COALESCE(penempatan, 'Belum Diisi')
      ORDER BY total DESC
    `);
    const byPlacement = placementRows.map(r => ({ label: r.penempatan, total: Number(r.total) }));

    // Sebaran per instansi
    const [instansiRows] = await pool.query(`
      SELECT COALESCE(instansi, 'Belum Diisi') AS instansi, COUNT(*) AS total
      FROM users WHERE is_active = TRUE
      GROUP BY COALESCE(instansi, 'Belum Diisi')
      ORDER BY total DESC
    `);
    const byInstansi = instansiRows.map(r => ({ label: r.instansi, total: Number(r.total) }));

    // Sebaran PKWT tahun ke-1..5 (kontrak aktif)
    const [pkwtRows] = await pool.query(`
      SELECT c.pkwt_year, COUNT(*) AS total
      FROM users u
      JOIN employment_contracts c ON c.user_id = u.id
        AND c.sequence_no = (SELECT MAX(c2.sequence_no) FROM employment_contracts c2 WHERE c2.user_id = u.id)
      WHERE u.is_active = TRUE AND c.contract_type = 'PKWT' AND c.pkwt_year IS NOT NULL
      GROUP BY c.pkwt_year
    `);
    const byPkwtYear = [1, 2, 3, 4, 5].map(y => ({
      label: `Tahun ke-${y}`,
      year: y,
      total: Number(pkwtRows.find(r => Number(r.pkwt_year) === y)?.total || 0),
    }));

    // Kontrak yang berakhir di tahun tsb, per bulan — buat perencanaan HR
    const [expiringRows] = await pool.query(
      `SELECT MONTH(c.end_date) AS month, COUNT(*) AS total
       FROM users u
       JOIN employment_contracts c ON c.user_id = u.id
         AND c.sequence_no = (SELECT MAX(c2.sequence_no) FROM employment_contracts c2 WHERE c2.user_id = u.id)
       WHERE u.is_active = TRUE AND c.status = 'active' AND YEAR(c.end_date) = ?
       GROUP BY MONTH(c.end_date)`,
      [year]
    );
    const contractEndings = MONTH_LABELS.map((label, i) => ({
      month: label,
      total: Number(expiringRows.find(r => Number(r.month) === i + 1)?.total || 0),
    }));

    // Headcount akhir tahun & rasio turn over.
    // Pembagi memakai rata-rata headcount awal+akhir tahun (praktik umum HR),
    // bukan headcount akhir saja, supaya tidak bias saat perusahaan tumbuh cepat.
    const [headcountRows] = await pool.query(
      `SELECT
         SUM(CASE WHEN join_date <= ? AND (resign_date IS NULL OR resign_date > ?) THEN 1 ELSE 0 END) AS end_of_year,
         SUM(CASE WHEN join_date < ? AND (resign_date IS NULL OR resign_date >= ?) THEN 1 ELSE 0 END) AS start_of_year
       FROM users`,
      [`${year}-12-31`, `${year}-12-31`, `${year}-01-01`, `${year}-01-01`]
    );
    const endHeadcount = Number(headcountRows[0].end_of_year || 0);
    const startHeadcount = Number(headcountRows[0].start_of_year || 0);
    const avgHeadcount = (startHeadcount + endHeadcount) / 2;
    const turnoverRate = avgHeadcount > 0 ? Number(((totalExits / avgHeadcount) * 100).toFixed(1)) : 0;

    // Daftar tahun yang punya data, untuk dropdown pemilih tahun
    const [yearRows] = await pool.query(`
      SELECT DISTINCT YEAR(join_date) AS y FROM users WHERE join_date IS NOT NULL
      UNION
      SELECT DISTINCT YEAR(resign_date) AS y FROM users WHERE resign_date IS NOT NULL
      ORDER BY y DESC
    `);
    const availableYears = yearRows.map(r => Number(r.y)).filter(Boolean);
    if (!availableYears.includes(new Date().getFullYear())) availableYears.unshift(new Date().getFullYear());

    res.json({
      success: true,
      year,
      available_years: availableYears.sort((a, b) => b - a),
      summary: {
        karyawan_baru: totalHires,
        turn_over: totalExits,
        net_growth: totalHires - totalExits,
        headcount_awal: startHeadcount,
        headcount_akhir: endHeadcount,
        turnover_rate: turnoverRate,
      },
      monthly,
      by_reason: byReason,
      by_status: byStatus,
      by_placement: byPlacement,
      by_instansi: byInstansi,
      by_pkwt_year: byPkwtYear,
      contract_endings: contractEndings,
    });
  } catch (err) {
    console.error('[getYearlyRecap]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── DAFTAR KARYAWAN BARU / KELUAR DI SATU TAHUN ──────────────────────────────
// Detail di balik angka rekap, supaya HR bisa menelusuri siapa saja orangnya.
const getRecapDetail = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const type = req.query.type === 'exit' ? 'exit' : 'hire';

    const [rows] = await pool.query(
      type === 'hire'
        ? `SELECT u.id, u.name, u.employee_id, u.position, u.penempatan, u.instansi,
                  u.join_date, u.is_active, c.contract_type, c.pkwt_year, c.duration_months, c.end_date
           FROM users u
           LEFT JOIN employment_contracts c ON c.user_id = u.id
             AND c.sequence_no = (SELECT MAX(c2.sequence_no) FROM employment_contracts c2 WHERE c2.user_id = u.id)
           WHERE YEAR(u.join_date) = ?
           ORDER BY u.join_date ASC`
        : `SELECT u.id, u.name, u.employee_id, u.position, u.penempatan, u.instansi,
                  u.join_date, u.resign_date, u.resign_reason, u.resign_note,
                  c.contract_type, c.pkwt_year, c.duration_months, c.end_date
           FROM users u
           LEFT JOIN employment_contracts c ON c.user_id = u.id
             AND c.sequence_no = (SELECT MAX(c2.sequence_no) FROM employment_contracts c2 WHERE c2.user_id = u.id)
           WHERE YEAR(u.resign_date) = ?
           ORDER BY u.resign_date ASC`,
      [year]
    );

    res.json({
      success: true,
      year,
      type,
      employees: rows.map(r => ({
        ...r,
        resign_reason_label: r.resign_reason ? (RESIGN_LABELS[r.resign_reason] || r.resign_reason) : null,
        ...deriveContractState(r),
      })),
    });
  } catch (err) {
    console.error('[getRecapDetail]', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = { getYearlyRecap, getRecapDetail };
