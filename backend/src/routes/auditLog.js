const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { pool } = require('../config/database');

router.use(authenticate);

// GET audit logs (superadmin & admin only)
router.get('/', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { action, user_id, target_type, limit = 100, offset = 0 } = req.query;
    let query = `
      SELECT al.*, u.role as user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1`;
    const params = [];

    if (action)      { query += ' AND al.action = ?';       params.push(action); }
    if (user_id)     { query += ' AND al.user_id = ?';      params.push(user_id); }
    if (target_type) { query += ' AND al.target_type = ?';  params.push(target_type); }

    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);

    // Total count
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams = [];
    if (action)      { countQuery += ' AND action = ?';       countParams.push(action); }
    if (user_id)     { countQuery += ' AND user_id = ?';      countParams.push(user_id); }
    if (target_type) { countQuery += ' AND target_type = ?';  countParams.push(target_type); }
    const [[{ total }]] = await pool.query(countQuery, countParams);

    res.json({ success: true, logs: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

module.exports = router;
