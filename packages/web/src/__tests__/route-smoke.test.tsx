import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor, cleanup } from '@testing-library/react';
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
  '/security-center',
  '/smart-building',
  '/maintenance-center',
  '/incidents',
  '/messages',
  '/calls',
  '/guests',
  '/rooms',
  '/reservations',
  '/financials',
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
});
