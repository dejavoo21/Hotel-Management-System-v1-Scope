import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { getUserPermissions, isSuperAdminUser, type PermissionId } from '@/utils/userAccess';
import SkipLink from '@/components/SkipLink';

// Layouts
import AuthLayout from '@/components/layouts/AuthLayout';
import DashboardLayout from '@/components/layouts/DashboardLayoutNew';

// Auth Pages
import LoginPage from '@/pages/auth/LoginPage';
import TwoFactorPage from '@/pages/auth/TwoFactorPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import RequestAccessPage from '@/pages/auth/RequestAccessPage';

// Dashboard Pages
import DashboardPage from '@/pages/DashboardPage';
import RoomsPage from '@/pages/RoomsPage';
import BookingsPage from '@/pages/BookingsPage';
import BookingDetailPage from '@/pages/BookingDetailPage';
import GuestsPage from '@/pages/GuestsPage';
import HousekeepingPage from '@/pages/HousekeepingPage';
import ReportsPage from '@/pages/ReportsPage';
import InvoicesPage from '@/pages/InvoicesPage';
import ExpensesPage from '@/pages/ExpensesPage';
import SettingsPage from '@/pages/SettingsPage';
import UsersPage from '@/pages/UsersPage';
import ReviewsPage from '@/pages/ReviewsPage';
import ConciergePage from '@/pages/ConciergePage';
import InventoryPage from '@/pages/InventoryPage';
import CalendarPage from '@/pages/CalendarPage';
import MessagesPage from '@/pages/MessagesPageRedesigned';
import CallsPage from '@/pages/CallsPage';
import ForcePasswordChangePage from '@/pages/auth/ForcePasswordChangePage';
import NotAuthorizedPage from '@/pages/NotAuthorizedPage';

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.mustChangePassword && location.pathname !== '/force-password-change') {
    return <Navigate to="/force-password-change" replace />;
  }

  return <>{children}</>;
}

// Module-protected route wrapper - checks module permissions
function ModuleRoute({ 
  children, 
  requiredModule 
}: { 
  children: React.ReactNode; 
  requiredModule: PermissionId;
}) {
  const { user } = useAuthStore();
  
  const userPermissions = getUserPermissions(
    user?.id, 
    user?.role, 
    user?.modulePermissions as PermissionId[] | undefined
  );
  const isSuperAdmin = isSuperAdminUser(user?.id);
  const hasAccess = isSuperAdmin || userPermissions.includes(requiredModule);

  if (!hasAccess) {
    return <NotAuthorizedPage />;
  }

  return <>{children}</>;
}

// Public Route wrapper (redirect if already authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    if (user?.mustChangePassword) {
      return <Navigate to="/force-password-change" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <SkipLink />
      <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/2fa"
          element={
            <PublicRoute>
              <TwoFactorPage />
            </PublicRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicRoute>
              <ResetPasswordPage />
            </PublicRoute>
          }
        />
        <Route
          path="/request-access"
          element={
            <PublicRoute>
              <RequestAccessPage />
            </PublicRoute>
          }
        />
      </Route>

      {/* Protected Dashboard Routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="force-password-change" element={<ForcePasswordChangePage />} />
        <Route index element={<ModuleRoute requiredModule="dashboard"><DashboardPage /></ModuleRoute>} />
        <Route path="rooms" element={<ModuleRoute requiredModule="rooms"><RoomsPage /></ModuleRoute>} />
        <Route path="bookings" element={<ModuleRoute requiredModule="bookings"><BookingsPage /></ModuleRoute>} />
        <Route path="bookings/:id" element={<ModuleRoute requiredModule="bookings"><BookingDetailPage /></ModuleRoute>} />
        <Route path="inventory" element={<ModuleRoute requiredModule="inventory"><InventoryPage /></ModuleRoute>} />
        <Route path="messages" element={<ModuleRoute requiredModule="messages"><MessagesPage /></ModuleRoute>} />
        <Route path="calls" element={<ModuleRoute requiredModule="messages"><CallsPage /></ModuleRoute>} />
        <Route path="calendar" element={<ModuleRoute requiredModule="calendar"><CalendarPage /></ModuleRoute>} />
        <Route path="guests" element={<ModuleRoute requiredModule="guests"><GuestsPage /></ModuleRoute>} />
        <Route path="housekeeping" element={<ModuleRoute requiredModule="housekeeping"><HousekeepingPage /></ModuleRoute>} />
        <Route path="reports" element={<ModuleRoute requiredModule="financials"><ReportsPage /></ModuleRoute>} />
        <Route path="invoices" element={<ModuleRoute requiredModule="financials"><InvoicesPage /></ModuleRoute>} />
        <Route path="expenses" element={<ModuleRoute requiredModule="financials"><ExpensesPage /></ModuleRoute>} />
        <Route path="reviews" element={<ModuleRoute requiredModule="reviews"><ReviewsPage /></ModuleRoute>} />
        <Route path="concierge" element={<ModuleRoute requiredModule="concierge"><ConciergePage /></ModuleRoute>} />
        <Route path="settings" element={<ModuleRoute requiredModule="settings"><SettingsPage /></ModuleRoute>} />
        <Route path="users" element={<ModuleRoute requiredModule="users"><UsersPage /></ModuleRoute>} />
        <Route path="not-authorized" element={<NotAuthorizedPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
