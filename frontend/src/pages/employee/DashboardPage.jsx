import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Clock, MapPin, CheckCircle, AlertCircle, LogIn, LogOut, Circle,
  RefreshCw, Sun, Sunset, Moon, Briefcase, ClipboardCheck,
  PartyPopper, Info, XCircle, ChevronRight, LifeBuoy, Bell
} from 'lucide-react';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

// ── Menu layanan mandiri — disamakan persis dengan grid di app mobile ──
const menuItems = [
  { label: 'Izin\nTerlambat',      icon: '/menu/01_izin_terlambat.svg',      to: '/leave/late-permission' },
  { label: 'Izin Pulang\nCepat',   icon: '/menu/02_izin_pulang_cepat.svg',   to: '/leave/early-leave' },
  { label: 'Ajukan\nCuti',         icon: '/menu/03_ajukan_cuti.svg',         to: '/leave/annual' },
  { label: 'Izin\nSakit',          icon: '/menu/04_izin_sakit.svg',          to: '/leave/sick' },
  { label: 'Dinas Luar/\nKelilingan', icon: '/menu/05_dinas_luar.svg',       to: '/leave/dinas' },
  { label: 'Izin Keluar\nKantor',  icon: '/menu/06_izin_keluar_kantor.svg',  to: '/leave/leave-office' },
  { label: 'Ajukan\nLembur',       icon: '/menu/07_ajukan_lembur.svg',       to: '/overtime' },
  { label: 'Statistik\nUser',      icon: '/menu/08_statistik_user.svg',      to: '/attendance' },
];

