import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import FinancialsPage from './FinancialsPage';

vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('@/services', () => ({ reportService: { exportReport: vi.fn() } }));

const mockedGet = vi.mocked(api.get);
const payloads: Record<string, unknown> = {
  '/reports/revenue': {
    total: 0,
    bookedValue: 447,
    paidRevenue: 0,
    outstandingBalance: 447,
    bookingCount: 1,
    breakdown: [{ date: '2026-08-11', revenue: 0, bookedValue: 447, paid: 0, outstanding: 447, bookings: 1 }],
  },
  '/reports/occupancy': { breakdown: [{ date: '2026-08-11', rate: 5, total: 20, occupied: 1 }] },
  '/reports/sources': [],
  '/reports/room-types': [],
  '/reports/guests': { totalGuests: 0, newGuests: 0, topGuests: [] },
};

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><FinancialsPage /></QueryClientProvider>);
};

describe('FinancialsPage', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedGet.mockImplementation(async (url) => ({ data: { data: payloads[url] } }));
    useAuthStore.setState({ user: { id: 'admin-1', email: 'admin@laflo.test', role: 'ADMIN', hotel: { currency: 'ZAR' } } as never });
  });

  it('shows honest posted-revenue, occupancy, currency, and empty states', async () => {
    renderPage();
    expect(await screen.findByText('No completed revenue posted for this period.')).toBeInTheDocument();
    expect(screen.getByText('Revenue Intelligence')).toBeInTheDocument();
    expect(screen.getAllByText(/ZAR/).length).toBeGreaterThan(0);
    expect(screen.getByText('No booking-source revenue available for this period.')).toBeInTheDocument();
    expect(screen.getByText('No room type booking activity for this period.')).toBeInTheDocument();
    expect(screen.getByText('No guest revenue data yet.')).toBeInTheDocument();
    expect(screen.queryByText('No occupancy activity available for this period.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Email Report/ })).toBeDisabled();
  });

  it('lets an authorised user inspect booked stay value without treating it as posted revenue', async () => {
    renderPage();
    await screen.findByText('No completed revenue posted for this period.');
    fireEvent.change(screen.getByRole('combobox', { name: 'Revenue type' }), { target: { value: 'bookedValue' } });
    expect(screen.queryByText('No completed revenue posted for this period.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeEnabled();
  });

  it('blocks users without financial permissions and avoids report requests', () => {
    useAuthStore.setState({ user: { id: 'viewer-1', email: 'viewer@laflo.test', role: 'RECEPTIONIST' } as never });
    renderPage();
    expect(screen.getByText('Financial access restricted')).toBeInTheDocument();
    expect(mockedGet).not.toHaveBeenCalled();
  });
});
