import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle,
  RefreshCw, X, Send, FileText, Clock, Check, Ban, ChevronRight,
  Calendar, User, Megaphone
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { format, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

const typeConfig = {
  info:    { icon: Info,          bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-600',   badge: 'bg-blue-100 text-blue-700'    },
  success: { icon: CheckCircle,   bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-600',badge: 'bg-emerald-100 text-emerald-700'},
  warning: { icon: AlertTriangle, bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700'   },
  error:   { icon: XCircle,       bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-600',    badge: 'bg-red-100 text-red-700'       },
};

const leaveTypeLabel = { annual: 'Cuti Tahunan', sick: 'Izin Sakit', permission: 'Izin', wfh: 'Work From Home', dinas: 'Dinas Luar' };

export default function NotificationsAdmin() {
  const [tab, setTab] = useState('pending'); // pending | notifications | broadcast
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [loadingNotif, setLoadingNotif] = useState(false);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [filter, setFilter] = useState('all');
  const [broadcast, setBroadcast] = useState({ title: '', message: '', type: 'info' });
  const [sending, setSending] = useState(false);
  const [reviewModal, setReviewModal] = useState(null); // { leave, action: 'approved'|'rejected' }
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => { fetchNotifications(); fetchPendingLeaves(); }, []);

  const fetchNotifications = async () => {
    setLoadingNotif(true);
    try {
      const { data } = await api.get('/users/notifications');
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch {} finally { setLoadingNotif(false); }
  };

  const fetchPendingLeaves = async () => {
    setLoadingLeaves(true);
    try {
      const { data } = await api.get('/leave/all?status=pending');
      setPendingLeaves(data.leaves);
    } catch {} finally { setLoadingLeaves(false); }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/users/notifications/read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnread(0);
      toast.success('Semua notifikasi ditandai sudah dibaca');
    } catch { toast.error('Gagal memperbarui notifikasi'); }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcast.title || !broadcast.message) return toast.error('Judul dan pesan wajib diisi');
    setSending(true);
    try {
      await api.post('/users/notifications/broadcast', broadcast);
      toast.success('Notifikasi berhasil dikirim ke semua karyawan');
      setBroadcast({ title: '', message: '', type: 'info' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim notifikasi');
    } finally { setSending(false); }
  };

  const openReview = (leave, action) => {
    setReviewModal({ leave, action });
    setReviewNote('');
  };

  const handleReview = async () => {
    if (!reviewModal) return;
    setReviewing(true);
    try {
      await api.put(`/leave/review/${reviewModal.leave.id}`, {
        status: reviewModal.action,
        review_notes: reviewNote,
      });
      toast.success(reviewModal.action === 'approved' ? 'Pengajuan disetujui' : 'Pengajuan ditolak');
      setReviewModal(null);
      fetchPendingLeaves();
      fetchNotifications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses pengajuan');
    } finally { setReviewing(false); }
  };

  const filteredNotif = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'read') return n.is_read;
    return true;
  });

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-24 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 pointer-events-none" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center relative">
              <Bell size={22} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold">Notifikasi & Pengajuan</h2>
              <p className="text-slate-400 text-sm">
                {pendingLeaves.length > 0 && <span className="text-amber-400 font-medium">{pendingLeaves.length} pengajuan menunggu · </span>}
                {unread} notifikasi belum dibaca
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-slate-100 rounded-2xl p-1">
        {[
          { key: 'pending',       label: 'Pengajuan Izin', icon: FileText,  count: pendingLeaves.length },
          { key: 'notifications', label: 'Notifikasi',     icon: Bell,      count: unread },
          { key: 'broadcast',     label: 'Broadcast',      icon: Megaphone, count: null },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={15} />
            <span className="hidden sm:inline">{t.label}</span>
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-600'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: PENGAJUAN IZIN ── */}
      {tab === 'pending' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">
              {loadingLeaves ? 'Memuat...' : `${pendingLeaves.length} pengajuan menunggu persetujuan`}
            </p>
            <button onClick={fetchPendingLeaves} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
              <RefreshCw size={15} className={`text-slate-600 ${loadingLeaves ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingLeaves ? (
            <div className="card p-12 text-center">
              <RefreshCw size={24} className="animate-spin text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Memuat pengajuan...</p>
            </div>
          ) : pendingLeaves.length === 0 ? (
            <div className="card p-12 text-center">
              <CheckCircle size={40} className="text-emerald-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Tidak ada pengajuan pending</p>
              <p className="text-slate-400 text-sm mt-1">Semua pengajuan sudah diproses</p>
            </div>
          ) : (
            <AnimatePresence>
              {pendingLeaves.map((leave, i) => (
                <motion.div key={leave.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="card p-4 border border-amber-200 bg-amber-50/40">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-500 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                      {leave.user_avatar
                        ? <img src={`/uploads/avatar/${leave.user_avatar}`} alt="" className="w-full h-full object-cover" />
                        : <User size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{leave.user_name}</p>
                          <p className="text-xs text-slate-500">{leave.employee_id || '-'} · {[leave.department, leave.position].filter(Boolean).join(' · ') || '-'}</p>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700 border border-amber-200 flex-shrink-0">
                          {leaveTypeLabel[leave.type] || leave.type}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {format(new Date(leave.start_date), 'dd MMM yyyy', { locale: id })}
                          {leave.start_date !== leave.end_date && ` – ${format(new Date(leave.end_date), 'dd MMM yyyy', { locale: id })}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {leave.total_days} hari kerja
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700 bg-white rounded-xl px-3 py-2 border border-slate-100 leading-relaxed">
                        {leave.reason}
                      </p>
                      {leave.attachment && (
                        <a href={`/uploads/sick/${leave.attachment}`} target="_blank" rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                          <FileText size={12} /> Lihat Lampiran
                        </a>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        Diajukan {formatDistanceToNow(new Date(leave.created_at), { addSuffix: true, locale: id })}
                      </p>
                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => openReview(leave, 'approved')}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors">
                          <Check size={13} /> Setujui
                        </button>
                        <button onClick={() => openReview(leave, 'rejected')}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors">
                          <Ban size={13} /> Tolak
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* ── TAB: NOTIFIKASI ── */}
      {tab === 'notifications' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex bg-slate-100 rounded-2xl p-1">
              {[{ key: 'all', label: 'Semua' }, { key: 'unread', label: 'Belum Dibaca' }, { key: 'read', label: 'Sudah Dibaca' }].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={fetchNotifications} className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
                <RefreshCw size={16} className={`text-slate-600 ${loadingNotif ? 'animate-spin' : ''}`} />
              </button>
              {unread > 0 && (
                <button onClick={handleMarkAllRead} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors text-sm font-medium">
                  <CheckCheck size={16} /> Tandai Semua Dibaca
                </button>
              )}
            </div>
          </div>

          {loadingNotif ? (
            <div className="card p-12 text-center">
              <RefreshCw size={24} className="animate-spin text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Memuat notifikasi...</p>
            </div>
          ) : filteredNotif.length === 0 ? (
            <div className="card p-12 text-center">
              <Bell size={40} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Tidak ada notifikasi</p>
              <p className="text-slate-400 text-sm mt-1">
                {filter === 'unread' ? 'Semua notifikasi sudah dibaca' : 'Belum ada notifikasi masuk'}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredNotif.map((notif, i) => {
                const cfg = typeConfig[notif.type] || typeConfig.info;
                return (
                  <motion.div key={notif.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className={`card p-4 border ${cfg.border} ${!notif.is_read ? cfg.bg : 'bg-white'} transition-colors`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${!notif.is_read ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                        <cfg.icon size={18} className={cfg.text} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-semibold text-sm ${!notif.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                              {notif.title}
                            </p>
                            {!notif.is_read && <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.badge}`}>
                            {notif.type}
                          </span>
                        </div>
                        <p className="text-slate-500 text-sm mt-1 leading-relaxed">{notif.message}</p>
                        <p className="text-slate-400 text-xs mt-2">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: id })}
                          {' · '}
                          {format(new Date(notif.created_at), 'dd MMM yyyy HH:mm', { locale: id })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* ── TAB: BROADCAST ── */}
      {tab === 'broadcast' && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center">
              <Megaphone size={20} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Kirim Broadcast</h3>
              <p className="text-slate-500 text-sm">Notifikasi akan dikirim ke semua karyawan aktif</p>
            </div>
          </div>
          <form onSubmit={handleSendBroadcast} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Jenis Notifikasi</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <button key={key} type="button" onClick={() => setBroadcast({ ...broadcast, type: key })}
                    className={`py-2.5 rounded-xl text-xs font-medium border-2 transition-all capitalize ${broadcast.type === key ? `${cfg.bg} ${cfg.border} ${cfg.text}` : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {key}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Judul *</label>
              <input value={broadcast.title} onChange={e => setBroadcast({ ...broadcast, title: e.target.value })}
                className="input-field" placeholder="Contoh: Pengumuman Libur Nasional" required />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Pesan *</label>
              <textarea value={broadcast.message} onChange={e => setBroadcast({ ...broadcast, message: e.target.value })}
                className="input-field resize-none" rows={5} placeholder="Tulis isi pesan notifikasi..." required />
            </div>
            <button type="submit" disabled={sending}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              {sending ? <><RefreshCw size={15} className="animate-spin" /> Mengirim...</> : <><Send size={15} /> Kirim ke Semua Karyawan</>}
            </button>
          </form>
        </div>
      )}

      {/* ── MODAL REVIEW ── */}
      <AnimatePresence>
        {reviewModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setReviewModal(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${reviewModal.action === 'approved' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  {reviewModal.action === 'approved'
                    ? <Check size={20} className="text-emerald-600" />
                    : <Ban size={20} className="text-red-500" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    {reviewModal.action === 'approved' ? 'Setujui Pengajuan' : 'Tolak Pengajuan'}
                  </h3>
                  <p className="text-sm text-slate-500">{reviewModal.leave.user_name} · {leaveTypeLabel[reviewModal.leave.type]}</p>
                </div>
                <button onClick={() => setReviewModal(null)} className="ml-auto p-2 rounded-xl hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>

              {/* Leave summary */}
              <div className="bg-slate-50 rounded-2xl p-4 mb-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal</span>
                  <span className="font-medium text-slate-800">
                    {format(new Date(reviewModal.leave.start_date), 'dd MMM yyyy', { locale: id })}
                    {reviewModal.leave.start_date !== reviewModal.leave.end_date && ` – ${format(new Date(reviewModal.leave.end_date), 'dd MMM yyyy', { locale: id })}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Durasi</span>
                  <span className="font-medium text-slate-800">{reviewModal.leave.total_days} hari kerja</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Alasan</span>
                  <span className="font-medium text-slate-800 text-right max-w-[60%]">{reviewModal.leave.reason}</span>
                </div>
              </div>

              <div className="mb-5">
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Catatan {reviewModal.action === 'rejected' ? '(wajib)' : '(opsional)'}
                </label>
                <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                  className="input-field resize-none text-sm" rows={3}
                  placeholder={reviewModal.action === 'approved' ? 'Tambahkan catatan jika perlu...' : 'Tuliskan alasan penolakan...'} />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setReviewModal(null)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                <button onClick={handleReview} disabled={reviewing || (reviewModal.action === 'rejected' && !reviewNote.trim())}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${reviewModal.action === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
                  {reviewing
                    ? <><RefreshCw size={14} className="animate-spin" /> Memproses...</>
                    : reviewModal.action === 'approved'
                      ? <><Check size={14} /> Setujui</>
                      : <><Ban size={14} /> Tolak</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
