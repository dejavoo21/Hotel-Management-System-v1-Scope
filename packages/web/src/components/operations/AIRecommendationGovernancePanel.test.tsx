import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_LAFLO_ASSISTANT_EVENT } from '@/lib/assistantEvents';
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
    expect(screen.getByRole('heading', { name: 'Recommendation Review Queue' })).toBeInTheDocument();
    expect(screen.getByText('Review AI-generated recommendations and decide whether to approve, reject, expire, assign, or convert them into tasks.')).toBeInTheDocument();
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
    expect(assign).toHaveTextContent('Unavailable by design');
    expect(assign).toHaveTextContent('No owner has been changed');
    fireEvent.click(within(assign).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    const comment = screen.getByRole('dialog', { name: 'Add recommendation comment' });
    expect(comment).toHaveTextContent('Unavailable by design');
    expect(comment).toHaveTextContent('No comment has been saved');
    fireEvent.click(within(comment).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    const rejection = screen.getByText('Reject recommendation').closest('div')!;
    expect(within(rejection).getByRole('button', { name: 'Reject' })).toBeDisabled();
    fireEvent.change(within(rejection).getByLabelText('Rejection reason'), { target: { value: 'Evidence is incomplete' } });
    fireEvent.click(within(rejection).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(mocks.reject).toHaveBeenCalledWith('rec-1', 'Evidence is incomplete'));
    fireEvent.click(screen.getByRole('button', { name: 'Expire' }));
    const expiry = screen.getByRole('alertdialog', { name: 'Expire recommendation?' });
    fireEvent.click(within(expiry).getByRole('button', { name: 'Expire recommendation' }));
    await waitFor(() => expect(mocks.expire).toHaveBeenCalledWith('rec-1'));
  });

  it('reviews the prefilled recommendation task before creating it', async () => {
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

  it('opens Ask LaFlo with queue and recommendation evidence context', async () => {
    const openAssistant = vi.fn();
    window.addEventListener(OPEN_LAFLO_ASSISTANT_EVENT, openAssistant);
    renderPanel();
    await screen.findByText('Assign overdue tasks');

    fireEvent.click(screen.getByRole('button', { name: 'Ask LaFlo about this queue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask LaFlo about this recommendation' }));

    expect(openAssistant).toHaveBeenCalledTimes(2);
    expect((openAssistant.mock.calls[0][0] as CustomEvent).detail.context).toMatchObject({ page: 'AI Recommendations', status: 'PENDING' });
    expect((openAssistant.mock.calls[1][0] as CustomEvent).detail.context).toMatchObject({ page: 'AI Recommendations', recommendationId: 'rec-1', sourceId: 'brief-1' });
    window.removeEventListener(OPEN_LAFLO_ASSISTANT_EVENT, openAssistant);
  });
});
