import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor, cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types';

vi.mock('@/hooks/useSocketPresence', () => ({
  useSocketPresence: () => ({
    emitPresenceSet: vi.fn(),
  }),
}));

const smokeRoutes = [
  '/',
  '/dashboard',
  '/operations-center',
  '/operations-center/weather',
  '/operations-center/revenue',
  '/operations-center/market-intelligence',
  '/operations-center/tasks',
  '/operations-center/ai',
  '/operations/ai-governance',
  '/operations/hotel-brain-console',
  '/operations/enterprise-search',
  '/operations/tasks-advisories',
  '/operations/operational-intelligence/weather-forecast',
  '/operations/operational-intelligence/market-intelligence',
  '/operations/operational-intelligence/revenue-guidance',
  '/security-center',
  '/smart-building',
  '/maintenance-center',
  '/incidents',
  '/messages',
  '/calls',
  '/guests',
  '/rooms',
  '/reservations',
  '/housekeeping',
  '/inventory',
  '/calendar',
  '/financials',
  '/reviews',
  '/concierge',
  '/users',
  '/settings',
  '/operations/smart-building',
  '/enterprise-command-center',
  '/operations-center/search',
  '/ai/hotel-brain',
] as const;

const routesWithoutSessionControls = [
  '/dashboard',
  '/reservations',
  '/guests',
  '/rooms',
  '/housekeeping',
  '/inventory',
  '/calendar',
  '/financials',
  '/reviews',
  '/concierge',
  '/users',
  '/operations-center',
  '/maintenance-center',
  '/incidents',
  '/settings',
  '/smart-building',
  '/security-center',
  '/ai/hotel-brain',
  '/operations-center/search',
] as const;

const user: User = {
  id: 'route-smoke-admin',
  email: 'route-smoke@example.com',
  firstName: 'Route',
  lastName: 'Smoke',
  role: 'ADMIN',
  hotelId: 'hotel-route-smoke',
  hotel: {
    id: 'hotel-route-smoke',
    name: 'Route Smoke Hotel',
    currency: 'USD',
    timezone: 'UTC',
  },
  modulePermissions: [
    'dashboard',
    'bookings',
    'rooms',
    'messages',
    'housekeeping',
    'inventory',
    'calendar',
    'guests',
    'financials',
    'reviews',
    'concierge',
    'security_center',
    'maintenance_center',
    'smart_building',
    'incident_management',
    'users',
    'settings',
  ],
  isActive: true,
  createdAt: new Date(0).toISOString(),
};

function renderRoute(route: string) {
  useAuthStore.setState({
    user,
    accessToken: 'route-smoke-token',
    refreshToken: 'route-smoke-refresh',
    isAuthenticated: true,
    isLoading: false,
    requiresTwoFactor: false,
    requiresOtpRevalidation: false,
    pendingEmail: null,
    pendingPassword: null,
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

afterEach(() => {
  cleanup();
});

describe('route smoke tests', () => {
  it.each(smokeRoutes)('renders %s without crashing', async (route) => {
    const { container } = renderRoute(route);

    await waitFor(() => {
      expect(container.firstChild).toBeTruthy();
    });
  });

  it.each(routesWithoutSessionControls)('does not render session controls on %s', async (route) => {
    renderRoute(route);

    await waitFor(() => {
      expect(screen.queryByLabelText('Collaboration toolbar')).not.toBeInTheDocument();
    });
  });

  it.each(routesWithoutSessionControls)('keeps the global shell available on %s', async (route) => {
    renderRoute(route);

    await waitFor(() => {
      expect(screen.getAllByRole('banner').length).toBeGreaterThan(0);
      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    });
  });

  it.each(['/messages', '/calls'])('does not render the floating assistant over %s', async (route) => {
    renderRoute(route);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Open assistant' })).not.toBeInTheDocument();
    });
  });

  it('renders the dashboard command-centre sections and fallback state', async () => {
    renderRoute('/dashboard');

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-smart-actions')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-kpi-row')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-kpi-row').querySelector('.theme-kpi')).toBeInTheDocument();
      expect(screen.getByTestId('room-readiness-panel')).toBeInTheDocument();
      expect(screen.getByTestId('room-readiness-panel')).toHaveClass('theme-card');
      expect(screen.getByTestId('revenue-panel')).toBeInTheDocument();
      expect(screen.getByTestId('guest-experience-panel')).toBeInTheDocument();
      expect(screen.getByTestId('booking-platform-panel')).toBeInTheDocument();
      expect(screen.getByTestId('booking-list-panel')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-right-rail')).toBeInTheDocument();
      expect(screen.queryByLabelText('Collaboration toolbar')).not.toBeInTheDocument();
    });
  });
});
