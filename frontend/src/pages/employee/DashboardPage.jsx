import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Clock, MapPin, Calendar, FileText, CheckCircle, AlertCircle,
  ChevronRight, Fingerprint, Activity, RefreshCw, Sparkles,
  TrendingUp, ArrowRight, Sun, Moon, Sunset
} from 'lucide-react';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

const statusConfig = {
  present: { label: 'Hadir',       color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', icon: CheckCircle,  dot: 'bg-emerald-500' },
  late:    { label: 'Terlambat',   color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   icon: AlertCircle,  dot: 'bg-amber-500' },
  absent:  { label: 'Tidak Hadir', color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     icon: AlertCircle,  dot: 'bg-red-500' },
  leave:   { label: 'Cuti',        color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',    icon: Calendar,     dot: 'bg-blue-500' },
  sick:    { label: 'Sakit',       color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200',  icon: FileText,     dot: 'bg-purple-500' },
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }
});

const statsContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
};

const statsItemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 25 } }
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [todayAtt, setTodayAtt] = useState(null);
  const [quota, setQuota] = useState(null);
  const [recentAtt, setRecentAtt] = useState([]);
  const [time, setTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleUpdate = () => fetchData();
    window.addEventListener('realtime-attendance', handleUpdate);
    window.addEventListener('realtime-leave', handleUpdate);
    window.addEventListener('realtime-overtime', handleUpdate);
    window.addEventListener('realtime-notification', handleUpdate);

    return () => {
      window.removeEventListener('realtime-attendance', handleUpdate);
      window.removeEventListener('realtime-leave', handleUpdate);
      window.removeEventListener('realtime-overtime', handleUpdate);
      window.removeEventListener('realtime-notification', handleUpdate);
    };
  }, [fetchData]);

  const fetchData = useCallback(async () => {
    try {
      const [attRes, quotaRes, histRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/leave/quota'),
        api.get('/attendance/my'),
      ]);
      setTodayAtt(attRes.data.attendance);
      setQuota(quotaRes.data.quota);
      setRecentAtt(histRes.data.attendances.slice(0, 7));
      setLastUpdated(new Date());
    } catch {}
  }, []);

  useAutoRefresh(fetchData, 30_000);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setTimeout(() => setRefreshing(false), 600);
  };

  const getGreeting = () => {
    const h = time.getHours();
    if (h < 12) return { text: 'Selamat pagi', icon: Sun, color: 'text-amber-400' };
    if (h < 15) return { text: 'Selamat siang', icon: Sun, color: 'text-orange-400' };
    if (h < 18) return { text: 'Selamat sore', icon: Sunset, color: 'text-orange-500' };
    return { text: 'Selamat malam', icon: Moon, color: 'text-indigo-400' };
  };

  const greeting = getGreeting();
  const GreetIcon = greeting.icon;

  return (
    <div className="p-4 lg:p-6 space-y-5">

      {/* ── Hero Banner ── */}
      <motion.div {...fadeUp(0)}
        className="relative overflow-hidden rounded-3xl text-white"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 35%, #4338ca 65%, #6366f1 100%)' }}>

        {/* Decorative Orbs */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 rounded-full opacity-5 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #c4b5fd 0%, transparent 70%)', transform: 'translate(-50%, -50%)' }} />

        {/* Shimmer overlay */}
        <div className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)' }} />

        <div className="relative p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <GreetIcon size={16} className={greeting.color} />
                <p className="text-indigo-200 text-sm font-medium">{greeting.text}</p>
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">
                {user?.name?.split(' ')[0]}
                <span className="ml-2 text-2xl">👋</span>
              </h2>
              <p className="text-indigo-300 text-sm mt-1.5 font-medium">
                {format(time, 'EEEE, d MMMM yyyy', { locale: id })}
              </p>
              {user?.department && (
                <div className="mt-3 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-indigo-200 font-medium">{user.department} · {user.position || 'Karyawan'}</span>
                </div>
              )}
              {lastUpdated && (
                <p className="text-indigo-400 text-xs mt-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  Update {format(lastUpdated, 'HH:mm:ss')}
                </p>
              )}
            </div>

            <div className="flex items-start gap-3">
              <button onClick={handleManualRefresh} title="Refresh data"
                className="w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl flex items-center justify-center transition-all active:scale-95 flex-shrink-0 backdrop-blur-sm">
                <RefreshCw size={16} className={`text-white ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 text-center">
                <div className="text-3xl lg:text-4xl font-bold font-mono tracking-tight tabular-nums">
                  {format(time, 'HH:mm')}
                </div>
                <div className="text-indigo-300 text-xs mt-1 font-mono">{format(time, 'ss')}s</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Stats Row ── */}
      <motion.div
        variants={statsContainerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-3 gap-3"
      >
        {[
          {
            label: 'Hadir Bulan Ini',
            value: recentAtt.filter(a => a.status === 'present' || a.status === 'late').length,
            icon: CheckCircle,
            gradient: 'from-emerald-500 to-teal-500',
            bg: 'bg-emerald-50',
            text: 'text-emerald-700',
          },
          {
            label: 'Terlambat',
            value: recentAtt.filter(a => a.status === 'late').length,
            icon: AlertCircle,
            gradient: 'from-amber-500 to-orange-500',
            bg: 'bg-amber-50',
            text: 'text-amber-700',
          },
          {
            label: 'Sisa Cuti',
            value: quota?.remaining_days ?? '-',
            icon: Calendar,
            gradient: 'from-blue-500 to-indigo-500',
            bg: 'bg-blue-50',
            text: 'text-blue-700',
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            variants={statsItemVariants}
            className="card card-hover p-4 text-center cursor-pointer"
          >
            <div className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mx-auto mb-2 shadow-lg`}>
              <stat.icon size={16} className="text-white" />
            </div>
            <div className={`text-2xl font-bold ${stat.text}`}>{stat.value}</div>
            <div className="text-xs text-slate-500 mt-0.5 leading-tight">{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Desktop: 2-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left Column ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Today Status */}
          <motion.div {...fadeUp(0.1)} className="card card-hover p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Clock size={15} className="text-white" />
                </div>
                <h3 className="font-bold text-slate-900">Status Hari Ini</h3>
              </div>
              <Link to="/attendance"
                className="flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors group">
                Absen <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {todayAtt ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-2xl p-4">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-400/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
                        <Clock size={12} className="text-white" />
                      </div>
                      <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Masuk</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-800 font-mono">
                      {todayAtt.check_in ? format(new Date(todayAtt.check_in), 'HH:mm') : '--:--'}
                    </div>
                  </div>
                  <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/50 border border-slate-200/60 rounded-2xl p-4">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-slate-400/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-slate-600 rounded-lg flex items-center justify-center shadow-sm">
                        <Clock size={12} className="text-white" />
                      </div>
                      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Pulang</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-700 font-mono">
                      {todayAtt.check_out ? format(new Date(todayAtt.check_out), 'HH:mm') : '--:--'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {(() => {
                    const s = statusConfig[todayAtt.status] || statusConfig.present;
                    return (
                      <span className={`${s.bg} ${s.color} border ${s.border} px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    );
                  })()}
                  {todayAtt.location_name && (
                    <span className="text-slate-400 text-xs flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                      <MapPin size={11} className="text-slate-400" /> {todayAtt.location_name}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4 py-3 px-4 bg-gradient-to-r from-slate-50 to-indigo-50/50 rounded-2xl border border-slate-200/60">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner">
                  <Fingerprint size={26} className="text-indigo-500" />
                </div>
                <div className="text-center sm:text-left flex-1">
                  <p className="font-semibold text-slate-800">Belum absen hari ini</p>
                  <p className="text-slate-500 text-sm mt-0.5">Lakukan absensi untuk mencatat kehadiran kamu</p>
                </div>
                <Link to="/attendance" className="btn-primary py-2.5 px-5 text-sm whitespace-nowrap">
                  Absen Sekarang
                </Link>
              </div>
            )}
          </motion.div>

          {/* Quick Actions */}
          <motion.div {...fadeUp(0.15)}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
                  <Sparkles size={15} className="text-white" />
                </div>
                <h3 className="font-bold text-slate-900">Aksi Cepat</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  to: '/attendance', icon: Fingerprint, label: 'Absensi', desc: 'Masuk & Pulang',
                  gradient: 'from-slate-800 via-slate-900 to-black',
                  shadow: 'shadow-slate-900/30',
                },
                {
                  to: '/leave/annual', icon: Calendar, label: 'Ajukan Cuti', desc: `Sisa: ${quota?.remaining_days ?? '-'} hari`,
                  gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
                  shadow: 'shadow-emerald-500/30',
                },
                {
                  to: '/leave/sick', icon: FileText, label: 'Izin Sakit', desc: 'Upload bukti foto',
                  gradient: 'from-amber-500 via-orange-500 to-red-500',
                  shadow: 'shadow-amber-500/30',
                },
                {
                  to: '/leave', icon: Activity, label: 'Riwayat', desc: 'Lihat semua',
                  gradient: 'from-blue-500 via-indigo-500 to-violet-600',
                  shadow: 'shadow-blue-500/30',
                },
              ].map((item) => (
                <Link key={item.to} to={item.to}
                  className={`relative overflow-hidden bg-gradient-to-br ${item.gradient} text-white rounded-2xl p-4 hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 shadow-xl ${item.shadow} group`}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
                  <div className="w-9 h-9 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center mb-3 border border-white/20">
                    <item.icon size={18} />
                  </div>
                  <div className="font-bold text-sm">{item.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{item.desc}</div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Recent Attendance */}
          {recentAtt.length > 0 && (
            <motion.div {...fadeUp(0.2)} className="card card-hover p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-200">
                    <TrendingUp size={15} className="text-white" />
                  </div>
                  <h3 className="font-bold text-slate-900">Riwayat Absensi</h3>
                </div>
                <Link to="/attendance"
                  className="flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors group">
                  Lihat semua <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
              <div className="space-y-1">
                {recentAtt.map((att, i) => {
                  const s = statusConfig[att.status] || statusConfig.present;
                  return (
                    <motion.div key={att.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 group hover:bg-slate-50/50 rounded-xl px-2 -mx-2 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/60 rounded-xl flex flex-col items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-xs font-bold text-slate-800 leading-none">{format(new Date(att.date), 'd')}</span>
                          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">{format(new Date(att.date), 'MMM', { locale: id })}</span>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{format(new Date(att.date), 'EEEE', { locale: id })}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Clock size={10} />
                            <span className="font-mono">{att.check_in ? format(new Date(att.check_in), 'HH:mm') : '-'}</span>
                            <span>–</span>
                            <span className="font-mono">{att.check_out ? format(new Date(att.check_out), 'HH:mm') : '-'}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`${s.bg} ${s.color} border ${s.border} px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-5">

          {/* Leave Quota */}
          {quota && (
            <motion.div {...fadeUp(0.12)} className="card card-hover p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
                  <Calendar size={15} className="text-white" />
                </div>
                <h3 className="font-bold text-slate-900">Jatah Cuti {quota.year}</h3>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Total', value: quota.total_days, gradient: 'from-slate-100 to-slate-50', text: 'text-slate-800' },
                  { label: 'Terpakai', value: quota.used_days, gradient: 'from-red-50 to-rose-50', text: 'text-red-600' },
                  { label: 'Sisa', value: quota.remaining_days, gradient: 'from-emerald-50 to-teal-50', text: 'text-emerald-600' },
                ].map(s => (
                  <div key={s.label} className={`text-center bg-gradient-to-br ${s.gradient} rounded-2xl p-3 border border-slate-100/60`}>
                    <div className={`text-2xl font-bold ${s.text}`}>{s.value}</div>
                    <div className="text-xs text-slate-400 mt-0.5 font-medium">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5 font-medium">
                  <span>{quota.used_days} hari terpakai</span>
                  <span>{Math.round((quota.used_days / quota.total_days) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((quota.used_days / quota.total_days) * 100, 100)}%` }}
                    transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                    className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  />
                </div>
              </div>

              <Link to="/leave/annual"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all text-sm font-semibold group">
                <Calendar size={15} />
                Ajukan Cuti
                <ArrowRight size={14} className="ml-auto group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* Info Card */}
          <motion.div {...fadeUp(0.18)} className="card card-hover p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-200">
                <Fingerprint size={15} className="text-white" />
              </div>
              <h3 className="font-bold text-slate-900">Info Akun</h3>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Nama', value: user?.name },
                { label: 'Departemen', value: user?.department || '-' },
                { label: 'Jabatan', value: user?.position || '-' },
                { label: 'ID Karyawan', value: user?.employee_id || '-' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{item.label}</span>
                  <span className="text-sm font-semibold text-slate-800 text-right max-w-[60%] truncate">{item.value}</span>
                </div>
              ))}
            </div>
            <Link to="/profile"
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 text-white hover:from-slate-700 hover:to-slate-800 transition-all text-sm font-semibold shadow-lg shadow-slate-900/20 group">
              Edit Profil
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
