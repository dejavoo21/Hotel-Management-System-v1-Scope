import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
  aiRecommendationsService: { list: mocks.recommendations, approve: vi.fn(), reject: vi.fn(), createTask: vi.fn(), expire: vi.fn() },
  getApiError: (error: Error) => ({ message: error.message }),
}));

const renderPage = (entry = '/hotel-insights') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}><HotelBrainPage /><LocationProbe /></MemoryRouter>
    </QueryClientProvider>,
  );
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

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

  it('renders Hotel Insights with friendly operational labels and no duplicate chat input', async () => {
    renderPage();
    expect(screen.getByText('Operations / Hotel Insights')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hotel Insights' })).toBeInTheDocument();
    expect(screen.getByText('Hotel Insights brings together information from rooms, tasks, incidents, revenue, security, and smart building systems to help Ask LaFlo give better answers.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Today’s hotel briefing' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Recommendations' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Information Sources' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Saved Prompts' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Activity History' })).toBeInTheDocument();
    expect(await screen.findByText('Operations are stable with two items requiring review.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Ask LaFlo status Ready/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connected information 6/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recommendations to review 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Last update/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh information' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View full hotel briefing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review recommendations' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Ask Hotel Brain/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Ask Hotel Brain')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ask LaFlo status Ready/i }));
    expect(screen.getByRole('dialog', { name: 'Ask LaFlo status' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close Ask LaFlo status' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Information Sources' }));
    expect(screen.getByRole('heading', { name: 'Information available to Ask LaFlo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Available Operations/i }));
    expect(screen.getByRole('dialog', { name: 'Operations information' })).toBeInTheDocument();
  });

  it('opens briefing details, routes recommendation review, refreshes all sources, and runs saved prompts in Ask LaFlo', async () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_LAFLO_ASSISTANT_EVENT, listener);
    renderPage();
    await screen.findByText('Operations are stable with two items requiring review.');

    fireEvent.click(screen.getByRole('button', { name: 'View full hotel briefing' }));
    expect(screen.getByRole('dialog', { name: 'Full hotel briefing' })).toHaveTextContent('Review room readiness');
    fireEvent.click(screen.getByRole('button', { name: 'Close Full hotel briefing' }));

    fireEvent.click(screen.getByRole('button', { name: 'Refresh information' }));
    await waitFor(() => {
      expect(mocks.status).toHaveBeenCalledTimes(2);
      expect(mocks.briefing).toHaveBeenCalledTimes(2);
      expect(mocks.recommendations).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Saved Prompts' }));
    fireEvent.click(screen.getByRole('button', { name: "Which rooms are not ready for today's arrivals?" }));
    expect((listener.mock.calls.at(-1)?.[0] as CustomEvent).detail).toMatchObject({
      prompt: "Which rooms are not ready for today's arrivals?",
      context: { page: 'Hotel Insights' },
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review recommendations' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/hotel-insights?tab=recommendations');
    expect(screen.getByRole('heading', { name: 'Recommendation Review' })).toBeInTheDocument();
    window.removeEventListener(OPEN_LAFLO_ASSISTANT_EVENT, listener);
  });

  it('opens the single Ask LaFlo assistant with incoming question context', async () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_LAFLO_ASSISTANT_EVENT, listener);
    renderPage('/hotel-insights?question=Which%20rooms%20need%20attention%3F');
    fireEvent.click(screen.getByRole('button', { name: 'Continue in Ask LaFlo' }));
    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toMatchObject({
      mode: 'operations',
      prompt: 'Which rooms need attention?',
      context: { page: 'Hotel Insights', incomingQuestion: 'Which rooms need attention?' },
    });
    window.removeEventListener(OPEN_LAFLO_ASSISTANT_EVENT, listener);
  });
});
