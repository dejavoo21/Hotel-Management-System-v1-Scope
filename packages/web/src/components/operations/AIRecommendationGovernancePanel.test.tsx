import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import AIRecommendationGovernancePanel from './AIRecommendationGovernancePanel';

const mocks = vi.hoisted(() => ({ list: vi.fn(), approve: vi.fn(), reject: vi.fn(), createTask: vi.fn(), expire: vi.fn() }));
vi.mock('@/services', () => ({ aiRecommendationsService: mocks, getApiError: (error: Error) => ({ message: error.message }) }));

const recommendation = {
  id: 'rec-1', hotelId: 'hotel-1', sourceType: 'DAILY_GM_BRIEFING', sourceId: 'brief-1',
  title: 'Assign overdue tasks', description: 'Assign operational owners.', category: 'OPERATIONS',
  department: 'SECURITY', priority: 'HIGH', confidence: 0.91, rationale: 'Unowned work increases SLA risk.',
  status: 'PENDING', createdAt: '2026-08-17T10:00:00Z', updatedAt: '2026-08-17T10:00:00Z',
};

const renderPanel = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AIRecommendationGovernancePanel /></QueryClientProvider>);

describe('AIRecommendationGovernancePanel', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: { id: 'admin-1', email: 'admin@laflo.test', role: 'ADMIN', hotel: { id: 'hotel-1' } } as never });
    mocks.list.mockImplementation((status: string) => Promise.resolve(status === 'PENDING' ? [recommendation] : []));
    mocks.approve.mockResolvedValue({ ...recommendation, status: 'APPROVED' });
    mocks.reject.mockResolvedValue({ ...recommendation, status: 'REJECTED' });
    mocks.createTask.mockResolvedValue({ ...recommendation, status: 'TASK_CREATED' });
    mocks.expire.mockResolvedValue({ ...recommendation, status: 'EXPIRED' });
  });

  it('filters tabs and provides an actionable empty state', async () => {
    renderPanel();
    expect(await screen.findByText('Assign overdue tasks')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approved' }));
    expect(await screen.findByText('No approved recommendations')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Return to Pending' }));
    expect(await screen.findByText('Assign overdue tasks')).toBeInTheDocument();
  });

  it('opens details, source, assignment, comment, rejection, and expiry workflows', async () => {
    renderPanel();
    await screen.findByText('Assign overdue tasks');
    fireEvent.click(screen.getByRole('button', { name: 'View details' }));
    expect(screen.getByRole('dialog', { name: 'Recommendation details' })).toHaveTextContent('Unowned work increases SLA risk');
    fireEvent.click(screen.getByRole('button', { name: 'Close recommendation details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Assign owner' }));
    const assign = screen.getByRole('dialog', { name: 'Assign recommendation owner' });
    fireEvent.change(within(assign).getByRole('combobox'), { target: { value: 'Security' } });
    fireEvent.click(within(assign).getByRole('button', { name: 'Save assignment' }));
    expect(await screen.findByText('Owner: Security')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    const comment = screen.getByRole('dialog', { name: 'Add governance comment' });
    fireEvent.change(within(comment).getByRole('textbox'), { target: { value: 'Reviewed with Security lead.' } });
    fireEvent.click(within(comment).getByRole('button', { name: 'Add comment' }));
    expect(await screen.findByText('1 comment')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.click(within(screen.getByText('Reject recommendation').closest('div')!).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(mocks.reject).toHaveBeenCalledWith('rec-1', ''));
    fireEvent.click(screen.getByRole('button', { name: 'Expire' }));
    const expiry = screen.getByRole('alertdialog', { name: 'Expire recommendation?' });
    fireEvent.click(within(expiry).getByRole('button', { name: 'Expire recommendation' }));
    await waitFor(() => expect(mocks.expire).toHaveBeenCalledWith('rec-1'));
  });

  it('reviews the prefilled governed task before creating it', async () => {
    mocks.list.mockImplementation((status: string) => Promise.resolve(status === 'APPROVED' ? [{ ...recommendation, status: 'APPROVED' }] : []));
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Approved' }));
    await screen.findByText('Assign overdue tasks');

    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    expect(mocks.createTask).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Create task from recommendation' });
    expect(dialog).toHaveTextContent('Assign operational owners.');
    expect(dialog).toHaveTextContent('SECURITY');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create task' }));
    await waitFor(() => expect(mocks.createTask).toHaveBeenCalledWith('rec-1'));
  });
});
