import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, ClipboardList,
  CloudRain, Gauge, House, RefreshCcw, ShieldAlert, ShieldCheck, Sparkles, TrendingDown,
  TrendingUp, UsersRound, Wrench,
} from 'lucide-react';
import OpsAdvisories from '@/components/operations/advisories/OpsAdvisories';
import AssistantDock from '@/components/operations/assistant/AssistantDock';
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

  const header = <CollaborationHeader workspace="operations" eyebrow="Operations / Operations Center" title={meta.title} subtitle={`${meta.description}${updatedAt ? ` Last updated ${updatedAt.toLocaleString()}.` : ''}`} statusLabel={operationsQuery.isError ? 'Operations context unavailable' : 'Operations workspace'} statusTone={operationsQuery.isError ? 'warning' : 'live'} actions={<button type="button" onClick={() => refreshWeatherMutation.mutate()} className="btn-primary" disabled={refreshWeatherMutation.isPending}><RefreshCcw className={`h-4 w-4 ${refreshWeatherMutation.isPending ? 'animate-spin' : ''}`} />Refresh forecast</button>} />;

  if (operationsQuery.isLoading) return <div className="space-y-4">{header}<OperationsSkeleton /></div>;
  if (operationsQuery.isError) return <div className="space-y-4">{header}<ErrorState onRetry={() => operationsQuery.refetch()} /></div>;

  return <div className="space-y-5">{header}{isOverview
    ? <CommandCenter context={operationsQuery.data} briefing={briefingQuery.data} briefingLoading={briefingQuery.isLoading} pendingGovernance={governanceQuery.data?.length || 0} />
    : <FocusedWorkspace focus={focus} context={operationsQuery.data} isRefreshing={refreshWeatherMutation.isPending} onRefreshWeather={() => refreshWeatherMutation.mutate()} />}
  </div>;
}

