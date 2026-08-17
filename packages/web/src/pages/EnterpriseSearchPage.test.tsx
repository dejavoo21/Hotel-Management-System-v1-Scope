import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import EnterpriseSearchPage from './EnterpriseSearchPage';
import { OPEN_LAFLO_ASSISTANT_EVENT } from '@/lib/assistantEvents';

const searchMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/enterpriseSearch', () => ({
  default: {
    search: searchMock,
    rebuild: vi.fn(),
    askHotelBrain: vi.fn(),
  },
}));

const results = [
  {
    id: 'room-1', searchId: 'search-room-1', entityId: 'room-214', entityType: 'ROOM', category: 'ROOM', sourceModule: 'ROOMS',
    title: 'Room 214 maintenance work order', summary: 'Plumbing issue reported by housekeeping.', snippet: 'Low water pressure.', status: 'IN_PROGRESS', severity: 'HIGH',
    roomNumber: '214', ownerId: 'maintenance-lead', sourceUrl: '/rooms/room-214', indexedAt: '2026-08-14T09:20:00Z', updatedAt: '2026-08-14T09:20:00Z',
    metadata: { ownerName: 'Mike Johnson', relatedRecords: [{ id: 'incident-1', title: 'Water pressure incident', status: 'OPEN' }] },
  },
  {
    id: 'financial-1', searchId: 'search-financial-1', entityId: 'invoice-1', entityType: 'INVOICE', category: 'FINANCIAL', sourceModule: 'FINANCIALS',
    title: 'Invoice #INV-8674', summary: 'Emergency plumbing repair.', snippet: 'Repair invoice.', status: 'PAID',
    sourceUrl: '/financials/invoice-1', indexedAt: '2026-08-14T08:00:00Z', updatedAt: '2026-08-14T08:00:00Z',
  },
  {
    id: 'cctv-1', searchId: 'search-cctv-1', entityId: 'camera-1', entityType: 'CAMERA', category: 'CCTV', sourceModule: 'SECURITY_CENTER',
    title: 'Offline camera near pool', summary: 'Camera has gone offline.', snippet: 'Offline camera.', status: 'OPEN', severity: 'MEDIUM',
    sourceUrl: '/security-center/cctv', indexedAt: '2026-08-14T07:00:00Z', updatedAt: '2026-08-14T07:00:00Z',
  },
];

const response = { query: 'water leak', results, groups: [], total: 3, restrictedCount: 0, generatedAt: '2026-08-14T10:30:00Z' };

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/operations-center/search']}>
        <EnterpriseSearchPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('EnterpriseSearchPage', () => {
  beforeEach(() => {
    searchMock.mockReset();
    searchMock.mockResolvedValue(response);
    useAuthStore.setState({ user: { id: 'admin-1', role: 'ADMIN', modulePermissions: [], hotel: { id: 'hotel-1' } } as never });
  });

  it('opens in the selected target investigation workspace', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Enterprise Search' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Enterprise search' })).toHaveValue('water leak basement sensor');
    expect(await screen.findByRole('button', { name: /Room 214 maintenance work order/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rebuild Index/i })).toBeInTheDocument();
    expect(screen.getByText('Saved Searches')).toBeInTheDocument();
    expect(screen.getByText('AI Insight')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–3 of 3 results')).toBeInTheDocument();
  });

  it('searches, renders compact results, updates preview, and keeps target filters available', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Room 214 maintenance work order/ });
    fireEvent.change(screen.getByRole('textbox', { name: 'Enterprise search' }), { target: { value: 'water leak' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('button', { name: /Room 214 maintenance work order/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Result preview' })).toHaveTextContent('No result selected');
    fireEvent.click(screen.getByRole('button', { name: /Room 214 maintenance work order/ }));
    expect(screen.getByRole('region', { name: 'Result preview' })).toHaveTextContent('Room 214 maintenance work order');
    fireEvent.click(screen.getByRole('button', { name: /Offline camera near pool/ }));
    expect(screen.getByRole('region', { name: 'Result preview' })).toHaveTextContent('Offline camera near pool');

    fireEvent.click(screen.getByRole('button', { name: /Status/ }));
    expect(screen.getByRole('button', { name: /Source Type/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter option' })).toBeInTheDocument();
  });

  it('hides restricted categories and records even if an upstream response includes them', async () => {
    useAuthStore.setState({ user: { id: 'frontdesk-1', role: 'RECEPTIONIST', modulePermissions: ['rooms'] } as never });
    renderPage();
    expect(screen.getByRole('button', { name: 'Room' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reservation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Financial' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'CCTV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Audit Log' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rebuild Index/i })).not.toBeInTheDocument();

    expect((await screen.findAllByText('Room 214 maintenance work order')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Invoice #INV-8674')).not.toBeInTheDocument();
    expect(screen.queryByText('Offline camera near pool')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create task' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Results 1 All sources/i })).toHaveTextContent('1');
  });

  it('shows a useful zero-result state without pagination and a connected preview state', async () => {
    searchMock.mockResolvedValue({ ...response, results: [], groups: [], total: 0 });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'No authorised results found' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check spelling' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try broader terms' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adjust filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search all categories' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next results page' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Result preview' })).toHaveTextContent('No result selected');
  });

  it('clears results and suppresses audit noise from the All category', async () => {
    searchMock.mockResolvedValue({ ...response, results: [...results, { ...results[0], id: 'duplicate-room' }, { ...results[0], id: 'audit-1', entityId: 'event-1', category: 'AUDIT_LOG', sourceModule: 'ENTERPRISE_SEARCH', title: 'ENTERPRISE_SEARCH_QUERY_SUBMITTED' }] });
    renderPage();
    expect(await screen.findAllByRole('button', { name: /Room 214 maintenance work order/ })).toHaveLength(1);
    expect(screen.queryByText('ENTERPRISE_SEARCH_QUERY_SUBMITTED')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search and results' }));
    expect(screen.getByRole('heading', { name: 'Search across LaFlo records' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next results page' })).not.toBeInTheDocument();
  });

  it('hands the current investigation to the global Ask LaFlo assistant', async () => {
    const openAssistant = vi.fn();
    window.addEventListener(OPEN_LAFLO_ASSISTANT_EVENT, openAssistant);
    renderPage();
    await screen.findByRole('button', { name: /Room 214 maintenance work order/ });
    fireEvent.change(screen.getByRole('textbox', { name: 'Enterprise search' }), { target: { value: 'offline cameras' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Ask LaFlo' })[0]);
    await waitFor(() => expect(openAssistant).toHaveBeenCalledTimes(1));
    const event = openAssistant.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toMatchObject({ mode: 'operations' });
    expect(event.detail.prompt).toContain('offline cameras');
    expect(searchMock).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_LAFLO_ASSISTANT_EVENT, openAssistant);
  });

  it('passes the selected result evidence into Ask LaFlo', async () => {
    const openAssistant = vi.fn();
    window.addEventListener(OPEN_LAFLO_ASSISTANT_EVENT, openAssistant);
    renderPage();
    await screen.findByRole('button', { name: /Room 214 maintenance work order/ });
    fireEvent.click(screen.getByRole('button', { name: /Offline camera near pool/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask LaFlo about this result' }));
    await waitFor(() => expect(openAssistant).toHaveBeenCalledTimes(1));
    const event = openAssistant.mock.calls[0][0] as CustomEvent;
    expect(event.detail.prompt).toContain('Offline camera near pool');
    expect(event.detail.prompt).toContain('Security Center');
    window.removeEventListener(OPEN_LAFLO_ASSISTANT_EVENT, openAssistant);
  });
});
