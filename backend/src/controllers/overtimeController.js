const { pool } = require('../config/database');
const { generateId } = require('../utils/helpers');
const { sendPushNotification } = require('../utils/fcm');
const { auditLog } = require('../utils/auditLog');

// ── Helper notifikasi ─────────────────────────────────────────────────────────
const notify = async (userId, title, message, type = 'info') => {
  const id = generateId();
  await pool.query(
    'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
    [id, userId, title, message, type]
  );
  await sendPushNotification(userId, title, message).catch(() => {});
};

// ── SUBMIT OVERTIME (karyawan) ────────────────────────────────────────────────
const submitOvertime = async (req, res) => {
  try {
    const { date, start_time, end_time, reason } = req.body;
    const userId = req.user.id;

    if (!date || !start_time || !end_time || !reason)
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });

    // Hitung durasi dalam menit
    const [sh, sm] = start_time.split(':').map(Number);
    const [eh, em] = end_time.split(':').map(Number);
    let durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (durationMinutes <= 0)
      return res.status(400).json({ success: false, message: 'Jam selesai harus lebih dari jam mulai' });

    // Cek apakah sudah ada pengajuan lembur di tanggal yang sama
    const [existing] = await pool.query(
      "SELECT id FROM overtime_requests WHERE user_id = ? AND date = ? AND status != 'rejected'",
      [userId, date]
    );
    if (existing.length)
      return res.status(400).json({ success: false, message: 'Sudah ada pengajuan lembur untuk tanggal ini' });

    const id = generateId();
    const attachment = req.file ? req.file.filename : null;
    const [userRows] = await pool.query('SELECT name FROM users WHERE id = ?', [userId]);
    const submitterName = userRows[0]?.name || 'Karyawan';

    await pool.query(
      `INSERT INTO overtime_requests (id, user_id, date, start_time, end_time, duration_minutes, reason, attachment, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, userId, date, start_time, end_time, durationMinutes, reason, attachment]
    );

    // Notif ke semua HRD & admin
    const [admins] = await pool.query(
      "SELECT id FROM users WHERE role IN ('superadmin','admin','hrd') AND is_active = TRUE"
    );
    for (const a of admins) {
      await notify(
        a.id,
        'Pengajuan Lembur Baru ⏰',
        `${submitterName} mengajukan lembur pada ${date} (${Math.floor(durationMinutes / 60)}j ${durationMinutes % 60}m).${attachment ? ' Disertai foto bukti.' : ''} Menunggu persetujuan.`,
        'info'
      );
    }

    // Konfirmasi ke karyawan
    await notify(
      userId,
      'Pengajuan Lembur Terkirim ✅',
      `Pengajuan lembur kamu pada ${date} telah dikirim ke HRD.`,
      'info'
    );

    const { broadcastEvent, sendEventToUser, sendEventToRoles } = require('../utils/realtimeManager');
    broadcastEvent('overtime_update', { event: 'overtime_update', type: 'submit', userId });
    sendEventToUser(userId, 'notification_update', { event: 'notification_update', type: 'submit' });
    sendEventToRoles(['superadmin', 'admin', 'hrd'], 'notification_update', { event: 'notification_update', type: 'pending' });

    res.status(201).json({ success: true, message: 'Pengajuan lembur berhasil dikirim', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── GET MY OVERTIME (karyawan) ────────────────────────────────────────────────
const getMyOvertime = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ot.*, u.name as reviewer_name
       FROM overtime_requests ot
       LEFT JOIN users u ON ot.reviewed_by = u.id
       WHERE ot.user_id = ?
       ORDER BY ot.date DESC`,
      [req.user.id]
    );
    res.json({ success: true, overtimes: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── GET ALL OVERTIME (admin/HRD) ──────────────────────────────────────────────
const getAllOvertime = async (req, res) => {
  try {
    const { status, month, year } = req.query;
    let query = `
      SELECT ot.*, u.name as user_name, u.employee_id, u.department, u.position, u.avatar as user_avatar,
             rv.name as reviewer_name
      FROM overtime_requests ot
      JOIN users u ON ot.user_id = u.id
      LEFT JOIN users rv ON ot.reviewed_by = rv.id
      WHERE 1=1`;
    const params = [];

    if (status) { query += ' AND ot.status = ?'; params.push(status); }
    if (month)  { query += ' AND MONTH(ot.date) = ?'; params.push(month); }
    if (year)   { query += ' AND YEAR(ot.date) = ?'; params.push(year); }

    query += ' ORDER BY ot.created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json({ success: true, overtimes: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── REVIEW OVERTIME (HRD/admin) ───────────────────────────────────────────────
const reviewOvertime = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_notes } = req.body;

    if (!['approved', 'rejected'].includes(status))
      return res.status(400).json({ success: false, message: 'Status tidak valid' });

    const [rows] = await pool.query('SELECT * FROM overtime_requests WHERE id = ?', [id]);
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });

    const ot = rows[0];
    if (ot.status !== 'pending')
      return res.status(400).json({ success: false, message: 'Pengajuan sudah diproses' });

    await pool.query(
      'UPDATE overtime_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ? WHERE id = ?',
      [status, req.user.id, review_notes || null, id]
    );

    const hours = Math.floor(ot.duration_minutes / 60);
    const mins  = ot.duration_minutes % 60;
    const durLabel = hours > 0 ? `${hours} jam ${mins > 0 ? mins + ' menit' : ''}`.trim() : `${mins} menit`;

    await auditLog(req,
      status === 'approved' ? 'APPROVE_OVERTIME' : 'REJECT_OVERTIME',
      'overtime_request', id,
      `${status === 'approved' ? 'Menyetujui' : 'Menolak'} lembur ${ot.date} (${durLabel})${review_notes ? ` — ${review_notes}` : ''}`
    );

    const notifMsg = status === 'approved'
      ? `Pengajuan lembur kamu pada ${ot.date} (${durLabel}) telah disetujui HRD.`
      : `Pengajuan lembur kamu pada ${ot.date} ditolak HRD.${review_notes ? ` Catatan: ${review_notes}` : ''}`;

    await notify(
      ot.user_id,
      status === 'approved' ? 'Lembur Disetujui ✅' : 'Lembur Ditolak ❌',
      notifMsg,
      status === 'approved' ? 'success' : 'error'
    );

    const { broadcastEvent, sendEventToUser } = require('../utils/realtimeManager');
    broadcastEvent('overtime_update', { event: 'overtime_update', type: 'review', id });
    sendEventToUser(ot.user_id, 'overtime_update', { event: 'overtime_update', type: 'review', id });
    sendEventToUser(ot.user_id, 'notification_update', { event: 'notification_update', type: 'reviewed' });

    res.json({ success: true, message: `Pengajuan lembur berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── DELETE OVERTIME ───────────────────────────────────────────────────────────
const deleteOvertime = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM overtime_requests WHERE id = ?', [id]);
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });

    // Karyawan hanya bisa hapus miliknya sendiri yang masih pending
    if (req.user.role === 'employee') {
      if (rows[0].user_id !== req.user.id)
        return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
      if (rows[0].status !== 'pending')
        return res.status(400).json({ success: false, message: 'Hanya pengajuan pending yang bisa dibatalkan' });
    }

    // Hapus file lampiran jika ada
    if (rows[0].attachment) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../../uploads/overtime', rows[0].attachment);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM overtime_requests WHERE id = ?', [id]);
    await auditLog(req, 'DELETE_OVERTIME', 'overtime_request', id,
      `Menghapus pengajuan lembur ${rows[0].date} milik user ${rows[0].user_id}`);
    res.json({ success: true, message: 'Pengajuan lembur berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── GET OVERTIME REPORT (admin) ───────────────────────────────────────────────
const getOvertimeReport = async (req, res) => {
  try {
    const { month, year, start_date, end_date } = req.query;

    let dateFilter, params;

    if (start_date && end_date) {
      dateFilter = 'AND ot.date >= ? AND ot.date <= ?';
      params = [start_date, end_date];
    } else {
      const m = month || new Date().getMonth() + 1;
      const y = year  || new Date().getFullYear();
      dateFilter = 'AND MONTH(ot.date) = ? AND YEAR(ot.date) = ?';
      params = [m, y];
    }

    const [rows] = await pool.query(
      `SELECT ot.*, u.name as user_name, u.employee_id, u.department, u.position
       FROM overtime_requests ot
       JOIN users u ON ot.user_id = u.id
       WHERE ot.status = 'approved' ${dateFilter}
       ORDER BY ot.date`,
      params
    );

    // Rekap per karyawan
    const summary = {};
    rows.forEach(r => {
      if (!summary[r.user_id]) {
        summary[r.user_id] = {
          user_id: r.user_id, user_name: r.user_name,
          employee_id: r.employee_id, department: r.department,
          total_sessions: 0, total_minutes: 0, total_compensation: 0
        };
      }
      summary[r.user_id].total_sessions++;
      summary[r.user_id].total_minutes += r.duration_minutes;
    });

    // Hitung kompensasi jika tarif diset
    const [rateSetting] = await pool.query(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'overtime_rate_per_hour'"
    );
    const ratePerHour = parseFloat(rateSetting[0]?.setting_value || '0');
    if (ratePerHour > 0) {
      Object.values(summary).forEach(s => {
        s.total_compensation = Math.round((s.total_minutes / 60) * ratePerHour);
      });
    }

    res.json({ success: true, report: rows, summary: Object.values(summary), month, year, start_date, end_date, rate_per_hour: ratePerHour });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = {
  submitOvertime, getMyOvertime, getAllOvertime,
  reviewOvertime, deleteOvertime, getOvertimeReport
};
