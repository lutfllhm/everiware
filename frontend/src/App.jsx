import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useAuthStore from './store/authStore';

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

  if (!auth) return <Navigate to="/login" replace />;
  if (!['superadmin', 'admin', 'hrd'].includes(currentUser?.role)) return <Navigate to="/dashboard" replace />;
  return <AdminLayout>{children}</AdminLayout>;
};

const EmployeeRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  const stored = (() => { try { return JSON.parse(localStorage.getItem('iware-auth') || '{}'); } catch { return {}; } })();
  const auth = isAuthenticated || stored.isAuthenticated;

  if (!auth) return <Navigate to="/login" replace />;
  return <EmployeeLayout>{children}</EmployeeLayout>;
};

export default function App() {
  const { isAuthenticated, user } = useAuthStore();
  const stored = (() => { try { return JSON.parse(localStorage.getItem('iware-auth') || '{}'); } catch { return {}; } })();
  const auth = isAuthenticated || stored.isAuthenticated;
  const currentUser = user || stored.user;

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
          <Route path="/" element={auth ? <Navigate to={['superadmin','admin','hrd'].includes(currentUser?.role) ? '/admin' : '/dashboard'} replace /> : <LoginPage />} />
          <Route path="/login" element={auth ? <Navigate to={['superadmin','admin','hrd'].includes(currentUser?.role) ? '/admin' : '/dashboard'} replace /> : <LoginPage />} />
          
          {/* Aktivasi akun karyawan baru */}
          <Route path="/activate/:token" element={<ActivateAccountPage />} />

          {/* Employee Routes */}
          <Route path="/dashboard" element={<EmployeeRoute><DashboardPage /></EmployeeRoute>} />
          <Route path="/attendance" element={<EmployeeRoute><AttendancePage /></EmployeeRoute>} />
          <Route path="/leave" element={<EmployeeRoute><LeavePage /></EmployeeRoute>} />
          <Route path="/leave/annual" element={<EmployeeRoute><LeavePage defaultTab={1} /></EmployeeRoute>} />
          <Route path="/leave/sick" element={<EmployeeRoute><LeavePage defaultTab={2} /></EmployeeRoute>} />
          <Route path="/profile" element={<EmployeeRoute><ProfilePage /></EmployeeRoute>} />
          <Route path="/notifications" element={<EmployeeRoute><NotificationsPage /></EmployeeRoute>} />
          <Route path="/overtime" element={<EmployeeRoute><OvertimePage /></EmployeeRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/attendance" element={<AdminRoute><AttendanceAdmin /></AdminRoute>} />
          <Route path="/admin/employees" element={<AdminRoute><EmployeesAdmin /></AdminRoute>} />
          <Route path="/admin/leaves" element={<AdminRoute><LeavesAdmin /></AdminRoute>} />
          <Route path="/admin/reports" element={<AdminRoute><ReportsAdmin /></AdminRoute>} />
          <Route path="/admin/locations" element={<AdminRoute><LocationsAdmin /></AdminRoute>} />
          <Route path="/admin/backup" element={<AdminRoute><BackupAdmin /></AdminRoute>} />
          <Route path="/admin/notifications" element={<AdminRoute><NotificationsAdmin /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><UsersAdmin /></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><SettingsAdmin /></AdminRoute>} />
          <Route path="/admin/shifts" element={<AdminRoute><ShiftsAdmin /></AdminRoute>} />
          <Route path="/admin/leave-types" element={<AdminRoute><LeaveTypesAdmin /></AdminRoute>} />
          <Route path="/admin/team-calendar" element={<AdminRoute><TeamCalendarAdmin /></AdminRoute>} />
          <Route path="/admin/departments" element={<AdminRoute><DepartmentsAdmin /></AdminRoute>} />
          <Route path="/admin/overtime" element={<AdminRoute><OvertimeAdmin /></AdminRoute>} />
          <Route path="/admin/holidays" element={<AdminRoute><HolidaysAdmin /></AdminRoute>} />
          <Route path="/admin/audit-log" element={<AdminRoute><AuditLogAdmin /></AdminRoute>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
