import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Info, X, LogIn, LogOut, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import PageHeader from '../../components/ui/PageHeader';

const WEEKDAYS = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];

/** Warna & label status, disalin dari calendar_screen.dart di app mobile. */
const STATUS_COLORS = {
  present:     '#22C55E', // Hijau — Hadir/Tepat Waktu
  late:        '#EF4444', // Merah — Terlambat
  late_permit: '#14B8A6', // Toska — Izin Datang Terlambat
  early_leave: '#F97316', // Oranye — Izin Pulang Cepat
  leave:       '#60A5FA', // Biru muda — Cuti
  absent:      '#60A5FA', // Biru muda — Tidak Masuk
  sick:        '#A855F7', // Ungu — Izin Sakit
};

const STATUS_LABELS = {
  present:     'Hadir/Tepat Waktu',
  late:        'Terlambat',
  late_permit: 'Izin Datang Terlambat',
  early_leave: 'Izin Pulang Cepat',
  leave:       'Cuti',
  absent:      'Tidak Masuk',
  sick:        'Izin Sakit',
};

/** Satu status bisa punya dua penanda (mis. terlambat = hijau + merah). */
const indicatorsFor = (status) => {
  switch (status) {
    case 'present':     return ['#22C55E'];
    case 'late':        return ['#22C55E', '#EF4444'];
    case 'late_permit': return ['#22C55E', '#14B8A6'];
    case 'early_leave': return ['#22C55E', '#F97316'];
    case 'leave':
    case 'absent':      return ['#60A5FA'];
    case 'sick':        return ['#A855F7'];
    default:            return [];
  }
};

const REQUIREMENTS = [
  'Harus berada di area lokasi kerja yang ditentukan',
  'Wajib selfie foto saat absensi',
  'Wajah harus cocok dengan foto profil akun kamu',
  'Pastikan GPS aktif di perangkat kamu',
];

const safe = (p) => p.then((r) => r).catch(() => ({ data: {} }));

const ymd = (date) => format(date, 'yyyy-MM-dd');

const fmtTime = (value) => {
  if (!value) return '--:--';
  const part = String(value).includes('T')
    ? String(value).split('T')[1]?.slice(0, 5)
    : String(value).slice(0, 5);
  return part || '--:--';
};

