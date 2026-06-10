const { pool } = require('../config/database');
const { generateId } = require('../utils/helpers');

// ── SHIFT CRUD ────────────────────────────────────────────────────────────────

const getShifts = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM work_shifts ORDER BY start_time ASC');
    res.json({ success: true, shifts: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

const createShift = async (req, res) => {
  try {
    const { name, start_time, end_time, late_tolerance } = req.body;
    if (!name || !start_time || !end_time)
      return res.status(400).json({ success: false, message: 'Nama, jam masuk, dan jam pulang wajib diisi' });
    const id = generateId();
    await pool.query(
      'INSERT INTO work_shifts (id, name, start_time, end_time, late_tolerance) VALUES (?, ?, ?, ?, ?)',
      [id, name, start_time, end_time, late_tolerance || 10]
    );
    res.status(201).json({ success: true, message: 'Shift berhasil ditambahkan', id });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

const updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, start_time, end_time, late_tolerance, is_active } = req.body;
    await pool.query(
      'UPDATE work_shifts SET name = ?, start_time = ?, end_time = ?, late_tolerance = ?, is_active = ? WHERE id = ?',
      [name, start_time, end_time, late_tolerance ?? 10, is_active ?? true, id]
    );
    res.json({ success: true, message: 'Shift berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    const [used] = await pool.query('SELECT COUNT(*) as c FROM user_shifts WHERE shift_id = ?', [id]);
    if (used[0].c > 0)
      return res.status(400).json({ success: false, message: 'Shift sedang digunakan oleh karyawan, tidak bisa dihapus' });
    await pool.query('DELETE FROM work_shifts WHERE id = ?', [id]);
    res.json({ success: true, message: 'Shift berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── USER SHIFT ASSIGNMENT ─────────────────────────────────────────────────────

const getUserShift = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const [rows] = await pool.query(
      `SELECT us.*, ws.name as shift_name, ws.start_time, ws.end_time, ws.late_tolerance
       FROM user_shifts us
       JOIN work_shifts ws ON us.shift_id = ws.id
       WHERE us.user_id = ?
       ORDER BY us.effective_date DESC LIMIT 1`,
      [userId]
    );
    // Fallback ke shift default jika tidak ada assignment
    if (!rows.length) {
      const [def] = await pool.query('SELECT * FROM work_shifts WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1');
      return res.json({ success: true, shift: def[0] || null });
    }
    res.json({ success: true, shift: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

const assignShift = async (req, res) => {
  try {
    const { user_id, shift_id, effective_date } = req.body;
    if (!user_id || !shift_id || !effective_date)
      return res.status(400).json({ success: false, message: 'user_id, shift_id, dan effective_date wajib diisi' });
    const id = generateId();
    await pool.query(
      'INSERT INTO user_shifts (id, user_id, shift_id, effective_date) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE shift_id = ?, effective_date = ?',
      [id, user_id, shift_id, effective_date, shift_id, effective_date]
    );
    res.json({ success: true, message: 'Shift karyawan berhasil diatur' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Bulk assign shift ke banyak karyawan sekaligus
const bulkAssignShift = async (req, res) => {
  try {
    const { user_ids, shift_id, effective_date } = req.body;
    if (!user_ids?.length || !shift_id || !effective_date)
      return res.status(400).json({ success: false, message: 'user_ids, shift_id, dan effective_date wajib diisi' });

    for (const uid of user_ids) {
      const id = generateId();
      await pool.query(
        'INSERT INTO user_shifts (id, user_id, shift_id, effective_date) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE shift_id = ?, effective_date = ?',
        [id, uid, shift_id, effective_date, shift_id, effective_date]
      );
    }
    res.json({ success: true, message: `Shift berhasil diatur untuk ${user_ids.length} karyawan` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Get all user-shift assignments (for admin table)
const getAllUserShifts = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id as user_id, u.name, u.employee_id, u.department, u.avatar,
              ws.id as shift_id, ws.name as shift_name, ws.start_time, ws.end_time,
              us.effective_date
       FROM users u
       LEFT JOIN user_shifts us ON u.id = us.user_id
         AND us.effective_date = (
           SELECT MAX(us2.effective_date) FROM user_shifts us2
           WHERE us2.user_id = u.id AND us2.effective_date <= CURDATE()
         )
       LEFT JOIN work_shifts ws ON us.shift_id = ws.id
       WHERE u.role = 'employee' AND u.is_active = TRUE
       ORDER BY u.name ASC`
    );
    res.json({ success: true, assignments: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = { getShifts, createShift, updateShift, deleteShift, getUserShift, assignShift, bulkAssignShift, getAllUserShifts };
