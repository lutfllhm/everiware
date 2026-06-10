import { Link, useLocation } from 'react-router-dom';
import { Home, Clock, FileText, User, Bell, LogOut, Timer } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/axios';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

const navItems = [
  { path: '/dashboard', icon: Home, label: 'Beranda' },
  { path: '/attendance', icon: Clock, label: 'Absensi' },
  { path: '/leave', icon: FileText, label: 'Izin & Cuti' },
  { path: '/overtime', icon: Timer, label: 'Lembur' },
  { path: '/notifications', icon: Bell, label: 'Notifikasi', badge: true },
  { path: '/profile', icon: User, label: 'Profil' },
];

export default function EmployeeLayout({ children }) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const prevUnreadRef = useRef(0);
  const isNotifPage = location.pathname === '/notifications';

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await api.get('/users/notifications');
      const newUnread = data.unread || 0;

      // Jika ada notif baru dan bukan di halaman notifikasi → tampilkan toast
      if (newUnread > prevUnreadRef.current && prevUnreadRef.current !== null && !isNotifPage) {
        const diff = newUnread - prevUnreadRef.current;
        toast(
          (t) => (
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => { navigate('/notifications'); toast.dismiss(t.id); }}
            >
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell size={15} className="text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {diff === 1 ? '1 notifikasi baru' : `${diff} notifikasi baru`}
                </p>
                <p className="text-xs text-slate-400">Tap untuk melihat</p>
              </div>
            </div>
          ),
          {
            duration: 4000,
            style: { padding: '10px 14px', borderRadius: '14px', background: '#fff', color: '#1e293b', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' },
          }
        );
      }

      prevUnreadRef.current = newUnread;
      setUnread(newUnread);
    } catch {}
  }, [isNotifPage, navigate]);

  // Auto-refresh badge setiap 15 detik
  useAutoRefresh(fetchUnread, 15_000);

  // Reset unread saat masuk halaman notifikasi
  useEffect(() => {
    if (isNotifPage && unread > 0) {
      api.put('/users/notifications/read').catch(() => {});
      setUnread(0);
      prevUnreadRef.current = 0;
    }
  }, [isNotifPage, unread]);

  const handleLogout = () => {
    logout();
    toast.success('Sampai jumpa! 👋');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-slate-100 fixed top-0 left-0 bottom-0 z-30">
        {/* Logo */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm flex-shrink-0 bg-slate-100">
              <img src="/logo.png" alt="iWare" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">Everiware</div>
              <div className="text-xs text-slate-400">Portal Karyawan</div>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
              {user?.avatar
                ? <img src={`/uploads/avatar/${user.avatar}`} alt="" className="w-full h-full object-cover" />
                : user?.name?.[0]}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 text-sm truncate">{user?.name}</div>
              <div className="text-xs text-slate-400 truncate">{[user?.department, user?.position].filter(Boolean).join(' · ') || 'Karyawan'}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ease-out active:scale-[0.98] ${
                  active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:translate-x-1'
                }`}>
                <div className="relative">
                  <item.icon size={18} />
                  {item.badge && unread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 bg-red-500 rounded-full text-white text-[8px] font-bold flex items-center justify-center px-0.5 animate-pulse">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </div>
                <span className="flex-1">{item.label}</span>
                {item.badge && unread > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-100">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors font-medium text-sm">
            <LogOut size={18} /> Keluar
          </button>        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">

        {/* Top Header */}
        <header className="bg-white border-b border-slate-100 px-4 lg:px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                <img src="/logo.png" alt="iWare" className="w-full h-full object-contain" />
              </div>
              <span className="font-bold text-slate-900 text-sm">Everiware</span>
            </div>
            {/* Desktop page title */}
            <div className="hidden lg:block">
              <h1 className="font-bold text-slate-900">
                {navItems.find(n => isActive(n.path))?.label || 'Dashboard'}
              </h1>
              <p className="text-xs text-slate-400">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/notifications" className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <Bell size={18} className="text-slate-600" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-1 animate-pulse">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            {/* Desktop user chip */}
            <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0">
                {user?.avatar
                  ? <img src={`/uploads/avatar/${user.avatar}`} alt="" className="w-full h-full object-cover" />
                  : user?.name?.[0]}
              </div>
              <span className="text-sm font-medium text-slate-700">{user?.name?.split(' ')[0]}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 pb-24 lg:pb-6">
          {/* Desktop: wider container */}
          <div className="lg:max-w-5xl lg:mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* ── Mobile Bottom Navigation ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-30 pb-safe">
          <div className="flex items-center justify-around px-1 py-2">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path} className="flex flex-col items-center gap-1 px-3 py-2 relative">
                  {active && (
                    <motion.div layoutId="mobile-nav-indicator" className="absolute inset-0 bg-slate-100 rounded-2xl" />
                  )}
                  <div className="relative z-10">
                    <item.icon size={21} className={`transition-colors ${active ? 'text-slate-900' : 'text-slate-400'}`} />
                    {item.badge && unread > 0 && (
                      <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 bg-red-500 rounded-full text-white text-[8px] font-bold flex items-center justify-center px-0.5 animate-pulse">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium relative z-10 transition-colors ${active ? 'text-slate-900' : 'text-slate-400'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}





