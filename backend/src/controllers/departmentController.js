const { pool } = require('../config/database');
const { generateId } = require('../utils/helpers');

// ── GET ALL DEPARTMENTS (dengan posisi) ───────────────────────────────────────
const getDepartments = async (req, res) => {
  try {
    const [depts] = await pool.query('SELECT * FROM departments WHERE is_active = TRUE ORDER BY name ASC');
    const [positions] = await pool.query('SELECT * FROM positions WHERE is_active = TRUE ORDER BY name ASC');

    // Gabungkan posisi ke dalam departemen masing-masing
    const result = depts.map(d => ({
      ...d,
      positions: positions.filter(p => p.department_id === d.id)
    }));

    res.json({ success: true, departments: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── GET ALL DEPARTMENTS (admin, termasuk nonaktif) ────────────────────────────
const getAllDepartments = async (req, res) => {
  try {
    const [depts] = await pool.query('SELECT * FROM departments ORDER BY name ASC');
    const [positions] = await pool.query('SELECT * FROM positions ORDER BY name ASC');

    const result = depts.map(d => ({
      ...d,
      positions: positions.filter(p => p.department_id === d.id)
    }));

    res.json({ success: true, departments: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── CREATE DEPARTMENT ─────────────────────────────────────────────────────────
const createDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Nama departemen wajib diisi' });

    const [existing] = await pool.query('SELECT id FROM departments WHERE name = ?', [name]);
    if (existing.length) return res.status(400).json({ success: false, message: 'Nama departemen sudah ada' });

    const id = generateId();
    await pool.query('INSERT INTO departments (id, name, description) VALUES (?, ?, ?)', [id, name, description || null]);
    res.status(201).json({ success: true, message: 'Departemen berhasil ditambahkan', id });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── UPDATE DEPARTMENT ─────────────────────────────────────────────────────────
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Nama departemen wajib diisi' });

    await pool.query(
      'UPDATE departments SET name = ?, description = ?, is_active = ? WHERE id = ?',
      [name, description || null, is_active !== undefined ? is_active : true, id]
    );
    res.json({ success: true, message: 'Departemen berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── DELETE DEPARTMENT ─────────────────────────────────────────────────────────
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const [used] = await pool.query("SELECT COUNT(*) as c FROM users WHERE department = (SELECT name FROM departments WHERE id = ?)", [id]);
    if (used[0].c > 0)
      return res.status(400).json({ success: false, message: `Departemen masih digunakan oleh ${used[0].c} karyawan` });

    await pool.query('DELETE FROM positions WHERE department_id = ?', [id]);
    await pool.query('DELETE FROM departments WHERE id = ?', [id]);
    res.json({ success: true, message: 'Departemen berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── CREATE POSITION ───────────────────────────────────────────────────────────
const createPosition = async (req, res) => {
  try {
    const { department_id, name, description } = req.body;
    if (!department_id || !name)
      return res.status(400).json({ success: false, message: 'Departemen dan nama jabatan wajib diisi' });

    const [deptRows] = await pool.query('SELECT id FROM departments WHERE id = ?', [department_id]);
    if (!deptRows.length) return res.status(404).json({ success: false, message: 'Departemen tidak ditemukan' });

    const [existing] = await pool.query('SELECT id FROM positions WHERE department_id = ? AND name = ?', [department_id, name]);
    if (existing.length) return res.status(400).json({ success: false, message: 'Jabatan sudah ada di departemen ini' });

    const id = generateId();
    await pool.query('INSERT INTO positions (id, department_id, name, description) VALUES (?, ?, ?, ?)', [id, department_id, name, description || null]);
    res.status(201).json({ success: true, message: 'Jabatan berhasil ditambahkan', id });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── UPDATE POSITION ───────────────────────────────────────────────────────────
const updatePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Nama jabatan wajib diisi' });

    await pool.query(
      'UPDATE positions SET name = ?, description = ?, is_active = ? WHERE id = ?',
      [name, description || null, is_active !== undefined ? is_active : true, id]
    );
    res.json({ success: true, message: 'Jabatan berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── DELETE POSITION ───────────────────────────────────────────────────────────
const deletePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const [posRows] = await pool.query('SELECT name FROM positions WHERE id = ?', [id]);
    if (!posRows.length) return res.status(404).json({ success: false, message: 'Jabatan tidak ditemukan' });

    const [used] = await pool.query("SELECT COUNT(*) as c FROM users WHERE position = ?", [posRows[0].name]);
    if (used[0].c > 0)
      return res.status(400).json({ success: false, message: `Jabatan masih digunakan oleh ${used[0].c} karyawan` });

    await pool.query('DELETE FROM positions WHERE id = ?', [id]);
    res.json({ success: true, message: 'Jabatan berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = {
  getDepartments, getAllDepartments,
  createDepartment, updateDepartment, deleteDepartment,
  createPosition, updatePosition, deletePosition
};
