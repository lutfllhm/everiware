import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BellRing, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle,
  RefreshCw, Trash2, X, Clock,
} from 'lucide-react';
import api from '../../api/axios';
import { formatDistanceToNow, format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';

const typeConfig = {
  info:    { icon: Info,          color: '#0284C7', bg: '#F0F9FF' },
  success: { icon: CheckCircle,   color: '#0D9488', bg: '#F0FDFA' },
  warning: { icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB' },
  error:   { icon: XCircle,       color: '#DC2626', bg: '#FEF2F2' },
};

/** Tebak halaman tujuan dari judul notifikasi, seperti di app mobile. */
const routeForTitle = (title = '') => {
  if (title.includes('Lembur')) return '/overtime';
  if (title.includes('Izin') || title.includes('Cuti')) return '/leave';
  if (title.includes('Absen')) return '/attendance';
  return null;
};

export default function NotificationsPage() {
  const navigate = useNavigate();
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

  const handleOpen = (notif) => {
    const route = routeForTitle(notif.title);
    if (!route) return;
    if (!notif.is_read) {
      api.put('/users/notifications/read').catch(() => {});
      setNotifications(prev => prev.map(n => (n.id === notif.id ? { ...n, is_read: true } : n)));
      setUnread(u => Math.max(0, u - 1));
    }
    navigate(route);
  };

  const readCount = notifications.filter(n => n.is_read).length;

  const headerActions = (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {unread > 0 && (
        <HeaderIconButton onClick={handleMarkAllRead} label="Tandai semua dibaca">
          <CheckCheck size={18} className="text-white" />
        </HeaderIconButton>
      )}

      {notifications.length > 0 && (
        <div className="relative">
          <HeaderIconButton onClick={() => setShowDeleteMenu(v => !v)} label="Hapus notifikasi">
            <Trash2 size={17} className="text-white" />
          </HeaderIconButton>

          <AnimatePresence>
            {showDeleteMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDeleteMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  className="absolute right-0 top-11 z-20 bg-white rounded-2xl shadow-xl border border-[#E7E5E4] overflow-hidden w-52"
                >
                  {readCount > 0 && (
                    <button onClick={() => handleDeleteAll(true)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:bg-stone-50 transition-colors text-left">
                      <CheckCheck size={15} className="text-stone-400" />
                      <span>
                        <span className="block font-medium">Hapus yang dibaca</span>
                        <span className="block text-xs text-stone-400">{readCount} notifikasi</span>
                      </span>
                    </button>
                  )}
                  <button onClick={() => handleDeleteAll(false)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors text-left border-t border-[#F5F5F4]">
                    <Trash2 size={15} className="text-red-500" />
                    <span>
                      <span className="block font-medium">Hapus semua</span>
                      <span className="block text-xs text-red-400">{notifications.length} notifikasi</span>
                    </span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      <HeaderIconButton onClick={fetchNotifications} label="Segarkan">
        <RefreshCw size={17} className={`text-white ${loading ? 'animate-spin' : ''}`} />
      </HeaderIconButton>
    </div>
  );

  return (
    <div className="bg-[#F8F7F5] min-h-screen">
      <PageHeader
        title="Pemberitahuan HRD"
        showBack
        subtitle={`${unread > 0 ? `${unread} belum dibaca` : 'Semua sudah dibaca'} · Otomatis hapus setelah 7 hari`}
        right={headerActions}
      >
        <div className="flex justify-center py-5">
          <div className="w-[100px] h-[100px] rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.25)] flex items-center justify-center">
            <div className="w-[84px] h-[84px] rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8B1F1F 0%, #DC2626 100%)' }}>
              <BellRing size={40} className="text-white" />
            </div>
          </div>
        </div>
      </PageHeader>

      <div className="px-4 pt-4 pb-8 lg:px-8 lg:max-w-3xl lg:mx-auto">
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-[14px] border border-[#E7E5E4] p-3 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-stone-100 rounded-[10px] flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 bg-stone-100 rounded w-3/4" />
                    <div className="h-3 bg-stone-100 rounded w-full" />
                    <div className="h-2 bg-stone-100 rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E7E5E4] p-12 text-center">
            <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Bell size={24} className="text-stone-300" />
            </div>
            <p className="font-semibold text-stone-500">Belum ada notifikasi</p>
            <p className="text-stone-400 text-sm mt-1">Notifikasi akan muncul di sini</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence>
              {notifications.map((notif, i) => {
                const cfg = typeConfig[notif.type] || typeConfig.info;
                const Icon = cfg.icon;
                const isRead = !!notif.is_read;
                const route = routeForTitle(notif.title);

                return (
                  <motion.div key={notif.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => handleOpen(notif)}
                    className={`relative group rounded-[14px] border p-3 transition-colors ${
                      route ? 'cursor-pointer' : ''
                    }`}
                    style={{
                      backgroundColor: isRead ? '#FFFFFF' : cfg.bg,
                      borderColor: isRead ? '#E7E5E4' : `${cfg.color}33`,
                    }}
                  >
                    <div className="flex gap-3">
                      <span className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: isRead ? '#F5F5F4' : `${cfg.color}1F` }}>
                        <Icon size={20} style={{ color: isRead ? '#A8A29E' : cfg.color }} />
                      </span>

                      <div className="flex-1 min-w-0 pr-5">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-bold text-[13px] ${isRead ? 'text-stone-600' : 'text-stone-900'}`}>
                            {notif.title}
                          </p>
                          {!isRead && (
                            <span className="w-[7px] h-[7px] rounded-full flex-shrink-0 mt-1"
                              style={{ backgroundColor: cfg.color }} />
                          )}
                        </div>

                        <p className={`text-xs mt-1 leading-relaxed ${isRead ? 'text-stone-400' : 'text-stone-600'}`}>
                          {notif.message}
                        </p>

                        <div className="flex items-center gap-1 mt-1.5">
                          <Clock size={10} className="text-stone-400 flex-shrink-0" />
                          <span className="text-[11px] text-stone-400">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: id })}
                            {' · '}
                            {format(new Date(notif.created_at), 'dd MMM yyyy HH:mm', { locale: id })}
                          </span>
                          {route && (
                            <span className="ml-auto text-[11px] font-semibold flex-shrink-0"
                              style={{ color: cfg.color }}>
                              Lihat →
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tombol hapus per item — muncul saat hover */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteOne(notif.id); }}
                      disabled={deletingId === notif.id}
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-red-50 transition-all disabled:opacity-50"
                      aria-label="Hapus notifikasi"
                    >
                      {deletingId === notif.id
                        ? <RefreshCw size={13} className="text-stone-400 animate-spin" />
                        : <X size={13} className="text-stone-400 hover:text-red-500 transition-colors" />}
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function HeaderIconButton({ onClick, label, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-9 h-9 rounded-xl bg-white/20 border border-white/[0.12] flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all"
    >
      {children}
    </button>
  );
}
