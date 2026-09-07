import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useAuthStore from './store/authStore';
import api from './api/axios';

// Pages
import LoginPage from './pages/LoginPage';
import ActivateAccountPage from './pages/ActivateAccountPage';

// Employee
import EmployeeLayout from './components/layout/EmployeeLayout';
import DashboardPage from './pages/employee/DashboardPage';
import AttendancePage from './pages/employee/AttendancePage';
import LeavePage from './pages/employee/LeavePage';
import ProfilePage from './pages/employee/ProfilePage';
import NotificationsPage from './pages/employee/NotificationsPage';
import OvertimePage from './pages/employee/OvertimePage';

// Admin
import AdminLayout from './components/layout/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AttendanceAdmin from './pages/admin/AttendanceAdmin';
import EmployeesAdmin from './pages/admin/EmployeesAdmin';
import LeavesAdmin from './pages/admin/LeavesAdmin';
import ReportsAdmin from './pages/admin/ReportsAdmin';
import LocationsAdmin from './pages/admin/LocationsAdmin';
import BackupAdmin from './pages/admin/BackupAdmin';
import NotificationsAdmin from './pages/admin/NotificationsAdmin';
import SettingsAdmin from './pages/admin/SettingsAdmin';
import ShiftsAdmin from './pages/admin/ShiftsAdmin';
import LeaveTypesAdmin from './pages/admin/LeaveTypesAdmin';
import TeamCalendarAdmin from './pages/admin/TeamCalendarAdmin';
import UsersAdmin from './pages/admin/UsersAdmin';
import DepartmentsAdmin from './pages/admin/DepartmentsAdmin';
import OvertimeAdmin from './pages/admin/OvertimeAdmin';
import HolidaysAdmin from './pages/admin/HolidaysAdmin';
import AuditLogAdmin from './pages/admin/AuditLogAdmin';
import RealtimeListener from './components/common/RealtimeListener';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore();
  // Fallback: baca langsung dari localStorage
  const stored = (() => { try { return JSON.parse(localStorage.getItem('iware-auth') || '{}'); } catch { return {}; } })();
  const auth = isAuthenticated || stored.isAuthenticated;
  const currentUser = user || stored.user;

  if (!auth) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(currentUser?.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  const stored = (() => { try { return JSON.parse(localStorage.getItem('iware-auth') || '{}'); } catch { return {}; } })();
  const auth = isAuthenticated || stored.isAuthenticated;
  const currentUser = user || stored.user;

  const hasAdminRole = ['superadmin', 'admin', 'hrd'].includes(currentUser?.role);
  const hasAnyPermission = Array.isArray(currentUser?.permissions) && currentUser.permissions.length > 0;

  if (!auth) return <Navigate to="/login" replace />;
  if (!hasAdminRole && !hasAnyPermission) return <Navigate to="/dashboard" replace />;
  return <AdminLayout>{children}</AdminLayout>;
};

// Membungkus halaman admin yang bisa diberikan sebagai grant granular (mis. shifts.manage).
// Role admin-tier selalu lolos. Employee non-admin wajib memegang `feature` di user.permissions.
const FeatureRoute = ({ children, feature }) => {
  const { user } = useAuthStore();
  const stored = (() => { try { return JSON.parse(localStorage.getItem('iware-auth') || '{}'); } catch { return {}; } })();
  const currentUser = user || stored.user;

  const hasAdminRole = ['superadmin', 'admin', 'hrd'].includes(currentUser?.role);
  if (hasAdminRole) return children;

  const hasFeature = feature && Array.isArray(currentUser?.permissions) && currentUser.permissions.includes(feature);
  if (!hasFeature) return <Navigate to="/admin/shifts" replace />;
  return children;
};

const EmployeeRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  const stored = (() => { try { return JSON.parse(localStorage.getItem('iware-auth') || '{}'); } catch { return {}; } })();
  const auth = isAuthenticated || stored.isAuthenticated;

  if (!auth) return <Navigate to="/login" replace />;
  return <EmployeeLayout>{children}</EmployeeLayout>;
};

// Ke mana user diarahkan setelah login/buka root path.
// Admin-tier -> /admin. Employee dengan grant fitur (mis. shifts.manage) -> langsung ke
// halaman fitur pertama yang dia pegang, bukan /admin (yang akan redirect balik ke situ juga).
// Employee biasa tanpa grant apa pun -> /dashboard (portal karyawan).
const getHomeRoute = (currentUser) => {
  if (['superadmin', 'admin', 'hrd'].includes(currentUser?.role)) return '/admin';
  if (Array.isArray(currentUser?.permissions) && currentUser.permissions.includes('shifts.manage')) return '/admin/shifts';
  return '/dashboard';
};

