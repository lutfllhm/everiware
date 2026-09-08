import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LogIn, LogOut, MapPin, CalendarRange, Clock, Inbox, CalendarX,
  MessageSquare, RefreshCw,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import PageHeader from '../../components/ui/PageHeader';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const STATUS = {
  present: { label: 'Hadir', color: '#16A34A' },
  late:    { label: 'Terlambat', color: '#F59E0B' },
  absent:  { label: 'Absen', color: '#DC2626' },
  leave:   { label: 'Cuti', color: '#0EA5E9' },
  sick:    { label: 'Sakit', color: '#8B5CF6' },
};

const LEAVE_TYPES = {
  annual:          { label: 'Cuti Tahunan',       color: '#8B1F1F', bg: '#FFEBEE' },
  sick:            { label: 'Izin Sakit',         color: '#0284C7', bg: '#F0F9FF' },
  dinas:           { label: 'Dinas Luar',         color: '#D97706', bg: '#FFFBEB' },
  permission:      { label: 'Izin',               color: '#7C3AED', bg: '#F5F3FF' },
  late_permission: { label: 'Izin Terlambat',     color: '#2E7D32', bg: '#F0FDF4' },
  early_leave:     { label: 'Izin Pulang Cepat',  color: '#FFB300', bg: '#FFF8E1' },
  leave_office:    { label: 'Izin Keluar Kantor', color: '#E040FB', bg: '#FCE4EC' },
};

const OVERTIME_COLOR = '#FF9100';
const OVERTIME_BG = '#FFF8E1';

const REQUEST_STATUS = {
  pending:  { label: 'Menunggu',  color: '#D97706', bg: '#FFFBEB' },
  approved: { label: 'Disetujui', color: '#16A34A', bg: '#F0FDF4' },
  rejected: { label: 'Ditolak',   color: '#DC2626', bg: '#FEF2F2' },
};

const safe = (p) => p.then((r) => r).catch(() => ({ data: {} }));

/** "HH:mm[:ss]" atau ISO datetime → "HH:mm". */
const fmtTime = (value) => {
  if (!value) return '--:--';
  const part = String(value).includes('T')
    ? String(value).split('T')[1]?.slice(0, 5)
    : String(value).slice(0, 5);
  return part || '--:--';
};

const parseDate = (value) => {
  try { return parseISO(String(value).slice(0, 10)); } catch { return null; }
};

