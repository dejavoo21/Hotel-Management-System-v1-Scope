import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_LAFLO_ASSISTANT_EVENT } from '@/lib/assistantEvents';
import { useAuthStore } from '@/stores/authStore';
import GuestCallsWorkspace from './GuestCallsWorkspace';

const mocks = vi.hoisted(() => ({ voice: vi.fn(), agents: vi.fn(), guests: vi.fn(), bookings: vi.fn(), call: vi.fn(), update: vi.fn() }));
vi.mock('@/services', () => ({
  messageService: { getSupportVoiceToken: mocks.voice, listSupportAgents: mocks.agents, startSupportPhoneCall: mocks.call },
  guestService: { getGuests: mocks.guests, updateGuest: mocks.update },
  bookingService: { getBookings: mocks.bookings },
}));

const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/calls']}><GuestCallsWorkspace /></MemoryRouter></QueryClientProvider>);

describe('GuestCallsWorkspace', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: { id: 'admin-1', role: 'ADMIN', firstName: 'Admin' } as never });
    mocks.voice.mockResolvedValue({ enabled: false, identity: 'admin', token: '' });
    mocks.agents.mockResolvedValue([]);
    mocks.guests.mockResolvedValue({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0, hasMore: false } });
    mocks.bookings.mockResolvedValue({ data: [], pagination: { page: 1, limit: 5, total: 0, totalPages: 0, hasMore: false } });
  });

  it('supports keypad entry and reports the real disconnected state', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Guest Calls' })).toBeInTheDocument();
    expect(await screen.findByText('Calling is not connected.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2 ABC' }));
    expect(screen.getByLabelText('Phone number or extension')).toHaveValue('12');
    fireEvent.click(screen.getByRole('button', { name: /Backspace/ }));
    expect(screen.getByLabelText('Phone number or extension')).toHaveValue('1');
    fireEvent.click(screen.getByLabelText('Clear number'));
    expect(screen.getByLabelText('Phone number or extension')).toHaveValue('');
  });

  it('opens Ask LaFlo with Guest Calls context', async () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_LAFLO_ASSISTANT_EVENT, listener);
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ask LaFlo' }).at(-1)!);
    await waitFor(() => expect(listener).toHaveBeenCalled());
    expect((listener.mock.calls[0][0] as CustomEvent).detail.context).toMatchObject({ page: 'Guest Calls', sourceState: 'unavailable' });
    window.removeEventListener(OPEN_LAFLO_ASSISTANT_EVENT, listener);
  });

  it('does not mount a second fixed Ask LaFlo launcher', () => {
    const { container } = renderPage();
    expect(container.querySelector('button.fixed.bottom-5.right-6')).toBeNull();
  });
});
