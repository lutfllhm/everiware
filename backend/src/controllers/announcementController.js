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

module.exports = { getAnnouncements, createAnnouncement };
