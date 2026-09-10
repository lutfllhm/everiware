// Daftar role dan pengelompokannya.
//
// Sistem ini dibagi dua tier:
//   - ADMIN_ROLES    : pemegang akses panel admin (authorize() memakai daftar ini)
//   - EMPLOYEE_ROLES : karyawan biasa — muncul di absensi, laporan, export,
//                      broadcast, jatah cuti, dan penugasan shift.
//
// 'gm' (General Manager) dan 'spv' (SPV/PIC) sengaja masuk employee-tier: role
// tersebut penanda jabatan struktural / atasan untuk approval, bukan pemberi
// akses admin. Karena itu keduanya WAJIB ikut terhitung sebagai karyawan —
// kalau tidak, mereka hilang dari laporan absensi dan tidak dapat jatah cuti.
const ADMIN_ROLES = ['superadmin', 'admin', 'hrd'];
const EMPLOYEE_ROLES = ['employee', 'gm', 'spv'];

// Potongan SQL siap tempel untuk query yang dulunya menulis `role = 'employee'`.
// Dipakai apa adanya (bukan parameter) karena isinya konstanta internal, bukan
// input user. Contoh: `WHERE u.${EMPLOYEE_ROLE_SQL('u')} AND u.is_active = TRUE`
const EMPLOYEE_ROLE_SQL = (alias) => {
  const col = alias ? `${alias}.role` : 'role';
  return `${col} IN (${EMPLOYEE_ROLES.map(r => `'${r}'`).join(',')})`;
};

module.exports = { ADMIN_ROLES, EMPLOYEE_ROLES, EMPLOYEE_ROLE_SQL };