export default function App() {
  const { isAuthenticated, user } = useAuthStore();
  const stored = (() => { try { return JSON.parse(localStorage.getItem('iware-auth') || '{}'); } catch { return {}; } })();
  const auth = isAuthenticated || stored.isAuthenticated;
  const currentUser = user || stored.user;

  // Validasi token secara diam-diam begitu app dibuka (mis. setelah lama tidak dibuka).
  // Kalau token sudah tidak valid, interceptor di api/axios.js yang akan menangani
  // logout + redirect halus, jadi tab lama tidak terasa "macet" sebelum ter-reload paksa.
  useEffect(() => {
    if (auth) {
      api.get('/auth/me').catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeListener />
      <BrowserRouter>
        <Toaster position="top-center" toastOptions={{
          style: { borderRadius: '12px', background: '#1e293b', color: '#f8fafc', fontSize: '14px' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }} />
        <Routes>
          <Route path="/" element={auth ? <Navigate to={getHomeRoute(currentUser)} replace /> : <LoginPage />} />
          <Route path="/login" element={auth ? <Navigate to={getHomeRoute(currentUser)} replace /> : <LoginPage />} />
          
          {/* Aktivasi akun karyawan baru */}
          <Route path="/activate/:token" element={<ActivateAccountPage />} />

          {/* Employee Routes */}
          <Route path="/dashboard" element={<EmployeeRoute><DashboardPage /></EmployeeRoute>} />
          <Route path="/attendance" element={<EmployeeRoute><AttendancePage /></EmployeeRoute>} />
          <Route path="/leave" element={<EmployeeRoute><LeavePage /></EmployeeRoute>} />
          <Route path="/leave/annual" element={<EmployeeRoute><LeavePage defaultTab={1} defaultType="annual" /></EmployeeRoute>} />
          <Route path="/leave/sick" element={<EmployeeRoute><LeavePage defaultTab={1} defaultType="sick" /></EmployeeRoute>} />
          <Route path="/leave/late-permission" element={<EmployeeRoute><LeavePage defaultTab={1} defaultType="late_permission" /></EmployeeRoute>} />
          <Route path="/leave/early-leave" element={<EmployeeRoute><LeavePage defaultTab={1} defaultType="early_leave" /></EmployeeRoute>} />
          <Route path="/leave/dinas" element={<EmployeeRoute><LeavePage defaultTab={1} defaultType="dinas" /></EmployeeRoute>} />
          <Route path="/leave/leave-office" element={<EmployeeRoute><LeavePage defaultTab={1} defaultType="leave_office" /></EmployeeRoute>} />
          <Route path="/profile" element={<EmployeeRoute><ProfilePage /></EmployeeRoute>} />
          <Route path="/notifications" element={<EmployeeRoute><NotificationsPage /></EmployeeRoute>} />
          <Route path="/overtime" element={<EmployeeRoute><OvertimePage /></EmployeeRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminRoute><FeatureRoute><AdminDashboard /></FeatureRoute></AdminRoute>} />
          <Route path="/admin/attendance" element={<AdminRoute><FeatureRoute><AttendanceAdmin /></FeatureRoute></AdminRoute>} />
          <Route path="/admin/employees" element={<AdminRoute><FeatureRoute><EmployeesAdmin /></FeatureRoute></AdminRoute>} />
          <Route path="/admin/leaves" element={<AdminRoute><FeatureRoute><LeavesAdmin /></FeatureRoute></AdminRoute>} />
          <Route path="/admin/reports" element={<AdminRoute><FeatureRoute><ReportsAdmin /></FeatureRoute></AdminRoute>} />
          <Route path="/admin/locations" element={<AdminRoute><FeatureRoute><LocationsAdmin /></FeatureRoute></AdminRoute>} />
          <Route path="/admin/backup" element={<AdminRoute><ProtectedRoute roles={['superadmin']}><BackupAdmin /></ProtectedRoute></AdminRoute>} />
          <Route path="/admin/notifications" element={<AdminRoute><FeatureRoute><NotificationsAdmin /></FeatureRoute></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><ProtectedRoute roles={['superadmin', 'admin']}><UsersAdmin /></ProtectedRoute></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><ProtectedRoute roles={['superadmin', 'admin']}><SettingsAdmin /></ProtectedRoute></AdminRoute>} />
          <Route path="/admin/shifts" element={<AdminRoute><FeatureRoute feature="shifts.manage"><ShiftsAdmin /></FeatureRoute></AdminRoute>} />
          <Route path="/admin/leave-types" element={<AdminRoute><FeatureRoute><LeaveTypesAdmin /></FeatureRoute></AdminRoute>} />
          <Route path="/admin/team-calendar" element={<AdminRoute><FeatureRoute><TeamCalendarAdmin /></FeatureRoute></AdminRoute>} />
          <Route path="/admin/departments" element={<AdminRoute><FeatureRoute><DepartmentsAdmin /></FeatureRoute></AdminRoute>} />
          <Route path="/admin/overtime" element={<AdminRoute><FeatureRoute><OvertimeAdmin /></FeatureRoute></AdminRoute>} />
          <Route path="/admin/holidays" element={<AdminRoute><FeatureRoute><HolidaysAdmin /></FeatureRoute></AdminRoute>} />
          <Route path="/admin/audit-log" element={<AdminRoute><ProtectedRoute roles={['superadmin', 'admin']}><AuditLogAdmin /></ProtectedRoute></AdminRoute>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
