import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Clock, FileText, TrendingUp, CheckCircle, AlertCircle,
  Calendar, ArrowRight, UserX, Activity, BarChart3, RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import api from '../../api/axios';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import useAuthStore from '../../store/authStore';
import UserAvatar from '../../components/ui/UserAvatar';

const COLORS = {
  present:  '#14b8a6',
  late:     '#f59e0b',
  absent:   '#ef4444',
  leave:    '#38bdf8',
  sick:     '#a855f7',
};

const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats]           = useState(null);
  const [trend, setTrend]           = useState([]);
  const [heatmap, setHeatmap]       = useState([]);
  const [departments, setDepts]     = useState([]);
  const [topLate, setTopLate]       = useState([]);
  const [recentLeaves, setLeaves]   = useState([]);
  const [recentAtt, setRecentAtt]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const curMonth = new Date().getMonth() + 1;
  const curYear  = new Date().getFullYear();

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [statsR, trendR, heatR, deptR, lateR, leavesR, attR] = await Promise.all([
        api.get('/analytics/dashboard'),
        api.get('/analytics/trend?months=6'),
        api.get(`/analytics/checkin-heatmap?month=${curMonth}&year=${curYear}`),
        api.get(`/analytics/departments?month=${curMonth}&year=${curYear}`),
        api.get(`/analytics/top-late?month=${curMonth}&year=${curYear}&limit=5`),
        api.get('/leave/all?status=pending'),
        api.get(`/attendance/all?month=${curMonth}&year=${curYear}&limit=6`),
      ]);
      setStats(statsR.data.stats);
      setTrend(trendR.data.trend);
      setHeatmap(heatR.data.heatmap);
      setDepts(deptR.data.departments);
      setTopLate(lateR.data.topLate);
      setLeaves(leavesR.data.leaves.slice(0, 5));
      setRecentAtt(attR.data.attendances.slice(0, 6));
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    fetchAll();

    const handleUpdate = () => fetchAll(true);
    window.addEventListener('realtime-attendance', handleUpdate);
    window.addEventListener('realtime-leave', handleUpdate);
    window.addEventListener('realtime-overtime', handleUpdate);

    return () => {
      window.removeEventListener('realtime-attendance', handleUpdate);
      window.removeEventListener('realtime-leave', handleUpdate);
      window.removeEventListener('realtime-overtime', handleUpdate);
    };
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
  };

  // Pie data untuk distribusi hari ini
  const todayPie = stats ? [
    { name: 'Hadir',     value: stats.present_today, color: COLORS.present },
    { name: 'Terlambat', value: stats.late_today,    color: COLORS.late    },
    { name: 'Belum',     value: Math.max(0, stats.total_employees - stats.present_today - stats.late_today), color: '#e2e8f0' },
  ].filter(d => d.value > 0) : [];

  const statCards = stats ? [
    { label: 'Total Karyawan',    value: stats.total_employees,    icon: Users,       color: 'text-slate-700',  bg: 'bg-slate-100',  border: 'border-slate-200', sub: `${stats.new_employees} baru bulan ini` },
    { label: 'Hadir Hari Ini',    value: stats.present_today,      icon: CheckCircle, color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-200',  sub: `${stats.late_today} terlambat` },
    { label: 'Izin Pending',      value: stats.pending_leaves,     icon: FileText,    color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200', sub: 'Menunggu persetujuan' },
    { label: 'Tingkat Kehadiran', value: `${stats.attendance_rate}%`, icon: TrendingUp, color: 'text-sky-700', bg: 'bg-sky-50',     border: 'border-sky-200',   sub: `${stats.working_days} hari kerja` },
  ] : [];

  return (
    <div className="space-y-6">

      {/* ── Hero Banner ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="relative px-6 py-7 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-slate-400 text-sm">{greeting()}, {user?.name?.split(' ')[0]} 👋</p>
              <h2 className="text-xl lg:text-2xl font-bold mt-1">Dashboard Analytics</h2>
              <p className="text-slate-400 text-sm mt-1">
                {format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => fetchAll(true)} disabled={refreshing}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
              </button>
              <Link to="/admin/team-calendar"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors">
                <Calendar size={14} /> Kalender Tim
              </Link>
              <Link to="/admin/reports"
                className="flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                <BarChart3 size={14} /> Laporan
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="w-10 h-10 bg-slate-100 rounded-xl mb-3" />
                <div className="h-7 bg-slate-100 rounded-lg w-12 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-24" />
              </div>
            ))
          : statCards.map((card, i) => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                className={`card p-5 border ${card.border}`}>
                <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <card.icon size={19} className={card.color} />
                </div>
                <div className="text-2xl font-bold text-slate-900">{card.value}</div>
                <div className="text-slate-600 text-sm font-medium mt-0.5">{card.label}</div>
                <div className="text-slate-400 text-xs mt-0.5">{card.sub}</div>
              </motion.div>
            ))
        }
      </div>

      {/* ── Row 1: Tren + Pie ── */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Tren 6 bulan — area chart */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="lg:col-span-2 card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-slate-800 rounded-full" />
                <h3 className="font-bold text-slate-900 text-sm">Tren Kehadiran 6 Bulan</h3>
              </div>
              <Link to="/admin/reports" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">Lihat detail →</Link>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.present} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.present} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.late} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.late} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="monthShort" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="present" name="Hadir"     stroke={COLORS.present} fill="url(#gradPresent)" strokeWidth={2} />
                <Area type="monotone" dataKey="late"    name="Terlambat" stroke={COLORS.late}    fill="url(#gradLate)"    strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Pie hari ini */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-slate-800 rounded-full" />
              <h3 className="font-bold text-slate-900 text-sm">Status Hari Ini</h3>
            </div>
            {todayPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={todayPie} cx="50%" cy="45%" innerRadius={45} outerRadius={68} paddingAngle={3} dataKey="value">
                    {todayPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-300 text-sm">Belum ada data</div>
            )}
            {stats && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { label: 'Hadir',     value: stats.present_today, color: 'text-teal-600',  bg: 'bg-teal-50' },
                  { label: 'Terlambat', value: stats.late_today,    color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Izin/Cuti', value: stats.total_leave_month, color: 'text-sky-600', bg: 'bg-sky-50' },
                  { label: 'Absen',     value: stats.monthly_absent, color: 'text-red-600',  bg: 'bg-red-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-2.5 text-center`}>
                    <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-slate-500">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ── Row 2: Heatmap jam masuk + Departemen ── */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Heatmap jam masuk */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-slate-800 rounded-full" />
              <h3 className="font-bold text-slate-900 text-sm">Distribusi Jam Masuk Bulan Ini</h3>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={heatmap} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v) => [`${v} karyawan`, 'Jumlah']} />
                <Bar dataKey="count" name="Karyawan" radius={[4,4,0,0]}
                  fill={COLORS.present}
                  label={false} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-400 mt-2 text-center">Jam masuk paling umum menunjukkan pola kedatangan karyawan</p>
          </motion.div>

          {/* Kehadiran per departemen */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-slate-800 rounded-full" />
              <h3 className="font-bold text-slate-900 text-sm">Kehadiran per Departemen</h3>
            </div>
            {departments.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-slate-300 text-sm">Belum ada data departemen</div>
            ) : (
              <div className="space-y-3">
                {departments.slice(0, 6).map((dept) => (
                  <div key={dept.department}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate max-w-[60%]">{dept.department}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{dept.total_emp} org</span>
                        <span className={`text-xs font-bold ${(dept.attendance_rate || 0) >= 80 ? 'text-teal-600' : (dept.attendance_rate || 0) >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                          {dept.attendance_rate || 0}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${(dept.attendance_rate || 0) >= 80 ? 'bg-teal-500' : (dept.attendance_rate || 0) >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(dept.attendance_rate || 0, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ── Row 3: Top Terlambat + Pending Leaves + Recent Att ── */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Top terlambat */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-amber-500 rounded-full" />
              <h3 className="font-bold text-slate-900 text-sm">Sering Terlambat Bulan Ini</h3>
            </div>
            {topLate.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle size={28} className="text-teal-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Tidak ada keterlambatan</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topLate.map((emp, i) => (
                  <div key={emp.id} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {i + 1}
                    </div>
                    <UserAvatar name={emp.name} avatar={emp.avatar} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 text-sm truncate">{emp.name}</div>
                      <div className="text-xs text-slate-400">{[emp.department, emp.position].filter(Boolean).join(' · ') || '-'}</div>                    </div>
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg flex-shrink-0">
                      {emp.late_count}×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Pending Leaves */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-slate-800 rounded-full" />
                <h3 className="font-bold text-slate-900 text-sm">Pengajuan Pending</h3>
              </div>
              <Link to="/admin/notifications" className="text-slate-400 hover:text-slate-700 transition-colors">
                <ArrowRight size={15} />
              </Link>
            </div>
            {recentLeaves.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle size={28} className="text-teal-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Semua sudah diproses</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentLeaves.map((leave) => (
                  <div key={leave.id} className="flex items-center gap-2.5">
                    <UserAvatar name={leave.user_name} avatar={leave.user_avatar} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 text-sm truncate">{leave.user_name}</div>
                      <div className="text-xs text-slate-400">{leave.total_days} hari · {leave.type}</div>
                    </div>
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg flex-shrink-0">
                      Pending
                    </span>
                  </div>
                ))}
                <Link to="/admin/notifications"
                  className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors mt-1">
                  Proses semua <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </motion.div>

          {/* Recent Attendance */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-slate-800 rounded-full" />
                <h3 className="font-bold text-slate-900 text-sm">Absensi Terbaru</h3>
              </div>
              <Link to="/admin/attendance" className="text-slate-400 hover:text-slate-700 transition-colors">
                <ArrowRight size={15} />
              </Link>
            </div>
            {recentAtt.length === 0 ? (
              <div className="text-center py-6">
                <Clock size={28} className="text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Belum ada data</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentAtt.map((att) => {
                  const statusCls = {
                    present: 'bg-teal-50 text-teal-700 border-teal-200',
                    late:    'bg-amber-50 text-amber-700 border-amber-200',
                    absent:  'bg-red-50 text-red-600 border-red-200',
                    leave:   'bg-sky-50 text-sky-700 border-sky-200',
                    sick:    'bg-purple-50 text-purple-700 border-purple-200',
                  }[att.status] || 'bg-slate-50 text-slate-600 border-slate-200';
                  const statusLabel = { present:'Hadir', late:'Terlambat', absent:'Absen', leave:'Cuti', sick:'Sakit' }[att.status] || att.status;
                  return (
                    <div key={att.id} className="flex items-center gap-2.5 py-1.5 border-b border-slate-50 last:border-0">
                      <UserAvatar name={att.user_name} avatar={att.user_avatar} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 text-sm truncate">{att.user_name}</div>
                        <div className="text-xs text-slate-400">
                          {format(new Date(att.date), 'd MMM', { locale: id })}
                          {att.check_in && ` · ${format(new Date(att.check_in), 'HH:mm')}`}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border flex-shrink-0 ${statusCls}`}>{statusLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ── Quick Nav ── */}
      {!loading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-slate-800 rounded-full" />
            <h3 className="font-bold text-slate-900">Akses Cepat</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { to: '/admin/attendance',    icon: Clock,      label: 'Data Absensi',  desc: 'Lihat & kelola',      color: 'text-slate-700',  bg: 'bg-slate-100' },
              { to: '/admin/employees',     icon: Users,      label: 'Karyawan',      desc: 'Manajemen karyawan',  color: 'text-teal-700',   bg: 'bg-teal-50' },
              { to: '/admin/team-calendar', icon: Calendar,   label: 'Kalender Tim',  desc: 'Status kehadiran',    color: 'text-sky-700',    bg: 'bg-sky-50' },
              { to: '/admin/reports',       icon: TrendingUp, label: 'Laporan',       desc: 'Export & rekap',      color: 'text-amber-700',  bg: 'bg-amber-50' },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="card p-4 hover:shadow-md transition-shadow group">
                <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                  <item.icon size={19} className={item.color} />
                </div>
                <div className="font-semibold text-slate-900 text-sm">{item.label}</div>
                <div className="text-slate-400 text-xs mt-0.5">{item.desc}</div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}



