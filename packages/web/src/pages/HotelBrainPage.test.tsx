import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_LAFLO_ASSISTANT_EVENT } from '@/lib/assistantEvents';
import { useAuthStore } from '@/stores/authStore';
import HotelBrainPage from './HotelBrainPage';

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  briefing: vi.fn(),
  recommendations: vi.fn(),
}));

vi.mock('@/services', () => ({
  assistantService: { status: mocks.status },
  aiBriefingService: { getDailyBriefing: mocks.briefing },
  aiRecommendationsService: { list: mocks.recommendations },
}));

const renderPage = (entry = '/ai/hotel-brain') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}><HotelBrainPage /></MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('HotelBrainPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: { id: 'admin-1', role: 'ADMIN', modulePermissions: [] } as never });
    mocks.status.mockResolvedValue({ live: true, provider: 'openai', hasKey: true, enabled: true, model: 'hotel-brain' });
    mocks.briefing.mockResolvedValue({
      hotelHealthScore: 88,
      executiveSummary: 'Operations are stable with two items requiring review.',
      todayPriorities: [{ title: 'Review room readiness', detail: 'Two arrivals need confirmed rooms.', department: 'Front Desk', severity: 'HIGH' }],
      operationalRisks: [], guestExperienceRisks: [], revenueOpportunities: [], weatherImpacts: [], maintenanceConcerns: [], securityConcerns: [], smartBuildingConcerns: [], staffingSuggestions: [], recommendedActions: [],
      generatedAt: '2026-08-14T10:32:00Z', contextVersion: 'v1', source: 'AI',
    });
    mocks.recommendations.mockResolvedValue([{ id: 'rec-1', title: 'Confirm room readiness', department: 'Front Desk', confidence: 0.91, priority: 'HIGH', status: 'PENDING' }]);
  });

  it('renders an intelligence and evidence console without a duplicate chat input', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Operational intelligence with evidence' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI context sources' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recommendation governance' })).toBeInTheDocument();
    expect(await screen.findByText('Operations are stable with two items requiring review.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Ask Hotel Brain/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Ask Hotel Brain')).not.toBeInTheDocument();
  });

  it('opens the single Ask LaFlo assistant with incoming question context', async () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_LAFLO_ASSISTANT_EVENT, listener);
    renderPage('/ai/hotel-brain?question=Which%20rooms%20need%20attention%3F');
    fireEvent.click(screen.getByRole('button', { name: 'Continue in Ask LaFlo' }));
    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ mode: 'operations', prompt: 'Which rooms need attention?' });
    window.removeEventListener(OPEN_LAFLO_ASSISTANT_EVENT, listener);
  });
});
