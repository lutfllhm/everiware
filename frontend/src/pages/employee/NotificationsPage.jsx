import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle, RefreshCw, Trash2, X } from 'lucide-react';
import api from '../../api/axios';
import { formatDistanceToNow, format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';

const typeConfig = {
  info:    { icon: Info,          bg: 'bg-sky-50',     border: 'border-sky-200',    text: 'text-sky-600',    dot: 'bg-sky-500' },
  success: { icon: CheckCircle,   bg: 'bg-teal-50',    border: 'border-teal-200',   text: 'text-teal-600',   dot: 'bg-teal-500' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-600',  dot: 'bg-amber-500' },
  error:   { icon: XCircle,       bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-600',    dot: 'bg-red-500' },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchNotifications();

    const handleUpdate = () => fetchNotifications();
    window.addEventListener('realtime-notification', handleUpdate);

    // Auto mark all read setelah 2 detik halaman dibuka
    const timer = setTimeout(() => {
      api.put('/users/notifications/read').catch(() => {});
      setUnread(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }, 2000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('realtime-notification', handleUpdate);
    };
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users/notifications');
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch {} finally { setLoading(false); }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/users/notifications/read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnread(0);
      toast.success('Semua notifikasi sudah dibaca');
    } catch {}
  };

  const handleDeleteOne = async (notifId) => {
    setDeletingId(notifId);
    try {
      await api.delete(`/users/notifications/${notifId}`);
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      toast.success('Notifikasi dihapus');
    } catch {
      toast.error('Gagal menghapus notifikasi');
    } finally { setDeletingId(null); }
  };

  const handleDeleteAll = async (onlyRead = false) => {
    setShowDeleteMenu(false);
    try {
      await api.delete(`/users/notifications/all${onlyRead ? '?only_read=true' : ''}`);
      if (onlyRead) {
        setNotifications(prev => prev.filter(n => !n.is_read));
        toast.success('Notifikasi yang sudah dibaca dihapus');
      } else {
        setNotifications([]);
        setUnread(0);
        toast.success('Semua notifikasi dihapus');
      }
    } catch {
      toast.error('Gagal menghapus notifikasi');
    }
  };

  const readCount = notifications.filter(n => n.is_read).length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-900 text-lg">Notifikasi</h2>
          <p className="text-slate-400 text-sm">
            {unread > 0 ? `${unread} belum dibaca` : 'Semua sudah dibaca'}
            {' · '}
            <span className="text-slate-300 text-xs">Otomatis hapus setelah 7 hari</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchNotifications} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <RefreshCw size={16} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {unread > 0 && (
            <button onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors">
              <CheckCheck size={14} /> Baca semua
            </button>
          )}
          {/* Menu hapus */}
          {notifications.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowDeleteMenu(v => !v)}
                className="p-2 rounded-xl hover:bg-red-50 transition-colors group">
                <Trash2 size={16} className="text-slate-400 group-hover:text-red-500 transition-colors" />
              </button>
              <AnimatePresence>
                {showDeleteMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowDeleteMenu(false)} />
                    <motion.div initial={{ opacity: 0, scale: 0.95, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -8 }}
                      className="absolute right-0 top-10 z-20 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden w-52">
                      {readCount > 0 && (
                        <button onClick={() => handleDeleteAll(true)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left">
                          <CheckCheck size={15} className="text-slate-400" />
                          <div>
                            <div className="font-medium">Hapus yang dibaca</div>
                            <div className="text-xs text-slate-400">{readCount} notifikasi</div>
                          </div>
                        </button>
                      )}
                      <button onClick={() => handleDeleteAll(false)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors text-left border-t border-slate-100">
                        <Trash2 size={15} className="text-red-500" />
                        <div>
                          <div className="font-medium">Hapus semua</div>
                          <div className="text-xs text-red-400">{notifications.length} notifikasi</div>
                        </div>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-2 bg-slate-100 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Bell size={24} className="text-slate-300" />
          </div>
          <p className="font-semibold text-slate-500">Belum ada notifikasi</p>
          <p className="text-slate-400 text-sm mt-1">Notifikasi akan muncul di sini</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {notifications.map((notif, i) => {
              const cfg = typeConfig[notif.type] || typeConfig.info;
              const Icon = cfg.icon;
              return (
                <motion.div key={notif.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`card p-4 border ${cfg.border} ${!notif.is_read ? cfg.bg : 'bg-white'} group relative`}>
                  <div className="flex gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${!notif.is_read ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                      <Icon size={17} className={cfg.text} />
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-semibold text-sm ${!notif.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                          {notif.title}
                        </p>
                        {!notif.is_read && <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${cfg.dot}`} />}
                      </div>
                      <p className="text-slate-500 text-sm mt-0.5 leading-relaxed">{notif.message}</p>
                      <p className="text-slate-400 text-xs mt-2">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: id })}
                        {' · '}
                        {format(new Date(notif.created_at), 'dd MMM yyyy HH:mm', { locale: id })}
                      </p>
                    </div>
                  </div>
                  {/* Tombol hapus per item — muncul saat hover */}
                  <button
                    onClick={() => handleDeleteOne(notif.id)}
                    disabled={deletingId === notif.id}
                    className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all disabled:opacity-50">
                    {deletingId === notif.id
                      ? <RefreshCw size={13} className="text-slate-400 animate-spin" />
                      : <X size={13} className="text-slate-400 hover:text-red-500 transition-colors" />}
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

