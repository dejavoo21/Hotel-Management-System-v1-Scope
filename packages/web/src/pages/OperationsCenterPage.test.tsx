import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import OperationsCenterPage from './OperationsCenterPage';

const serviceMocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  getBriefing: vi.fn(),
  listRecommendations: vi.fn(),
  syncWeather: vi.fn(),
}));

vi.mock('@/services', () => ({
  operationsService: { getOperationsContext: serviceMocks.getContext },
  aiBriefingService: { getDailyBriefing: serviceMocks.getBriefing },
  aiRecommendationsService: { list: serviceMocks.listRecommendations },
  weatherSignalsService: { sync: serviceMocks.syncWeather },
}));
vi.mock('@/components/collaboration/CollaborationHeader', () => ({ default: ({ title }: { title: string }) => <header><h1>{title}</h1></header> }));
vi.mock('@/components/operations/advisories/OpsAdvisories', () => ({ default: () => <div>Detailed advisories</div> }));
vi.mock('@/components/operations/assistant/AssistantDock', () => ({ default: () => <div>Detailed concierge and context</div> }));
vi.mock('@/components/operations/pricing/PricingCalendarCard', () => ({ default: () => <div>Detailed revenue guidance</div> }));
vi.mock('@/components/operations/pricing/MarketIntelligenceCard', () => ({ default: () => <div>Detailed market intelligence</div> }));
vi.mock('@/components/operations/SignalsGrid', () => ({ default: () => <div>Detailed signals</div> }));
vi.mock('@/components/operations/signals/ArrivalsSignalCard', () => ({ default: () => <div>Arrivals details</div> }));
vi.mock('@/components/operations/signals/DemandSignalCard', () => ({ default: () => <div>Demand details</div> }));
vi.mock('@/components/operations/signals/PricingSignalCard', () => ({ default: () => <div>Pricing details</div> }));
vi.mock('@/components/operations/signals/WeatherSignalCard', () => ({ default: () => <div>Weather details</div> }));
vi.mock('@/components/operations/DepartmentIntelligenceCard', () => ({ default: () => <div>Department intelligence details</div> }));
vi.mock('@/components/operations/AIRecommendationGovernancePanel', () => ({ default: () => <div>Detailed governance queue</div> }));
vi.mock('@/components/ai/AICopilotPanel', () => ({ default: () => <div>Operations copilot details</div> }));
vi.mock('@/components/timeline/OperationalTimeline', () => ({ default: () => <div>Detailed activity filters</div> }));

const context = {
  hotelId: 'hotel-1', generatedAtUtc: '2026-08-11T12:00:00Z',
  weather: { isFresh: true, syncedAtUtc: '2026-08-11T12:00:00Z', next24h: { summary: 'Light rain' } },
  ops: { arrivalsNext24h: 3, departuresNext24h: 2, inhouseNow: 12 },
  pricingSignal: { demandTrend: 'down', marketCoveragePct: 40, suggestion: 'Review pricing' },
  advisories: [{ id: 'a1', title: 'Review task', reason: 'Due', priority: 'high', source: 'ARRIVALS', department: 'FRONT_DESK' }],
};
const briefing = {
  hotelHealthScore: 78, executiveSummary: 'Operations need attention.',
  todayPriorities: [{ title: 'Review arrivals', detail: 'Prepare rooms', department: 'FRONT_DESK' }],
  operationalRisks: [{ title: 'Late room', detail: 'Needs review', severity: 'HIGH' }],
  guestExperienceRisks: [], revenueOpportunities: [], weatherImpacts: [], maintenanceConcerns: [], securityConcerns: [], smartBuildingConcerns: [], staffingSuggestions: [],
  recommendedActions: [{ title: 'Assign owner', owner: 'Front Desk', priority: 'HIGH', rationale: 'Resolve promptly' }],
  generatedAt: '2026-08-11T12:00:00Z', contextVersion: 'v1', source: 'RULES',
};

const renderPage = (route = '/operations-center') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}><OperationsCenterPage /></MemoryRouter></QueryClientProvider>);
};

describe('OperationsCenterPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'admin-1', role: 'ADMIN', hotel: { id: 'hotel-1' } } as never });
    serviceMocks.getContext.mockResolvedValue(context);
    serviceMocks.getBriefing.mockResolvedValue(briefing);
    serviceMocks.listRecommendations.mockResolvedValue([{}, {}, {}]);
  });

  it('renders a summary-first command centre without mounting dense details', async () => {
    renderPage();
    expect(await screen.findByText('Today’s Operational Focus')).toBeInTheDocument();
    expect(screen.getByText('Department Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Operational Indicators')).toBeInTheDocument();
    expect(screen.getByText('Operations Quick Actions')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review tasks and advisories/ })).toHaveAttribute('href', '/operations-center/tasks');
    expect(screen.queryByPlaceholderText('Ask an operational question...')).not.toBeInTheDocument();
    expect(screen.getByText('AI Recommendation Governance')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review queue/ })).toHaveAttribute('href', '/operations-center/ai');
    expect(screen.queryByText('Detailed governance queue')).not.toBeInTheDocument();
    expect(screen.queryByText('Detailed market intelligence')).not.toBeInTheDocument();
  });

  it('keeps detailed concierge, context, governance, and department tools in the AI workspace', async () => {
    renderPage('/operations-center/ai');
    expect(await screen.findByText('Operations Concierge')).toBeInTheDocument();
    expect(await screen.findByText('Detailed concierge and context')).toBeInTheDocument();
    expect(screen.getByText('Detailed governance queue')).toBeInTheDocument();
    expect(screen.getAllByText('Department intelligence details').length).toBeGreaterThan(0);
  });
});
