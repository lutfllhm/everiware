const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const realtimeManager = require('../utils/realtimeManager');

// Custom middleware to authenticate Token from Header OR Query Param (since EventSource in browser doesn't support headers)
const authenticateSSE = async (req, res, next) => {
  try {
    let token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [decoded.id]);
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Akun tidak ditemukan atau tidak aktif' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token tidak valid' });
  }
};

router.get('/stream', authenticateSSE, (req, res) => {
  realtimeManager.addClient(req.user.id, req.user.role, res);
});

module.exports = router;
