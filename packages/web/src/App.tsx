import { lazy, Suspense } from 'react';
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
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const EnterpriseCommandCenterPage = lazy(() => import('@/pages/EnterpriseCommandCenterPage'));
const RoomsPage = lazy(() => import('@/pages/RoomsPage'));
const BookingsPage = lazy(() => import('@/pages/BookingsPage'));
const BookingDetailPage = lazy(() => import('@/pages/BookingDetailPage'));
const GuestsPage = lazy(() => import('@/pages/GuestsPage'));
const HousekeepingPage = lazy(() => import('@/pages/HousekeepingPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const FinancialsPage = lazy(() => import('@/pages/FinancialsPage'));
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage'));
const ExpensesPage = lazy(() => import('@/pages/ExpensesPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));
const ReviewsPage = lazy(() => import('@/pages/ReviewsPage'));
const ConciergePage = lazy(() => import('@/pages/ConciergePage'));
const InventoryPage = lazy(() => import('@/pages/InventoryPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const MessagesPage = lazy(() => import('@/pages/MessagesPageRedesigned'));
const CallsPage = lazy(() => import('@/pages/CallsPage'));
const OperationsCenterPage = lazy(() => import('@/pages/OperationsCenterPage'));
const EnterpriseSearchPage = lazy(() => import('@/pages/EnterpriseSearchPage'));
const HotelBrainPage = lazy(() => import('@/pages/HotelBrainPage'));
const SecurityCenterPage = lazy(() => import('@/pages/SecurityCenterPage'));
const MaintenanceCenterPage = lazy(() => import('@/pages/MaintenanceCenterPage'));
const SmartBuildingPage = lazy(() => import('@/pages/SmartBuildingPage'));
const IncidentCenterPage = lazy(() => import('@/features/incidents/IncidentCenterPage'));
const NotAuthorizedPage = lazy(() => import('@/pages/NotAuthorizedPage'));

function RouteFallback() {
  return <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading workspace"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" /></div>;
}

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

  if (user?.mustChangePassword && location.pathname !== '/reset-password') {
    return <Navigate to={`/reset-password?email=${encodeURIComponent(user.email || '')}`} replace />;
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
      return <Navigate to={`/reset-password?email=${encodeURIComponent(user.email || '')}`} replace />;
    }
    // Redirect to first allowed page based on permissions
    const firstAllowed = getFirstAllowedPath(user);
    return <Navigate to={firstAllowed} replace />;
  }

  return <>{children}</>;
}

function HotelInsightsRedirect({ tab }: { tab?: 'recommendations' }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (tab) params.set('tab', tab);
  const query = params.toString();
  return <Navigate to={`/hotel-insights${query ? `?${query}` : ''}`} replace />;
}

export default function App() {
  return (
    <>
      <SkipLink />
      <Suspense fallback={<RouteFallback />}>
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
          element={<ResetPasswordPage />}
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
        <Route path="force-password-change" element={<Navigate to="/reset-password" replace />} />
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
        <Route path="operations/ai" element={<HotelInsightsRedirect tab="recommendations" />} />
        <Route path="operations/ai-workspace" element={<HotelInsightsRedirect tab="recommendations" />} />
        <Route path="operations/operations-concierge" element={<HotelInsightsRedirect tab="recommendations" />} />
        <Route path="operations/revenue" element={<Navigate to="/operations/operational-intelligence/revenue-guidance" replace />} />
        <Route path="operations/weather" element={<Navigate to="/operations/operational-intelligence/weather-forecast" replace />} />
        <Route path="operations/tasks" element={<Navigate to="/operations/tasks-advisories" replace />} />
        <Route path="operations/market-intelligence" element={<Navigate to="/operations/operational-intelligence/market-intelligence" replace />} />
        <Route path="operations-center" element={<ModuleRoute requiredModule="bookings"><OperationsCenterPage /></ModuleRoute>} />
        <Route path="operations/enterprise-search" element={<ModuleRoute requiredModule="bookings"><EnterpriseSearchPage /></ModuleRoute>} />
        <Route path="hotel-insights" element={<ModuleRoute requiredModule="bookings"><HotelBrainPage /></ModuleRoute>} />
        <Route path="hotel-brain" element={<HotelInsightsRedirect />} />
        <Route path="hotel-brain-console" element={<HotelInsightsRedirect />} />
        <Route path="ai-governance" element={<HotelInsightsRedirect tab="recommendations" />} />
        <Route path="ai-recommendations" element={<HotelInsightsRedirect tab="recommendations" />} />
        <Route path="operations/ai-governance" element={<HotelInsightsRedirect tab="recommendations" />} />
        <Route path="operations/ai-recommendations" element={<HotelInsightsRedirect tab="recommendations" />} />
        <Route path="operations/hotel-brain-console" element={<HotelInsightsRedirect />} />
        <Route path="operations/tasks-advisories" element={<ModuleRoute requiredModule="bookings"><OperationsCenterPage /></ModuleRoute>} />
        <Route path="operations/operational-intelligence/weather-forecast" element={<ModuleRoute requiredModule="bookings"><OperationsCenterPage /></ModuleRoute>} />
        <Route path="operations/operational-intelligence/market-intelligence" element={<ModuleRoute requiredModule="bookings"><OperationsCenterPage /></ModuleRoute>} />
        <Route path="operations/operational-intelligence/revenue-guidance" element={<ModuleRoute requiredModule="financials"><OperationsCenterPage /></ModuleRoute>} />
        <Route path="operations-center/search" element={<Navigate to="/operations/enterprise-search" replace />} />
        <Route path="operations-center/ai" element={<HotelInsightsRedirect tab="recommendations" />} />
        <Route path="ai/hotel-brain" element={<HotelInsightsRedirect />} />
        <Route path="operations-center/revenue" element={<Navigate to="/operations/operational-intelligence/revenue-guidance" replace />} />
        <Route path="operations-center/weather" element={<Navigate to="/operations/operational-intelligence/weather-forecast" replace />} />
        <Route path="operations-center/tasks" element={<Navigate to="/operations/tasks-advisories" replace />} />
        <Route path="operations-center/market-intelligence" element={<Navigate to="/operations/operational-intelligence/market-intelligence" replace />} />
        <Route path="incidents" element={<ModuleRoute requiredModule="incident_management"><IncidentCenterPage /></ModuleRoute>} />
        <Route path="incidents/active" element={<Navigate to="/incidents?tab=active" replace />} />
        <Route path="incidents/critical" element={<Navigate to="/incidents?tab=critical" replace />} />
        <Route path="incidents/assigned-to-me" element={<Navigate to="/incidents?tab=assigned-to-me" replace />} />
        <Route path="incidents/resolved" element={<Navigate to="/incidents?tab=resolved" replace />} />
        <Route path="incidents/closed" element={<Navigate to="/incidents?tab=closed" replace />} />
        <Route path="security-center" element={<ModuleRoute requiredModule="security_center"><SecurityCenterPage /></ModuleRoute>} />
        <Route path="security-center/cctv" element={<Navigate to="/security-center?tab=cctv" replace />} />
        <Route path="security-center/access-logs" element={<Navigate to="/security-center?tab=access-logs" replace />} />
        <Route path="security-center/visitors" element={<Navigate to="/security-center?tab=visitors" replace />} />
        <Route path="security-center/alerts" element={<Navigate to="/security-center?tab=alerts" replace />} />
        <Route path="security-center/:tab" element={<ModuleRoute requiredModule="security_center"><SecurityCenterPage /></ModuleRoute>} />
        <Route path="operations/security/cctv" element={<Navigate to="/security-center?tab=cctv" replace />} />
        <Route path="operations/security/access-logs" element={<Navigate to="/security-center?tab=access-logs" replace />} />
        <Route path="operations/security/visitors" element={<Navigate to="/security-center?tab=visitors" replace />} />
        <Route path="operations/security/alerts" element={<Navigate to="/security-center?tab=alerts" replace />} />
        <Route path="operations/smart-building" element={<ModuleRoute requiredModule="smart_building"><SmartBuildingPage /></ModuleRoute>} />
        <Route path="smart-building" element={<Navigate to="/operations/smart-building" replace />} />
        <Route path="smart-building/doors" element={<Navigate to="/operations/smart-building?tab=doors" replace />} />
        <Route path="smart-building/sensors" element={<Navigate to="/operations/smart-building?tab=sensors" replace />} />
        <Route path="smart-building/devices" element={<Navigate to="/operations/smart-building?tab=devices" replace />} />
        <Route path="operations/smart-building/doors" element={<Navigate to="/operations/smart-building?tab=doors" replace />} />
        <Route path="operations/smart-building/sensors" element={<Navigate to="/operations/smart-building?tab=sensors" replace />} />
        <Route path="operations/smart-building/devices" element={<Navigate to="/operations/smart-building?tab=devices" replace />} />
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
        <Route path="financials" element={<ModuleRoute requiredModule="financials"><FinancialsPage /></ModuleRoute>} />
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
      </Suspense>
    </>
  );
}
