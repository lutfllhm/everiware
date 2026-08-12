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
// scoped=true  -> caller WAJIB filter hasil/aksi ke departmentId ini.
const resolveScope = (user) => {
  if (ADMIN_TIER_ROLES.includes(user.role)) {
    return { scoped: false, departmentId: null };
  }
  return { scoped: true, departmentId: user.department_id };
};

module.exports = { hasFeaturePermission, resolveScope };