function CommandCenter({ context, briefing, briefingLoading, pendingGovernance }: { context?: OperationsContext; briefing?: DailyGMBriefing; briefingLoading: boolean; pendingGovernance: number }) {
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

  return <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
    <main className="min-w-0 space-y-5">
      <section aria-label="Operations summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={CloudRain} label="Forecast Status" value={forecastFresh ? 'Fresh' : 'Needs refresh'} sub={context?.weather?.syncedAtUtc ? `Updated ${new Date(context.weather.syncedAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Forecast not synced'} tone={forecastFresh ? 'good' : 'warn'} />
        <StatusCard icon={demand === 'down' ? TrendingDown : TrendingUp} label="Demand Signal" value={demand === 'up' ? 'Rising' : demand === 'down' ? 'Softening' : 'Stable'} sub={context?.pricingSignal?.suggestion || context?.pricingSignal?.note || 'Monitor booking pace'} tone={demand === 'down' ? 'warn' : 'info'} />
        <StatusCard icon={ShieldAlert} label="Active Alerts" value={String(criticalRisks.length)} sub={`${risks.filter((x) => x.severity === 'CRITICAL').length} critical · ${risks.filter((x) => x.severity === 'HIGH').length} high`} tone={criticalRisks.length ? 'risk' : 'good'} />
        <StatusCard icon={ClipboardList} label="Open Tasks" value={String(advisories.length)} sub={`Across ${new Set(advisories.map((x) => x.department).filter(Boolean)).size || 0} departments`} tone="info" />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h2 className="font-semibold text-text-main">Today’s Operational Focus</h2>{briefingLoading ? <div className="mt-4 grid gap-3 lg:grid-cols-3"><Skeleton /><Skeleton /><Skeleton /></div> : <div className="mt-4 grid gap-3 lg:grid-cols-3">{operationalFocus.map((item) => <FocusCard key={item.title} {...item} />)}</div>}</section>

      <section><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-text-main">Department Snapshot</h2><Link className="text-sm font-semibold text-primary-600 hover:text-primary-700" to="/operations-center/ai">Open department intelligence</Link></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{departments.map((department) => <DepartmentSnapshot key={department.name} {...department} />)}</div></section>

      <section className="rounded-2xl border border-border bg-card shadow-sm"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="font-semibold text-text-main">Recent Activity</h2><p className="text-xs text-text-muted">Latest operational signals and recommendations</p></div><Link className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600" to="/operations-center/tasks">View all activity <ArrowRight className="h-4 w-4" /></Link></div><div className="divide-y divide-border">{recentItems(briefing, context).map((item, index) => <div key={`${item.title}-${index}`} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[90px_1fr_auto] sm:items-center"><span className="font-semibold text-text-main">{item.actor}</span><span className="text-text-muted">{item.title}</span><span className="text-xs text-text-muted">{item.detail}</span></div>)}</div></section>
    </main>

    <aside className="space-y-4">
      <SummaryPanel icon={Sparkles} title="Operations Concierge" description="Ask operational questions and get guided actions from live hotel context." action="Open concierge" href="/operations-center/ai"><div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1"><PromptLink text="What needs attention today?" /><PromptLink text="Summarize top advisories" /><PromptLink text="Which guests are at risk?" /></div></SummaryPanel>
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h2 className="font-semibold text-text-main">Operational Indicators</h2><div className="mt-3 space-y-2"><Indicator icon={CloudRain} label="Weather Outlook" value={context?.weather?.next24h?.summary || 'No forecast'} href="/operations-center/weather" /><Indicator icon={UsersRound} label="Arrival Forecast" value={`${context?.ops?.arrivalsNext24h || 0} arrivals`} href="/operations-center/weather" /><Indicator icon={Gauge} label="Revenue Guidance" value={`${context?.pricingSignal?.marketCoveragePct || 0}% coverage`} href="/operations-center/revenue" /></div><Link className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-600" to="/operations-center/weather">View all indicators <ArrowRight className="h-4 w-4" /></Link></section>
      <SummaryPanel icon={ShieldCheck} title="AI Recommendation Governance" description="Keep AI recommendations accurate and aligned with operational goals." action="Review queue" href="/operations-center/ai"><div className="flex items-end justify-between"><span className="text-sm text-text-muted">Pending reviews</span><strong className="text-3xl text-text-main">{pendingGovernance}</strong></div></SummaryPanel>
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
  return <div className="grid gap-5 xl:grid-cols-2"><div className="space-y-5"><AICopilotPanel title="Operations Copilot" contextScope={['hotelProfile', 'occupancy', 'weather', 'bookings', 'guests', 'housekeeping', 'maintenance', 'security', 'smartBuilding', 'incidents', 'tasks', 'messages', 'financialSummary']} /><AIRecommendationGovernancePanel /></div><div className="space-y-5"><AssistantDock context={context} /><DepartmentIntelligenceCard department="front-desk" compact /><DepartmentIntelligenceCard department="guest-experience" compact /></div></div>;
}

