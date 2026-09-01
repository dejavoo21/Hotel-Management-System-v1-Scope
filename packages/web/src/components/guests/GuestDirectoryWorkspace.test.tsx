import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import GuestDirectoryWorkspace from './GuestDirectoryWorkspace';

const mocks = vi.hoisted(() => ({ guests: vi.fn(), summary: vi.fn(), guest: vi.fn(), create: vi.fn(), update: vi.fn(), bookings: vi.fn(), task: vi.fn() }));
vi.mock('@/services', () => ({
  guestService: { getGuests: mocks.guests, getDirectorySummary: mocks.summary, getGuest: mocks.guest, createGuest: mocks.create, updateGuest: mocks.update },
  bookingService: { getBookings: mocks.bookings },
  operationsService: { createAdvisoryTicket: mocks.task },
}));

const guest = { id: 'g1', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah@example.com', phone: '+27111234567', country: 'South Africa', nationality: 'South African', vipStatus: true, notes: '', totalStays: 2, totalSpent: '2500.50', bookings: [] };
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/guests']}><GuestDirectoryWorkspace /></MemoryRouter></QueryClientProvider>);

describe('GuestDirectoryWorkspace', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'admin-1', role: 'ADMIN', firstName: 'Admin', hotel: { currency: 'ZAR' } } as never });
    mocks.guests.mockResolvedValue({ data: [guest], pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasMore: false } });
    mocks.summary.mockResolvedValue({ total: 1, vip: 1, inHouse: 0, returning: 1, contactable: 1, needsFollowUp: 0, totalLifetimeSpend: 2500.5, averageSpend: 2500.5, repeatStayRate: 100, recentlyAdded: [] });
    mocks.bookings.mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } });
    mocks.create.mockResolvedValue({ ...guest, id: 'g2', firstName: 'New', lastName: 'Guest' });
    mocks.guest.mockResolvedValue({ ...guest, id: 'g2', firstName: 'New', lastName: 'Guest' });
  });

  it('formats decimal spend numerically and applies KPI filters', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Guest Directory' })).toBeInTheDocument();
    await waitFor(() => expect(document.body.textContent?.replace(/\D/g, '')).toContain('250050'));
    fireEvent.click(screen.getByRole('button', { name: /VIP Guests/ }));
    await waitFor(() => expect(mocks.guests).toHaveBeenLastCalledWith(expect.objectContaining({ vipStatus: true })));
  });

  it('creates a guest through the real service workflow', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Add Guest' }));
    const modal = screen.getByRole('dialog', { name: 'Add Guest' });
    const inputs = modal.querySelectorAll('input');
    fireEvent.change(inputs[0], { target: { value: 'New' } });
    fireEvent.change(inputs[1], { target: { value: 'Guest' } });
    fireEvent.change(inputs[2], { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save guest' }));
    await waitFor(() => expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({ firstName: 'New', email: 'new@example.com' }));
  });
});
