const { pool } = require('../config/database');
const { generateId } = require('../utils/helpers');

// GET semua pengumuman perusahaan
const getAnnouncements = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM company_announcements ORDER BY created_at DESC LIMIT 50'
    );
    res.json({ success: true, announcements: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// TAMBAH pengumuman perusahaan baru
const createAnnouncement = async (req, res) => {
  try {
    const { title, content, type, is_holiday } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Judul dan konten pengumuman wajib diisi' });
    }

    const id = generateId();
    await pool.query(
      'INSERT INTO company_announcements (id, title, content, type, is_holiday) VALUES (?, ?, ?, ?, ?)',
      [id, title, content, type || 'info', (is_holiday === true || is_holiday === 'true') ? 1 : 0]
    );

    // Kirim event realtime agar aplikasi mobile tahu ada update pengumuman baru
    try {
      const { broadcastEvent } = require('../utils/realtimeManager');
      broadcastEvent('announcement_update', { event: 'announcement_update' });
    } catch (_) {}

    res.status(201).json({ success: true, message: 'Pengumuman perusahaan berhasil dibuat', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// UPDATE pengumuman perusahaan
const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, type, is_holiday } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Judul dan konten pengumuman wajib diisi' });
    }

    const [result] = await pool.query(
      'UPDATE company_announcements SET title = ?, content = ?, type = ?, is_holiday = ? WHERE id = ?',
      [title, content, type || 'info', (is_holiday === true || is_holiday === 'true' || is_holiday === 1) ? 1 : 0, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Pengumuman tidak ditemukan' });
    }

    // Kirim event realtime agar aplikasi mobile tahu ada update
    try {
      const { broadcastEvent } = require('../utils/realtimeManager');
      broadcastEvent('announcement_update', { event: 'announcement_update' });
    } catch (_) {}

    res.json({ success: true, message: 'Pengumuman perusahaan berhasil diperbarui' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// DELETE pengumuman perusahaan
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM company_announcements WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Pengumuman tidak ditemukan' });
    }

    // Kirim event realtime agar aplikasi mobile tahu ada update
    try {
      const { broadcastEvent } = require('../utils/realtimeManager');
      broadcastEvent('announcement_update', { event: 'announcement_update' });
    } catch (_) {}

    res.json({ success: true, message: 'Pengumuman perusahaan berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement };
