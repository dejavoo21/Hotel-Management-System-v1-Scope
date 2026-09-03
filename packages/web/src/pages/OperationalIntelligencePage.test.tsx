import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_LAFLO_ASSISTANT_EVENT } from '@/lib/assistantEvents';
import { useAuthStore } from '@/stores/authStore';
import OperationalIntelligencePage from './OperationalIntelligencePage';

const mocks = vi.hoisted(() => ({
  context: vi.fn(), dashboard: vi.fn(), housekeeping: vi.fn(), security: vi.fn(), maintenance: vi.fn(), smart: vi.fn(), incidents: vi.fn(), timeline: vi.fn(), createTask: vi.fn(),
}));

vi.mock('@/services', () => ({
  operationsService: { getOperationsContext: mocks.context, createAdvisoryTicket: mocks.createTask },
  dashboardService: { getSummary: mocks.dashboard, getHousekeepingSummary: mocks.housekeeping },
  securityCenterService: { getOverview: mocks.security },
  maintenanceCenterService: { getOverview: mocks.maintenance },
  smartBuildingService: { getOverview: mocks.smart },
  timelineService: { list: mocks.timeline },
}));
vi.mock('@/services/incidents', () => ({ incidentService: { overview: mocks.incidents } }));

function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
function renderPage(entry = '/operational-intelligence') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[entry]}><OperationalIntelligencePage /><LocationProbe /></MemoryRouter></QueryClientProvider>);
}

describe('OperationalIntelligencePage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'admin-1', email: 'admin@laflo.test', role: 'ADMIN', hotel: { id: 'hotel-1' }, modulePermissions: [] } as never });
    mocks.context.mockResolvedValue({ hotelId: 'hotel-1', generatedAtUtc: '2026-08-31T18:00:00Z', ops: { arrivalsNext24h: 18, departuresNext24h: 12, inhouseNow: 74 }, weather: { current: { summary: 'Cloudy', temperatureC: 17 }, next24h: { summary: 'Light rain later', rainRisk: 'medium' } }, pricingSignal: { demandTrend: 'down', opportunityPct: 4, marketCoveragePct: 72, note: 'Demand softened', suggestion: 'Review pricing' }, advisories: [{ id: 'adv-1', title: 'Confirm arrival rooms', reason: 'Several arrivals need readiness confirmation.', priority: 'high', department: 'FRONT_DESK', source: 'ARRIVALS', createdTicket: null }] });
    mocks.dashboard.mockResolvedValue({ inHouseGuests: 74, outOfServiceRooms: 2 });
    mocks.housekeeping.mockResolvedValue({ clean: 80, dirty: 6, inspection: 2, outOfService: 2, priorityRooms: [] });
    mocks.security.mockResolvedValue({ cctv: { total: 10, online: 9, offline: 1 }, accessEvents: { today: 14 }, visitors: { onsite: 2 }, alerts: { open: 1 }, recentActivity: [] });
    mocks.maintenance.mockResolvedValue({ workOrders: { open: 3 }, faults: { urgent: 1 }, repairs: { inProgress: 1 }, preventiveMaintenance: { overdue: 0 }, assets: { dueInspection: 0 }, completed: { today: 2 }, recentActivity: [] });
    mocks.smart.mockResolvedValue({ cameras: { online: 9, offline: 1 }, doors: { locked: 8, open: 1 }, accessEvents: { today: 14 }, motionAlerts: { active: 0 }, temperatureSensors: { normal: 10, warning: 1 }, waterLeakSensors: { alerts: 0 }, panicButtons: { active: 0 }, health: { activeAlerts: 1, onlineDevices: 18, totalDevices: 20 } });
    mocks.incidents.mockResolvedValue({ active: 2, critical: 0, resolved: 4, closed: 3, total: 9, averageResolutionMinutes: 32, byDepartment: [], bySourceModule: [] });
    mocks.timeline.mockResolvedValue({ events: [{ id: 'event-1', timestamp: '2026-08-31T17:55:00Z', hotelId: 'hotel-1', module: 'SECURITY', eventType: 'ALERT', severity: 'WARNING', summary: 'Security alert detected', icon: 'shield', sourceEventId: 'alert-1', correlationId: 'corr-1' }], filters: { modules: [], severities: [], departments: [] } });
    mocks.createTask.mockResolvedValue({ ticketId: 'ticket-123456', status: 'OPEN', department: 'FRONT_DESK', conversationId: 'conversation-1', deduped: false });
  });

  it('renders a multi-source overview and route-backed tabs', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Operational Intelligence' })).toBeInTheDocument();
    expect(screen.getByText('Hotel Operating Posture')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Guest Flow/ })).toHaveTextContent('18'));
    expect(screen.getByRole('button', { name: /Room Readiness/ })).toHaveTextContent('80');
    expect(screen.getByRole('button', { name: /Security & Safety/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /Maintenance & Smart Building/ })).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: /Revenue & Demand/ })).toHaveTextContent('Softening');
    expect(screen.getByRole('button', { name: /Weather Impact/ })).toHaveTextContent('Cloudy');
    expect(screen.getByRole('button', { name: /Front Desk/ })).toBeInTheDocument();
    expect(screen.getByText('Security alert detected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Risk Signals' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/operational-intelligence?tab=risk-signals');
    expect(screen.getAllByRole('heading', { name: 'Risk Signals' })).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Weather Impact' }));
    expect(screen.getAllByRole('heading', { name: 'Weather Impact' })).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Weather Impact/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/operations/operational-intelligence/weather-forecast');
  });

  it('creates tasks, confirms dismissals, and reports unavailable assignment', async () => {
    renderPage('/operational-intelligence?tab=recommended-actions');
    expect(await screen.findByText('Confirm arrival rooms')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    const taskDialog = screen.getByRole('dialog', { name: 'Create task from recommended action' });
    expect(taskDialog).toHaveTextContent('Several arrivals need readiness confirmation.');
    fireEvent.click(within(taskDialog).getByRole('button', { name: 'Create task' }));
    await waitFor(() => expect(mocks.createTask).toHaveBeenCalledWith(expect.objectContaining({ advisoryId: 'adv-1', department: 'FRONT_DESK' })));
    expect(await screen.findByRole('button', { name: /Open linked task ticket-1/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Assign owner' }));
    expect(screen.getByRole('dialog', { name: 'Assign owner' })).toHaveTextContent('Assignment service unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Close Assign owner' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    const confirmation = screen.getByRole('alertdialog', { name: 'Dismiss recommended action?' });
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Dismiss action' }));
    expect(screen.queryByText('Confirm arrival rooms')).not.toBeInTheDocument();
    expect(screen.getByText('No recommended actions')).toBeInTheDocument();
  });

  it('opens Ask LaFlo with Operational Intelligence and record context', async () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_LAFLO_ASSISTANT_EVENT, listener);
    renderPage('/operational-intelligence?tab=recommended-actions');
    await screen.findByText('Confirm arrival rooms');
    fireEvent.click(screen.getByRole('button', { name: 'Ask LaFlo about this' }));
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ context: { page: 'Operational Intelligence', tab: 'recommended-actions', advisoryId: 'adv-1', source: 'ARRIVALS' } });
    window.removeEventListener(OPEN_LAFLO_ASSISTANT_EVENT, listener);
  });
});
