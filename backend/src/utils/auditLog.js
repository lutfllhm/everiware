const { pool } = require('../config/database');
const { generateId } = require('./helpers');

/**
 * Catat aksi admin ke audit_logs
 * @param {object} req       - Express request (untuk user & IP)
 * @param {string} action    - Nama aksi, misal 'APPROVE_LEAVE'
 * @param {string} targetType - Tipe target, misal 'leave_request'
 * @param {string} targetId  - ID record yang diubah
 * @param {string} description - Deskripsi singkat aksi
 */
const auditLog = async (req, action, targetType, targetId, description) => {
  try {
    const id = generateId();
    const userId   = req.user?.id   || 'system';
    const userName = req.user?.name || 'System';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
             || req.socket?.remoteAddress
             || null;

    await pool.query(
      `INSERT INTO audit_logs (id, user_id, user_name, action, target_type, target_id, description, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, userName, action, targetType, targetId || null, description || null, ip]
    );
  } catch (err) {
    // Audit log tidak boleh mengganggu flow utama
    console.error('[AuditLog Error]', err.message);
  }
};

module.exports = { auditLog };
