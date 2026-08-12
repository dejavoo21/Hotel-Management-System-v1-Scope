import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, ClipboardList,
  CloudRain, Gauge, House, RefreshCcw, ShieldAlert, ShieldCheck, TrendingDown,
  TrendingUp, UsersRound, Wrench,
} from 'lucide-react';
import OpsAdvisories from '@/components/operations/advisories/OpsAdvisories';
import PricingCalendarCard from '@/components/operations/pricing/PricingCalendarCard';
import MarketIntelligenceCard from '@/components/operations/pricing/MarketIntelligenceCard';
import SignalsGrid from '@/components/operations/SignalsGrid';
import ArrivalsSignalCard from '@/components/operations/signals/ArrivalsSignalCard';
import DemandSignalCard from '@/components/operations/signals/DemandSignalCard';
import PricingSignalCard from '@/components/operations/signals/PricingSignalCard';
import WeatherSignalCard from '@/components/operations/signals/WeatherSignalCard';
import DepartmentIntelligenceCard from '@/components/operations/DepartmentIntelligenceCard';
import AIRecommendationGovernancePanel from '@/components/operations/AIRecommendationGovernancePanel';
import AICopilotPanel from '@/components/ai/AICopilotPanel';
import ContextPreview from '@/components/operations/assistant/ContextPreview';
import OperationalTimeline from '@/components/timeline/OperationalTimeline';
import CollaborationHeader from '@/components/collaboration/CollaborationHeader';
import { aiBriefingService, aiRecommendationsService, operationsService, weatherSignalsService } from '@/services';
import type { DailyGMBriefing, DailyBriefingItem } from '@/services/aiBriefing';
import type { OperationsContext } from '@/services/operations';
import { useAuthStore } from '@/stores/authStore';

type OperationsFocus = 'overview' | 'ai' | 'revenue' | 'weather' | 'tasks' | 'market-intelligence';
const focusMeta: Record<OperationsFocus, { title: string; description: string }> = {
  overview: { title: 'Operations Center', description: 'Real-time operational visibility across your hotel. Make informed decisions with confidence.' },
  ai: { title: 'Operations Concierge', description: 'Ask about operations, pricing, weather, context, and task execution.' },
  revenue: { title: 'Revenue Guidance', description: 'Review per-night recommendations, booking pace, and market-aware pricing.' },
  weather: { title: 'Weather & Forecast', description: 'Review forecast signals, guest readiness, and weather-driven actions.' },
  tasks: { title: 'Tasks & Advisories', description: 'Review operational actions, detailed advisories, and recent activity.' },
  'market-intelligence': { title: 'Market Intelligence', description: 'Manage competitor context and market-rate inputs.' },
};
const getFocusFromPath = (pathname: string): OperationsFocus => {
  const segment = pathname.split('/').filter(Boolean)[1];
  return ['ai', 'revenue', 'weather', 'tasks', 'market-intelligence'].includes(segment) ? segment as OperationsFocus : 'overview';
};

export default function OperationsCenterPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const hotelId = user?.hotel?.id || '';
  const focus = getFocusFromPath(location.pathname);
  const isOverview = focus === 'overview';
  const meta = focusMeta[focus];
  const operationsQuery = useQuery({ queryKey: ['operationsContext', hotelId], queryFn: () => operationsService.getOperationsContext(hotelId), enabled: Boolean(hotelId), staleTime: 0, refetchOnWindowFocus: true });
  const briefingQuery = useQuery({ queryKey: ['dailyGMBriefing', hotelId], queryFn: () => aiBriefingService.getDailyBriefing(), enabled: Boolean(hotelId) && isOverview, staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false });
  const governanceQuery = useQuery({ queryKey: ['ai-recommendations', 'PENDING'], queryFn: () => aiRecommendationsService.list('PENDING'), enabled: Boolean(hotelId) && isOverview, staleTime: 60 * 1000, refetchOnWindowFocus: false });
  const refreshWeatherMutation = useMutation({
    mutationFn: () => weatherSignalsService.sync(hotelId),
    onSuccess: async (data) => { toast.success(`Forecast refreshed (${data.daysStored} days stored)`); await queryClient.invalidateQueries({ queryKey: ['operationsContext', hotelId] }); },
    onError: (error) => toast.error((error as any)?.response?.data?.error || (error as Error)?.message || 'Failed to refresh forecast'),
  });
  const updatedAt = operationsQuery.data?.generatedAtUtc ? new Date(operationsQuery.data.generatedAtUtc) : null;

  const refreshButton = <button type="button" onClick={() => refreshWeatherMutation.mutate()} className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60" disabled={refreshWeatherMutation.isPending}><RefreshCcw className={`h-4 w-4 ${refreshWeatherMutation.isPending ? 'animate-spin' : ''}`} />Refresh forecast</button>;
  const header = isOverview
    ? <CommandHeader updatedAt={updatedAt} isError={operationsQuery.isError} refreshButton={refreshButton} />
    : <CollaborationHeader workspace="operations" eyebrow="Operations / Operations Center" title={meta.title} subtitle={`${meta.description}${updatedAt ? ` Last updated ${updatedAt.toLocaleString()}.` : ''}`} statusLabel={operationsQuery.isError ? 'Operations context unavailable' : 'Operations workspace'} statusTone={operationsQuery.isError ? 'warning' : 'live'} actions={refreshButton} />;

  if (operationsQuery.isLoading) return <div className="space-y-4">{header}<OperationsSkeleton /></div>;
  if (operationsQuery.isError) return <div className="space-y-4">{header}<ErrorState onRetry={() => operationsQuery.refetch()} /></div>;

  return isOverview
    ? <CommandCenter header={header} context={operationsQuery.data} briefing={briefingQuery.data} briefingLoading={briefingQuery.isLoading} pendingGovernance={governanceQuery.data?.length || 0} />
    : <div className="space-y-4">{header}<FocusedWorkspace focus={focus} context={operationsQuery.data} isRefreshing={refreshWeatherMutation.isPending} onRefreshWeather={() => refreshWeatherMutation.mutate()} /></div>;
}

function CommandCenter({ header, context, briefing, briefingLoading, pendingGovernance }: { header: React.ReactNode; context?: OperationsContext; briefing?: DailyGMBriefing; briefingLoading: boolean; pendingGovernance: number }) {
  const risks = useMemo(() => [...(briefing?.operationalRisks || []), ...(briefing?.maintenanceConcerns || []), ...(briefing?.securityConcerns || []), ...(briefing?.guestExperienceRisks || [])], [briefing]);
  const criticalRisks = risks.filter((item) => item.severity === 'CRITICAL' || item.severity === 'HIGH');
  const advisories = context?.advisories || [];
  const demand = context?.pricingSignal?.demandTrend || 'flat';
  const forecastFresh = Boolean(context?.weather?.isFresh);
  const operationalFocus: Array<{ title: string; tone: 'good' | 'risk' | 'warn'; icon: typeof Activity; count: number; items: DailyBriefingItem[]; href: string; link: string }> = [
    { title: 'Top Priorities', tone: 'good', icon: CheckCircle2, count: briefing?.todayPriorities.length || 0, items: briefing?.todayPriorities || [], href: '/operations-center/tasks', link: 'View all priorities' },
    { title: 'Active Risks', tone: 'risk', icon: AlertTriangle, count: risks.length, items: risks, href: '/operations-center/weather', link: 'View all risks' },
    { title: 'Recommended Actions', tone: 'warn', icon: Activity, count: briefing?.recommendedActions.length || 0, items: (briefing?.recommendedActions || []).map((item) => ({ title: item.title, detail: `${item.owner} · ${item.rationale}` })), href: '/operations-center/tasks', link: 'View all actions' },
  ];
  const departments = [
    { name: 'Front Desk', icon: UsersRound, status: context?.ops?.arrivalsNext24h ? 'Active' : 'Ready', metrics: [['Arrivals', context?.ops?.arrivalsNext24h || 0], ['Departures', context?.ops?.departuresNext24h || 0], ['In house', context?.ops?.inhouseNow || 0]], href: '/operations-center/tasks' },
    { name: 'Housekeeping', icon: House, status: briefing?.maintenanceConcerns.length ? 'At risk' : 'Stable', metrics: [['Priorities', briefing?.todayPriorities.filter((x) => x.department?.includes('HOUSE')).length || 0], ['Risks', briefing?.operationalRisks.length || 0], ['Actions', advisories.filter((x) => x.department === 'HOUSEKEEPING').length]], href: '/operations-center/tasks' },
    { name: 'Maintenance', icon: Wrench, status: briefing?.maintenanceConcerns.length ? 'Attention' : 'Stable', metrics: [['Concerns', briefing?.maintenanceConcerns.length || 0], ['Urgent', briefing?.maintenanceConcerns.filter((x) => x.severity === 'CRITICAL').length || 0], ['Advisories', advisories.filter((x) => x.department === 'MAINTENANCE').length]], href: '/operations-center/tasks' },
    { name: 'Security', icon: ShieldAlert, status: briefing?.securityConcerns.length ? 'Attention' : 'Stable', metrics: [['Alerts', briefing?.securityConcerns.length || 0], ['Critical', briefing?.securityConcerns.filter((x) => x.severity === 'CRITICAL').length || 0], ['Risks', criticalRisks.length]], href: '/operations-center/ai' },
  ];

  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
    <main className="min-w-0 space-y-4">
      {header}
      <section aria-label="Operations summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={CloudRain} label="Forecast Status" value={forecastFresh ? 'Fresh' : 'Needs refresh'} sub={context?.weather?.syncedAtUtc ? `Updated ${new Date(context.weather.syncedAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Forecast not synced'} tone={forecastFresh ? 'good' : 'warn'} />
        <StatusCard icon={demand === 'down' ? TrendingDown : TrendingUp} label="Demand Signal" value={demand === 'up' ? 'Rising' : demand === 'down' ? 'Softening' : 'Stable'} sub={context?.pricingSignal?.suggestion || context?.pricingSignal?.note || 'Monitor booking pace'} tone={demand === 'down' ? 'warn' : 'info'} />
        <StatusCard icon={ShieldAlert} label="Active Alerts" value={String(criticalRisks.length)} sub={`${risks.filter((x) => x.severity === 'CRITICAL').length} critical · ${risks.filter((x) => x.severity === 'HIGH').length} high`} tone={criticalRisks.length ? 'risk' : 'good'} />
        <StatusCard icon={ClipboardList} label="Open Tasks" value={String(advisories.length)} sub={`Across ${new Set(advisories.map((x) => x.department).filter(Boolean)).size || 0} departments`} tone="info" />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h2 className="font-semibold text-text-main">Today’s Operational Focus</h2>{briefingLoading ? <div className="mt-3 grid gap-3 lg:grid-cols-3"><Skeleton /><Skeleton /><Skeleton /></div> : <div className="mt-3 grid gap-3 lg:grid-cols-3">{operationalFocus.map((item) => <FocusCard key={item.title} {...item} />)}</div>}</section>

      <section><div className="mb-2 flex items-center justify-between"><h2 className="font-semibold text-text-main">Department Snapshot</h2><Link className="text-sm font-semibold text-primary-600 hover:text-primary-700" to="/operations-center/ai">Open department intelligence</Link></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{departments.map((department) => <DepartmentSnapshot key={department.name} {...department} />)}</div></section>

      <section className="rounded-2xl border border-border bg-card shadow-sm"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="font-semibold text-text-main">Recent Activity</h2><p className="text-xs text-text-muted">Latest operational signals and recommendations</p></div><Link className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600" to="/operations-center/tasks">View all activity <ArrowRight className="h-4 w-4" /></Link></div><div className="divide-y divide-border">{recentItems(briefing, context).map((item, index) => <div key={`${item.title}-${index}`} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[90px_1fr_auto] sm:items-center"><span className="font-semibold text-text-main">{item.actor}</span><span className="text-text-muted">{item.title}</span><span className="text-xs text-text-muted">{item.detail}</span></div>)}</div></section>
    </main>

    <aside className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="theme-kpi-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><ClipboardList className="h-5 w-5" /></span>
          <div>
            <h2 className="font-semibold text-text-main">Operations Quick Actions</h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">Open the live operational workspace you need. Use Ask LaFlo for AI questions.</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <QuickAction icon={ClipboardList} title="Review tasks and advisories" detail={`${advisories.length} open tasks`} href="/operations-center/tasks" />
          <QuickAction icon={AlertTriangle} title="Review active risks" detail={`${criticalRisks.length} high-priority alerts`} href="/operations-center/weather" />
          <QuickAction icon={Gauge} title="Open revenue guidance" detail={`${context?.pricingSignal?.marketCoveragePct || 0}% market coverage`} href="/operations-center/revenue" />
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h2 className="font-semibold text-text-main">Operational Indicators</h2><div className="mt-3 space-y-2"><Indicator icon={CloudRain} label="Weather Outlook" value={context?.weather?.next24h?.summary || 'No forecast'} href="/operations-center/weather" /><Indicator icon={UsersRound} label="Arrival Forecast" value={`${context?.ops?.arrivalsNext24h || 0} arrivals`} href="/operations-center/weather" /><Indicator icon={Gauge} label="Revenue Guidance" value={`${context?.pricingSignal?.marketCoveragePct || 0}% coverage`} href="/operations-center/revenue" /></div><Link className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-600" to="/operations-center/weather">View all indicators <ArrowRight className="h-4 w-4" /></Link></section>
      <SummaryPanel icon={ShieldCheck} title="AI Recommendation Governance" description="Keep AI recommendations accurate and aligned with operational goals." action="Review queue" href="/operations-center/ai" darkIcon><div className="flex items-end justify-between"><span className="text-sm text-text-muted">Pending reviews</span><strong className="text-3xl text-text-main">{pendingGovernance}</strong></div></SummaryPanel>
    </aside>
  </div>;
}

