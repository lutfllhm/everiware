import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Users, Clock, RefreshCw,
  ChevronLeft, ChevronRight, UserCheck, UserX, X
} from 'lucide-react';
import api from '../../api/axios';
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  eachDayOfInterval, isToday, parseISO, isSameMonth
} from 'date-fns';
import { id } from 'date-fns/locale';
import UserAvatar from '../../components/ui/UserAvatar';

// ── Warna per jenis izin ──────────────────────────────────────────────────────
const leaveColors = {
  annual:     { dot: 'bg-sky-500',    pill: 'bg-sky-100 text-sky-700 border-sky-200',    label: 'Cuti Tahunan' },
  sick:       { dot: 'bg-purple-500', pill: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Izin Sakit' },
  permission: { dot: 'bg-amber-500',  pill: 'bg-amber-100 text-amber-700 border-amber-200',  label: 'Izin' },
  wfh:        { dot: 'bg-teal-500',   pill: 'bg-teal-100 text-teal-700 border-teal-200',   label: 'WFH' },
  dinas:      { dot: 'bg-orange-500', pill: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Dinas Luar' },
};

const DAY_HEADERS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const statusConfig = {
  present: { label: 'Hadir',     cls: 'badge-success' },
  late:    { label: 'Terlambat', cls: 'badge-warning' },
  leave:   { label: 'Cuti',      cls: 'badge-info' },
  sick:    { label: 'Sakit',     cls: 'badge-purple' },
  absent:  { label: 'Absen',     cls: 'badge-danger' },
};

export default function TeamCalendarAdmin() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [data, setData] = useState({ onLeave: [], todayAttendance: [], notYetCheckedIn: [] });
  const [holidays, setHolidays] = useState(new Set()); // set of 'yyyy-MM-dd'
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('calendar');
  const [selectedDay, setSelectedDay] = useState(null); // { date, leaves, isHoliday, holidayName }

  // Hitung range kalender (termasuk padding minggu pertama & terakhir)
  const monthStart  = startOfMonth(currentMonth);
  const monthEnd    = endOfMonth(currentMonth);
  const calStart    = startOfWeek(monthStart, { weekStartsOn: 0 }); // Minggu
  const calEnd      = endOfWeek(monthEnd,   { weekStartsOn: 0 });
  const calDays     = eachDayOfInterval({ start: calStart, end: calEnd });

  useEffect(() => { fetchData(); fetchHolidays(); }, [currentMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const from = format(calStart, 'yyyy-MM-dd');
      const to   = format(calEnd,   'yyyy-MM-dd');
      const { data: res } = await api.get(`/leave/team-calendar?start_date=${from}&end_date=${to}`);
      setData(res);
    } catch {} finally { setLoading(false); }
  };

  const fetchHolidays = async () => {
    try {
      const year = format(currentMonth, 'yyyy');
      const { data: res } = await api.get(`/holidays?year=${year}`);
      const set = new Set(
        (res.holidays || []).map(h => h.date?.split('T')[0])
      );
      setHolidays(set);
    } catch {}
  };

  const prevMonth = () => setCurrentMonth(m => subMonths(m, 1));
  const nextMonth = () => setCurrentMonth(m => addMonths(m, 1));
  const goToday   = () => setCurrentMonth(new Date());

  // Cuti yang aktif pada hari tertentu
  const getLeavesOnDay = (day) =>
    data.onLeave.filter(l => {
      const s = parseISO(l.start_date);
      const e = parseISO(l.end_date);
      return day >= s && day <= e;
    });

  const getHolidayName = (dateStr) => {
    // Cari nama dari data holidays (kita simpan sebagai map)
    return null; // nama sudah di-handle via tooltip
  };

  const handleDayClick = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const leaves  = getLeavesOnDay(day);
    const isHol   = holidays.has(dateStr);
    setSelectedDay({ date: day, dateStr, leaves, isHoliday: isHol });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">Kalender Tim</h2>
          <p className="text-slate-500 text-sm">Pantau kehadiran & izin seluruh karyawan</p>
        </div>
        <button onClick={() => { fetchData(); fetchHolidays(); }}
          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
          <RefreshCw size={16} className={`text-slate-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tab */}
      <div className="flex bg-slate-100 rounded-2xl p-1 w-fit">
        {[{ key: 'calendar', label: 'Kalender Bulanan', icon: Calendar },
          { key: 'today',    label: 'Status Hari Ini',  icon: Users }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
              ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          KALENDER BULANAN
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'calendar' && (
        <div className="space-y-3">

          {/* Navigasi bulan */}
          <div className="flex items-center gap-2">
            <button onClick={prevMonth}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <ChevronLeft size={18} className="text-slate-600" />
            </button>
            <div className="flex-1 text-center">
              <span className="font-bold text-slate-900 text-base">
                {format(currentMonth, 'MMMM yyyy', { locale: id })}
              </span>
            </div>
            <button onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <ChevronRight size={18} className="text-slate-600" />
            </button>
            <button onClick={goToday}
              className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-700 transition-colors">
              Hari Ini
            </button>
          </div>

          {/* Grid kalender */}
          <div className="card overflow-hidden">

            {/* Header hari */}
            <div className="grid grid-cols-7 border-b border-slate-200">
              {DAY_HEADERS.map((d, i) => (
                <div key={d}
                  className={`py-2.5 text-center text-xs font-bold uppercase tracking-wide
                    ${i === 0 ? 'text-red-500' : i === 6 ? 'text-amber-600' : 'text-slate-500'}`}>
                  {d}
                </div>
              ))}
            </div>

            {/* Baris tanggal */}
            <div className="grid grid-cols-7">
              {calDays.map((day, idx) => {
                const dateStr    = format(day, 'yyyy-MM-dd');
                const inMonth    = isSameMonth(day, currentMonth);
                const today      = isToday(day);
                const isSun      = day.getDay() === 0;
                const isSat      = day.getDay() === 6;
                const isHol      = holidays.has(dateStr);
                const dayLeaves  = getLeavesOnDay(day);
                const MAX_SHOW   = 3;

                return (
                  <div
                    key={dateStr}
                    onClick={() => inMonth && handleDayClick(day)}
                    className={[
                      'min-h-[90px] p-1.5 border-b border-r border-slate-100',
                      'last:border-r-0',
                      idx % 7 === 6 ? 'border-r-0' : '',
                      inMonth ? 'cursor-pointer hover:bg-slate-50 transition-colors' : 'bg-slate-50/50',
                      today ? 'bg-slate-900 hover:bg-slate-800' : '',
                      !today && isSun && inMonth ? 'bg-red-50/40' : '',
                      !today && isSat && inMonth ? 'bg-amber-50/40' : '',
                      !today && isHol && inMonth ? 'bg-red-50/60' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {/* Nomor tanggal */}
                    <div className="flex items-start justify-between mb-1">
                      <span className={[
                        'w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold leading-none',
                        today ? 'bg-white text-slate-900' : '',
                        !today && isSun ? 'text-red-500' : '',
                        !today && isSat ? 'text-amber-600' : '',
                        !today && isHol && !isSun && !isSat ? 'text-red-500' : '',
                        !today && !isSun && !isSat && !isHol ? (inMonth ? 'text-slate-800' : 'text-slate-300') : '',
                        !inMonth ? 'text-slate-300' : '',
                      ].filter(Boolean).join(' ')}>
                        {format(day, 'd')}
                      </span>

                      {/* Dot merah untuk hari libur */}
                      {isHol && inMonth && !today && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
                      )}
                      {/* Label ½ hari Sabtu */}
                      {isSat && inMonth && !today && (
                        <span className="text-[9px] text-amber-500 font-semibold leading-none mt-1">½</span>
                      )}
                    </div>

                    {/* Chip karyawan cuti */}
                    {inMonth && (
                      <div className="space-y-0.5">
                        {dayLeaves.slice(0, MAX_SHOW).map(l => {
                          const cfg = leaveColors[l.type] || { dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-600 border-slate-200' };
                          return (
                            <div key={`${l.user_id}-${l.start_date}`}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium truncate ${cfg.pill}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                              <span className="truncate">{l.name?.split(' ')[0]}</span>
                            </div>
                          );
                        })}
                        {dayLeaves.length > MAX_SHOW && (
                          <div className="text-[10px] text-slate-400 font-medium px-1.5">
                            +{dayLeaves.length - MAX_SHOW} lainnya
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3 h-3 rounded-full bg-red-400" /> Hari Libur Nasional
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3 h-3 rounded-full bg-amber-400" /> Sabtu (½ hari)
            </div>
            {Object.entries(leaveColors).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`w-3 h-3 rounded-full ${cfg.dot}`} /> {cfg.label}
              </div>
            ))}
          </div>

          {/* Daftar cuti bulan ini */}
          {data.onLeave.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">
                  Karyawan Izin/Cuti — {format(currentMonth, 'MMMM yyyy', { locale: id })}
                </h3>
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {data.onLeave.map((l, i) => {
                  const cfg = leaveColors[l.type] || { pill: 'bg-slate-100 text-slate-600 border-slate-200', label: l.type };
                  return (
                    <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="flex items-center gap-3 px-4 py-3">
                      <UserAvatar name={l.name} avatar={l.avatar} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 text-sm">{l.name}</div>
                        <div className="text-xs text-slate-500">{l.department || '-'}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.pill}`}>
                          {cfg.label}
                        </span>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {format(parseISO(l.start_date), 'd MMM', { locale: id })} –{' '}
                          {format(parseISO(l.end_date),   'd MMM', { locale: id })}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STATUS HARI INI
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'today' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Hadir',       value: data.todayAttendance.filter(a => ['present','late'].includes(a.status)).length, color: 'text-teal-700',  bg: 'bg-teal-50',  border: 'border-teal-200',  icon: UserCheck },
              { label: 'Izin/Cuti',   value: data.onLeave.filter(l => { const t = new Date(); return new Date(l.start_date) <= t && new Date(l.end_date) >= t; }).length, color: 'text-sky-700',   bg: 'bg-sky-50',   border: 'border-sky-200',   icon: Calendar },
              { label: 'Belum Absen', value: data.notYetCheckedIn.length, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock },
              { label: 'Terlambat',   value: data.todayAttendance.filter(a => a.status === 'late').length, color: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200',   icon: UserX },
            ].map(s => (
              <div key={s.label} className={`bg-white border ${s.border} rounded-xl p-4 flex items-center gap-3`}>
                <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <s.icon size={18} className={s.color} />
                </div>
                <div>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {data.todayAttendance.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Sudah Absen Hari Ini ({data.todayAttendance.length})</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {data.todayAttendance.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <UserAvatar name={a.name} avatar={a.avatar} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 text-sm">{a.name}</div>
                      <div className="text-xs text-slate-500">{a.department || '-'}</div>
                    </div>
                    <div className="text-right">
                      <span className={statusConfig[a.status]?.cls || 'badge-info'}>{statusConfig[a.status]?.label || a.status}</span>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {a.check_in  ? format(new Date(a.check_in),  'HH:mm') : '-'} –{' '}
                        {a.check_out ? format(new Date(a.check_out), 'HH:mm') : '-'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.notYetCheckedIn.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-amber-100 bg-amber-50">
                <h3 className="font-bold text-amber-900 text-sm">Belum Absen ({data.notYetCheckedIn.length})</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {data.notYetCheckedIn.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <UserAvatar name={e.name} avatar={e.avatar} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 text-sm">{e.name}</div>
                      <div className="text-xs text-slate-500">{e.department || '-'} · {e.employee_id || '-'}</div>
                    </div>
                    <span className="badge-warning">Belum Absen</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          POPUP DETAIL HARI (klik kotak tanggal)
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelectedDay(null)}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>

              {/* Header popup */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {format(selectedDay.date, 'EEEE', { locale: id })}
                  </h3>
                  <p className="text-slate-500 text-sm">
                    {format(selectedDay.date, 'd MMMM yyyy', { locale: id })}
                  </p>
                </div>
                <button onClick={() => setSelectedDay(null)}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Badge hari libur */}
              {selectedDay.isHoliday && (
                <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-red-700">Hari Libur Nasional</span>
                </div>
              )}

              {/* Badge Sabtu */}
              {selectedDay.date.getDay() === 6 && (
                <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-amber-700">Sabtu — Setengah Hari (pulang 15:00)</span>
                </div>
              )}

              {/* Daftar karyawan cuti */}
              {selectedDay.leaves.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar size={32} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">Tidak ada karyawan izin/cuti hari ini</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    {selectedDay.leaves.length} Karyawan Izin/Cuti
                  </p>
                  {selectedDay.leaves.map((l, i) => {
                    const cfg = leaveColors[l.type] || { pill: 'bg-slate-100 text-slate-600 border-slate-200', label: l.type };
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <UserAvatar name={l.name} avatar={l.avatar} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 text-sm">{l.name}</div>
                          <div className="text-xs text-slate-500">{l.department || '-'}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${cfg.pill}`}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
