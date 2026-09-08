// Helper perhitungan kontrak kerja (PKWT/PKWTT/Daily Worker).
// Semua turunan kontrak — tanggal berakhir, PKWT tahun ke-berapa, sisa hari —
// DIHITUNG sistem, bukan diinput manual oleh HR.

// Ambang reminder: kontrak masuk radar HR saat sisa <= 14 hari.
const REMINDER_DAYS_BEFORE = 14;

// Tanggal hari ini di WIB sebagai string YYYY-MM-DD.
const todayWIB = () => {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
};

// Hitung tanggal berakhir kontrak: start_date + durasi bulan - 1 hari.
// Contoh dari HRD: mulai 01/08/2026 durasi 6 bulan -> berakhir 31/01/2027
// (bukan 01/02/2027), karena hari terakhir kontrak masih hari kerja.
// Kalau tanggal mulai melebihi jumlah hari di bulan tujuan (mis. 31 Jan + 1 bulan),
// JS Date otomatis meluber ke bulan berikutnya, jadi di-clamp ke akhir bulan.
const calculateEndDate = (startDate, durationMonths) => {
  if (!startDate || !durationMonths) return null;

  const [y, m, d] = String(startDate).slice(0, 10).split('-').map(Number);

  // Hari terakhir kontrak = (tanggal mulai + durasi bulan) - 1 hari.
  // Dihitung sebagai "hari sebelum tanggal jatuh tempo" supaya kontrak yang
  // mulai tanggal 1 berakhir di akhir bulan (01/08 + 6 bln -> 31/01).
  const dueMonthIndex = (m - 1) + Number(durationMonths);
  const dueYear = y + Math.floor(dueMonthIndex / 12);
  const dueMonth = dueMonthIndex % 12;

  // Kalau tanggal mulai tidak ada di bulan jatuh tempo (mis. 31 Jan + 1 bulan
  // -> 31 Feb), pakai hari terakhir bulan itu sebagai akhir kontrak langsung,
  // tanpa mundur sehari — kontrak yang mulai di akhir bulan berakhir di akhir bulan.
  const daysInDueMonth = new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate();
  if (d > daysInDueMonth) {
    return new Date(Date.UTC(dueYear, dueMonth, daysInDueMonth)).toISOString().slice(0, 10);
  }

  const end = new Date(Date.UTC(dueYear, dueMonth, d));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
};

// Selisih hari dari hari ini ke tanggal berakhir. Positif = masih berjalan,
// 0 = berakhir hari ini, negatif = sudah lewat.
const daysUntil = (endDate) => {
  if (!endDate) return null;
  const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00Z`).getTime();
  const today = new Date(`${todayWIB()}T00:00:00Z`).getTime();
  return Math.round((end - today) / (24 * 60 * 60 * 1000));
};

// PKWT tahun ke-berapa. Dibaca dari akumulasi durasi kontrak PKWT sebelumnya,
// bukan dari input manual. Kontrak PKWT pertama = tahun ke-1; setiap akumulasi
// 12 bulan menaikkan satu tahun. Dibatasi 5 sesuai aturan HRD (maks PKWT 5 tahun).
const calculatePkwtYear = (previousPkwtMonths, currentDurationMonths = 0) => {
  const totalBefore = Number(previousPkwtMonths) || 0;
  const year = Math.floor(totalBefore / 12) + 1;
  return Math.min(year, 5);
};

// Status turunan kontrak untuk ditampilkan di tabel/dashboard.
const deriveContractState = (contract) => {
  if (!contract) {
    return { days_remaining: null, is_expiring_soon: false, is_expired: false, state_label: 'Tanpa Kontrak' };
  }
  // PKWTT tidak punya tanggal berakhir — karyawan tetap.
  if (contract.contract_type === 'PKWTT' || !contract.end_date) {
    return { days_remaining: null, is_expiring_soon: false, is_expired: false, state_label: 'Permanen' };
  }

  const days = daysUntil(contract.end_date);
  const isExpired = days < 0;
  const isExpiringSoon = !isExpired && days <= REMINDER_DAYS_BEFORE;

  return {
    days_remaining: days,
    is_expiring_soon: isExpiringSoon,
    is_expired: isExpired,
    state_label: isExpired ? 'Berakhir' : isExpiringSoon ? 'Segera Berakhir' : 'Aktif',
  };
};

// Format tampilan durasi, mis. 6 -> "6 Bulan"
const formatDuration = (months) => (months ? `${months} Bulan` : '-');

module.exports = {
  REMINDER_DAYS_BEFORE,
  todayWIB,
  calculateEndDate,
  daysUntil,
  calculatePkwtYear,
  deriveContractState,
  formatDuration,
};
