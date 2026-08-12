// Katalog fitur yang bisa diberikan sebagai akses granular ke user non-admin (role employee).
// Harus tetap sinkron dengan backend/src/constants/features.js
export const FEATURES = [
  { key: 'shifts.manage', label: 'Shift Kerja', description: 'Assign shift ke anggota divisi (tidak termasuk buat/ubah jenis shift)' },
];