function FocusedWorkspace({ focus, context, isRefreshing, onRefreshWeather }: { focus: Exclude<OperationsFocus, 'overview'>; context?: OperationsContext; isRefreshing: boolean; onRefreshWeather: () => void }) {
  const revenue = <PricingCalendarCard pricingCalendar={context?.pricingCalendar} pricingSummary={context?.pricingSignal} snapshotMeta={context?.pricingSnapshotMeta} title="Revenue Guidance (14 nights)" subtitle="Per-night suggestions based on booking pace, weather signals, and market rates when available." />;
  const signals = <SignalsGrid context={context} onRefreshWeather={onRefreshWeather} isRefreshingWeather={isRefreshing} />;
  if (focus === 'weather') return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-5">{signals}<OpsAdvisories context={context} /></div><div className="space-y-5"><WeatherSignalCard context={context} onRefresh={onRefreshWeather} isRefreshing={isRefreshing} /><ArrivalsSignalCard context={context} /></div></div>;
  if (focus === 'revenue') return <div className="space-y-5"><DepartmentIntelligenceCard department="revenue" /><div className="grid gap-4 lg:grid-cols-2"><DemandSignalCard context={context} /><PricingSignalCard context={context} /></div>{revenue}</div>;
  if (focus === 'market-intelligence') return <div className="grid gap-5 xl:grid-cols-2"><div className="space-y-5"><MarketIntelligenceCard /><div className="grid gap-4 lg:grid-cols-2"><DemandSignalCard context={context} /><PricingSignalCard context={context} /></div></div><div className="space-y-5"><DepartmentIntelligenceCard department="revenue" compact />{revenue}</div></div>;
  if (focus === 'tasks') return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-5"><OpsAdvisories context={context} /><OperationalTimeline /></div><div className="space-y-5"><ArrivalsSignalCard context={context} /><DepartmentIntelligenceCard department="front-desk" compact /><DepartmentIntelligenceCard department="housekeeping" compact /></div></div>;
  return <OperationsAIWorkspace context={context} />;
}

