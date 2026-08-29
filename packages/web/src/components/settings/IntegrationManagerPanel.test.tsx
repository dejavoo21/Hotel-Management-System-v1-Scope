import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IntegrationManagerPanel from './IntegrationManagerPanel';
import { useAuthStore } from '@/stores/authStore';
import type { IntegrationManagerOverview } from '@/services/integrationManager';

const overview: IntegrationManagerOverview = {
  setupSteps: ['Select category', 'Select provider', 'Connection details', 'Test connection'],
  categories: [
    { category: 'CCTV', label: 'CCTV', providerName: 'Hikvision', connectionStatus: 'Not Connected', connectedCount: 0, totalConfigured: 0, lastSyncAt: null, healthStatus: 'UNKNOWN', errorCount: 0, action: 'Configure' },
    { category: 'WEATHER', label: 'Weather', providerName: 'OpenWeather', connectionStatus: 'Connected', connectedCount: 1, totalConfigured: 1, lastSyncAt: '2026-08-05T08:09:00.000Z', healthStatus: 'HEALTHY', errorCount: 0, action: 'Manage' },
    { category: 'PAYMENTS', label: 'Payments', providerName: 'Stripe', connectionStatus: 'Not Connected', connectedCount: 0, totalConfigured: 0, lastSyncAt: null, healthStatus: 'UNKNOWN', errorCount: 0, action: 'Configure' },
    { category: 'BOOKING_CHANNELS', label: 'Booking Channels', providerName: 'Booking.com', connectionStatus: 'Not Connected', connectedCount: 0, totalConfigured: 0, lastSyncAt: null, healthStatus: 'UNKNOWN', errorCount: 0, action: 'Configure' },
  ],
  registry: [
    { id: 'hikvision', category: 'CCTV', name: 'Hikvision', providerType: 'HARDWARE', connectionMethods: ['Gateway'], credentialFields: [{ key: 'apiKey', label: 'API key', secret: true, required: true }], status: 'AVAILABLE' },
    { id: 'hls-camera', category: 'CCTV', name: 'HLS Camera', providerType: 'GENERIC_HLS', connectionMethods: ['HLS'], credentialFields: [{ key: 'host', label: 'Host / URL', required: true }, { key: 'password', label: 'Password / API key', secret: true }], status: 'AVAILABLE' },
    { id: 'verkada', category: 'CCTV', name: 'Verkada', providerType: 'VERKADA', connectionMethods: ['CLOUD_API'], credentialFields: [{ key: 'apiKey', label: 'API key', secret: true, required: true }], status: 'FUTURE' },
    { id: 'weather', category: 'WEATHER', name: 'OpenWeather', providerType: 'CLOUD', connectionMethods: ['API'], credentialFields: [{ key: 'apiKey', label: 'API key', secret: true, required: true }], status: 'ENVIRONMENT_CONFIGURED' },
    { id: 'stripe', category: 'PAYMENTS', name: 'Stripe', providerType: 'STRIPE', connectionMethods: ['REST_API'], credentialFields: [{ key: 'secretKey', label: 'Secret key', secret: true, required: true }], status: 'AVAILABLE' },
    { id: 'booking-com', category: 'BOOKING_CHANNELS', name: 'Booking.com', providerType: 'BOOKING_COM', connectionMethods: ['PARTNER_API'], credentialFields: [{ key: 'apiKey', label: 'API key', secret: true, required: true }], status: 'AVAILABLE' },
  ],
  recentLogs: [],
};

const serviceMocks = vi.hoisted(() => ({
  overview: vi.fn(),
  devices: vi.fn(),
  publishEvent: vi.fn(),
  reviewConnectorStatus: vi.fn(),
  connectGoogleReviews: vi.fn(),
  syncGoogleReviews: vi.fn(),
}));

vi.mock('@/services', async () => {
  const actual = await vi.importActual<typeof import('@/services')>('@/services');
  return {
    ...actual,
    integrationManagerService: {
      overview: serviceMocks.overview,
      devices: serviceMocks.devices,
      publishEvent: serviceMocks.publishEvent,
      reviewConnectorStatus: serviceMocks.reviewConnectorStatus,
      connectGoogleReviews: serviceMocks.connectGoogleReviews,
      syncGoogleReviews: serviceMocks.syncGoogleReviews,
    },
  };
});

vi.mock('@/components/hardware/HardwareIntegrationPanel', () => ({ default: () => <div>Hardware setup</div> }));

function renderPanel(role: 'ADMIN' | 'MANAGER' = 'ADMIN') {
  useAuthStore.setState({ user: { id: 'user-1', email: 'admin@laflogroup.com', role } as never });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><IntegrationManagerPanel /></QueryClientProvider>);
}

