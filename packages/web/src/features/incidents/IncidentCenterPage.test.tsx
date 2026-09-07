import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IncidentCenterPage from './IncidentCenterPage';
import { useAuthStore } from '@/stores/authStore';

const mocks = vi.hoisted(() => ({ overview: vi.fn(), list: vi.fn(), acknowledge: vi.fn(), resolve: vi.fn(), close: vi.fn() }));
vi.mock('@/services/incidents', () => ({ default: mocks }));
vi.mock('@/components/collaboration/CollaborationHeader', () => ({ default: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }));

const incident = { id: 'incident-1', incidentNumber: 'INC-001', title: 'Water leak', description: 'Leak sensor triggered', category: 'SMART_BUILDING', severity: 'CRITICAL', status: 'NEW', sourceModule: 'SMART_BUILDING', startedAt: '2026-08-28T10:00:00Z', createdAt: '2026-08-28T10:00:00Z', updatedAt: '2026-08-28T10:00:00Z', tasks: [] };
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/incidents?tab=active']}><IncidentCenterPage /></MemoryRouter></QueryClientProvider>);

describe('IncidentCenterPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'admin-1', role: 'ADMIN', hotel: { id: 'hotel-1' } } as never });
    mocks.overview.mockResolvedValue({ active: 1, critical: 1, resolved: 0, closed: 0, total: 1, averageResolutionMinutes: 0, byDepartment: [], bySourceModule: [] });
    mocks.list.mockResolvedValue([incident]);
    mocks.acknowledge.mockResolvedValue({ ...incident, status: 'ACKNOWLEDGED' });
    mocks.resolve.mockResolvedValue({ ...incident, status: 'RESOLVED' });
    mocks.close.mockResolvedValue({ ...incident, status: 'CLOSED' });
  });

  it('maps the Assigned to Me tab to the current-user service view', async () => {
    renderPage();
    await screen.findByText('Water leak');
    fireEvent.click(screen.getByRole('button', { name: 'Assigned to Me' }));
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith('assigned_to_me'));
  });

  it('filters within one workspace and opens Ask LaFlo with incident context', async () => {
    const openAssistant = vi.fn();
    window.addEventListener('laflo:open-assistant', openAssistant);
    renderPage();
    expect(await screen.findByText('Water leak')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Critical' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Incident severity'), { target: { value: 'HIGH' } });
    expect(screen.getByText('No incidents found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Ask LaFlo' })[1]);
    expect(openAssistant).toHaveBeenCalledTimes(1);
    window.removeEventListener('laflo:open-assistant', openAssistant);
  });

  it('confirms incident resolution before changing state', async () => {
    renderPage();
    await screen.findByText('Water leak');
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    expect(mocks.resolve).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog', { name: 'Resolve incident?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve incident' }));
    await waitFor(() => expect(mocks.resolve.mock.calls[0]?.[0]).toBe('incident-1'));
  });
});