function OperationsAIWorkspace({ context }: { context?: OperationsContext }) {
  const pendingQuery = useQuery({ queryKey: ['ai-recommendations', 'PENDING'], queryFn: () => aiRecommendationsService.list('PENDING'), staleTime: 60 * 1000, refetchOnWindowFocus: false });
  const pending = pendingQuery.data || [];
  const highPriority = pending.filter((item) => item.priority === 'HIGH' || item.priority === 'CRITICAL').length;
  const contextSources = [context?.weather, context?.ops, context?.pricingSignal, context?.pricingCalendar, context?.advisories].filter(Boolean).length;
  const syncTime = context?.generatedAtUtc ? new Date(context.generatedAtUtc) : null;
  const departments = [
    { name: 'Front Desk', value: context?.ops?.arrivalsNext24h || 0, unit: 'arrivals', status: 'Live', tone: 'text-blue-600' },
    { name: 'Housekeeping', value: context?.ops?.departuresNext24h || 0, unit: 'departures', status: 'Live', tone: 'text-emerald-600' },
    { name: 'Security', value: pending.filter((item) => item.department.toLowerCase().includes('security')).length, unit: 'recommendations', status: highPriority ? 'Attention' : 'Stable', tone: 'text-violet-600' },
    { name: 'Revenue', value: context?.pricingSignal?.opportunityPct || 0, unit: '% opportunity', status: context?.pricingSignal?.demandTrend || 'Stable', tone: 'text-amber-600' },
  ];
  return <div className="space-y-3 pb-20">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AIStat icon={Gauge} label="Pending Recommendations" value={pending.length} detail="Governance review queue" />
      <AIStat icon={AlertTriangle} label="High Priority" value={highPriority} detail="Needs attention" semantic="risk" />
      <AIStat icon={Activity} label="Connected Contexts" value={contextSources} detail="Live operational sources" />
      <AIStat icon={RefreshCcw} label="Last Sync" value={syncTime ? syncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} detail={syncTime ? 'Context is current' : 'Awaiting context'} />
    </section>
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-3">
        <AICopilotPanel title="AI Assistant" contextScope={['hotelProfile', 'occupancy', 'weather', 'bookings', 'guests', 'housekeeping', 'maintenance', 'security', 'smartBuilding', 'incidents', 'tasks', 'messages', 'financialSummary']} workspace />
        <AIRecommendationGovernancePanel compact />
      </div>
      <aside className="space-y-3">
        <ContextPreview context={context} />
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border px-4 py-3"><h2 className="font-semibold text-text-main">Department Intelligence</h2><p className="mt-1 text-xs text-text-muted">Compact operational focus by department.</p></div><div className="grid grid-cols-2">{departments.map((item) => <div key={item.name} className="border-b border-r border-border p-4 even:border-r-0"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-text-main">{item.name}</p><span className="rounded-full bg-bg px-2 py-0.5 text-[9px] font-semibold text-text-muted">{item.status}</span></div><p className={`mt-4 text-2xl font-bold ${item.tone}`}>{item.value}</p><p className="mt-1 text-[10px] text-text-muted">{item.unit}</p></div>)}</div></section>
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold text-text-main">Recent AI Activity</h2><Link to="/operations-center/tasks" className="text-xs font-semibold text-primary-600">View all</Link></div><div className="mt-3 divide-y divide-border">{pending.slice(0,4).map((item) => <div key={item.id} className="py-3"><p className="text-xs font-semibold text-text-main">{item.title}</p><p className="mt-1 text-[10px] text-text-muted">{item.department} · {new Date(item.createdAt).toLocaleString()}</p></div>)}{!pending.length && <p className="py-5 text-xs text-text-muted">No recent governed AI activity.</p>}</div></section>
        <div className="rounded-2xl border border-border bg-card p-4 text-xs leading-5 text-text-muted">AI insights may contain errors. Review context, rationale, confidence, and permissions before taking action.</div>
      </aside>
    </div>
  </div>;
}

