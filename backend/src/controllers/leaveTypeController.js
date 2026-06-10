const { pool } = require('../config/database');
const { generateId } = require('../utils/helpers');

const getLeaveTypes = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM leave_types ORDER BY created_at ASC');
    res.json({ success: true, leaveTypes: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

const getActiveLeaveTypes = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM leave_types WHERE is_active = TRUE ORDER BY created_at ASC');
    res.json({ success: true, leaveTypes: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

const createLeaveType = async (req, res) => {
  try {
    const { code, name, requires_attachment, deducts_quota, blocks_attendance, max_duration_minutes } = req.body;
    if (!code || !name)
      return res.status(400).json({ success: false, message: 'Kode dan nama wajib diisi' });

    const [existing] = await pool.query('SELECT id FROM leave_types WHERE code = ?', [code]);
    if (existing.length)
      return res.status(400).json({ success: false, message: 'Kode jenis izin sudah digunakan' });

    const id = generateId();
    await pool.query(
      'INSERT INTO leave_types (id, code, name, requires_attachment, deducts_quota, blocks_attendance, max_duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, code.toLowerCase().replace(/\s+/g, '_'), name, requires_attachment || false, deducts_quota || false, blocks_attendance !== undefined ? blocks_attendance : true, max_duration_minutes || null]
    );
    res.status(201).json({ success: true, message: 'Jenis izin berhasil ditambahkan', id });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

const updateLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, requires_attachment, deducts_quota, blocks_attendance, max_duration_minutes, is_active } = req.body;
    await pool.query(
      'UPDATE leave_types SET name = ?, requires_attachment = ?, deducts_quota = ?, blocks_attendance = ?, max_duration_minutes = ?, is_active = ? WHERE id = ?',
      [name, requires_attachment ?? false, deducts_quota ?? false, blocks_attendance !== undefined ? blocks_attendance : true, max_duration_minutes || null, is_active ?? true, id]
    );
    res.json({ success: true, message: 'Jenis izin berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

const deleteLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const [used] = await pool.query(
      'SELECT COUNT(*) as c FROM leave_requests lr JOIN leave_types lt ON lr.type = lt.code WHERE lt.id = ?', [id]
    );
    if (used[0].c > 0)
      return res.status(400).json({ success: false, message: 'Jenis izin sudah digunakan, tidak bisa dihapus' });
    await pool.query('DELETE FROM leave_types WHERE id = ?', [id]);
    res.json({ success: true, message: 'Jenis izin berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = { getLeaveTypes, getActiveLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType };
