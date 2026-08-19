const { pool } = require('../config/database');

const ADMIN_TIER_ROLES = ['superadmin', 'admin', 'hrd'];

const hasFeaturePermission = async (userId, featureKey) => {
  const [rows] = await pool.query(
    'SELECT 1 FROM user_feature_permissions WHERE user_id = ? AND feature_key = ? LIMIT 1',
    [userId, featureKey]
  );
  return rows.length > 0;
};

// scoped=false -> akses global (superadmin/admin/hrd), tidak perlu difilter.
// scoped=true  -> caller WAJIB filter hasil/aksi ke department (nama divisi) ini.
// Catatan: kolom users.department_id tidak pernah diisi di alur create/update user manapun —
// pembagian divisi di seluruh aplikasi memakai kolom users.department (string nama divisi).
const resolveScope = (user) => {
  if (ADMIN_TIER_ROLES.includes(user.role)) {
    return { scoped: false, department: null };
  }
  return { scoped: true, department: user.department };
};

module.exports = { hasFeaturePermission, resolveScope };
