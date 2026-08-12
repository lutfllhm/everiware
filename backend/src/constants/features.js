// Katalog fitur yang bisa diberikan sebagai akses granular ke user non-admin (role employee).
// feature_key di tabel user_feature_permissions divalidasi terhadap daftar ini.
const FEATURE_KEYS = [
  'shifts.manage', // Shift Kerja — assign shift ke anggota divisi (bukan buat/ubah jenis shift)
];

module.exports = { FEATURE_KEYS };
