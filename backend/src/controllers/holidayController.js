const { pool } = require('../config/database');
const { generateId } = require('../utils/helpers');

// ── GET semua hari libur (bisa filter tahun) ──────────────────────────────────
const getHolidays = async (req, res) => {
  try {
    const { year } = req.query;
    let query = 'SELECT * FROM public_holidays WHERE 1=1';
    const params = [];
    if (year) { query += ' AND YEAR(date) = ?'; params.push(year); }
    query += ' ORDER BY date ASC';
    const [rows] = await pool.query(query, params);
    res.json({ success: true, holidays: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── GET hari libur untuk range tanggal (dipakai internal) ─────────────────────
const getHolidaysInRange = async (startDate, endDate) => {
  const [rows] = await pool.query(
    'SELECT date FROM public_holidays WHERE date >= ? AND date <= ?',
    [startDate, endDate]
  );
  return new Set(rows.map(r => r.date.toISOString().split('T')[0]));
};

// ── CEK apakah tanggal tertentu adalah hari libur ─────────────────────────────
const isHoliday = async (date) => {
  const [rows] = await pool.query(
    'SELECT id FROM public_holidays WHERE date = ?',
    [date]
  );
  return rows.length > 0;
};

// ── TAMBAH hari libur ─────────────────────────────────────────────────────────
const createHoliday = async (req, res) => {
  try {
    const { date, name, description } = req.body;
    if (!date || !name)
      return res.status(400).json({ success: false, message: 'Tanggal dan nama wajib diisi' });

    const [existing] = await pool.query('SELECT id FROM public_holidays WHERE date = ?', [date]);
    if (existing.length)
      return res.status(400).json({ success: false, message: 'Tanggal ini sudah terdaftar sebagai hari libur' });

    const id = generateId();
    await pool.query(
      'INSERT INTO public_holidays (id, date, name, description) VALUES (?, ?, ?, ?)',
      [id, date, name, description || null]
    );
    res.status(201).json({ success: true, message: 'Hari libur berhasil ditambahkan', id });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── UPDATE hari libur ─────────────────────────────────────────────────────────
const updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, name, description } = req.body;
    await pool.query(
      'UPDATE public_holidays SET date = ?, name = ?, description = ? WHERE id = ?',
      [date, name, description || null, id]
    );
    res.json({ success: true, message: 'Hari libur berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── HAPUS hari libur ──────────────────────────────────────────────────────────
const deleteHoliday = async (req, res) => {
  try {
    await pool.query('DELETE FROM public_holidays WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Hari libur berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── IMPORT MASSAL (paste dari daftar) ─────────────────────────────────────────
const bulkImportHolidays = async (req, res) => {
  try {
    const { holidays } = req.body; // array of { date, name, description }
    if (!Array.isArray(holidays) || !holidays.length)
      return res.status(400).json({ success: false, message: 'Data tidak valid' });

    let inserted = 0, skipped = 0;
    for (const h of holidays) {
      if (!h.date || !h.name) { skipped++; continue; }
      const [existing] = await pool.query('SELECT id FROM public_holidays WHERE date = ?', [h.date]);
      if (existing.length) { skipped++; continue; }
      const id = generateId();
      await pool.query(
        'INSERT INTO public_holidays (id, date, name, description) VALUES (?, ?, ?, ?)',
        [id, h.date, h.name, h.description || null]
      );
      inserted++;
    }
    res.json({ success: true, message: `${inserted} hari libur berhasil diimpor, ${skipped} dilewati (duplikat/invalid)` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = { getHolidays, getHolidaysInRange, isHoliday, createHoliday, updateHoliday, deleteHoliday, bulkImportHolidays };
