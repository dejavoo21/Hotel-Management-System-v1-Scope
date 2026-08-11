import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import ReviewsPage from './ReviewsPage';

vi.mock('@/data/dataSource', () => ({
  getReviewStats: vi.fn(async () => ({
    total: 2,
    average: 4.5,
    responseRate: 50,
    series: [{ day: '10 Aug', positive: 0, negative: 0 }],
    categoryScores: [
      { name: 'Facilities', value: 4.4 }, { name: 'Cleanliness', value: 4.5 },
      { name: 'Services', value: 4.6 }, { name: 'Comfort', value: 4.5 },
      { name: 'Location', value: 4.7 }, { name: 'Food and Dining', value: 4.2 },
    ],
  })),
  getReviewsByCountry: vi.fn(async () => [{ country: 'South Africa', count: 2, pct: 100 }]),
  getReviewsList: vi.fn(async () => [
    { id: 'r1', guest: 'Ava Stone', country: 'South Africa', rating: 5, date: '2026-08-10', comment: 'Wonderful stay and service.', responded: true },
    { id: 'r2', guest: 'Noah Reed', country: 'South Africa', rating: 2, date: '2026-08-09', comment: 'The room was not ready.', responded: false },
  ]),
}));

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ReviewsPage /></QueryClientProvider>);
};

describe('ReviewsPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'admin-1', email: 'admin@laflo.test', firstName: 'Admin', lastName: 'User', role: 'ADMIN' } as never });
  });

  it('renders consistent KPIs, rating, country data, and a clear empty trend state', async () => {
    renderPage();
    expect(await screen.findByText('Ava Stone')).toBeInTheDocument();
    expect(screen.getAllByText('Overall Rating')).toHaveLength(2);
    expect(screen.getByText('4.5 / 5')).toBeInTheDocument();
    expect(screen.getByText('South Africa')).toBeInTheDocument();
    expect(screen.getByText('No review trend data available for this period.')).toBeInTheDocument();
    expect(screen.getByText(/Limited sample/)).toBeInTheDocument();
  });

  it('filters reviews by sentiment and clears filters', async () => {
    renderPage();
    await screen.findByText('Ava Stone');
    fireEvent.change(screen.getByRole('combobox', { name: 'Sentiment' }), { target: { value: 'Negative' } });
    expect(screen.queryByText('Ava Stone')).not.toBeInTheDocument();
    expect(screen.getByText('Noah Reed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(screen.getByText('Ava Stone')).toBeInTheDocument());
  });

  it('keeps export permission-controlled for read-only users', async () => {
    useAuthStore.setState({ user: { id: 'viewer-1', email: 'viewer@laflo.test', firstName: 'View', lastName: 'Only', role: 'RECEPTIONIST' } as never });
    renderPage();
    await screen.findByText('Ava Stone');
    expect(screen.queryByRole('button', { name: 'Export report' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import reviews' })).toBeDisabled();
  });
});
