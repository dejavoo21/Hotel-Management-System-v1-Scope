import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { getExplicitPermissions, isSuperAdminUser, type PermissionId, type UserRole } from '@/utils/userAccess';
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
import EnterpriseCommandCenterPage from '@/pages/EnterpriseCommandCenterPage';
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
import OperationsCenterPage from '@/pages/OperationsCenterPage';
import EnterpriseSearchPage from '@/pages/EnterpriseSearchPage';
import HotelBrainPage from '@/pages/HotelBrainPage';
import SecurityCenterPage from '@/pages/SecurityCenterPage';
import MaintenanceCenterPage from '@/pages/MaintenanceCenterPage';
import SmartBuildingPage from '@/pages/SmartBuildingPage';
import IncidentCenterPage from '@/features/incidents/IncidentCenterPage';
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

// Priority order for redirect when user doesn't have access to dashboard
const MODULE_ROUTE_PRIORITY: { module: PermissionId; path: string }[] = [
  { module: 'dashboard', path: '/' },
  { module: 'bookings', path: '/bookings' },
  { module: 'rooms', path: '/rooms' },
  { module: 'housekeeping', path: '/housekeeping' },
  { module: 'messages', path: '/messages' },
  { module: 'guests', path: '/guests' },
  { module: 'calendar', path: '/calendar' },
  { module: 'inventory', path: '/inventory' },
  { module: 'security_center', path: '/security-center' },
  { module: 'incident_management', path: '/incidents' },
  { module: 'maintenance_center', path: '/maintenance-center' },
  { module: 'smart_building', path: '/operations/smart-building' },
];

