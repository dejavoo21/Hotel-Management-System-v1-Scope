import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, ArrowRight, Bot, Brain, CheckCircle2, ClipboardCheck, Clock3, Database, History, LockKeyhole, RefreshCcw, ShieldCheck, X } from 'lucide-react';
import AIRecommendationGovernancePanel from '@/components/operations/AIRecommendationGovernancePanel';
import { aiBriefingService, aiRecommendationsService, assistantService } from '@/services';
import { openLafloAssistant } from '@/lib/assistantEvents';
import { useAuthStore } from '@/stores/authStore';
import { canAccess } from '@/lib/access';
import type { PermissionId } from '@/utils/userAccess';

type InsightsTab = 'overview' | 'recommendations' | 'information-sources' | 'saved-prompts' | 'activity-history';
type SourceDefinition = { label: string; detail: string; permission: PermissionId; href: string };
type ActivityEntry = { action: string; targetLabel?: string; createdAt: string };

const tabs: Array<{ value: InsightsTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'recommendations', label: 'Recommendations' },
  { value: 'information-sources', label: 'Information Sources' },
  { value: 'saved-prompts', label: 'Saved Prompts' },
  { value: 'activity-history', label: 'Activity History' },
];

const savedPrompts = [
  "Which rooms are not ready for today's arrivals?",
  'Show open incidents affecting guest experience.',
  'Which devices are offline on the third floor?',
  'What maintenance tasks are overdue?',
];

const sourceDefinitions: SourceDefinition[] = [
  { label: 'Operations', detail: 'Bookings, rooms and hotel flow', permission: 'bookings', href: '/operations-center' },
  { label: 'Tasks', detail: 'Assigned and overdue operational work', permission: 'maintenance_center', href: '/operations/tasks-advisories' },
  { label: 'Incidents', detail: 'Active and resolved incident records', permission: 'incident_management', href: '/incidents?tab=overview' },
  { label: 'Revenue', detail: 'Authorised financial context', permission: 'financials', href: '/operations/operational-intelligence/revenue-guidance' },
  { label: 'Security & CCTV', detail: 'Alerts, cameras and access context', permission: 'security_center', href: '/security-center?tab=overview' },
  { label: 'Smart Building', detail: 'Connected devices and sensor context', permission: 'smart_building', href: '/operations/smart-building?tab=overview' },
];

function normaliseTab(value: string | null): InsightsTab {
  if (value === 'sources') return 'information-sources';
  if (value === 'prompts') return 'saved-prompts';
  if (value === 'activity') return 'activity-history';
  return tabs.some((tab) => tab.value === value) ? value as InsightsTab : 'overview';
}

function formatTime(value?: string | null) {
  if (!value) return 'Not available yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function readRecommendationActivity(): ActivityEntry[] {
  try {
    const entries = JSON.parse(localStorage.getItem('laflo:auditLog') || '[]') as ActivityEntry[];
    return entries.filter((entry) => entry.action?.startsWith('AI Recommendation')).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  } catch {
    return [];
  }
}