const statusConfig = {
  present: { label: 'Hadir',       color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  late:    { label: 'Terlambat',   color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  absent:  { label: 'Tidak Hadir', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500' },
  leave:   { label: 'Cuti',        color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    dot: 'bg-blue-500' },
  sick:    { label: 'Sakit',       color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200',  dot: 'bg-purple-500' },
};

const requestStatusConfig = {
  pending:  { label: 'Menunggu',  color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  approved: { label: 'Disetujui', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  rejected: { label: 'Ditolak',   color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
};

// Quote harian — sama persis dengan _getMotivationalQuote() di mobile
const quotes = [
  'Semangat bekerja! Setiap usaha terbaikmu hari ini adalah bekal kesuksesan hari esok.',
  'Ayo berikan performa terbaikmu hari ini untuk masa depan yang lebih gemilang!',
  'Kesehatan dan keselamatan kerja adalah yang utama. Selamat beraktivitas!',
  'Fokus, kerja keras, dan konsistensi adalah kunci mencapai kesuksesan bersama.',
  'Jadikan hari ini lebih baik dari kemarin dengan dedikasi dan profesionalisme tinggi.',
  'Kerja sama tim yang solid melahirkan hasil yang luar biasa. Semangat!',
  'Setiap kontribusi kecilmu sangat berharga bagi kemajuan perusahaan.',
];

// Ambang batas jam sama dengan _getGreeting() di mobile (11 / 15 / 18)
const getGreeting = (h) => {
  if (h < 11) return { text: 'Selamat Pagi', Icon: Sun };
  if (h < 15) return { text: 'Selamat Siang', Icon: Sun };
  if (h < 18) return { text: 'Selamat Sore', Icon: Sunset };
  return { text: 'Selamat Malam', Icon: Moon };
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] },
});

const fmtTime = (v) => (v ? format(new Date(v), 'HH:mm') : '--:--');

// Backend mengirim start_time/end_time sebagai "08:00:00" — mobile menampilkannya
// apa adanya, jadi cukup potong detiknya supaya rapi.
const fmtShift = (v, fallback) => (v ? String(v).slice(0, 5) : fallback);

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [todayAtt, setTodayAtt] = useState(null);
  const [quota, setQuota] = useState(null);
  const [shift, setShift] = useState(null);
  const [monthAtt, setMonthAtt] = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [time, setTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    // Setiap endpoint dibungkus agar satu kegagalan tidak mengosongkan kartu lain.
    const safe = (p) => p.then(r => r.data).catch(() => null);
    const [att, q, hist, sh, lv, ann] = await Promise.all([
      safe(api.get('/attendance/today')),
      safe(api.get('/leave/quota')),
      safe(api.get('/attendance/my')),
      safe(api.get('/shifts/my')),
      safe(api.get('/leave/my')),
      safe(api.get('/announcements')),
    ]);
    if (att) setTodayAtt(att.attendance);
    if (q) setQuota(q.quota);
    if (hist) setMonthAtt(hist.attendances || []);
    if (sh) setShift(sh.shift || null);
    if (lv) setRecentLeaves((lv.leaves || []).slice(0, 3));
    if (ann) setAnnouncements((ann.announcements || []).slice(0, 5));
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    const handleUpdate = () => fetchData();
    const events = ['realtime-attendance', 'realtime-leave', 'realtime-overtime', 'realtime-notification'];
    events.forEach(e => window.addEventListener(e, handleUpdate));
    return () => events.forEach(e => window.removeEventListener(e, handleUpdate));
  }, [fetchData]);

  useAutoRefresh(fetchData, 30_000);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setTimeout(() => setRefreshing(false), 600);
  };

  const { text: greetingText, Icon: GreetIcon } = getGreeting(time.getHours());
  const quote = quotes[new Date().getDate() % quotes.length];

  const isCheckIn = Boolean(todayAtt?.check_in);
  const isCheckOut = Boolean(todayAtt?.check_out);
  const isLate = todayAtt?.status === 'late';

  // Rekap bulan berjalan — dihitung dari riwayat absensi seperti di mobile.
  const now = new Date();
  const thisMonth = monthAtt.filter(a => {
    const d = new Date(a.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const presentCount = thisMonth.filter(a => a.status === 'present').length;
  const lateCount = thisMonth.filter(a => a.status === 'late').length;
  const leaveSickCount = thisMonth.filter(a => a.status === 'leave' || a.status === 'sick').length;
  const totalDays = presentCount + lateCount + leaveSickCount;
  const attendanceRate = totalDays > 0 ? (presentCount + lateCount) / totalDays : 1;
  const ratePct = Math.round(attendanceRate * 100);
  const rateColor = attendanceRate >= 0.9 ? '#16A34A' : attendanceRate >= 0.75 ? '#D97706' : '#DC2626';

  // Badge status kehadiran di kartu shift
  const attendanceBadge = !isCheckIn
    ? { label: 'Belum Hadir', cls: 'bg-slate-100 text-slate-500' }
    : isCheckOut
      ? { label: 'Selesai', cls: 'bg-[#FFEBEE] text-[#8B1F1F]' }
      : isLate
        ? { label: 'Terlambat', cls: 'bg-amber-50 text-amber-700' }
        : { label: 'Hadir', cls: 'bg-emerald-50 text-emerald-700' };

  const shiftName = shift?.name || shift?.shift_name || 'Shift Reguler';
  const shiftStart = fmtShift(shift?.start_time, '08:00');
  const shiftEnd = fmtShift(shift?.end_time, '17:00');

  const quotaTotal = Number(quota?.total_days ?? 0);
  const quotaUsed = Number(quota?.used_days ?? 0);
  const quotaRemaining = Number(quota?.remaining_days ?? 0);
  const quotaPct = quotaTotal > 0 ? Math.min((quotaUsed / quotaTotal) * 100, 100) : 0;

  return (
    <div className="bg-[#F6F8FD] min-h-screen -m-px">

      {/* ── Header: foto latar + overlay gelap, identik dengan mobile ── */}
      <div
        className="relative rounded-b-[28px] overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: 'url(/bg-apk.jpg)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/[0.65] to-black/40" />

        <div className="relative px-5 pt-4 pb-6 lg:px-8 lg:pt-6 lg:pb-8">
          {/* Baris atas: logo + tanggal */}
          <div className="flex items-center justify-between">
            <div className="flex items-center text-white font-black italic text-lg tracking-tight">
              EV
              <img src="/iwaa.png" alt="" className="w-[22px] h-[22px] mx-[3px] object-contain" />
              RIWARE
            </div>
            <div className="flex items-center gap-2.5">
              <Link
                to="/notifications"
                className="w-[38px] h-[38px] rounded-xl bg-white/20 border border-white/[0.12] flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <Bell size={20} className="text-white" />
              </Link>
              <span className="text-white text-[11px] font-medium">
                {format(time, 'EEEE, d MMM yyyy', { locale: id })}
              </span>
            </div>
          </div>

          {/* Profil + salam */}
          <div className="mt-5 flex items-center gap-3.5">
            <div className="w-[60px] h-[60px] rounded-full border-2 border-white shadow-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#8B1F1F] to-[#EF5350] flex items-center justify-center">
              {user?.avatar
                ? <img src={`/uploads/avatar/${user.avatar}`} alt="" className="w-full h-full object-cover" />
                : <span className="text-white font-black text-xl">{user?.name?.[0]}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <GreetIcon size={15} className="text-[#FFD54F]" />
                <span className="text-white/85 text-[12.5px] font-medium">{greetingText}</span>
              </div>
              <h2 className="text-white text-lg font-black tracking-tight truncate mt-0.5">
                {user?.name || 'Karyawan'}
              </h2>
              <p className="text-white/70 text-[11px] truncate">
                {[user?.department, user?.position].filter(Boolean).join(' · ') || '-'}
              </p>
            </div>

            {/* Jam + refresh — pemanfaatan ruang lebar khas desktop */}
            <div className="hidden lg:flex items-center gap-3">
              <button
                onClick={handleManualRefresh}
                title="Refresh data"
                className="w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl flex items-center justify-center transition-all active:scale-95"
              >
                <RefreshCw size={16} className={`text-white ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <div className="bg-white/10 border border-white/20 rounded-2xl px-5 py-3 text-center">
                <div className="text-3xl font-bold font-mono tabular-nums text-white leading-none">
                  {format(time, 'HH:mm')}
                </div>
                {lastUpdated && (
                  <div className="text-white/60 text-[10px] mt-1.5">
                    Update {format(lastUpdated, 'HH:mm:ss')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Banner quote */}
          <div className="mt-3 rounded-xl bg-white/[0.08] border border-white/[0.05] px-3 py-2">
            <p className="text-white/90 text-[10.5px] italic leading-relaxed">{quote}</p>
          </div>

          {/* Tombol absen masuk / pulang — gaya 3D bevel seperti mobile */}
          <div className="mt-4 grid grid-cols-2 gap-4 lg:max-w-md">
            {[
              { title: 'Absen Masuk', icon: '/menu/masuk_top.png' },
              { title: 'Absen Pulang', icon: '/menu/keluar_top.png' },
            ].map(btn => (
              <Link
                key={btn.title}
                to="/attendance"
                className="h-[90px] rounded-2xl flex flex-col items-center justify-center border transition-transform active:scale-[0.94]"
                style={{
                  background: 'linear-gradient(135deg, #8B1F1F 0%, #5A0F11 50%, #360507 100%)',
                  borderColor: 'rgba(139,31,31,0.55)',
                  boxShadow: '0 6px 10px rgba(22,1,2,0.3), 0 3px 0 rgba(22,1,2,0.7)',
                }}
              >
                <img src={btn.icon} alt="" className="w-12 h-12 object-contain" />
                <span className="text-white text-xs font-bold mt-1">{btn.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Konten ── */}
      <div className="px-4 py-5 lg:px-6 space-y-5">

        {/* Kartu shift & absensi hari ini */}
        <motion.div {...fadeUp(0.05)} className="card-mobile p-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[10px] bg-[#FFEBEE] flex-shrink-0">
              <Briefcase size={18} className="text-[#8B1F1F]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-stone-400 tracking-wide">SHIFT JADWAL KERJA</div>
              <div className="text-[13px] font-extrabold text-stone-900 truncate">
                {shiftName} ({shiftStart} - {shiftEnd})
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${attendanceBadge.cls}`}>
              {attendanceBadge.label}
            </span>
          </div>

          {/* Panel jam masuk & pulang */}
          <div className="mt-4 rounded-[14px] bg-[#FAFAF9] border border-stone-100 px-3.5 py-3 flex items-center">
            <div className="flex-1 flex items-center gap-2.5 min-w-0">
              <div className={`p-1.5 rounded-full flex-shrink-0 ${isCheckIn ? (isLate ? 'bg-amber-50' : 'bg-emerald-50') : 'bg-stone-50'}`}>
                {isCheckIn
                  ? (isLate ? <AlertCircle size={16} className="text-amber-600" /> : <CheckCircle size={16} className="text-emerald-600" />)
                  : <LogIn size={16} className="text-stone-400" />}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-stone-400">Absen Masuk</div>
                <div className={`text-base font-black tracking-tight ${isCheckIn ? 'text-emerald-600' : 'text-stone-900/40'}`}>
                  {fmtTime(todayAtt?.check_in)}
                </div>
              </div>
            </div>

            <div className="w-px h-8 bg-stone-200 mx-3" />

            <div className="flex-1 flex items-center gap-2.5 min-w-0">
              <div className={`p-1.5 rounded-full flex-shrink-0 ${isCheckOut ? 'bg-[#FFEBEE]' : isCheckIn ? 'bg-amber-50' : 'bg-stone-50'}`}>
                {isCheckOut
                  ? <CheckCircle size={16} className="text-[#8B1F1F]" />
                  : isCheckIn
                    ? <LogOut size={16} className="text-amber-500" />
                    : <Circle size={16} className="text-stone-400" />}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-stone-400">Absen Pulang</div>
                <div className={`text-base font-black tracking-tight ${isCheckOut ? 'text-[#8B1F1F]' : isCheckIn ? 'text-amber-500' : 'text-stone-900/40'}`}>
                  {fmtTime(todayAtt?.check_out)}
                </div>
              </div>
            </div>
          </div>

          {isCheckIn && todayAtt?.location_name && (
            <div className="mt-2.5 flex items-center gap-1.5">
              <MapPin size={13} className="text-red-600 flex-shrink-0" />
              <span className="text-[10px] text-stone-600 font-medium truncate">
                Absen masuk di: {todayAtt.location_name}
              </span>
            </div>
          )}

          {!isCheckIn && (
            <Link
              to="/attendance"
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-transform active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #8B1F1F, #EF5350)' }}
            >
              <Clock size={15} /> Absen Sekarang
            </Link>
          )}
        </motion.div>

        {/* Menu layanan mandiri */}
        <motion.div {...fadeUp(0.1)}>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="section-bar" />
            <h3 className="text-[14.5px] font-extrabold text-stone-900 tracking-tight">Menu Layanan Mandiri</h3>
          </div>
          <div className="grid grid-cols-4 gap-x-2 gap-y-4 lg:grid-cols-8">
            {menuItems.map(item => (
              <Link
                key={item.label}
                to={item.to}
                className="flex flex-col items-center transition-transform active:scale-[0.92] hover:-translate-y-0.5"
              >
                <img src={item.icon} alt="" className="w-[62px] h-[62px] object-contain" />
                <span className="mt-1.5 text-[11px] font-bold text-stone-600 text-center leading-tight whitespace-pre-line">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Analisis kehadiran bulanan */}
        <motion.div {...fadeUp(0.12)} className="card-mobile p-[18px]">
          <div className="flex items-center gap-2.5">
            <span className="section-bar" />
            <h3 className="text-[14.5px] font-extrabold text-stone-900 tracking-tight">
              Analisis Kehadiran Bulanan ({format(now, 'MMMM', { locale: id })})
            </h3>
          </div>

          <div className="mt-[18px] flex items-center gap-4">
            {/* Cincin progres rasio kehadiran */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#E7E5E4" strokeWidth="6.5" />
                <motion.circle
                  cx="40" cy="40" r="36" fill="none"
                  stroke={rateColor} strokeWidth="6.5" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 36}
                  initial={{ strokeDashoffset: 2 * Math.PI * 36 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 36 * (1 - attendanceRate) }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-black tracking-tight leading-none" style={{ color: rateColor }}>
                  {ratePct}%
                </span>
                <span className="text-[9px] font-extrabold text-stone-400 mt-0.5">Rasio</span>
              </div>
            </div>

            {/* Mini stat */}
            <div className="flex-1 grid grid-cols-3 gap-1.5">
              {[
                { icon: CheckCircle,     value: presentCount,   label: 'Hadir',      color: '#16A34A', bg: '#F0FDF4' },
                { icon: AlertCircle,     value: lateCount,      label: 'Terlambat',  color: '#D97706', bg: '#FFFBEB' },
                { icon: ClipboardCheck,  value: leaveSickCount, label: 'Izin/Sakit', color: '#0284C7', bg: '#F0F9FF' },
              ].map(s => (
                <div key={s.label} className="rounded-xl px-2 py-2.5 text-center" style={{ background: s.bg }}>
                  <s.icon size={15} className="mx-auto" style={{ color: s.color }} />
                  <div className="text-lg font-black mt-1 leading-none" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[9.5px] font-bold text-stone-500 mt-1 leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Alokasi & sisa cuti */}
        {quota && (
          <motion.div {...fadeUp(0.14)} className="card-mobile p-5">
            <div className="flex items-center gap-2.5">
              <span className="section-bar" />
              <h3 className="text-[14.5px] font-extrabold text-stone-900 tracking-tight">Alokasi &amp; Sisa Cuti Tahunan</h3>
            </div>

            <div className="mt-[22px] flex items-start">
              <div className="flex-1 text-center">
                <div className="text-2xl font-black text-stone-900 tabular-nums leading-none">{quotaTotal}</div>
                <div className="text-[11px] text-stone-500 mt-1.5">Total Kuota</div>
              </div>
              <div className="w-px h-[34px] bg-stone-200 mt-0.5" />
              <div className="flex-1 text-center">
                <div className="text-2xl font-black text-stone-900 tabular-nums leading-none">{quotaUsed}</div>
                <div className="text-[11px] text-stone-500 mt-1.5">Terpakai</div>
              </div>
              <div className="w-px h-[34px] bg-stone-200 mt-0.5" />
              <div className="flex-1 text-center">
                <div className="text-2xl font-black text-[#8B1F1F] tabular-nums leading-none">{quotaRemaining}</div>
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-[#FFEBEE] text-[#8B1F1F] text-[10px] font-extrabold">
                  Sisa Cuti
                </span>
              </div>
            </div>

            <div className="mt-[22px] h-[9px] rounded-lg bg-stone-100 overflow-hidden">
              <motion.div
                className="h-full rounded-lg"
                style={{ background: 'linear-gradient(135deg, #8B1F1F, #EF5350)' }}
                initial={{ width: 0 }}
                animate={{ width: `${quotaPct}%` }}
                transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-[11px] text-stone-600 font-medium">
                Terpakai {quotaUsed} dari {quotaTotal} hari
              </span>
              <span className="text-[11px] text-stone-900 font-extrabold">{Math.round(quotaPct)}%</span>
            </div>

            <Link
              to="/leave/annual"
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-[#FFCDD2] text-[#8B1F1F] hover:bg-[#FFEBEE] transition-all text-sm font-semibold"
            >
              Ajukan Cuti <ChevronRight size={15} />
            </Link>
          </motion.div>
        )}

        {/* Pengumuman perusahaan */}
        {announcements.length > 0 && (
          <motion.div {...fadeUp(0.16)}>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="section-bar" />
              <h3 className="text-[14.5px] font-extrabold text-stone-900 tracking-tight">Pengumuman Perusahaan</h3>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {announcements.map((a, i) => {
                const isHoliday = a.is_holiday === 1 || a.is_holiday === true || a.is_holiday === 'true';
                const type = String(a.type || 'info').toLowerCase();
                const style = isHoliday
                  ? { Icon: PartyPopper, color: '#F59E0B' }
                  : type === 'success' ? { Icon: CheckCircle, color: '#16A34A' }
                  : type === 'warning' ? { Icon: AlertCircle, color: '#D97706' }
                  : type === 'error'   ? { Icon: XCircle, color: '#DC2626' }
                  : { Icon: Info, color: '#1D4ED8' };
                return (
                  <div key={a.id ?? i} className="card-mobile p-4 flex gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${style.color}1A` }}
                    >
                      <style.Icon size={17} style={{ color: style.color }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-extrabold text-stone-900">{a.title}</div>
                      <p className="text-[11.5px] text-stone-600 mt-1 leading-relaxed line-clamp-3">{a.content}</p>
                      {a.created_at && (
                        <div className="text-[10px] text-stone-400 mt-1.5">
                          {format(new Date(a.created_at), 'd MMM yyyy', { locale: id })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Pengajuan terakhir */}
        {recentLeaves.length > 0 && (
          <motion.div {...fadeUp(0.18)}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="section-bar" />
                <h3 className="text-[14.5px] font-extrabold text-stone-900 tracking-tight">Pengajuan Terakhir</h3>
              </div>
              <Link to="/leave" className="text-[12px] font-semibold text-[#8B1F1F] hover:underline flex items-center gap-0.5">
                Lihat semua <ChevronRight size={14} />
              </Link>
            </div>
            <div className="card-mobile divide-y divide-stone-100">
              {recentLeaves.map(lv => {
                const s = requestStatusConfig[lv.status] || requestStatusConfig.pending;
                return (
                  <div key={lv.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-200 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-stone-800 leading-none">
                        {format(new Date(lv.start_date), 'd')}
                      </span>
                      <span className="text-[9px] text-stone-400 font-semibold uppercase">
                        {format(new Date(lv.start_date), 'MMM', { locale: id })}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-stone-900 truncate">{lv.reason}</div>
                      <div className="text-[11px] text-stone-400 mt-0.5">{lv.total_days} hari</div>
                    </div>
                    <span className={`${s.bg} ${s.color} border ${s.border} px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Riwayat absensi terakhir */}
        {thisMonth.length > 0 && (
          <motion.div {...fadeUp(0.2)}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="section-bar" />
                <h3 className="text-[14.5px] font-extrabold text-stone-900 tracking-tight">Riwayat Absensi</h3>
              </div>
              <Link to="/attendance" className="text-[12px] font-semibold text-[#8B1F1F] hover:underline flex items-center gap-0.5">
                Lihat semua <ChevronRight size={14} />
              </Link>
            </div>
            <div className="card-mobile divide-y divide-stone-100">
              {monthAtt.slice(0, 7).map(att => {
                const s = statusConfig[att.status] || statusConfig.present;
                return (
                  <div key={att.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-200 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-stone-800 leading-none">{format(new Date(att.date), 'd')}</span>
                        <span className="text-[9px] text-stone-400 font-semibold uppercase">
                          {format(new Date(att.date), 'MMM', { locale: id })}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-stone-900">
                          {format(new Date(att.date), 'EEEE', { locale: id })}
                        </div>
                        <div className="text-[11px] text-stone-400 flex items-center gap-1.5 mt-0.5 font-mono">
                          <Clock size={10} />
                          {fmtTime(att.check_in)} – {fmtTime(att.check_out)}
                        </div>
                      </div>
                    </div>
                    <span className={`${s.bg} ${s.color} border ${s.border} px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 flex-shrink-0`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Banner bantuan */}
        <motion.div
          {...fadeUp(0.22)}
          className="rounded-2xl p-4 flex items-center gap-3.5 text-white"
          style={{ background: 'linear-gradient(135deg, #4A0808, #8B1F1F, #EF5350)' }}
        >
          <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0">
            <LifeBuoy size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">Butuh bantuan?</div>
            <p className="text-[11.5px] text-white/75 mt-0.5">
              Hubungi HRD bila ada kendala absensi atau pengajuan izin.
            </p>
          </div>
          <Link
            to="/profile"
            className="text-[12px] font-semibold bg-white/15 border border-white/20 rounded-xl px-3.5 py-2 hover:bg-white/25 transition-colors flex-shrink-0"
          >
            Profil
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
