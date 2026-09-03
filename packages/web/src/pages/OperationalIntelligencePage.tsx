import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
  CloudRain,
  Gauge,
  House,
  RefreshCcw,
  ShieldAlert,
  UsersRound,
  Wrench,
  X,
} from 'lucide-react';
import {
  dashboardService,
  maintenanceCenterService,
  operationsService,
  securityCenterService,
  smartBuildingService,
  timelineService,
} from '@/services';
import { incidentService } from '@/services/incidents';
import type { CreateAdvisoryTicketInput, OperationsContext } from '@/services/operations';
import type { TimelineEvent } from '@/services/timeline';
import { useAuthStore } from '@/stores/authStore';
import { canAccess } from '@/lib/access';
import { openLafloAssistant } from '@/lib/assistantEvents';

type IntelligenceTab = 'overview' | 'weather-impact' | 'demand-revenue' | 'guest-flow' | 'department-pressure' | 'risk-signals' | 'recommended-actions';
type DrawerState = { title: string; body: React.ReactNode } | null;
type Advisory = NonNullable<OperationsContext['advisories']>[number];

const intelligenceTabs: Array<{ value: IntelligenceTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'weather-impact', label: 'Weather Impact' },
  { value: 'demand-revenue', label: 'Demand & Revenue' },
  { value: 'guest-flow', label: 'Guest Flow' },
  { value: 'department-pressure', label: 'Department Pressure' },
  { value: 'risk-signals', label: 'Risk Signals' },
  { value: 'recommended-actions', label: 'Recommended Actions' },
];

const isIntelligenceTab = (value: string | null): value is IntelligenceTab => intelligenceTabs.some((tab) => tab.value === value);
const displayValue = (value: number | undefined, unavailable: boolean) => unavailable ? 'Unavailable' : String(value ?? 0);
const formatTime = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not available';

