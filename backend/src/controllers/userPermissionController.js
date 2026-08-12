const { pool } = require('../config/database');
const { generateId } = require('../utils/helpers');
const { auditLog } = require('../utils/auditLog');
const { FEATURE_KEYS } = require('../constants/features');

const getUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT feature_key FROM user_feature_permissions WHERE user_id = ?',
      [id]
    );
    res.json({ success: true, permissions: rows.map(r => r.feature_key) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Replace-set: body { feature_keys: string[] } menggantikan seluruh grant user ini
const setUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { feature_keys } = req.body;
    if (!Array.isArray(feature_keys)) {
      return res.status(400).json({ success: false, message: 'feature_keys harus berupa array' });
    }
    const invalid = feature_keys.filter(k => !FEATURE_KEYS.includes(k));
    if (invalid.length) {
      return res.status(400).json({ success: false, message: `Fitur tidak dikenal: ${invalid.join(', ')}` });
    }

    const [existingRows] = await pool.query(
      'SELECT feature_key FROM user_feature_permissions WHERE user_id = ?',
      [id]
    );
    const existing = existingRows.map(r => r.feature_key);
    const toAdd = feature_keys.filter(k => !existing.includes(k));
    const toRemove = existing.filter(k => !feature_keys.includes(k));

    for (const featureKey of toAdd) {
      await pool.query(
        'INSERT INTO user_feature_permissions (id, user_id, feature_key, granted_by) VALUES (?, ?, ?, ?)',
        [generateId(), id, featureKey, req.user.id]
      );
      await auditLog(req, 'GRANT_PERMISSION', 'user', id, `Memberi akses fitur "${featureKey}"`);
    }
    for (const featureKey of toRemove) {
      await pool.query(
        'DELETE FROM user_feature_permissions WHERE user_id = ? AND feature_key = ?',
        [id, featureKey]
      );
      await auditLog(req, 'REVOKE_PERMISSION', 'user', id, `Mencabut akses fitur "${featureKey}"`);
    }

    res.json({ success: true, message: 'Akses berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = { getUserPermissions, setUserPermissions };