export default function HistoryPage() {
  const { user } = useAuthStore();
  const now = new Date();
  // Dashboard bisa membuka langsung ke tab tertentu lewat ?tab=requests
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(
    searchParams.get('tab') === 'requests' ? 'requests' : 'attendance',
  );

  // Tab absensi
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [attendances, setAttendances] = useState([]);
  const [attLoading, setAttLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  // Tab izin & lembur
  const [leaves, setLeaves] = useState([]);
  const [overtimes, setOvertimes] = useState([]);
  const [reqLoading, setReqLoading] = useState(true);

  const loadAttendance = useCallback(async () => {
    setAttLoading(true);
    const { data } = await safe(api.get(`/attendance/my?month=${month}&year=${year}`));
    setAttendances(data?.attendances || []);
    setAttLoading(false);
  }, [month, year]);

  const loadRequests = useCallback(async () => {
    setReqLoading(true);
    const [lv, ot] = await Promise.all([
      safe(api.get('/leave/my')),
      safe(api.get('/overtime/my')),
    ]);
    setLeaves(lv.data?.leaves || []);
    setOvertimes(ot.data?.overtimes || []);
    setReqLoading(false);
  }, []);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  // Ikut menyegarkan saat ada pembaruan realtime, seperti di app mobile.
  useEffect(() => {
    const onAtt = () => loadAttendance();
    const onReq = () => loadRequests();
    window.addEventListener('realtime-attendance', onAtt);
    window.addEventListener('realtime-leave', onReq);
    window.addEventListener('realtime-overtime', onReq);
    return () => {
      window.removeEventListener('realtime-attendance', onAtt);
      window.removeEventListener('realtime-leave', onReq);
      window.removeEventListener('realtime-overtime', onReq);
    };
  }, [loadAttendance, loadRequests]);

  const counts = useMemo(() => {
    const c = (s) => attendances.filter((a) => a.status === s).length;
    return {
      present: c('present'), late: c('late'), absent: c('absent'),
      leave: c('leave'), sick: c('sick'), total: attendances.length,
    };
  }, [attendances]);

  const filtered = useMemo(
    () => (filterStatus === 'all' ? attendances : attendances.filter((a) => a.status === filterStatus)),
    [attendances, filterStatus],
  );

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="bg-[#F8F7F5] min-h-screen">
      <PageHeader
        title="Riwayat Absensi"
        name={user?.name}
        meta={[user?.department, user?.position].filter(Boolean).join(' · ') || 'Karyawan'}
        avatar={{
          url: user?.avatar
            ? (user.avatar.startsWith('http') ? user.avatar : `/uploads/avatar/${user.avatar}`)
            : null,
          fallback: user?.name?.[0],
        }}
      >
        <div className="flex gap-7 mt-4 -mb-1">
          {[['attendance', 'Absensi'], ['requests', 'Izin & Lembur']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative pb-2.5 text-sm transition-colors ${
                tab === key ? 'text-white font-bold' : 'text-white/70 font-medium hover:text-white/90'
              }`}
            >
              {label}
              {tab === key && (
                <motion.span layoutId="history-tab"
                  className="absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-[#EF5350]" />
              )}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="px-4 pt-4 pb-8 lg:px-8 lg:max-w-3xl lg:mx-auto">
        {tab === 'attendance' ? (
          <AttendanceTab
            month={month} setMonth={setMonth}
            year={year} setYear={setYear} years={years}
            loading={attLoading} counts={counts}
            filterStatus={filterStatus} setFilterStatus={setFilterStatus}
            items={filtered} onReload={loadAttendance}
          />
        ) : (
          <RequestsTab loading={reqLoading} leaves={leaves} overtimes={overtimes} />
        )}
      </div>
    </div>
  );
}

/* ── Tab absensi ── */

function AttendanceTab({
  month, setMonth, year, setYear, years,
  loading, counts, filterStatus, setFilterStatus, items, onReload,
}) {
  const chips = [
    { key: 'all', label: 'Semua', count: counts.total, color: '#8B1F1F' },
    { key: 'present', label: 'Hadir', count: counts.present, color: STATUS.present.color },
    { key: 'late', label: 'Terlambat', count: counts.late, color: STATUS.late.color },
    { key: 'absent', label: 'Absen', count: counts.absent, color: STATUS.absent.color },
    { key: 'leave', label: 'Cuti', count: counts.leave, color: STATUS.leave.color },
    { key: 'sick', label: 'Sakit', count: counts.sick, color: STATUS.sick.color },
  ];

  return (
    <div>
      {/* Filter bulan & tahun */}
      <div className="flex items-center gap-2.5">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="flex-1 px-3.5 py-2.5 rounded-2xl border border-[#E7E5E4] bg-white text-[13px] font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B1F1F]/15">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="px-3.5 py-2.5 rounded-2xl border border-[#E7E5E4] bg-white text-[13px] font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B1F1F]/15">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={onReload} aria-label="Muat ulang"
          className="w-11 h-11 rounded-2xl bg-white border border-[#E7E5E4] flex items-center justify-center hover:bg-stone-50 active:scale-95 transition-all flex-shrink-0">
          <RefreshCw size={16} className={`text-stone-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!loading && items.length === 0 && counts.total === 0 ? null : (
        <>
          {/* Kartu statistik */}
          {!loading && counts.total > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-stretch bg-white rounded-[18px] border border-[#E7E5E4] shadow-[0_4px_16px_rgba(0,0,0,0.06)] py-3.5 px-2">
              {[
                { v: counts.present, l: 'Hadir', c: STATUS.present.color },
                { v: counts.late, l: 'Terlambat', c: STATUS.late.color },
                { v: counts.absent, l: 'Absen', c: STATUS.absent.color },
                { v: counts.leave, l: 'Cuti', c: STATUS.leave.color },
                { v: counts.sick, l: 'Sakit', c: STATUS.sick.color },
              ].map((s, i, arr) => (
                <div key={s.l} className="flex-1 flex items-center">
                  <div className="flex-1 text-center">
                    <div className="text-xl font-extrabold" style={{ color: s.c }}>{s.v}</div>
                    <div className="text-[10.5px] text-stone-400 font-medium mt-0.5">{s.l}</div>
                  </div>
                  {i < arr.length - 1 && <span className="w-px h-6 bg-[#E7E5E4] flex-shrink-0" />}
                </div>
              ))}
            </motion.div>
          )}

          {/* Chip filter status */}
          {!loading && counts.total > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
              {chips.map((chip) => {
                const active = filterStatus === chip.key;
                return (
                  <button key={chip.key} onClick={() => setFilterStatus(chip.key)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-all flex-shrink-0"
                    style={active
                      ? { backgroundColor: chip.color, borderColor: chip.color, color: '#fff' }
                      : { backgroundColor: '#fff', borderColor: '#E7E5E4', color: '#57534E' }}>
                    {chip.label}
                    <span className="text-[11px] font-bold px-1.5 rounded-full"
                      style={active
                        ? { backgroundColor: 'rgba(255,255,255,0.25)' }
                        : { backgroundColor: '#F5F5F4', color: chip.color }}>
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Daftar absensi */}
      <div className="mt-4 space-y-2.5">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-[88px] bg-white rounded-2xl border border-[#E7E5E4] animate-pulse" />
          ))
        ) : items.length === 0 ? (
          <EmptyState
            icon={CalendarX}
            title="Tidak ada data"
            subtitle={counts.total === 0
              ? 'Belum ada absensi pada bulan ini'
              : 'Tidak ada absensi untuk filter yang dipilih'}
          />
        ) : (
          items.map((att, i) => <AttendanceCard key={att.id ?? i} att={att} index={i} />)
        )}
      </div>
    </div>
  );
}

function AttendanceCard({ att, index }) {
  const cfg = STATUS[att.status] || { label: att.status, color: '#8B1F1F' };
  const date = parseDate(att.date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="flex bg-white rounded-2xl border border-[#E7E5E4] shadow-[0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden"
    >
      <span className="w-[5px] flex-shrink-0" style={{ backgroundColor: cfg.color }} />

      <div className="flex-1 flex items-center gap-3.5 px-4 py-3.5 min-w-0">
        <div className="w-[42px] text-center flex-shrink-0">
          <div className="text-[22px] font-extrabold text-stone-900 leading-none">
            {date ? format(date, 'd') : '--'}
          </div>
          <div className="text-[10px] font-bold text-stone-400 tracking-wide mt-0.5">
            {date ? format(date, 'MMM', { locale: localeId }).toUpperCase() : ''}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14.5px] text-stone-900">
            {date ? format(date, 'EEEE', { locale: localeId }) : '-'}
          </div>

          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1">
              <LogIn size={12} style={{ color: att.check_in ? STATUS.present.color : '#A8A29E' }} />
              <span className="text-xs font-semibold"
                style={{ color: att.check_in ? STATUS.present.color : '#A8A29E' }}>
                {fmtTime(att.check_in)}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <LogOut size={12} style={{ color: att.check_out ? '#8B1F1F' : '#A8A29E' }} />
              <span className="text-xs font-semibold"
                style={{ color: att.check_out ? '#8B1F1F' : '#A8A29E' }}>
                {fmtTime(att.check_out)}
              </span>
            </span>
          </div>

          {att.location_name && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={12} className="text-stone-400 flex-shrink-0" />
              <span className="text-[11.5px] text-stone-400 truncate">{att.location_name}</span>
            </div>
          )}
        </div>

        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ backgroundColor: `${cfg.color}1A`, color: cfg.color }}>
          {cfg.label}
        </span>
      </div>
    </motion.div>
  );
}

/* ── Tab izin & lembur ── */

function RequestsTab({ loading, leaves, overtimes }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 bg-white rounded-2xl border border-[#E7E5E4] animate-pulse" />
        ))}
      </div>
    );
  }

  if (leaves.length === 0 && overtimes.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Belum ada pengajuan"
        subtitle="Pengajuan izin, cuti, dan lembur akan muncul di sini"
      />
    );
  }

  return (
    <div className="space-y-3">
      {leaves.length > 0 && (
        <>
          <SectionTitle color="#8B1F1F" title="Izin & Cuti" count={leaves.length} />
          {leaves.map((lv, i) => <LeaveCard key={lv.id ?? i} leave={lv} index={i} />)}
        </>
      )}

      {overtimes.length > 0 && (
        <>
          <SectionTitle color={OVERTIME_COLOR} title="Lembur" count={overtimes.length} />
          {overtimes.map((ot, i) => <OvertimeCard key={ot.id ?? i} overtime={ot} index={i} />)}
        </>
      )}
    </div>
  );
}