export default function OperationalIntelligencePage() {
  const user = useAuthStore((state) => state.user);
  const hotelId = user?.hotel?.id || '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [selectedAction, setSelectedAction] = useState<Advisory | null>(null);
  const [dismissTarget, setDismissTarget] = useState<Advisory | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [createdTicketIds, setCreatedTicketIds] = useState<Record<string, string>>({});
  const activeTab = isIntelligenceTab(searchParams.get('tab')) ? searchParams.get('tab') as IntelligenceTab : 'overview';

  const canHousekeeping = canAccess(user, 'housekeeping');
  const canSecurity = canAccess(user, 'security_center');
  const canMaintenance = canAccess(user, 'maintenance_center');
  const canSmartBuilding = canAccess(user, 'smart_building');
  const canIncidents = canAccess(user, 'incident_management');
  const canRevenue = canAccess(user, 'financials');

  const operationsQuery = useQuery({ queryKey: ['operational-intelligence', 'context', hotelId], queryFn: () => operationsService.getOperationsContext(hotelId), enabled: Boolean(hotelId), retry: false });
  const dashboardQuery = useQuery({ queryKey: ['operational-intelligence', 'dashboard'], queryFn: dashboardService.getSummary, retry: false });
  const housekeepingQuery = useQuery({ queryKey: ['operational-intelligence', 'housekeeping'], queryFn: dashboardService.getHousekeepingSummary, enabled: canHousekeeping, retry: false });
  const securityQuery = useQuery({ queryKey: ['operational-intelligence', 'security'], queryFn: securityCenterService.getOverview, enabled: canSecurity, retry: false });
  const maintenanceQuery = useQuery({ queryKey: ['operational-intelligence', 'maintenance'], queryFn: maintenanceCenterService.getOverview, enabled: canMaintenance, retry: false });
  const smartBuildingQuery = useQuery({ queryKey: ['operational-intelligence', 'smart-building'], queryFn: smartBuildingService.getOverview, enabled: canSmartBuilding, retry: false });
  const incidentsQuery = useQuery({ queryKey: ['operational-intelligence', 'incidents'], queryFn: incidentService.overview, enabled: canIncidents, retry: false });
  const timelineQuery = useQuery({ queryKey: ['operational-intelligence', 'timeline'], queryFn: () => timelineService.list({ time: '24h', limit: 20 }), retry: false });

  const createTaskMutation = useMutation({
    mutationFn: (advisory: Advisory) => operationsService.createAdvisoryTicket({
      advisoryId: advisory.id,
      title: advisory.title,
      reason: advisory.reason,
      priority: advisory.priority,
      department: advisory.department || 'MANAGEMENT',
      source: advisory.source,
      meta: { generatedAtUtc: operationsQuery.data?.generatedAtUtc || null },
    } as CreateAdvisoryTicketInput),
    onSuccess: async (ticket, advisory) => {
      setCreatedTicketIds((current) => ({ ...current, [advisory.id]: ticket.ticketId }));
      setSelectedAction(null);
      toast.success(ticket.deduped ? 'Existing task linked' : 'Task created');
      await queryClient.invalidateQueries({ queryKey: ['operational-intelligence', 'context'] });
    },
    onError: (error) => toast.error((error as Error).message || 'Task service unavailable'),
  });

  const context = operationsQuery.data;
  const visibleActions = (context?.advisories || []).filter((advisory) => !dismissedIds.has(advisory.id));
  const meaningfulTimeline = useMemo(() => (timelineQuery.data?.events || []).filter((event) => !['SYSTEM', 'AUDIT'].includes(event.module.toUpperCase())).slice(0, 10), [timelineQuery.data?.events]);

  const risks = useMemo(() => [
    { label: 'Active incidents', value: displayValue(incidentsQuery.data?.active, incidentsQuery.isError || !canIncidents), severity: (incidentsQuery.data?.critical || 0) > 0 ? 'Critical incidents require attention' : 'Incident workload', href: '/incidents?tab=active', allowed: canIncidents },
    { label: 'Active security alerts', value: displayValue(securityQuery.data?.alerts.open, securityQuery.isError || !canSecurity), severity: 'Security alert queue', href: '/security-center?tab=alerts', allowed: canSecurity },
    { label: 'Offline devices', value: displayValue(smartBuildingQuery.data ? smartBuildingQuery.data.health.totalDevices - smartBuildingQuery.data.health.onlineDevices : undefined, smartBuildingQuery.isError || !canSmartBuilding), severity: 'Connected device health', href: '/operations/smart-building?tab=devices', allowed: canSmartBuilding },
    { label: 'Room readiness risks', value: displayValue(housekeepingQuery.data?.dirty, housekeepingQuery.isError || !canHousekeeping), severity: 'Rooms awaiting housekeeping', href: '/housekeeping', allowed: canHousekeeping },
    { label: 'Revenue / demand risk', value: operationsQuery.isError || !canRevenue ? 'Unavailable' : context?.pricingSignal?.demandTrend === 'down' ? 'Softening' : context?.pricingSignal?.demandTrend === 'up' ? 'Growing' : 'Stable', severity: context?.pricingSignal?.note || 'Demand signal', href: '/operations/operational-intelligence/revenue-guidance', allowed: canRevenue },
    { label: 'Weather-related risk', value: operationsQuery.isError ? 'Unavailable' : context?.weather?.next24h?.rainRisk || 'Unknown', severity: context?.weather?.next24h?.summary || 'Forecast detail unavailable', href: '/operations/operational-intelligence/weather-forecast', allowed: true },
  ], [canHousekeeping, canIncidents, canRevenue, canSecurity, canSmartBuilding, context, housekeepingQuery.data, housekeepingQuery.isError, incidentsQuery.data, incidentsQuery.isError, operationsQuery.isError, securityQuery.data, securityQuery.isError, smartBuildingQuery.data, smartBuildingQuery.isError]);

  const pressureScore = (incidentsQuery.data?.active || 0) + (securityQuery.data?.alerts.open || 0) + (smartBuildingQuery.data?.health.activeAlerts || 0) + (housekeepingQuery.data?.dirty || 0) + (context?.pricingSignal?.demandTrend === 'down' ? 2 : 0) + (context?.weather?.next24h?.rainRisk === 'high' ? 2 : 0);
  const posture = pressureScore >= 12 ? 'At Risk' : pressureScore >= 6 ? 'Under Pressure' : pressureScore >= 2 ? 'Busy' : 'Normal';
  const postureReasons = [
    (securityQuery.data?.alerts.open || 0) > 0 ? `${securityQuery.data?.alerts.open} active security alert${securityQuery.data?.alerts.open === 1 ? '' : 's'}` : null,
    context?.pricingSignal?.demandTrend === 'down' ? 'demand softening' : null,
    visibleActions.length ? `${visibleActions.length} pending operational action${visibleActions.length === 1 ? '' : 's'}` : null,
    (housekeepingQuery.data?.dirty || 0) > 0 ? `${housekeepingQuery.data?.dirty} rooms awaiting housekeeping` : null,
  ].filter(Boolean);

  const selectTab = (tab: IntelligenceTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab'); else next.set('tab', tab);
    setSearchParams(next);
  };

  const openRestrictedOrRoute = (allowed: boolean, href: string, title: string) => {
    if (allowed) navigate(href);
    else setDrawer({ title, body: <UnavailableState title="Permission restricted" detail="Your current role does not include access to this operational source." /> });
  };

  const openAssistant = (prompt: string, extra: Record<string, unknown> = {}) => openLafloAssistant({
    mode: 'operations',
    prompt,
    context: { page: 'Operational Intelligence', tab: activeTab, operatingPosture: posture, pendingActions: visibleActions.length, generatedAt: context?.generatedAtUtc || null, ...extra },
  });

  const refreshAll = async () => {
    const results = await Promise.all([
      operationsQuery.refetch(), dashboardQuery.refetch(), timelineQuery.refetch(),
      ...(canHousekeeping ? [housekeepingQuery.refetch()] : []),
      ...(canSecurity ? [securityQuery.refetch()] : []),
      ...(canMaintenance ? [maintenanceQuery.refetch()] : []),
      ...(canSmartBuilding ? [smartBuildingQuery.refetch()] : []),
      ...(canIncidents ? [incidentsQuery.refetch()] : []),
    ]);
    const failures = results.filter((result) => result.error).length;
    if (!failures) toast.success('Operational intelligence refreshed');
    else if (failures < results.length) toast('Operational intelligence partially refreshed');
    else toast.error('Operational intelligence is disconnected');
  };

  const isRefreshing = [operationsQuery, dashboardQuery, housekeepingQuery, securityQuery, maintenanceQuery, smartBuildingQuery, incidentsQuery, timelineQuery].some((query) => query.isFetching);
  const allDisconnected = operationsQuery.isError && dashboardQuery.isError && timelineQuery.isError;

  const signalCards = [
    { title: 'Guest Flow', icon: UsersRound, value: displayValue(context?.ops?.arrivalsNext24h, operationsQuery.isError), detail: `${context?.ops?.departuresNext24h ?? 0} departures · ${context?.ops?.inhouseNow ?? dashboardQuery.data?.inHouseGuests ?? 0} in-house`, status: (context?.ops?.arrivalsNext24h || 0) > 20 ? 'High expected pressure' : 'Expected pressure available', href: '/operational-intelligence?tab=guest-flow', allowed: true },
    { title: 'Room Readiness', icon: House, value: displayValue(housekeepingQuery.data?.clean, housekeepingQuery.isError || !canHousekeeping), detail: `${housekeepingQuery.data?.dirty ?? 0} not ready · ${housekeepingQuery.data?.outOfService ?? dashboardQuery.data?.outOfServiceRooms ?? 0} out of service`, status: (housekeepingQuery.data?.dirty || 0) > 0 ? 'Housekeeping attention' : 'Readiness stable', href: '/housekeeping', allowed: canHousekeeping },
    { title: 'Security & Safety', icon: ShieldAlert, value: displayValue(securityQuery.data?.alerts.open, securityQuery.isError || !canSecurity), detail: `${securityQuery.data?.cctv.offline ?? 0} CCTV issues · ${securityQuery.data?.accessEvents.today ?? 0} access events`, status: (securityQuery.data?.alerts.open || 0) > 0 ? 'Active alerts' : 'No active alert signal', href: '/security-center?tab=alerts', allowed: canSecurity },
    { title: 'Maintenance & Smart Building', icon: Wrench, value: displayValue(maintenanceQuery.data?.workOrders.open, maintenanceQuery.isError || !canMaintenance), detail: `${smartBuildingQuery.data ? smartBuildingQuery.data.health.totalDevices - smartBuildingQuery.data.health.onlineDevices : 0} offline devices · ${smartBuildingQuery.data?.health.activeAlerts ?? 0} sensor alerts`, status: (maintenanceQuery.data?.faults.urgent || 0) > 0 ? 'Urgent facilities items' : 'Facilities status', href: '/maintenance-center', allowed: canMaintenance },
    { title: 'Revenue & Demand', icon: Gauge, value: operationsQuery.isError || !canRevenue ? 'Unavailable' : context?.pricingSignal?.demandTrend === 'down' ? 'Softening' : context?.pricingSignal?.demandTrend === 'up' ? 'Growing' : 'Stable', detail: `${context?.pricingSignal?.opportunityPct ?? 0}% pricing opportunity · ${context?.pricingSignal?.marketCoveragePct ?? 0}% coverage`, status: context?.pricingSignal?.suggestion || 'Revenue guidance available', href: '/operations/operational-intelligence/revenue-guidance', allowed: canRevenue },
    { title: 'Weather Impact', icon: CloudRain, value: operationsQuery.isError ? 'Unavailable' : context?.weather?.current?.summary || 'No current reading', detail: `${context?.weather?.current?.temperatureC ?? '—'}°C · ${context?.weather?.next24h?.rainRisk || 'unknown'} risk`, status: context?.weather?.next24h?.summary || 'No forecast detail', href: '/operations/operational-intelligence/weather-forecast', allowed: true },
  ];

  const departments = [
    { name: 'Front Desk', pressure: (context?.ops?.arrivalsNext24h || 0) > 20 ? 'High' : 'Normal', issue: `${context?.ops?.arrivalsNext24h ?? 0} arrivals expected`, action: 'Review arrival readiness', href: '/operations/tasks-advisories?department=FRONT_DESK', allowed: true },
    { name: 'Housekeeping', pressure: (housekeepingQuery.data?.dirty || 0) > 5 ? 'High' : 'Normal', issue: canHousekeeping ? `${housekeepingQuery.data?.dirty ?? 0} rooms not ready` : 'Permission restricted', action: 'Prioritise arrival rooms', href: '/operations/tasks-advisories?department=HOUSEKEEPING', allowed: canHousekeeping },
    { name: 'Security', pressure: (securityQuery.data?.alerts.open || 0) > 0 ? 'High' : 'Normal', issue: canSecurity ? `${securityQuery.data?.alerts.open ?? 0} active alerts` : 'Permission restricted', action: 'Review active alert queue', href: '/security-center?tab=alerts', allowed: canSecurity },
    { name: 'Maintenance', pressure: (maintenanceQuery.data?.faults.urgent || 0) > 0 ? 'High' : 'Normal', issue: canMaintenance ? `${maintenanceQuery.data?.workOrders.open ?? 0} open work orders` : 'Permission restricted', action: 'Review urgent facilities work', href: '/maintenance-center', allowed: canMaintenance },
    { name: 'Revenue', pressure: context?.pricingSignal?.demandTrend === 'down' ? 'Elevated' : 'Normal', issue: canRevenue ? `${context?.pricingSignal?.marketCoveragePct ?? 0}% market coverage` : 'Permission restricted', action: 'Review demand and pricing guidance', href: '/operations/operational-intelligence/revenue-guidance', allowed: canRevenue },
    { name: 'Management', pressure: posture, issue: `${visibleActions.length} actions awaiting review`, action: 'Review recommended actions', href: '/operational-intelligence?tab=recommended-actions', allowed: true },
  ];

  const content = allDisconnected ? <UnavailableState title="Operational intelligence disconnected" detail="Core operational sources could not be reached. Refresh to try again; restricted modules remain hidden." action={<button type="button" onClick={() => void refreshAll()} className="rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast">Retry connection</button>} /> : (
    <>
      {activeTab === 'overview' ? <div className="space-y-4"><PosturePanel posture={posture} reasons={postureReasons as string[]} updatedAt={context?.generatedAtUtc} onAsk={() => openAssistant('What needs attention today, what does it mean, and what should we do first?')} /><SignalGrid cards={signalCards} onOpen={openRestrictedOrRoute} /><DepartmentGrid departments={departments} actions={visibleActions} onOpen={openRestrictedOrRoute} /><RecommendedActions actions={visibleActions} createdTicketIds={createdTicketIds} onCreate={setSelectedAction} onOpenTask={() => navigate('/operations/tasks-advisories')} onAssign={(action) => setDrawer({ title: 'Assign owner', body: <UnavailableState title="Assignment service unavailable" detail={`No owner was changed for “${action.title}”. Connect the task assignment service to enable this action.`} /> })} onDismiss={setDismissTarget} onAsk={(action) => openAssistant(`Explain this recommended action and why it matters: ${action.title}`, { advisoryId: action.id, source: action.source, department: action.department })} /><RiskSignals risks={risks} onOpen={openRestrictedOrRoute} /><Timeline events={meaningfulTimeline} isLoading={timelineQuery.isLoading} isError={timelineQuery.isError} onOpen={(event) => navigate(timelineHref(event))} /></div> : null}
      {activeTab === 'weather-impact' ? <FocusedSection title="Weather Impact" description="Weather is one operational intelligence source. Open the dedicated forecast for current conditions, outlook, demand effects, pricing intelligence, and weather-driven advisories."><SignalGrid cards={signalCards.filter((card) => card.title === 'Weather Impact')} onOpen={openRestrictedOrRoute} /><RiskSignals risks={risks.filter((risk) => risk.label === 'Weather-related risk')} onOpen={openRestrictedOrRoute} /></FocusedSection> : null}
      {activeTab === 'demand-revenue' ? <FocusedSection title="Demand & Revenue" description="Live demand direction, pricing opportunity, and market coverage from connected revenue sources."><SignalGrid cards={signalCards.filter((card) => card.title === 'Revenue & Demand')} onOpen={openRestrictedOrRoute} /><RecommendedActions actions={visibleActions.filter((action) => action.source === 'PRICING')} createdTicketIds={createdTicketIds} onCreate={setSelectedAction} onOpenTask={() => navigate('/operations/tasks-advisories')} onAssign={(action) => setDrawer({ title: 'Assign owner', body: <UnavailableState title="Assignment service unavailable" detail={`No owner was changed for “${action.title}”.`} /> })} onDismiss={setDismissTarget} onAsk={(action) => openAssistant(`Explain this revenue action: ${action.title}`, { advisoryId: action.id, source: action.source, department: action.department })} /></FocusedSection> : null}
      {activeTab === 'guest-flow' ? <FocusedSection title="Guest Flow" description="Arrivals, departures, in-house guests, and expected front desk pressure."><SignalGrid cards={signalCards.filter((card) => card.title === 'Guest Flow')} onOpen={openRestrictedOrRoute} /><DepartmentGrid departments={departments.filter((department) => ['Front Desk', 'Housekeeping'].includes(department.name))} actions={visibleActions} onOpen={openRestrictedOrRoute} /></FocusedSection> : null}
      {activeTab === 'department-pressure' ? <FocusedSection title="Department Pressure" description="Current pressure, top issue, next action, and related advisory workload by department."><DepartmentGrid departments={departments} actions={visibleActions} onOpen={openRestrictedOrRoute} /></FocusedSection> : null}
      {activeTab === 'risk-signals' ? <FocusedSection title="Risk Signals" description="Operational risks from incidents, security, rooms, facilities, revenue, and weather."><RiskSignals risks={risks} onOpen={openRestrictedOrRoute} /></FocusedSection> : null}
      {activeTab === 'recommended-actions' ? <FocusedSection title="Recommended Actions" description="Actions generated from connected operational signals. Create a task, review ownership availability, dismiss from this review, or ask Ask LaFlo for context."><RecommendedActions actions={visibleActions} createdTicketIds={createdTicketIds} onCreate={setSelectedAction} onOpenTask={() => navigate('/operations/tasks-advisories')} onAssign={(action) => setDrawer({ title: 'Assign owner', body: <UnavailableState title="Assignment service unavailable" detail={`No owner was changed for “${action.title}”.`} /> })} onDismiss={setDismissTarget} onAsk={(action) => openAssistant(`Explain this recommended action: ${action.title}`, { advisoryId: action.id, source: action.source, department: action.department })} /></FocusedSection> : null}
    </>
  );

  return <div className="space-y-4">
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-700">Operations / Operational Intelligence</p><h1 className="mt-1 text-2xl font-semibold text-text-main">Operational Intelligence</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">Understand what is happening across the hotel, what it means, and what needs action now.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openAssistant('What needs attention today across hotel operations?')} className="inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700"><Bot className="h-4 w-4" />Ask LaFlo</button><button type="button" onClick={() => void refreshAll()} disabled={isRefreshing} className="inline-flex items-center gap-2 rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast disabled:opacity-60"><RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />{isRefreshing ? 'Refreshing…' : 'Refresh intelligence'}</button></div></div></section>
    <nav aria-label="Operational Intelligence sections" className="overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-sm"><div role="tablist" className="flex min-w-max gap-1">{intelligenceTabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={activeTab === tab.value} onClick={() => selectTab(tab.value)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${activeTab === tab.value ? 'bg-primary-solid text-primary-contrast' : 'text-text-muted hover:bg-bg hover:text-main'}`}>{tab.label}</button>)}</div></nav>
    {content}
    {selectedAction ? <ActionDialog action={selectedAction} pending={createTaskMutation.isPending} onCancel={() => setSelectedAction(null)} onConfirm={() => createTaskMutation.mutate(selectedAction)} /> : null}
    {dismissTarget ? <ConfirmDialog title="Dismiss recommended action?" detail="This removes the action from your current review session. The source signal and any existing task remain unchanged." confirmLabel="Dismiss action" onCancel={() => setDismissTarget(null)} onConfirm={() => { setDismissedIds((current) => new Set(current).add(dismissTarget.id)); setDismissTarget(null); toast.success('Action dismissed from this review'); }} /> : null}
    {drawer ? <Drawer title={drawer.title} onClose={() => setDrawer(null)}>{drawer.body}</Drawer> : null}
  </div>;
}

function PosturePanel({ posture, reasons, updatedAt, onAsk }: { posture: string; reasons: string[]; updatedAt?: string; onAsk: () => void }) { return <section className="rounded-3xl border border-border bg-gradient-to-r from-slate-950 via-[#05254b] to-[#123a67] p-6 text-primary-contrast shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-sky-200">Hotel Operating Posture</p><div className="mt-2 flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold">{posture}</h2><span className="rounded-full border border-white/30 px-2.5 py-1 text-xs">Updated {formatTime(updatedAt)}</span></div><p className="mt-2 max-w-3xl text-sm leading-6 text-sky-50">{reasons.length ? `The hotel is ${posture.toLowerCase()} due to ${reasons.join(', ')}.` : 'Connected signals do not currently indicate material operational pressure.'}</p></div><button type="button" onClick={onAsk} className="inline-flex items-center gap-2 rounded-xl bg-card px-4 py-2 text-sm font-semibold text-text-main"><Bot className="h-4 w-4" />Ask LaFlo what to do first</button></div></section>; }
function SignalGrid({ cards, onOpen }: { cards: Array<{ title: string; icon: typeof Activity; value: string; detail: string; status: string; href: string; allowed: boolean }>; onOpen: (allowed: boolean, href: string, title: string) => void }) { return <section><div className="mb-3"><h2 className="text-base font-semibold text-text-main">Hotel signals</h2><p className="mt-1 text-sm text-text-muted">Select a signal to open its connected workspace or access state.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <button key={card.title} type="button" onClick={() => onOpen(card.allowed, card.href, card.title)} className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary-300 hover:-translate-y-0.5"><span className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-primary-700"><card.icon className="h-5 w-5" /></span><span className="text-lg font-bold text-text-main">{card.value}</span></span><span className="mt-3 block text-sm font-semibold text-text-main">{card.title}</span><span className="mt-1 block text-xs text-text-muted">{card.detail}</span><span className="mt-3 flex items-center justify-between text-[11px] font-medium text-text-muted"><span>{card.status}</span><ArrowRight className="h-3.5 w-3.5" /></span></button>)}</div></section>; }
function DepartmentGrid({ departments, actions, onOpen }: { departments: Array<{ name: string; pressure: string; issue: string; action: string; href: string; allowed: boolean }>; actions: Advisory[]; onOpen: (allowed: boolean, href: string, title: string) => void }) { return <section><div className="mb-3"><h2 className="text-base font-semibold text-text-main">Department Intelligence</h2><p className="mt-1 text-sm text-text-muted">Pressure, top issue, recommended response, and related advisory workload.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{departments.map((department) => { const key = department.name.toUpperCase().replace(/ /g, '_'); const related = actions.filter((action) => action.department === key || (department.name === 'Revenue' && action.source === 'PRICING')).length; return <button key={department.name} type="button" onClick={() => onOpen(department.allowed, department.href, department.name)} className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm hover:border-primary-300"><span className="flex items-center justify-between"><span className="font-semibold text-text-main">{department.name}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${department.pressure === 'High' || department.pressure === 'At Risk' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{department.pressure}</span></span><span className="mt-3 block text-xs text-text-muted">Top issue</span><span className="mt-1 block text-sm font-medium text-text-main">{department.issue}</span><span className="mt-3 block text-xs text-text-muted">Recommended action</span><span className="mt-1 block text-sm text-text-main">{department.action}</span><span className="mt-3 flex items-center justify-between text-xs text-text-muted"><span>{related} related tasks/advisories</span><ArrowRight className="h-3.5 w-3.5" /></span></button>; })}</div></section>; }
function RecommendedActions({ actions, createdTicketIds, onCreate, onOpenTask, onAssign, onDismiss, onAsk }: { actions: Advisory[]; createdTicketIds: Record<string, string>; onCreate: (action: Advisory) => void; onOpenTask: () => void; onAssign: (action: Advisory) => void; onDismiss: (action: Advisory) => void; onAsk: (action: Advisory) => void }) { return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div><h2 className="text-base font-semibold text-text-main">Recommended Actions</h2><p className="mt-1 text-sm text-text-muted">Actions are sourced from connected operational signals; no action is invented when the service has no data.</p></div><div className="mt-4 space-y-3">{actions.length ? actions.map((action) => { const ticketId = createdTicketIds[action.id] || action.createdTicket?.ticketId; return <article key={action.id} className="rounded-2xl border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold text-text-main">{action.title}</h3><p className="mt-1 text-xs leading-5 text-text-muted">{action.reason}</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase text-amber-700">{action.priority}</span></div><div className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-4"><span>Department: {action.department || 'Management'}</span><span>Source: {action.source.replace(/_/g, ' ')}</span><span>Owner: {action.createdTicket?.createdAtUtc ? 'Task workflow' : 'Unassigned'}</span><span>Status: {ticketId ? 'Task created' : 'Open'}</span></div><div className="mt-4 flex flex-wrap gap-2">{ticketId ? <button type="button" onClick={onOpenTask} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Open linked task {ticketId.slice(0, 8)}</button> : <button type="button" onClick={() => onCreate(action)} className="rounded-xl bg-primary-solid px-3 py-2 text-xs font-semibold text-primary-contrast">Create task</button>}<button type="button" onClick={() => onAssign(action)} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-main">Assign owner</button><button type="button" onClick={() => onDismiss(action)} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-muted">Dismiss</button><button type="button" onClick={() => onAsk(action)} className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700">Ask LaFlo about this</button></div></article>; }) : <UnavailableState title="No recommended actions" detail="Connected sources have not returned any actions requiring review." />}</div></section>; }
function RiskSignals({ risks, onOpen }: { risks: Array<{ label: string; value: string; severity: string; href: string; allowed: boolean }>; onOpen: (allowed: boolean, href: string, title: string) => void }) { return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="text-base font-semibold text-text-main">Risk Signals</h2><div className="mt-4 divide-y divide-border">{risks.map((risk) => <button key={risk.label} type="button" onClick={() => onOpen(risk.allowed, risk.href, risk.label)} className="flex w-full items-center gap-3 py-3 text-left hover:text-primary-700"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><AlertTriangle className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-main">{risk.label}</span><span className="block truncate text-xs text-text-muted">{risk.severity}</span></span><span className="text-sm font-bold text-text-main">{risk.value}</span><ArrowRight className="h-4 w-4 text-text-muted" /></button>)}</div></section>; }
function Timeline({ events, isLoading, isError, onOpen }: { events: TimelineEvent[]; isLoading: boolean; isError: boolean; onOpen: (event: TimelineEvent) => void }) { return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div><h2 className="text-base font-semibold text-text-main">Intelligence Timeline</h2><p className="mt-1 text-sm text-text-muted">Meaningful operational events from connected hotel systems.</p></div><div className="mt-4 divide-y divide-border">{isLoading ? <p className="py-4 text-sm text-text-muted" role="status">Loading operational events…</p> : isError ? <UnavailableState title="Timeline unavailable" detail="The operational timeline service is disconnected." /> : events.length ? events.map((event) => <button key={event.id} type="button" onClick={() => onOpen(event)} className="flex w-full items-start gap-3 py-3 text-left hover:text-primary-700"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-500" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-main">{event.summary}</span><span className="mt-1 block text-xs text-text-muted">{event.module} · {event.department || 'Hotel-wide'} · {formatTime(event.timestamp)}</span></span><ArrowRight className="mt-1 h-4 w-4 text-text-muted" /></button>) : <UnavailableState title="No recent intelligence events" detail="No meaningful operational events were returned for the last 24 hours." />}</div></section>; }
function FocusedSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <div className="space-y-4"><section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="text-lg font-semibold text-text-main">{title}</h2><p className="mt-1 text-sm text-text-muted">{description}</p></section>{children}</div>; }
function UnavailableState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) { return <div className="rounded-2xl border border-dashed border-border bg-bg p-5 text-center"><Building2 className="mx-auto h-6 w-6 text-text-muted" /><p className="mt-2 text-sm font-semibold text-text-main">{title}</p><p className="mt-1 text-xs leading-5 text-text-muted">{detail}</p>{action ? <div className="mt-4">{action}</div> : null}</div>; }
function ActionDialog({ action, pending, onCancel, onConfirm }: { action: Advisory; pending: boolean; onCancel: () => void; onConfirm: () => void }) { return <div className="fixed inset-0 z-[95] grid place-items-center bg-text-main/45 p-4"><section role="dialog" aria-modal="true" aria-label="Create task from recommended action" className="w-full max-w-lg rounded-3xl bg-card p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Prefilled operational task</p><h2 className="mt-1 text-lg font-semibold text-text-main">Create task from recommended action</h2></div><button type="button" onClick={onCancel} aria-label="Close task drawer" className="grid h-9 w-9 place-items-center rounded-xl border border-border"><X className="h-4 w-4" /></button></div><div className="mt-4 space-y-2 rounded-2xl border border-border p-4 text-sm"><p className="font-semibold text-text-main">{action.title}</p><p className="text-text-muted">{action.reason}</p><p className="text-xs text-text-muted">{action.department || 'Management'} · {action.priority} · {action.source.replace(/_/g, ' ')}</p></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} disabled={pending} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={onConfirm} disabled={pending} className="rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast disabled:opacity-60">{pending ? 'Creating…' : 'Create task'}</button></div></section></div>; }
function ConfirmDialog({ title, detail, confirmLabel, onCancel, onConfirm }: { title: string; detail: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) { return <div className="fixed inset-0 z-[95] grid place-items-center bg-text-main/45 p-4"><section role="alertdialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-3xl bg-card p-5 shadow-2xl"><AlertTriangle className="h-6 w-6 text-amber-600" /><h2 className="mt-3 text-lg font-semibold text-text-main">{title}</h2><p className="mt-2 text-sm leading-6 text-text-muted">{detail}</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={onConfirm} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-primary-contrast">{confirmLabel}</button></div></section></div>; }
function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[90] flex justify-end bg-text-main/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card p-5 shadow-2xl"><div className="mb-5 flex items-start justify-between gap-3"><h2 className="text-lg font-semibold text-text-main">{title}</h2><button type="button" onClick={onClose} aria-label={`Close ${title}`} className="grid h-9 w-9 place-items-center rounded-xl border border-border"><X className="h-4 w-4" /></button></div>{children}</section></div>; }
function timelineHref(event: TimelineEvent) { const module = event.module.toUpperCase(); if (module.includes('SECURITY')) return '/security-center?tab=alerts'; if (module.includes('INCIDENT')) return '/incidents?tab=active'; if (module.includes('SMART') || module.includes('DEVICE')) return '/operations/smart-building?tab=overview'; if (module.includes('WEATHER')) return '/operations/operational-intelligence/weather-forecast'; if (module.includes('REVENUE') || module.includes('PRICING')) return '/operations/operational-intelligence/revenue-guidance'; if (module.includes('HOUSEKEEPING')) return '/housekeeping'; return '/operations/tasks-advisories'; }