// Helper to get first allowed page for a user
function getFirstAllowedPath(user: { id?: string; role?: string; modulePermissions?: string[] } | null): string {
  if (!user) return '/login';
  
  const isSuperAdmin = isSuperAdminUser(user.id, user.role as UserRole | undefined);
  if (isSuperAdmin) return '/';
  
  const permissions = getExplicitPermissions(user.id, user.modulePermissions as PermissionId[] | undefined);
  
  for (const { module, path } of MODULE_ROUTE_PRIORITY) {
    if (permissions.includes(module)) {
      return path;
    }
  }
  
  // No allowed pages - go to not-authorized
  return '/not-authorized';
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
  
  const userPermissions = getExplicitPermissions(
    user?.id, 
    user?.modulePermissions as PermissionId[] | undefined
  );
  const isSuperAdmin = isSuperAdminUser(user?.id, user?.role as UserRole | undefined);
  const hasAccess = isSuperAdmin || userPermissions.includes(requiredModule);

  if (!hasAccess) {
    // Redirect to first allowed page instead of NotAuthorized
    const firstAllowed = getFirstAllowedPath(user);
    if (firstAllowed !== '/not-authorized') {
      return <Navigate to={firstAllowed} replace />;
    }
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
    // Redirect to first allowed page based on permissions
    const firstAllowed = getFirstAllowedPath(user);
    return <Navigate to={firstAllowed} replace />;
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
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="enterprise-command-center" element={<ModuleRoute requiredModule="dashboard"><EnterpriseCommandCenterPage /></ModuleRoute>} />
        <Route path="rooms" element={<ModuleRoute requiredModule="rooms"><RoomsPage /></ModuleRoute>} />
        <Route path="bookings" element={<ModuleRoute requiredModule="bookings"><BookingsPage /></ModuleRoute>} />
        <Route path="reservations" element={<Navigate to="/bookings" replace />} />
        <Route path="bookings/:id" element={<ModuleRoute requiredModule="bookings"><BookingDetailPage /></ModuleRoute>} />
        <Route path="inventory" element={<ModuleRoute requiredModule="inventory"><InventoryPage /></ModuleRoute>} />
        <Route path="messages" element={<ModuleRoute requiredModule="messages"><MessagesPage /></ModuleRoute>} />
        <Route path="calls" element={<ModuleRoute requiredModule="messages"><CallsPage /></ModuleRoute>} />
        <Route path="operations" element={<Navigate to="/operations-center" replace />} />
        <Route path="operations/ai" element={<Navigate to="/operations-center/ai" replace />} />
        <Route path="operations/revenue" element={<Navigate to="/operations-center/revenue" replace />} />
        <Route path="operations/weather" element={<Navigate to="/operations-center/weather" replace />} />
        <Route path="operations/tasks" element={<Navigate to="/operations-center/tasks" replace />} />
        <Route path="operations/market-intelligence" element={<Navigate to="/operations-center/market-intelligence" replace />} />
        <Route path="operations-center" element={<ModuleRoute requiredModule="bookings"><OperationsCenterPage /></ModuleRoute>} />
        <Route path="operations-center/search" element={<ModuleRoute requiredModule="bookings"><EnterpriseSearchPage /></ModuleRoute>} />
        <Route path="operations-center/ai" element={<ModuleRoute requiredModule="bookings"><OperationsCenterPage /></ModuleRoute>} />
        <Route path="ai/hotel-brain" element={<ModuleRoute requiredModule="bookings"><HotelBrainPage /></ModuleRoute>} />
        <Route path="operations-center/revenue" element={<ModuleRoute requiredModule="financials"><OperationsCenterPage /></ModuleRoute>} />
        <Route path="operations-center/weather" element={<ModuleRoute requiredModule="bookings"><OperationsCenterPage /></ModuleRoute>} />
        <Route path="operations-center/tasks" element={<ModuleRoute requiredModule="bookings"><OperationsCenterPage /></ModuleRoute>} />
        <Route path="operations-center/market-intelligence" element={<ModuleRoute requiredModule="bookings"><OperationsCenterPage /></ModuleRoute>} />
        <Route path="incidents" element={<ModuleRoute requiredModule="incident_management"><IncidentCenterPage /></ModuleRoute>} />
        <Route path="security-center" element={<ModuleRoute requiredModule="security_center"><SecurityCenterPage /></ModuleRoute>} />
        <Route path="security-center/:tab" element={<ModuleRoute requiredModule="security_center"><SecurityCenterPage /></ModuleRoute>} />
        <Route path="operations/security/cctv" element={<Navigate to="/security-center/cctv" replace />} />
        <Route path="operations/security/access-logs" element={<Navigate to="/security-center/access-logs" replace />} />
        <Route path="operations/security/visitors" element={<Navigate to="/security-center/visitors" replace />} />
        <Route path="operations/security/alerts" element={<Navigate to="/security-center/alerts" replace />} />
        <Route path="operations/smart-building" element={<ModuleRoute requiredModule="smart_building"><SmartBuildingPage /></ModuleRoute>} />
        <Route path="smart-building" element={<Navigate to="/operations/smart-building" replace />} />
        <Route path="operations/smart-building/doors" element={<ModuleRoute requiredModule="smart_building"><SmartBuildingPage /></ModuleRoute>} />
        <Route path="operations/smart-building/sensors" element={<ModuleRoute requiredModule="smart_building"><SmartBuildingPage /></ModuleRoute>} />
        <Route path="operations/smart-building/energy" element={<ModuleRoute requiredModule="smart_building"><SmartBuildingPage /></ModuleRoute>} />
        <Route path="operations/smart-building/hvac" element={<ModuleRoute requiredModule="smart_building"><SmartBuildingPage /></ModuleRoute>} />
        <Route path="operations/smart-building/assets" element={<ModuleRoute requiredModule="smart_building"><SmartBuildingPage /></ModuleRoute>} />
        <Route path="maintenance-center" element={<ModuleRoute requiredModule="maintenance_center"><MaintenanceCenterPage /></ModuleRoute>} />
        <Route path="maintenance-center/:tab" element={<ModuleRoute requiredModule="maintenance_center"><MaintenanceCenterPage /></ModuleRoute>} />
        <Route path="operations/maintenance/work-orders" element={<Navigate to="/maintenance-center/work-orders" replace />} />
        <Route path="operations/maintenance/faults" element={<Navigate to="/maintenance-center/faults" replace />} />
        <Route path="operations/maintenance/repairs" element={<Navigate to="/maintenance-center/repairs" replace />} />
        <Route path="calendar" element={<ModuleRoute requiredModule="calendar"><CalendarPage /></ModuleRoute>} />
        <Route path="guests" element={<ModuleRoute requiredModule="guests"><GuestsPage /></ModuleRoute>} />
        <Route path="housekeeping" element={<ModuleRoute requiredModule="housekeeping"><HousekeepingPage /></ModuleRoute>} />
        <Route path="reports" element={<ModuleRoute requiredModule="financials"><ReportsPage /></ModuleRoute>} />
        <Route path="financials" element={<Navigate to="/reports" replace />} />
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
