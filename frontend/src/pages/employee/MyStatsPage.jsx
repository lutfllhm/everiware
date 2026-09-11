import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  LogIn, LogOut, AlertTriangle, FileText, Timer, RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import PageHeader from '../../components/ui/PageHeader';
import SearchableSelect from '../../components/ui/SearchableSelect';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const STATUS_COLORS = {
  present: '#0D9488',
  late: '#F59E0B',
  absent: '#DC2626',
  leave: '#0EA5E9',
  sick: '#A855F7',
};

const safe = (p) => p.then((r) => r).catch(() => ({ data: {} }));

/** Ubah "HH:mm[:ss]" atau ISO datetime jadi menit sejak tengah malam. */
const toMinutes = (value) => {
  if (!value) return null;
  const timePart = String(value).includes('T')
    ? String(value).split('T')[1]?.slice(0, 5)
    : String(value).slice(0, 5);
  if (!timePart) return null;
  const [h, m] = timePart.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const fmtTime = (value) => {
  const mins = toMinutes(value);
  if (mins === null) return '--:--';
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};

export default function MyStatsPage() {
  const { user } = useAuthStore();
  const now = new Date();
  const [tab, setTab] = useState('overview');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [overtimes, setOvertimes] = useState([]);
  const [quota, setQuota] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [attRes, quotaRes, leaveRes, otRes] = await Promise.all([
      safe(api.get(`/attendance/my?month=${month}&year=${year}`)),
      safe(api.get('/leave/quota')),
      safe(api.get('/leave/my')),
      safe(api.get('/overtime/my')),
    ]);
    setAttendances(attRes.data?.attendances || []);
    setQuota(quotaRes.data?.quota || null);
    setLeaves(leaveRes.data?.leaves || []);
    setOvertimes(otRes.data?.overtimes || []);
    setLoading(false);
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Statistik ──
  const stats = useMemo(() => {
    const count = (s) => attendances.filter((a) => a.status === s).length;
    const present = count('present');
    const late = count('late');
    const absent = count('absent');
    const leave = count('leave');
    const sick = count('sick');
    const total = attendances.length;
    const rate = total === 0 ? 0 : ((present + late) / total) * 100;

    const checkIns = attendances.map((a) => toMinutes(a.check_in)).filter((m) => m !== null);
    const avgCheckIn = checkIns.length === 0
      ? '--:--'
      : (() => {
          const avg = Math.floor(checkIns.reduce((s, m) => s + m, 0) / checkIns.length);
          return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`;
        })();

    return { present, late, absent, leave, sick, total, rate, avgCheckIn };
  }, [attendances]);

  const pieData = useMemo(() => {
    const rows = [
      { name: 'Hadir', value: stats.present, color: STATUS_COLORS.present },
      { name: 'Terlambat', value: stats.late, color: STATUS_COLORS.late },
      { name: 'Absen', value: stats.absent, color: STATUS_COLORS.absent },
      { name: 'Cuti', value: stats.leave, color: STATUS_COLORS.leave },
      { name: 'Sakit', value: stats.sick, color: STATUS_COLORS.sick },
    ].filter((r) => r.value > 0);
    return rows.length ? rows : [{ name: 'Belum ada data', value: 1, color: '#D6D3D1' }];
  }, [stats]);

  // ── Linimasa aktivitas (absensi + izin + lembur, terbaru dulu) ──
  const activities = useMemo(() => {
    const items = [];

    for (const att of attendances) {
      const at = (t) => (String(t).includes('T') ? t : `${att.date}T${t}`);
      if (att.check_in) {
        const isLate = att.status === 'late';
        items.push({
          id: `${att.id}_in`,
          ts: at(att.check_in),
          icon: LogIn,
          color: isLate ? STATUS_COLORS.late : STATUS_COLORS.present,
          title: 'Absen Masuk',
          desc: `Absensi masuk di ${att.location_name || 'Kantor'} pukul ${fmtTime(att.check_in)}.`,
          status: isLate ? 'Terlambat' : 'Tepat Waktu',
        });
      }
      if (att.check_out) {
        items.push({
          id: `${att.id}_out`,
          ts: at(att.check_out),
          icon: LogOut,
          color: '#8B1F1F',
          title: 'Absen Pulang',
          desc: `Absensi pulang di ${att.location_name || 'Kantor'} pukul ${fmtTime(att.check_out)}.`,
          status: 'Selesai',
        });
      }
      if (!att.check_in && !att.check_out && att.status === 'absent') {
        items.push({
          id: `${att.id}_absent`,
          ts: `${att.date}T08:00:00`,
          icon: AlertTriangle,
          color: STATUS_COLORS.absent,
          title: 'Mangkir / Tidak Hadir',
          desc: 'Tidak ada riwayat absensi masuk untuk hari ini.',
          status: 'Tidak Hadir',
        });
      }
    }

    const statusMeta = (s) => ({
      approved: { label: 'Disetujui', color: STATUS_COLORS.present },
      rejected: { label: 'Ditolak', color: STATUS_COLORS.absent },
    }[s] || { label: 'Menunggu', color: STATUS_COLORS.late });

    for (const lv of leaves) {
      const meta = statusMeta(lv.status);
      items.push({
        id: `leave_${lv.id}`,
        ts: lv.created_at,
        icon: FileText,
        color: meta.color,
        title: 'Pengajuan Izin / Cuti',
        desc: `${lv.type_label || lv.leave_type || 'Izin'} · ${lv.start_date} s/d ${lv.end_date}\nAlasan: ${lv.reason || '-'}`,
        status: meta.label,
      });
    }

    for (const ot of overtimes) {
      const meta = statusMeta(ot.status);
      items.push({
        id: `ot_${ot.id}`,
        ts: ot.created_at,
        icon: Timer,
        color: meta.color,
        title: 'Pengajuan Lembur',
        desc: `Tanggal: ${ot.date}\nKeperluan: ${ot.reason || '-'}`,
        status: meta.label,
      });
    }

    return items
      .filter((i) => i.ts)
      .sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }, [attendances, leaves, overtimes]);

  const quotaTotal = Number(quota?.total_days ?? 0);
  const quotaUsed = Number(quota?.used_days ?? 0);
  const quotaPct = quotaTotal > 0 ? Math.min((quotaUsed / quotaTotal) * 100, 100) : 0;

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="bg-[#F8F7F5] min-h-screen">
      <PageHeader
        title="Statistik Saya"
        showBack
        name={user?.name}
        meta={[user?.department, user?.position].filter(Boolean).join(' · ') || 'Karyawan'}
        avatar={{
          url: user?.avatar
            ? (user.avatar.startsWith('http') ? user.avatar : `/uploads/avatar/${user.avatar}`)
            : null,
          fallback: user?.name?.[0],
        }}
      >
        {/* Tab bergaya mobile: garis merah di bawah label aktif */}
        <div className="flex gap-7 mt-4 -mb-1">
          {[['overview', 'Ringkasan'], ['activities', 'Aktivitas']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative pb-2.5 text-sm transition-colors ${
                tab === key ? 'text-white font-bold' : 'text-white/70 font-medium hover:text-white/90'
              }`}
            >
              {label}
              {tab === key && (
                <motion.span layoutId="stats-tab" className="absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-[#EF5350]" />
              )}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="px-4 pt-4 pb-10 lg:px-8 lg:max-w-4xl lg:mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="w-9 h-9 border-[3px] border-[#8B1F1F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'overview' ? (
          <div className="space-y-4">
            {/* ── Filter bulan & tahun ── */}
            <div className="flex items-center gap-2.5">
              <div className="flex-1 min-w-0">
                <SearchableSelect variant="brand" value={month} onChange={setMonth}
                  options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                  searchPlaceholder="Cari bulan..."
                  className="px-3.5 py-2.5 rounded-xl font-semibold" />
              </div>
              <div className="flex-1 min-w-0">
                <SearchableSelect variant="brand" value={year} onChange={setYear}
                  options={years.map((y) => ({ value: y, label: String(y) }))}
                  className="px-3.5 py-2.5 rounded-xl font-semibold" />
              </div>
              <button onClick={loadData} aria-label="Muat ulang"
                className="w-11 h-11 rounded-xl bg-white border border-[#E7E5E4] flex items-center justify-center hover:bg-stone-50 active:scale-95 transition-all">
                <RefreshCw size={16} className="text-stone-500" />
              </button>
            </div>

            {/* ── Tingkat kehadiran ── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-[20px] p-5 text-center text-white shadow-[0_6px_12px_rgba(139,31,31,0.2)]"
              style={{ background: 'linear-gradient(135deg, #8B1F1F 0%, #E53935 100%)' }}>
              <div className="text-5xl font-black leading-none">{stats.rate.toFixed(1)}%</div>
              <p className="text-white/70 text-[13px] mt-1">Tingkat Kehadiran</p>

              <div className="h-2 rounded-lg bg-white/20 overflow-hidden mt-4">
                <motion.div className="h-full bg-white rounded-lg"
                  initial={{ width: 0 }} animate={{ width: `${stats.rate}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
              </div>

              <div className="flex justify-around mt-3">
                <MiniStat value={String(stats.total)} label="Total Hari" />
                <MiniStat value={stats.avgCheckIn} label="Rata Masuk" />
                <MiniStat value={`${stats.late} H`} label="Terlambat" />
              </div>
            </motion.div>

            {/* ── Distribusi kehadiran ── */}
            <Card title="Grafik Distribusi Kehadiran">
              <div className="flex items-center gap-3">
                <div className="flex-[3] h-[150px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name"
                        innerRadius={30} outerRadius={60} paddingAngle={2} stroke="none">
                        {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12, border: '1px solid #E7E5E4', fontSize: 12,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-[2] space-y-1.5">
                  <Legend color={STATUS_COLORS.present} label={`Hadir (${stats.present})`} />
                  <Legend color={STATUS_COLORS.late} label={`Terlambat (${stats.late})`} />
                  <Legend color={STATUS_COLORS.absent} label={`Absen (${stats.absent})`} />
                  <Legend color={STATUS_COLORS.leave} label={`Cuti (${stats.leave})`} />
                  <Legend color={STATUS_COLORS.sick} label={`Sakit (${stats.sick})`} />
                </div>
              </div>
            </Card>

            {/* ── Jatah cuti ── */}
            {quota && (
              <Card title={`Jatah Cuti ${quota.year || ''}`.trim()}>
                <div className="flex gap-2.5">
                  <QuotaBox value={quota.total_days ?? 0} label="Total" color="#1C1917" />
                  <QuotaBox value={quota.used_days ?? 0} label="Terpakai" color="#8B1F1F" />
                  <QuotaBox value={quota.remaining_days ?? 0} label="Sisa" color="#0D9488" />
                </div>
                <div className="h-2 rounded-lg bg-stone-100 overflow-hidden mt-3">
                  <motion.div className="h-full rounded-lg bg-[#8B1F1F]"
                    initial={{ width: 0 }} animate={{ width: `${quotaPct}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
                </div>
              </Card>
            )}

            {/* ── Rincian status ── */}
            <Card title="Rincian Status">
              <div className="space-y-2.5">
                <StatRow label="Hadir" value={stats.present} total={stats.total} color={STATUS_COLORS.present} />
                <StatRow label="Terlambat" value={stats.late} total={stats.total} color={STATUS_COLORS.late} />
                <StatRow label="Tidak Hadir" value={stats.absent} total={stats.total} color={STATUS_COLORS.absent} />
                <StatRow label="Cuti" value={stats.leave} total={stats.total} color={STATUS_COLORS.leave} />
                <StatRow label="Sakit" value={stats.sick} total={stats.total} color={STATUS_COLORS.sick} />
              </div>
            </Card>
          </div>
        ) : (
          /* ── Tab aktivitas ── */
          <div className="pt-1">
            {activities.length === 0 ? (
              <div className="text-center py-16 text-stone-400 text-sm">Belum ada aktivitas.</div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E7E5E4] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4">
                {activities.map((act, i) => (
                  <TimelineItem key={act.id} act={act} isLast={i === activities.length - 1} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-komponen ── */

function Card({ title, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-[#E7E5E4] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-[18px]">
      <h3 className="font-bold text-[15px] text-stone-900 mb-3.5">{title}</h3>
      {children}
    </motion.div>
  );
}

function MiniStat({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-white font-extrabold text-base">{value}</div>
      <div className="text-white/60 text-[10.5px] mt-0.5">{label}</div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[11.5px] text-stone-600">{label}</span>
    </div>
  );
}

function QuotaBox({ value, label, color }) {
  return (
    <div className="flex-1 rounded-xl bg-stone-50 border border-[#F5F5F4] py-3 text-center">
      <div className="font-extrabold text-lg" style={{ color }}>{value}</div>
      <div className="text-[11px] text-stone-400 mt-0.5">{label}</div>
    </div>
  );
}

function StatRow({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-stone-600 font-medium">{label}</span>
        <span className="font-bold" style={{ color }}>{value} hari</span>
      </div>
      <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
        <motion.div className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
      </div>
    </div>
  );
}

function TimelineItem({ act, isLast }) {
  const Icon = act.icon;
  let when = '';
  try {
    when = format(parseISO(act.ts), 'd MMM yyyy · HH:mm', { locale: localeId });
  } catch { when = act.ts; }

  return (
    <div className="flex gap-3">
      {/* Rel waktu */}
      <div className="flex flex-col items-center flex-shrink-0">
        <span className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${act.color}1A` }}>
          <Icon size={17} style={{ color: act.color }} />
        </span>
        {!isLast && <span className="w-px flex-1 bg-[#F5F5F4] my-1" />}
      </div>

      <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-5'}`}>
        <div className="flex items-start justify-between gap-2">
          <span className="font-bold text-[13.5px] text-stone-900">{act.title}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: `${act.color}1A`, color: act.color }}>
            {act.status}
          </span>
        </div>
        <p className="text-[11px] text-stone-400 mt-0.5">{when}</p>
        <p className="text-[12px] text-stone-500 mt-1 whitespace-pre-line leading-relaxed">{act.desc}</p>
      </div>
    </div>
  );
}