export default function CalendarPage() {
  const { user } = useAuthStore();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [attendances, setAttendances] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [att, hol] = await Promise.all([
      safe(api.get(`/attendance/my?month=${cursor.getMonth() + 1}&year=${cursor.getFullYear()}`)),
      safe(api.get(`/holidays?year=${cursor.getFullYear()}`)),
    ]);
    setAttendances(att.data?.attendances || []);
    setHolidays(hol.data?.holidays || []);
    setLoading(false);
  }, [cursor]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const onUpdate = () => loadData();
    window.addEventListener('realtime-attendance', onUpdate);
    return () => window.removeEventListener('realtime-attendance', onUpdate);
  }, [loadData]);

  const attByDate = useMemo(() => {
    const map = new Map();
    for (const a of attendances) map.set(String(a.date).slice(0, 10), a);
    return map;
  }, [attendances]);

  const holidayByDate = useMemo(() => {
    const map = new Map();
    for (const h of holidays) map.set(String(h.date).slice(0, 10), h);
    return map;
  }, [holidays]);

  const counts = useMemo(() => {
    const c = (s) => attendances.filter((a) => a.status === s).length;
    return {
      present: c('present'), late: c('late'), latePermit: c('late_permit'),
      earlyLeave: c('early_leave'), leave: c('leave'), absent: c('absent'), sick: c('sick'),
    };
  }, [attendances]);

  // Susun sel kalender: penyeimbang awal bulan + tanggal.
  const weeks = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Minggu

    const cells = Array.from({ length: firstWeekday }, () => null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const shiftMonth = (delta) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const summary = [
    { label: 'Hadir/Tepat Waktu', count: counts.present, color: STATUS_COLORS.present },
    { label: 'Terlambat', count: counts.late, color: STATUS_COLORS.late },
    { label: 'Izin Datang Terlambat', count: counts.latePermit, color: STATUS_COLORS.late_permit },
    { label: 'Izin Pulang Cepat', count: counts.earlyLeave, color: STATUS_COLORS.early_leave },
    { label: 'Tidak Masuk/Cuti', count: counts.leave + counts.absent, color: STATUS_COLORS.leave },
    { label: 'Izin Sakit', count: counts.sick, color: STATUS_COLORS.sick },
  ];

  return (
    <div className="bg-[#F8F7F5] min-h-screen">
      <PageHeader
        title="Kalender Kehadiran"
        name={user?.name}
        meta={[user?.department, user?.position].filter(Boolean).join(' · ') || 'Karyawan'}
        avatar={{
          url: user?.avatar
            ? (user.avatar.startsWith('http') ? user.avatar : `/uploads/avatar/${user.avatar}`)
            : null,
          fallback: user?.name?.[0],
        }}
      />

      <div className="px-5 pt-5 pb-8 lg:px-8 lg:max-w-3xl lg:mx-auto space-y-4">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-[18px] border border-[#E7E5E4] animate-pulse" />
          ))
        ) : (
          <>
            {/* ── Kartu kalender ── */}
            <div className="bg-white rounded-[18px] border border-[#E7E5E4] shadow-[0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3">
                <button onClick={() => shiftMonth(-1)} aria-label="Bulan sebelumnya"
                  className="w-9 h-9 rounded-[10px] bg-stone-50 border border-[#E7E5E4] flex items-center justify-center hover:bg-stone-100 active:scale-95 transition-all">
                  <ChevronLeft size={20} className="text-stone-900" />
                </button>
                <h2 className="flex-1 text-center font-extrabold text-base text-stone-900">
                  {format(cursor, 'MMMM yyyy', { locale: localeId })}
                </h2>
                <button onClick={() => shiftMonth(1)} aria-label="Bulan berikutnya"
                  className="w-9 h-9 rounded-[10px] bg-stone-50 border border-[#E7E5E4] flex items-center justify-center hover:bg-stone-100 active:scale-95 transition-all">
                  <ChevronRight size={20} className="text-stone-900" />
                </button>
              </div>

              <div className="h-px bg-[#E7E5E4]" />

              <div className="pt-3.5 px-2.5 pb-3">
                {/* Nama hari */}
                <div className="grid grid-cols-7 px-1">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="text-center text-[10.5px] font-extrabold text-stone-400 tracking-wide">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Grid tanggal */}
                <div className="mt-2.5 space-y-1">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-1.5">
                      {week.map((date, di) => {
                        if (!date) return <div key={di} className="h-12" />;

                        const key = ymd(date);
                        const att = attByDate.get(key);
                        const holiday = holidayByDate.get(key);
                        const isToday = ymd(today) === key;
                        const isSunday = di === 0;
                        const redText = isSunday || !!holiday;

                        return (
                          <button
                            key={di}
                            onClick={att ? () => setDetail({ att, date, holiday }) : undefined}
                            disabled={!att}
                            title={holiday?.name || (att ? STATUS_LABELS[att.status] : undefined)}
                            className={`h-12 rounded-[10px] flex flex-col items-center justify-center transition-colors ${
                              att ? 'cursor-pointer hover:brightness-95' : 'cursor-default'
                            }`}
                            style={{
                              backgroundColor: isToday ? 'rgba(255,235,238,0.5)' : '#FAFAF9',
                              border: isToday ? '1.5px solid #8B1F1F' : '0.8px solid rgba(231,229,228,0.5)',
                            }}
                          >
                            <span className={`text-[13px] ${
                              isToday || att || holiday ? 'font-bold' : 'font-semibold'
                            }`} style={{ color: redText ? '#EF4444' : '#1C1917' }}>
                              {date.getDate()}
                            </span>

                            <span className="flex items-center gap-[3px] h-1 mt-1">
                              {att && indicatorsFor(att.status).map((color, idx) => (
                                <span key={idx} className="w-3 h-1 rounded-sm"
                                  style={{ backgroundColor: color }} />
                              ))}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Legenda ── */}
            <div className="bg-white rounded-2xl border border-[#E7E5E4] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4">
              <h3 className="font-bold text-sm text-stone-900 mb-3">Keterangan Warna</h3>
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-3">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-3.5 h-1.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[key] }} />
                    <span className="text-[11.5px] text-stone-600">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Ringkasan bulan ── */}
            <div className="rounded-2xl border p-4"
              style={{ backgroundColor: 'rgba(255,235,238,0.3)', borderColor: '#FFCDD2' }}>
              <div className="grid grid-cols-3 gap-y-3">
                {summary.map((s) => (
                  <div key={s.label} className="text-center px-1">
                    <div className="text-[22px] font-extrabold leading-none" style={{ color: s.color }}>
                      {s.count}
                    </div>
                    <div className="text-[10px] font-bold text-stone-600 mt-1 leading-tight">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Syarat absensi ── */}
            <div className="bg-white rounded-2xl border border-[#E7E5E4] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(139,31,31,0.08)' }}>
                  <Info size={16} style={{ color: '#8B1F1F' }} />
                </span>
                <h3 className="font-bold text-sm text-stone-900">Syarat Absensi</h3>
              </div>
              <ul className="mt-3.5 space-y-2.5">
                {REQUIREMENTS.map((req) => (
                  <li key={req} className="flex items-start gap-2.5">
                    <span className="w-[5px] h-[5px] rounded-full flex-shrink-0 mt-[7px]"
                      style={{ backgroundColor: '#8B1F1F' }} />
                    <span className="text-xs text-stone-600 font-medium leading-relaxed">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* ── Detail absensi satu tanggal ── */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setDetail(null)}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-sm p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-stone-900">
                    {format(detail.date, 'EEEE, d MMMM yyyy', { locale: localeId })}
                  </h3>
                  <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full mt-1.5"
                    style={{
                      backgroundColor: `${STATUS_COLORS[detail.att.status] || '#8B1F1F'}1A`,
                      color: STATUS_COLORS[detail.att.status] || '#8B1F1F',
                    }}>
                    {STATUS_LABELS[detail.att.status] || detail.att.status}
                  </span>
                </div>
                <button onClick={() => setDetail(null)} aria-label="Tutup"
                  className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center hover:bg-stone-200 transition-colors flex-shrink-0">
                  <X size={16} className="text-stone-500" />
                </button>
              </div>

              {detail.holiday && (
                <p className="mt-3 text-xs font-semibold px-3 py-2 rounded-xl bg-[#FEF2F2] text-red-600">
                  Hari libur: {detail.holiday.name}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl bg-stone-50 border border-[#E7E5E4] p-3">
                  <div className="flex items-center gap-1.5">
                    <LogIn size={13} style={{ color: '#22C55E' }} />
                    <span className="text-[11px] text-stone-400 font-medium">Masuk</span>
                  </div>
                  <div className="font-bold text-stone-900 mt-1">{fmtTime(detail.att.check_in)}</div>
                </div>
                <div className="rounded-xl bg-stone-50 border border-[#E7E5E4] p-3">
                  <div className="flex items-center gap-1.5">
                    <LogOut size={13} style={{ color: '#8B1F1F' }} />
                    <span className="text-[11px] text-stone-400 font-medium">Pulang</span>
                  </div>
                  <div className="font-bold text-stone-900 mt-1">{fmtTime(detail.att.check_out)}</div>
                </div>
              </div>

              {detail.att.location_name && (
                <div className="flex items-center gap-2 mt-3">
                  <MapPin size={14} className="text-stone-400 flex-shrink-0" />
                  <span className="text-xs text-stone-600">{detail.att.location_name}</span>
                </div>
              )}

              {detail.att.notes && (
                <p className="mt-3 text-xs text-stone-600 bg-stone-50 border border-[#E7E5E4] rounded-xl px-3 py-2.5 leading-relaxed">
                  {detail.att.notes}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