export default function HotelBrainPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detail, setDetail] = useState<{ title: string; content: React.ReactNode } | null>(null);
  const activeTab = normaliseTab(searchParams.get('tab'));
  const incomingQuestion = searchParams.get('question')?.trim();
  const authorisedSources = sourceDefinitions.filter((source) => canAccess(user, source.permission));
  const recommendationActivity = useMemo(readRecommendationActivity, []);

  const statusQuery = useQuery({ queryKey: ['assistant', 'status'], queryFn: assistantService.status, retry: false });
  const briefingQuery = useQuery({ queryKey: ['hotel-insights', 'briefing'], queryFn: aiBriefingService.getDailyBriefing, retry: false });
  const recommendationsQuery = useQuery({ queryKey: ['hotel-insights', 'recommendations'], queryFn: () => aiRecommendationsService.list('PENDING'), retry: false });

  const recentQuestions = useMemo(() => {
    if (!user?.id) return [];
    try {
      const stored = localStorage.getItem(`laflo-assistant:${user.id}`);
      const parsed = stored ? JSON.parse(stored) as { messages?: Array<{ role?: string; text?: string }> } : null;
      return (parsed?.messages || []).filter((message) => message.role === 'user' && message.text?.trim()).slice(-6).reverse().map((message) => message.text as string);
    } catch {
      return [];
    }
  }, [user?.id]);

  const selectTab = (tab: InsightsTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next);
  };

  const openAssistant = (prompt?: string, extraContext?: Record<string, unknown>) => openLafloAssistant({
    mode: 'operations',
    prompt: prompt || incomingQuestion || 'What should I pay attention to across hotel operations today?',
    context: {
      page: 'Hotel Insights',
      section: activeTab,
      authorisedContextSources: authorisedSources.map((source) => source.label),
      readiness: statusQuery.data?.live ? 'ready' : 'configuration-review',
      pendingRecommendations: recommendationsQuery.data?.length || 0,
      briefingGeneratedAt: briefingQuery.data?.generatedAt || null,
      incomingQuestion: incomingQuestion || null,
      ...extraContext,
    },
  });

  const briefing = briefingQuery.data;

  const refreshInformation = async () => {
    const results = await Promise.all([statusQuery.refetch(), briefingQuery.refetch(), recommendationsQuery.refetch()]);
    const successes = results.filter((result) => !result.error).length;
    if (successes === results.length) toast.success('Hotel information refreshed');
    else if (successes > 0) toast('Hotel information partially refreshed');
    else toast.error('Hotel information refresh failed');
  };

  const openSource = (source: SourceDefinition) => {
    const allowed = canAccess(user, source.permission);
    setDetail({
      title: `${source.label} information`,
      content: <div className="space-y-4"><DetailStack rows={[["Status", allowed ? "Available" : "Permission restricted"], ["Information", source.detail], ["Last refresh", formatTime(briefing?.generatedAt)]]} />{allowed ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => navigate(source.href)} className="rounded-xl bg-primary-solid px-3 py-2 text-xs font-semibold text-primary-contrast">Open source workspace</button><button type="button" onClick={() => openAssistant(`Summarise the latest ${source.label} information.`, { source: source.label })} className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700">Ask LaFlo using this context</button></div> : <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Your current role does not include access to this information source.</p>}</div>,
    });
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-r from-slate-950 via-[#05254b] to-[#123a67] text-primary-contrast shadow-sm">
        <div className="flex flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-card/10 ring-1 ring-border/20"><Brain className="h-7 w-7" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-200">Operations / Hotel Insights</p><h1 className="mt-1 text-2xl font-semibold">Hotel Insights</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-primary-contrast">Hotel Insights brings together information from rooms, tasks, incidents, revenue, security, and smart building systems to help Ask LaFlo give better answers.</p></div></div>
          <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100"><ShieldCheck className="h-4 w-4" />Information matched to your access</span><button type="button" onClick={() => openAssistant()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-card px-4 py-2 text-sm font-semibold text-text-main hover:bg-border/50"><Bot className="h-4 w-4" />Open Ask LaFlo</button></div>
        </div>
      </section>

      {incomingQuestion ? <section className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Question ready for Ask LaFlo</p><p className="mt-1 text-sm font-medium text-text-main">{incomingQuestion}</p></div><button type="button" onClick={() => openAssistant(incomingQuestion)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast"><Bot className="h-4 w-4" />Continue in Ask LaFlo</button></section> : null}

      <nav aria-label="Hotel Insights sections" className="overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-sm"><div role="tablist" className="flex min-w-max gap-1">{tabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={activeTab === tab.value} onClick={() => selectTab(tab.value)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${activeTab === tab.value ? 'bg-primary-solid text-primary-contrast' : 'text-text-muted hover:bg-bg hover:text-text-main'}`}>{tab.label}</button>)}</div></nav>

      {activeTab === 'overview' ? <Overview statusQuery={statusQuery} briefingQuery={briefingQuery} recommendationsQuery={recommendationsQuery} authorisedSources={authorisedSources} recentQuestions={recentQuestions} savedPrompts={savedPrompts} openAssistant={openAssistant} selectTab={selectTab} setDetail={setDetail} refreshInformation={refreshInformation} /> : null}
      {activeTab === 'recommendations' ? <AIRecommendationGovernancePanel /> : null}
      {activeTab === 'information-sources' ? <InformationSources user={user} briefingGeneratedAt={briefing?.generatedAt} openSource={openSource} /> : null}
      {activeTab === 'saved-prompts' ? <SavedPrompts openAssistant={openAssistant} /> : null}
      {activeTab === 'activity-history' ? <ActivityHistory recentQuestions={recentQuestions} authorisedSources={authorisedSources} briefingGeneratedAt={briefing?.generatedAt} recommendationActivity={recommendationActivity} /> : null}
      {detail ? <DetailDrawer title={detail.title} onClose={() => setDetail(null)}>{detail.content}</DetailDrawer> : null}
    </div>
  );
}

type OverviewProps = {
  statusQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof assistantService.status>>>>;
  briefingQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof aiBriefingService.getDailyBriefing>>>>;
  recommendationsQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof aiRecommendationsService.list>>>>;
  authorisedSources: SourceDefinition[];
  recentQuestions: string[];
  savedPrompts: string[];
  openAssistant: (prompt?: string, extraContext?: Record<string, unknown>) => void;
  selectTab: (tab: InsightsTab) => void;
  setDetail: (detail: { title: string; content: React.ReactNode }) => void;
  refreshInformation: () => Promise<void>;
};

function Overview({ statusQuery, briefingQuery, recommendationsQuery, authorisedSources, recentQuestions, savedPrompts: prompts, openAssistant, selectTab, setDetail, refreshInformation }: OverviewProps) {
  const briefing = briefingQuery.data;
  const recommendations = recommendationsQuery.data || [];
  const readinessLabel = statusQuery.isLoading ? 'Checking status' : statusQuery.isError ? 'Unavailable' : statusQuery.data?.live ? 'Ready' : 'Needs configuration';
  return <div className="space-y-4">
    <section aria-label="Hotel Insights status" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatusCard icon={Activity} label="Ask LaFlo status" value={readinessLabel} detail={statusQuery.data?.model || 'Ask LaFlo service'} tone="emerald" onClick={() => setDetail({ title: 'Ask LaFlo status', content: <DetailStack rows={[["Status", readinessLabel], ["Model", statusQuery.data?.model || "Not available"], ["Provider", statusQuery.data?.provider || "Not available"]]} /> })} />
      <StatusCard icon={Database} label="Connected information" value={String(authorisedSources.length)} detail="Available hotel systems" tone="sky" onClick={() => selectTab('information-sources')} />
      <StatusCard icon={ClipboardCheck} label="Recommendations to review" value={recommendationsQuery.isLoading ? '—' : recommendationsQuery.isError ? 'Unavailable' : String(recommendations.length)} detail="Pending recommendations" tone="violet" onClick={() => selectTab('recommendations')} />
      <StatusCard icon={Clock3} label="Last update" value={briefingQuery.isLoading ? 'Loading…' : formatTime(briefing?.generatedAt)} detail="Hotel information update" tone="amber" onClick={() => setDetail({ title: 'Last update', content: <DetailStack rows={[["Updated", formatTime(briefing?.generatedAt)], ["Status", briefing ? "Completed" : "Not available"], ["Source", briefing?.source || "Not available"]]} /> })} />
    </section>
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-text-main">Today’s hotel briefing</h2><p className="mt-1 text-sm text-text-muted">Useful operational information available to Ask LaFlo.</p></div><button type="button" onClick={() => void refreshInformation()} disabled={briefingQuery.isFetching || statusQuery.isFetching || recommendationsQuery.isFetching} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-main hover:bg-bg disabled:opacity-50"><RefreshCcw className={`h-4 w-4 ${briefingQuery.isFetching || statusQuery.isFetching || recommendationsQuery.isFetching ? 'animate-spin' : ''}`} />Refresh information</button></div>
      {briefingQuery.isLoading ? <div className="mt-4 h-32 animate-pulse rounded-xl bg-border/50" role="status" aria-label="Loading hotel briefing" /> : briefingQuery.isError ? <ErrorState text="The hotel briefing is currently unavailable." onRetry={() => void briefingQuery.refetch()} /> : briefing ? <div className="mt-4"><p className="rounded-xl border border-border bg-bg p-4 text-sm leading-6 text-text-main">{briefing.executiveSummary}</p><div className="mt-3 divide-y divide-slate-100 rounded-xl border border-border">{briefing.todayPriorities.slice(0, 5).map((item) => <div key={`${item.title}-${item.detail}`} className="flex items-start gap-3 px-4 py-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><div><p className="text-sm font-semibold text-text-main">{item.title}</p><p className="mt-0.5 text-xs leading-5 text-text-muted">{item.detail}</p></div>{item.department ? <span className="ml-auto shrink-0 rounded-full bg-border/50 px-2 py-1 text-[10px] font-semibold text-text-muted">{item.department}</span> : null}</div>)}</div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => openAssistant(`Explain this hotel briefing: ${briefing.executiveSummary}`)} className="rounded-xl bg-primary-solid px-3 py-2 text-xs font-semibold text-primary-contrast">Open Ask LaFlo</button><button type="button" onClick={() => setDetail({ title: 'Full hotel briefing', content: <div className="space-y-3"><p className="text-sm leading-6 text-text-main">{briefing.executiveSummary}</p><DetailStack rows={briefing.todayPriorities.map((item) => [item.title, item.detail])} /></div> })} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-main">View full hotel briefing</button><button type="button" onClick={() => selectTab('recommendations')} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-main">Review recommendations</button></div></div> : <EmptyState text="No hotel briefing is available yet." />}
    </section>
    <section className="grid gap-4 lg:grid-cols-2"><ConsoleList icon={History} title="Recent Ask LaFlo questions" subtitle="Questions saved in your assistant history" items={recentQuestions} empty="No recent Ask LaFlo questions yet." actionLabel="Open Ask LaFlo" onAction={() => openAssistant()} onItem={(question) => openAssistant(question)} /><ConsoleList icon={ClipboardCheck} title="Saved hotel prompts" subtitle="Reusable prompts for Ask LaFlo" items={prompts.slice(0, 3)} empty="No saved prompts available." actionLabel="View saved prompts" onAction={() => selectTab('saved-prompts')} onItem={(prompt) => openAssistant(prompt)} /></section>
  </div>;
}

function InformationSources({ user, briefingGeneratedAt, openSource }: { user: ReturnType<typeof useAuthStore.getState>['user']; briefingGeneratedAt?: string; openSource: (source: SourceDefinition) => void }) {
  return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div><h2 className="text-base font-semibold text-text-main">Information available to Ask LaFlo</h2><p className="mt-1 text-sm text-text-muted">Open an information source to see its availability, latest update, and connected workspace. Last update: {formatTime(briefingGeneratedAt)}</p></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{sourceDefinitions.map((source) => { const allowed = canAccess(user, source.permission); return <button key={source.label} type="button" onClick={() => openSource(source)} className="rounded-2xl border border-border p-4 text-left transition hover:border-primary-300 hover:bg-primary-50/30"><span className="flex items-center justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-bg text-text-muted"><Database className="h-5 w-5" /></span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${allowed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{allowed ? 'Available' : 'Restricted'}</span></span><span className="mt-3 block text-sm font-semibold text-text-main">{source.label}</span><span className="mt-1 block text-xs leading-5 text-text-muted">{source.detail}</span></button>; })}</div></section>;
}

function SavedPrompts({ openAssistant }: { openAssistant: (prompt?: string, extraContext?: Record<string, unknown>) => void }) { return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div><h2 className="text-base font-semibold text-text-main">Saved hotel prompts</h2><p className="mt-1 text-sm text-text-muted">Choose a prompt to open Ask LaFlo with the prompt and your authorised Hotel Insights context.</p></div><div className="mt-5 grid gap-3 md:grid-cols-2">{savedPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => openAssistant(prompt, { savedPrompt: true })} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4 text-left text-sm font-semibold text-text-main hover:border-primary-300 hover:bg-primary-50/30"><span>{prompt}</span><ArrowRight className="h-4 w-4 shrink-0" /></button>)}</div></section>; }

function ActivityHistory({ recentQuestions, authorisedSources, briefingGeneratedAt, recommendationActivity }: { recentQuestions: string[]; authorisedSources: SourceDefinition[]; briefingGeneratedAt?: string; recommendationActivity: ActivityEntry[] }) { return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-emerald-700" /><div><h2 className="text-base font-semibold text-text-main">Sources and activity history</h2><p className="mt-1 text-sm text-text-muted">Permission-filtered Ask LaFlo, information refresh, and recommendation review activity.</p></div></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><ActivityList title="Recent Ask LaFlo activity" entries={recentQuestions.map((question, index) => ({ label: question, value: `Recent question ${index + 1}` }))} empty="No recent Ask LaFlo activity is saved for this user." /><ActivityList title="Information activity" entries={[{ label: 'Hotel information refreshed', value: formatTime(briefingGeneratedAt) }, ...authorisedSources.map((source) => ({ label: `${source.label} available`, value: 'Permission confirmed' }))]} empty="No information activity is available." /><div className="lg:col-span-2"><ActivityList title="Recommendation review activity" entries={recommendationActivity.map((entry) => ({ label: entry.action, value: `${entry.targetLabel || 'Recommendation'} · ${formatTime(entry.createdAt)}` }))} empty="No recommendation review activity has been recorded in this browser session." /></div></div></section>; }

function StatusCard({ icon: Icon, label, value, detail, tone, onClick }: { icon: typeof Activity; label: string; value: string; detail: string; tone: 'emerald' | 'sky' | 'violet' | 'amber'; onClick: () => void }) { const styles = { emerald: 'bg-emerald-50 text-emerald-700', sky: 'bg-sky-50 text-sky-700', violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700' }; return <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${styles[tone]}`}><Icon className="h-5 w-5" /></span><span className="min-w-0"><span className="block text-xs font-semibold text-text-muted">{label}</span><span className="mt-0.5 block truncate text-lg font-bold text-text-main">{value}</span><span className="block truncate text-[11px] text-text-muted">{detail}</span></span></button>; }
function ConsoleList({ icon: Icon, title, subtitle, items, empty, actionLabel, onAction, onItem }: { icon: typeof History; title: string; subtitle: string; items: string[]; empty: string; actionLabel?: string; onAction?: () => void; onItem: (item: string) => void }) { return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 text-text-muted" /><div><h2 className="text-base font-semibold text-text-main">{title}</h2><p className="mt-1 text-xs leading-5 text-text-muted">{subtitle}</p></div></div><div className="mt-4 space-y-2">{items.length ? items.map((item) => <button key={item} type="button" onClick={() => onItem(item)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-left text-xs font-medium text-text-main hover:border-emerald-300 hover:bg-emerald-50/40"><span>{item}</span><ArrowRight className="h-3.5 w-3.5 shrink-0" /></button>) : <EmptyState text={empty} />}</div>{actionLabel && onAction ? <button type="button" onClick={onAction} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-800">{actionLabel}<ArrowRight className="h-3.5 w-3.5" /></button> : null}</section>; }
function ActivityList({ title, entries, empty }: { title: string; entries: Array<{ label: string; value: string }>; empty: string }) { return <div className="rounded-2xl border border-border p-4"><h3 className="text-sm font-semibold text-text-main">{title}</h3><div className="mt-3 space-y-2">{entries.length ? entries.map((entry, index) => <div key={`${entry.label}-${index}`} className="rounded-xl bg-bg p-3"><p className="text-xs font-semibold text-text-main">{entry.label}</p><p className="mt-1 text-[11px] text-text-muted">{entry.value}</p></div>) : <EmptyState text={empty} />}</div></div>; }
function DetailStack({ rows }: { rows: Array<[string, string]> }) { return <div className="space-y-3">{rows.map(([label, value]) => <div key={`${label}-${value}`} className="rounded-2xl border border-border p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p><p className="mt-1 text-sm leading-6 text-text-main">{value}</p></div>)}</div>; }
function DetailDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[90] flex justify-end bg-text-main/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card p-5 shadow-2xl"><div className="mb-5 flex items-start justify-between gap-3"><h2 className="text-lg font-semibold text-text-main">{title}</h2><button type="button" onClick={onClose} aria-label={`Close ${title}`} className="grid h-9 w-9 place-items-center rounded-xl border border-border"><X className="h-4 w-4" /></button></div>{children}</section></div>; }
function EmptyState({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-border bg-bg p-4 text-xs text-text-muted">{text}</p>; }
function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) { return <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><p>{text}</p><button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-rose-300 bg-card px-3 py-2 text-xs font-semibold">Try again</button></div>; }