describe('IntegrationManagerPanel', () => {
  beforeEach(() => {
    serviceMocks.overview.mockResolvedValue(overview);
    serviceMocks.devices.mockResolvedValue([]);
    serviceMocks.publishEvent.mockResolvedValue({ accepted: true });
    serviceMocks.reviewConnectorStatus.mockResolvedValue({ google: { provider: 'GOOGLE_BUSINESS_PROFILE', credentialsConfigured: false, redirectUri: 'https://api.example.com/api/integration-manager/review-platforms/google/callback', requiredScope: 'business.manage', setupMessage: 'Add Google credentials.', status: 'NOT_CONNECTED' } });
  });

  it('renders enterprise metrics, tabs, filters, and status-aware cards', async () => {
    renderPanel();
    expect(await screen.findByRole('heading', { name: 'Integration Manager' })).toBeInTheDocument();
    expect(screen.getAllByText('Needs Attention').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /add integration/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Hardware' })).toBeInTheDocument();
    expect(screen.getByLabelText('Provider filter')).toBeInTheDocument();
    expect(screen.getByLabelText('Protocol filter')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'CCTV & Security Integrations' })).toBeInTheDocument();
    expect(screen.getByLabelText('CCTV & Security Integrations providers')).toHaveClass('w-full');
    expect(screen.getByLabelText('CCTV & Security Integrations providers').className).toContain('auto-fit');
    expect(screen.getAllByText('Hikvision').length).toBeGreaterThan(0);
    const openWeatherIcons = screen.getAllByRole('img', { name: 'OpenWeather integration icon' });
    expect(openWeatherIcons.length).toBeGreaterThan(0);
    expect(openWeatherIcons.some((icon) => icon.className.includes('ring-emerald-400'))).toBe(true);
    expect(openWeatherIcons[0].querySelector('img')).toHaveAttribute('src', '/assets/integration-providers/openweather.svg');
    expect(screen.getAllByRole('img', { name: 'Stripe integration icon' })[0].querySelector('img')).toHaveAttribute('src', '/assets/integration-providers/stripe.png');
    expect(screen.getAllByRole('img', { name: 'Booking.com integration icon' })[0].querySelector('img')).toHaveAttribute('src', '/assets/integration-providers/booking-com.png');
  });

  it('filters integrations and opens the setup wizard without exposing a raw credential', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: 'Integration Manager' });
    fireEvent.change(screen.getByPlaceholderText('Search integrations...'), { target: { value: 'weather' } });
    expect(screen.queryByRole('button', { name: 'Configure' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add integration/i }));
    expect(screen.getByRole('dialog', { name: 'Add integration' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Credential entry is unavailable in this build.')).toBeInTheDocument();
    expect(screen.getByText('Credential *')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Credential' })).not.toBeInTheDocument();
    expect(screen.queryByText(/must-not-render/i)).not.toBeInTheDocument();
  });

  it('opens connected details and runs a connection test', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: 'Integration Manager' });
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    const dialog = screen.getByRole('dialog', { name: 'Weather' });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(serviceMocks.publishEvent).toHaveBeenCalledWith('integration.connection.tested', 'WEATHER', { category: 'WEATHER' }));
  });

  it('keeps configuration controls away from view-only users', async () => {
    renderPanel('MANAGER');
    await screen.findByRole('heading', { name: 'Integration Manager' });
    expect(screen.queryByRole('button', { name: /add integration/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configure' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Permission required' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'View details' }).length).toBeGreaterThan(0);
  });

  it('filters the full-width provider catalogue and keeps future providers unavailable', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: 'Integration Manager' });

    const futureCard = screen.getByRole('img', { name: 'Verkada integration icon' }).closest('article')!;
    expect(within(futureCard).getByText('Future')).toBeInTheDocument();
    expect(within(futureCard).getByRole('button', { name: 'Coming soon' })).toBeDisabled();
    fireEvent.click(within(futureCard).getByRole('button', { name: 'View requirements' }));
    expect(screen.getByRole('dialog', { name: 'Verkada documentation' })).toHaveTextContent('planned');
    fireEvent.click(screen.getByRole('button', { name: 'Close provider documentation' }));

    fireEvent.change(screen.getByLabelText('Protocol filter'), { target: { value: 'HLS' } });
    expect(screen.getByRole('img', { name: 'HLS Camera integration icon' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'OpenWeather integration icon' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    const configuration = screen.getByRole('dialog', { name: 'Configure HLS Camera' });
    expect(within(configuration).getByText('Credential entry is unavailable in this build.')).toBeInTheDocument();
    expect(within(configuration).getByText('Password / API key')).toBeInTheDocument();
    expect(within(configuration).getByText('Secret · always masked')).toBeInTheDocument();
    expect(within(configuration).queryByRole('textbox')).not.toBeInTheDocument();
  });
});