const toneClass = { good: 'border-emerald-200 bg-emerald-50/40 text-emerald-700', warn: 'border-amber-200 bg-amber-50/40 text-amber-700', risk: 'border-rose-200 bg-rose-50/40 text-rose-700', info: 'border-sky-200 bg-sky-50/40 text-sky-700' };
function StatusCard({ icon: Icon, label, value, sub, tone }: { icon: typeof Activity; label: string; value: string; sub: string; tone: keyof typeof toneClass }) { return <article className={`rounded-2xl border p-4 shadow-sm ${toneClass[tone]}`}><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80"><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-medium text-text-muted">{label}</p><p className="mt-1 text-lg font-bold text-text-main">{value}</p><p className="mt-1 truncate text-xs text-text-muted">{sub}</p></div></div></article>; }
function FocusCard({ title, tone, icon: Icon, count, items, href, link }: { title: string; tone: 'good' | 'risk' | 'warn'; icon: typeof Activity; count: number; items: DailyBriefingItem[]; href: string; link: string }) { return <article className={`flex min-h-52 flex-col rounded-2xl border p-4 ${toneClass[tone]}`}><div className="flex items-center gap-2"><Icon className="h-5 w-5" /><h3 className="font-semibold text-text-main">{title}</h3><span className="ml-auto rounded-full bg-white/80 px-2 py-1 text-xs font-bold">{count}</span></div><div className="mt-4 flex-1 space-y-2">{items.slice(0, 3).map((item, index) => <div key={`${item.title}-${index}`} className="flex gap-2 text-sm text-text-muted"><span aria-hidden>•</span><span className="line-clamp-2">{item.title}</span></div>)}{!items.length ? <p className="text-sm text-text-muted">No current items.</p> : null}</div><Link className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-700" to={href}>{link} <ArrowRight className="h-4 w-4" /></Link></article>; }
function DepartmentSnapshot({ name, icon: Icon, status, metrics, href }: { name: string; icon: typeof Activity; status: string; metrics: (string | number)[][]; href: string }) { return <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center gap-2"><span className="theme-kpi-icon grid h-9 w-9 place-items-center rounded-xl"><Icon className="h-4 w-4" /></span><h3 className="font-semibold text-text-main">{name}</h3><span className="ml-auto rounded-full bg-bg px-2 py-1 text-[11px] font-semibold text-text-muted">{status}</span></div><div className="mt-4 grid grid-cols-3 divide-x divide-border">{metrics.map(([label, value]) => <div key={label} className="px-2 text-center first:pl-0 last:pr-0"><p className="text-lg font-bold text-text-main">{value}</p><p className="text-[10px] text-text-muted">{label}</p></div>)}</div><Link className="mt-4 flex items-center justify-center gap-1 border-t border-border pt-3 text-sm font-semibold text-primary-600" to={href}>View details <ArrowRight className="h-4 w-4" /></Link></article>; }
function SummaryPanel({ icon: Icon, title, description, action, href, children }: { icon: typeof Activity; title: string; description: string; action: string; href: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start gap-3"><span className="theme-kpi-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><Icon className="h-5 w-5" /></span><div><h2 className="font-semibold text-text-main">{title}</h2><p className="mt-1 text-sm text-text-muted">{description}</p></div></div><div className="mt-4">{children}</div><Link className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600" to={href}>{action} <ArrowRight className="h-4 w-4" /></Link></section>; }
function PromptLink({ text }: { text: string }) { return <Link to="/operations-center/ai" className="rounded-xl border border-border bg-bg/40 px-3 py-2 text-xs font-medium text-text-muted hover:border-primary-300 hover:text-primary-700">{text}</Link>; }
function Indicator({ icon: Icon, label, value, href }: { icon: typeof Activity; label: string; value: string; href: string }) { return <Link to={href} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-bg/50"><span className="theme-kpi-icon grid h-9 w-9 place-items-center rounded-xl"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-semibold text-text-main">{label}</span><span className="block truncate text-xs text-text-muted">{value}</span></span><ArrowRight className="ml-auto h-4 w-4 text-text-muted" /></Link>; }
function recentItems(briefing?: DailyGMBriefing, context?: OperationsContext) { const result = [{ actor: 'System', title: context?.weather?.isFresh ? 'Forecast context is current' : 'Forecast refresh recommended', detail: 'Weather' }, ...(briefing?.todayPriorities.slice(0, 2).map((item) => ({ actor: 'AI', title: item.title, detail: item.department || 'Operations' })) || [])]; return result.slice(0, 3); }
function Skeleton() { return <div className="h-52 animate-shimmer rounded-2xl" />; }
function OperationsSkeleton() { return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div><div className="grid gap-4 xl:grid-cols-3"><Skeleton /><Skeleton /><Skeleton /></div></div>; }
function ErrorState({ onRetry }: { onRetry: () => void }) { return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800"><AlertTriangle className="h-6 w-6" /><h2 className="mt-3 font-semibold">Unable to load operations context</h2><p className="mt-1 text-sm">The command centre could not retrieve live hotel data.</p><button className="btn-outline mt-4" onClick={onRetry}>Try again</button></div>; }