function AIStat({ icon: Icon, label, value, detail, semantic }: { icon: typeof Activity; label: string; value: string | number; detail: string; semantic?: 'risk' }) {
  return <article className="theme-stat-card flex min-h-24 items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${semantic === 'risk' ? 'bg-rose-50 text-rose-600' : 'theme-kpi-icon'}`}><Icon className="h-5 w-5" /></span><div><p className="text-xs text-text-muted">{label}</p><p className="mt-1 text-xl font-bold text-text-main">{value}</p><p className="mt-1 text-[10px] text-text-muted">{detail}</p></div></article>;
}

const toneClass = { good: 'border-emerald-200 bg-emerald-50/40 text-emerald-700', warn: 'border-amber-200 bg-amber-50/40 text-amber-700', risk: 'border-rose-200 bg-rose-50/40 text-rose-700', info: 'border-sky-200 bg-sky-50/40 text-sky-700' };
function CommandHeader({ updatedAt, isError, refreshButton }: { updatedAt: Date | null; isError: boolean; refreshButton: React.ReactNode }) { return <header className="flex flex-col gap-3 px-1 py-1 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><span className="theme-kpi-icon grid h-12 w-12 shrink-0 place-items-center rounded-2xl"><Activity className="h-6 w-6" /></span><div><h1 className="text-2xl font-bold tracking-tight text-text-main">Operations Center</h1><p className="mt-0.5 text-sm text-text-muted">Real-time operational visibility across your hotel. Make informed decisions with confidence.</p>{updatedAt ? <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted"><RefreshCcw className="h-3.5 w-3.5" />Last updated: {updatedAt.toLocaleDateString([], { month: 'short', day: 'numeric' })}, {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p> : null}</div></div><div className="flex flex-wrap items-center gap-2 self-start"><span className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${isError ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}><span className="h-2 w-2 rounded-full bg-current" />{isError ? 'Context unavailable' : 'Operations workspace'}</span>{refreshButton}</div></header>; }
function StatusCard({ icon: Icon, label, value, sub, tone }: { icon: typeof Activity; label: string; value: string; sub: string; tone: keyof typeof toneClass }) { return <article className={`min-h-[116px] rounded-2xl border p-4 shadow-sm ${toneClass[tone]}`}><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80"><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-medium text-text-muted">{label}</p><p className="mt-1 text-lg font-bold text-text-main">{value}</p><p className="mt-1 truncate text-xs text-text-muted">{sub}</p></div></div></article>; }
function FocusCard({ title, tone, icon: Icon, count, items, href, link }: { title: string; tone: 'good' | 'risk' | 'warn'; icon: typeof Activity; count: number; items: DailyBriefingItem[]; href: string; link: string }) { return <article className={`flex min-h-40 flex-col rounded-2xl border p-3.5 ${toneClass[tone]}`}><div className="flex items-center gap-2"><Icon className="h-4 w-4" /><h3 className="text-sm font-semibold text-text-main">{title}</h3><span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold">{count}</span></div><div className="mt-3 flex-1 space-y-1.5">{items.slice(0, 3).map((item, index) => <div key={`${item.title}-${index}`} className="flex gap-2 text-xs text-text-muted"><span aria-hidden>•</span><span className="line-clamp-1">{item.title}</span></div>)}{!items.length ? <p className="text-xs text-text-muted">No current items.</p> : null}</div><Link className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-700" to={href}>{link} <ArrowRight className="h-3.5 w-3.5" /></Link></article>; }
function DepartmentSnapshot({ name, icon: Icon, status, metrics, href }: { name: string; icon: typeof Activity; status: string; metrics: (string | number)[][]; href: string }) { return <article className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2"><span className="theme-kpi-icon grid h-8 w-8 place-items-center rounded-xl"><Icon className="h-4 w-4" /></span><h3 className="text-sm font-semibold text-text-main">{name}</h3><span className="ml-auto rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold text-text-muted">{status}</span></div><div className="mt-3 grid grid-cols-3 divide-x divide-border">{metrics.map(([label, value]) => <div key={label} className="px-1.5 text-center first:pl-0 last:pr-0"><p className="text-base font-bold text-text-main">{value}</p><p className="truncate text-[9px] text-text-muted">{label}</p></div>)}</div><Link className="mt-3 flex items-center justify-center gap-1 border-t border-border pt-2.5 text-xs font-semibold text-primary-600" to={href}>View details <ArrowRight className="h-3.5 w-3.5" /></Link></article>; }
function SummaryPanel({ icon: Icon, title, description, action, href, badge, darkIcon = false, children }: { icon: typeof Activity; title: string; description: string; action: string; href: string; badge?: string; darkIcon?: boolean; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${darkIcon ? 'bg-slate-900 text-white' : 'theme-kpi-icon'}`}><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h2 className="font-semibold text-text-main">{title}</h2>{badge ? <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">{badge}</span> : null}</div><p className="mt-1 text-xs leading-5 text-text-muted">{description}</p></div></div><div className="mt-3">{children}</div><Link className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600" to={href}>{action} <ArrowRight className="h-3.5 w-3.5" /></Link></section>; }
function QuickAction({ icon: Icon, title, detail, href }: { icon: typeof Activity; title: string; detail: string; href: string }) { return <Link to={href} className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary-300 hover:bg-bg/50"><span className="theme-kpi-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-semibold text-text-main">{title}</span><span className="block truncate text-xs text-text-muted">{detail}</span></span><ArrowRight className="ml-auto h-4 w-4 text-text-muted" /></Link>; }
function Indicator({ icon: Icon, label, value, href }: { icon: typeof Activity; label: string; value: string; href: string }) { return <Link to={href} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-bg/50"><span className="theme-kpi-icon grid h-9 w-9 place-items-center rounded-xl"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-semibold text-text-main">{label}</span><span className="block truncate text-xs text-text-muted">{value}</span></span><ArrowRight className="ml-auto h-4 w-4 text-text-muted" /></Link>; }
function recentItems(briefing?: DailyGMBriefing, context?: OperationsContext) { const priorities = briefing?.todayPriorities.slice(0, 2).map((item) => ({ actor: 'AI', title: item.title, detail: item.department || 'Operations' })) || []; const risk = briefing?.operationalRisks[0] ? [{ actor: 'AI', title: briefing.operationalRisks[0].title, detail: briefing.operationalRisks[0].department || 'Risk' }] : []; const result = [...priorities, ...risk, { actor: 'System', title: context?.weather?.isFresh ? 'Forecast context is current' : 'Forecast refresh recommended', detail: 'Weather' }]; return result.slice(0, 3); }
function Skeleton() { return <div className="h-40 animate-shimmer rounded-2xl" />; }
function OperationsSkeleton() { return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div><div className="grid gap-4 xl:grid-cols-3"><Skeleton /><Skeleton /><Skeleton /></div></div>; }
function ErrorState({ onRetry }: { onRetry: () => void }) { return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800"><AlertTriangle className="h-6 w-6" /><h2 className="mt-3 font-semibold">Unable to load operations context</h2><p className="mt-1 text-sm">The command centre could not retrieve live hotel data.</p><button className="btn-outline mt-4" onClick={onRetry}>Try again</button></div>; }
