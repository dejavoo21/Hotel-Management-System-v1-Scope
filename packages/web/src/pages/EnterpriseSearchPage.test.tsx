import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import EnterpriseSearchPage from './EnterpriseSearchPage';

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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/operations-center/search']}>
        <Routes>
          <Route path="/operations-center/search" element={<EnterpriseSearchPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
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

  it('opens in the target investigation state with collapsed filters and preserves a clear empty state', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Enterprise Search' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Enterprise search' })).toHaveValue('water leak basement sensor');
    expect(await screen.findByRole('button', { name: /Room 214 maintenance work order/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filters/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.queryByText('Saved Searches')).not.toBeInTheDocument();
    expect(screen.queryByText('Hotel Brain Insight')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Search across LaFlo records')).toBeInTheDocument();
  });

  it('searches, renders compact results, updates preview, and opens filters on demand', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Room 214 maintenance work order/ });
    fireEvent.change(screen.getByRole('textbox', { name: 'Enterprise search' }), { target: { value: 'water leak' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('button', { name: /Room 214 maintenance work order/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Result preview' })).toHaveTextContent('Room 214 maintenance work order');
    fireEvent.click(screen.getByRole('button', { name: /Offline camera near pool/ }));
    expect(screen.getByRole('region', { name: 'Result preview' })).toHaveTextContent('Offline camera near pool');

    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    expect(screen.getByRole('button', { name: /Filters/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Source module' })).toBeInTheDocument();
  });

  it('hides restricted categories and records even if an upstream response includes them', async () => {
    useAuthStore.setState({ user: { id: 'frontdesk-1', role: 'RECEPTIONIST', modulePermissions: ['rooms'] } as never });
    renderPage();
    expect(screen.getByRole('button', { name: 'Rooms' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bookings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Financial' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'CCTV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Audit Logs' })).not.toBeInTheDocument();

    expect((await screen.findAllByText('Room 214 maintenance work order')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Invoice #INV-8674')).not.toBeInTheDocument();
    expect(screen.queryByText('Offline camera near pool')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create task' })).not.toBeInTheDocument();
  });

  it('hands the current investigation to Hotel Brain without rendering another assistant', async () => {
    renderPage();
    await screen.findByRole('button', { name: /Room 214 maintenance work order/ });
    fireEvent.change(screen.getByRole('textbox', { name: 'Enterprise search' }), { target: { value: 'offline cameras' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Ask Hotel Brain' })[0]);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/ai/hotel-brain?question=offline%20cameras'));
    expect(searchMock).toHaveBeenCalledTimes(1);
  });
});