function SectionTitle({ color, title, count }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="w-1 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
      <h3 className="font-extrabold text-sm text-stone-900">{title}</h3>
      <span className="ml-auto text-[11px] text-stone-400">{count} pengajuan</span>
    </div>
  );
}

function StatusPill({ status }) {
  const cfg = REQUEST_STATUS[status] || { label: status, color: '#57534E', bg: '#F5F5F4' };
  return (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function ReviewNote({ note }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-xl bg-stone-50 border border-[#E7E5E4] px-3 py-2.5">
      <MessageSquare size={13} className="text-stone-400 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-stone-600 leading-relaxed">{note}</p>
    </div>
  );
}

function LeaveCard({ leave, index }) {
  const cfg = LEAVE_TYPES[leave.type] || { label: leave.type, color: '#8B1F1F', bg: '#FFEBEE' };
  const start = parseDate(leave.start_date);
  const end = parseDate(leave.end_date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="flex bg-white rounded-2xl border border-[#E7E5E4] shadow-[0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden"
    >
      <span className="w-[5px] flex-shrink-0" style={{ backgroundColor: cfg.color }} />

      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
          <span className="ml-auto"><StatusPill status={leave.status} /></span>
        </div>

        <p className="font-bold text-[14.5px] text-stone-900 mt-3 line-clamp-2">{leave.reason}</p>

        <div className="flex items-center flex-wrap gap-2 mt-2.5">
          <span className="flex items-center gap-1.5">
            <CalendarRange size={14} style={{ color: cfg.color }} />
            <span className="text-[12.5px] font-medium text-stone-600">
              {start ? format(start, 'd MMM', { locale: localeId }) : '-'} – {end ? format(end, 'd MMM yyyy', { locale: localeId }) : '-'}
            </span>
          </span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            {leave.total_days} hari
          </span>
        </div>

        {leave.review_notes && <ReviewNote note={leave.review_notes} />}
      </div>
    </motion.div>
  );
}

function OvertimeCard({ overtime, index }) {
  const date = parseDate(overtime.date);
  const mins = Number(overtime.duration_minutes) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="flex bg-white rounded-2xl border border-[#E7E5E4] shadow-[0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden"
    >
      <span className="w-[5px] flex-shrink-0" style={{ backgroundColor: OVERTIME_COLOR }} />

      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: OVERTIME_BG, color: OVERTIME_COLOR }}>
            Lembur
          </span>
          <span className="ml-auto"><StatusPill status={overtime.status} /></span>
        </div>

        <p className="font-bold text-[14.5px] text-stone-900 mt-3 line-clamp-2">{overtime.reason}</p>

        <div className="flex items-center flex-wrap gap-2 mt-2.5">
          <span className="flex items-center gap-1.5">
            <CalendarRange size={14} style={{ color: OVERTIME_COLOR }} />
            <span className="text-[12.5px] font-medium text-stone-600">
              {date ? format(date, 'd MMM yyyy', { locale: localeId }) : '-'}
            </span>
          </span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
            style={{ backgroundColor: OVERTIME_BG, color: OVERTIME_COLOR }}>
            {Math.floor(mins / 60)} jam {mins % 60} mnt
          </span>
        </div>

        <div className="flex items-center gap-1.5 mt-2">
          <Clock size={14} className="text-stone-400" />
          <span className="text-xs font-medium text-stone-600">
            {fmtTime(overtime.start_time)} – {fmtTime(overtime.end_time)}
          </span>
        </div>

        {overtime.review_notes && <ReviewNote note={overtime.review_notes} />}
      </div>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E7E5E4] py-14 text-center">
      <Icon size={44} className="text-stone-300 mx-auto" />
      <p className="text-stone-500 font-semibold text-sm mt-3">{title}</p>
      <p className="text-stone-400 text-xs mt-1 px-6">{subtitle}</p>
    </div>
  );
}
