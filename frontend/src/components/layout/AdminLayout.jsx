import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Clock, FileText, BarChart3, Settings,
  Bell, LogOut, Menu, X, MapPin, Database, Shield, ChevronRight,
  CalendarClock, ListChecks, CalendarDays, Building
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const navGroups = [
  {
    label: 'Utama',
    items: [
      { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
      { path: '/admin/attendance', icon: Clock, label: 'Absensi' },
      { path: '/admin/employees', icon: Users, label: 'Karyawan' },
      { path: '/admin/leaves', icon: FileText, label: 'Perizinan' },
      { path: '/admin/overtime', icon: Clock, label: 'Lembur' },
    ]
  },
  {
    label: 'Konfigurasi',
    items: [
      { path: '/admin/shifts',      icon: CalendarClock, label: 'Shift Kerja',          roles: ['superadmin', 'admin', 'hrd'] },
      { path: '/admin/leave-types', icon: ListChecks,    label: 'Jenis Izin',           roles: ['superadmin', 'admin', 'hrd'] },
      { path: '/admin/departments', icon: Building,      label: 'Departemen & Jabatan', roles: ['superadmin', 'admin', 'hrd'] },
      { path: '/admin/holidays',    icon: CalendarDays,  label: 'Hari Libur Nasional',  roles: ['superadmin', 'admin', 'hrd'] },
      { path: '/admin/locations',   icon: MapPin,        label: 'Lokasi Absensi' },
    ]
  },
  {
    label: 'Analitik',
    items: [
      { path: '/admin/reports',       icon: BarChart3,    label: 'Laporan & Export' },
      { path: '/admin/team-calendar', icon: CalendarDays, label: 'Kalender Tim' },
    ]
  },
  {
    label: 'Sistem',
    items: [
      { path: '/admin/users',     icon: Shield,    label: 'Manajemen User', roles: ['superadmin', 'admin'] },
      { path: '/admin/audit-log', icon: Shield,    label: 'Audit Log',      roles: ['superadmin', 'admin'] },
      { path: '/admin/backup',    icon: Database,  label: 'Backup',         roles: ['superadmin'] },
      { path: '/admin/settings',  icon: Settings,  label: 'Pengaturan',     roles: ['superadmin', 'admin'] },
    ]
  },
];

// ── SidebarNav — komponen terpisah di luar AdminLayout ────────────────────────
// Didefinisikan di luar agar tidak di-recreate setiap render AdminLayout,
// sehingga scroll position nav tetap terjaga saat navigasi antar halaman.
function SidebarNav({ filteredGroups, location, user, onLinkClick, onLogout }) {
  const navRef = useRef(null);

  const isActive = (item) =>
    item.exact
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path);

  // Scroll ke item aktif saat pertama kali mount
  useEffect(() => {
    if (!navRef.current) return;
    const activeEl = navRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []); // hanya saat mount

  return (
    <div className="flex flex-col h-full bg-slate-900 sidebar-dark">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-white/15 border border-white/20">
            <img src="/logo.png" alt="iWare" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="font-bold text-white text-sm">Everiware</div>
            <div className="text-xs text-slate-400 capitalize">{user?.role} Panel</div>
          </div>
        </div>
      </div>

      {/* Nav — overflow-y-auto agar bisa scroll, scroll position dipertahankan */}
      <nav ref={navRef} className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {filteredGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    data-active={active}
                    onClick={onLinkClick}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ease-out active:scale-[0.98] ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'
                    }`}
                  >
                    <item.icon size={17} />
                    <span>{item.label}</span>
                    {active && <ChevronRight size={13} className="ml-auto text-slate-400" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-slate-800 space-y-2 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-800 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
            {user?.avatar
              ? <img src={`/uploads/avatar/${user.avatar}`} alt="" className="w-full h-full object-cover" />
              : user?.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white text-sm truncate">{user?.name}</div>
            <div className="text-xs text-slate-400 truncate">{user?.email}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors text-sm font-medium"
        >
          <LogOut size={16} /> Keluar
        </button>
      </div>
    </div>
  );
}

// ── AdminLayout ───────────────────────────────────────────────────────────────
export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let isFetching = false;
    const fetchUnread = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        const { data } = await api.get('/users/notifications');
        setUnreadCount(data.unread || 0);
      } catch {}
      finally { isFetching = false; }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 120_000); // 2 menit
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Sampai jumpa! 👋');
    navigate('/login');
  };

  const isActive = (item) =>
    item.exact
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path);

  const currentLabel =
    navGroups.flatMap(g => g.items).find(n => isActive(n))?.label || 'Dashboard';

  const filteredGroups = navGroups
    .map(g => ({
      ...g,
      items: g.items.filter(item => !item.roles || item.roles.includes(user?.role))
    }))
    .filter(g => g.items.length > 0);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Desktop Sidebar — tetap mount, tidak pernah unmount ── */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0">
        <SidebarNav
          filteredGroups={filteredGroups}
          location={location}
          user={user}
          onLinkClick={() => {}}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile Sidebar ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-64 z-50 lg:hidden shadow-2xl"
            >
              <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <SidebarNav
                filteredGroups={filteredGroups}
                location={location}
                user={user}
                onLinkClick={() => setSidebarOpen(false)}
                onLogout={handleLogout}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-0 flex items-center justify-between flex-shrink-0 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <Menu size={18} className="text-slate-600" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm hidden sm:block">Everiware</span>
              <span className="text-slate-300 hidden sm:block">/</span>
              <span className="font-semibold text-slate-900 text-sm">{currentLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:block text-xs text-slate-400 mr-2">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>

            <Link to="/admin/notifications" className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <Bell size={18} className="text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0">
                {user?.avatar
                  ? <img src={`/uploads/avatar/${user.avatar}`} alt="" className="w-full h-full object-cover" />
                  : user?.name?.[0]}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-semibold text-slate-800 leading-none">{user?.name?.split(' ')[0]}</div>
                <div className="text-[10px] text-slate-400 capitalize leading-none mt-0.5">{user?.role}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Title bar — hanya tampil di halaman yang tidak punya hero banner sendiri */}
          {location.pathname !== '/admin' && (
            <div className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3.5 flex items-center gap-3">
              <div className="w-1 h-5 bg-slate-800 rounded-full" />
              <h1 className="text-base font-bold text-slate-900">{currentLabel}</h1>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="p-4 sm:p-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}


