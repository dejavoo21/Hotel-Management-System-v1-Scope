import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SET_LAFLO_ASSISTANT_CONTEXT_EVENT } from '@/lib/assistantEvents';
import { useAuthStore } from '@/stores/authStore';
import GuestCallsWorkspace from './GuestCallsWorkspace';

const mocks = vi.hoisted(() => ({ voice: vi.fn(), agents: vi.fn(), guests: vi.fn(), bookings: vi.fn(), call: vi.fn(), update: vi.fn() }));
vi.mock('@/services', () => ({
  messageService: { getSupportVoiceToken: mocks.voice, listSupportAgents: mocks.agents, startSupportPhoneCall: mocks.call },
  guestService: { getGuests: mocks.guests, updateGuest: mocks.update },
  bookingService: { getBookings: mocks.bookings },
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

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

  it('appends every dial-pad character and supports keyboard, backspace, and clear', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Guest Calls' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Call summary' })).toHaveClass('xl:grid-cols-4');
    expect(await screen.findByText('Calling is not connected.')).toBeInTheDocument();
    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']) {
      fireEvent.click(screen.getByRole('button', { name: `Dial ${key}` }));
    }
    const input = screen.getByLabelText('Phone number or extension');
    expect(input).toHaveValue('123456789*0#');
    fireEvent.click(screen.getByRole('button', { name: /Backspace/ }));
    expect(input).toHaveValue('123456789*0');
    fireEvent.click(screen.getByLabelText('Clear number'));
    expect(input).toHaveValue('');
    fireEvent.input(input, { target: { value: '+441234567890' } });
    expect(input).toHaveValue('+441234567890');
    fireEvent.keyDown(input, { key: 'Backspace' });
    fireEvent.input(input, { target: { value: '+44123456789' } });
    expect(input).toHaveValue('+44123456789');
  });

  it('blocks empty calls and reports a disconnected provider without starting a call', async () => {
    renderPage();
    await screen.findByText('Calling is not connected.');
    fireEvent.click(screen.getByRole('button', { name: /Call unavailable/ }));
    expect(toast.error).toHaveBeenCalledWith('Enter a phone number or extension first.');
    fireEvent.input(screen.getByLabelText('Phone number or extension'), { target: { value: '+441234567890' } });
    fireEvent.click(screen.getByRole('button', { name: /Call unavailable/ }));
    expect(await screen.findByRole('dialog', { name: 'Calling is not connected' })).toBeInTheDocument();
    expect(mocks.call).not.toHaveBeenCalled();
  });

  it('provides Guest Calls context to the single global Ask LaFlo launcher', async () => {
    const listener = vi.fn();
    window.addEventListener(SET_LAFLO_ASSISTANT_CONTEXT_EVENT, listener);
    renderPage();
    await waitFor(() => expect(listener).toHaveBeenCalled());
    expect((listener.mock.calls.at(-1)?.[0] as CustomEvent).detail).toMatchObject({ page: 'Guest Calls', sourceState: 'unavailable' });
    window.removeEventListener(SET_LAFLO_ASSISTANT_CONTEXT_EVENT, listener);
  });

  it('uses the approved portrait asset for a known guest contact', async () => {
    mocks.guests.mockResolvedValue({ data: [{ id: 'g1', firstName: 'Sarah', lastName: 'Johnson', phone: '+27111234567', email: 'sarah@example.com', vipStatus: true }], pagination: { page: 1, limit: 100, total: 1, totalPages: 1, hasMore: false } });
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelector('img[src="/assets/guests/sarah-johnson.png"]')).toBeInTheDocument());
  });

  it('does not mount a second fixed Ask LaFlo launcher', () => {
    const { container } = renderPage();
    expect(container.querySelector('button.fixed.bottom-5.right-6')).toBeNull();
  });
});
