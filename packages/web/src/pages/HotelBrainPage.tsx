import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Database,
  FileSearch,
  History,
  Layers3,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { aiBriefingService, aiRecommendationsService, assistantService } from '@/services';
import { openLafloAssistant } from '@/lib/assistantEvents';
import { useAuthStore } from '@/stores/authStore';
import { canAccess } from '@/lib/access';
import type { PermissionId } from '@/utils/userAccess';

const savedPrompts = [
  "Which rooms are not ready for today's arrivals?",
  'Show open incidents affecting guest experience.',
  'Which devices are offline on the third floor?',
  'What maintenance tasks are overdue?',
];

const sourceDefinitions: Array<{ label: string; detail: string; permission: PermissionId }> = [
  { label: 'Operations', detail: 'Bookings, rooms and hotel flow', permission: 'bookings' },
  { label: 'Tasks', detail: 'Assigned and overdue operational work', permission: 'maintenance_center' },
  { label: 'Incidents', detail: 'Active and resolved incident records', permission: 'incident_management' },
  { label: 'Revenue', detail: 'Authorised financial context', permission: 'financials' },
  { label: 'Security & CCTV', detail: 'Alerts, cameras and access context', permission: 'security_center' },
  { label: 'Smart Building', detail: 'Connected devices and sensor context', permission: 'smart_building' },
];

function formatTime(value?: string | null) {
  if (!value) return 'Not generated yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HotelBrainPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [detail, setDetail] = useState<{ title: string; content: React.ReactNode } | null>(null);
  const incomingQuestion = searchParams.get('question')?.trim();
  const authorisedSources = sourceDefinitions.filter((source) => canAccess(user, source.permission));

  const statusQuery = useQuery({ queryKey: ['assistant', 'status'], queryFn: assistantService.status, retry: false });
  const briefingQuery = useQuery({ queryKey: ['hotel-brain', 'briefing'], queryFn: aiBriefingService.getDailyBriefing, retry: false });
  const recommendationsQuery = useQuery({ queryKey: ['hotel-brain', 'recommendations'], queryFn: () => aiRecommendationsService.list('PENDING'), retry: false });

  const recentQuestions = useMemo(() => {
    if (!user?.id) return [];
    try {
      const stored = localStorage.getItem(`laflo-assistant:${user.id}`);
      const parsed = stored ? JSON.parse(stored) as { messages?: Array<{ role?: string; text?: string }> } : null;
      return (parsed?.messages || [])
        .filter((message) => message.role === 'user' && message.text?.trim())
        .slice(-4)
        .reverse()
        .map((message) => message.text as string);
    } catch {
      return [];
    }
  }, [user?.id]);

  const openAssistant = (prompt?: string) => openLafloAssistant({
    mode: 'operations',
    prompt: prompt || incomingQuestion || 'What should I pay attention to across hotel operations today?',
  });

  const briefing = briefingQuery.data;
  const recommendations = recommendationsQuery.data || [];
  const readinessLabel = statusQuery.isLoading ? 'Checking readiness' : statusQuery.data?.live ? 'AI ready' : 'Review configuration';
  const openGovernance = () => document.getElementById('hotel-brain-governance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const refreshEvidence = async () => {
    const results = await Promise.allSettled([statusQuery.refetch(), briefingQuery.refetch(), recommendationsQuery.refetch()]);
    if (results.every((result) => result.status === 'fulfilled')) toast.success('Hotel Brain evidence refreshed');
    else if (results.some((result) => result.status === 'fulfilled')) toast('Evidence partially refreshed');
    else toast.error('Evidence refresh failed');
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 via-[#05254b] to-[#123a67] text-white shadow-sm">
        <div className="flex flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10"><Brain className="h-7 w-7" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-200">AI / Hotel Brain Console</p>
              <h1 className="mt-1 text-2xl font-semibold">Hotel Brain Console</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">Hotel Brain powers Ask LaFlo with permission-filtered context, connected modules, evidence history, and governed recommendations.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100"><ShieldCheck className="h-4 w-4" />Permission-filtered evidence</span>
            <button type="button" onClick={() => openAssistant()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100"><Bot className="h-4 w-4" />Open Ask LaFlo</button>
          </div>
        </div>
      </section>

      {incomingQuestion ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Question ready for Ask LaFlo</p><p className="mt-1 text-sm font-medium text-slate-900">{incomingQuestion}</p></div>
          <button type="button" onClick={() => openAssistant(incomingQuestion)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast"><Bot className="h-4 w-4" />Continue in Ask LaFlo</button>
        </section>
      ) : null}

      <section aria-label="Hotel Brain status" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={Activity} label="AI readiness" value={readinessLabel} detail={statusQuery.data?.model || 'Ask LaFlo service'} tone="emerald" onClick={() => setDetail({ title: 'AI readiness', content: <DetailStack rows={[["Status", readinessLabel], ["Model", statusQuery.data?.model || "Not available"], ["Provider", statusQuery.data?.provider || "Not available"]]} /> })} />
        <StatusCard icon={Database} label="Context sources" value={String(authorisedSources.length)} detail="Authorised connected modules" tone="sky" onClick={() => setDetail({ title: 'Context sources', content: <DetailStack rows={authorisedSources.map((source) => [source.label, source.detail])} /> })} />
        <StatusCard icon={Sparkles} label="Governance queue" value={recommendationsQuery.isLoading ? '—' : String(recommendations.length)} detail="Pending AI recommendations" tone="violet" onClick={openGovernance} />
        <StatusCard icon={Clock3} label="Last intelligence run" value={briefingQuery.isLoading ? 'Loading…' : formatTime(briefing?.generatedAt)} detail={briefing?.source === 'AI' ? 'AI generated' : 'Rules-assisted evidence'} tone="amber" onClick={() => setDetail({ title: 'Last intelligence run', content: <DetailStack rows={[["Generated", formatTime(briefing?.generatedAt)], ["Status", briefing ? "Completed" : "Not available"], ["Source", briefing?.source || "Not available"]]} /> })} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-base font-semibold text-slate-950">Latest operational briefing</h2><p className="mt-1 text-sm text-slate-500">Evidence-backed intelligence available to Ask LaFlo.</p></div>
              <button type="button" onClick={() => void refreshEvidence()} disabled={briefingQuery.isFetching || statusQuery.isFetching || recommendationsQuery.isFetching} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCcw className={`h-4 w-4 ${briefingQuery.isFetching ? 'animate-spin' : ''}`} />Refresh evidence</button>
            </div>
            {briefingQuery.isLoading ? <div className="mt-4 h-32 animate-pulse rounded-xl bg-slate-100" /> : briefing ? (
              <div className="mt-4">
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{briefing.executiveSummary}</p>
                <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {briefing.todayPriorities.slice(0, 5).map((item) => <div key={`${item.title}-${item.detail}`} className="flex items-start gap-3 px-4 py-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><div><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{item.detail}</p></div>{item.department ? <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{item.department}</span> : null}</div>)}
                </div>
                <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => openAssistant(`Explain this operational briefing: ${briefing.executiveSummary}`)} className="rounded-xl bg-primary-solid px-3 py-2 text-xs font-semibold text-primary-contrast">Open Ask LaFlo</button><button type="button" onClick={() => setDetail({ title: 'Full operational briefing', content: <div className="space-y-3"><p className="text-sm leading-6 text-text-main">{briefing.executiveSummary}</p><DetailStack rows={briefing.todayPriorities.map((item) => [item.title, item.detail])} /></div> })} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-main">View full briefing</button><button type="button" onClick={openGovernance} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-main">Review related recommendations</button></div>
              </div>
            ) : <EmptyState text="No operational briefing is available yet." />}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <ConsoleList icon={History} title="Recent Ask LaFlo questions" subtitle="Evidence-backed questions from your saved assistant history" items={recentQuestions} empty="No recent Ask LaFlo questions yet." actionLabel="Open Ask LaFlo" onAction={() => openAssistant()} onItem={(question) => setDetail({ title: 'Ask LaFlo question history', content: <DetailStack rows={[["Question", question], ["History", "Open Ask LaFlo to continue with current authorised context."]]} /> })} />
            <ConsoleList icon={ClipboardCheck} title="Saved operational prompts" subtitle="Reusable prompts run through the same Ask LaFlo assistant" items={savedPrompts} empty="No saved prompts available." onItem={(prompt) => openAssistant(prompt)} />
          </section>

          <section id="hotel-brain-governance" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-950">Recommendation governance</h2><p className="mt-1 text-sm text-slate-500">Hotel Brain produces recommendations; authorised reviewers approve, reject, expire, or convert them to tasks.</p></div><ShieldCheck className="h-5 w-5 text-emerald-700" /></div>
            <div className="mt-4 space-y-2">
              {recommendations.slice(0, 3).map((item) => <button type="button" onClick={() => setDetail({ title: item.title, content: <DetailStack rows={[["Department", item.department], ["Priority", item.priority], ["Confidence", `${Math.round(item.confidence * 100)}%`], ["Status", item.status]]} /> })} key={item.id} className="flex w-full flex-col gap-2 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-primary-300 hover:bg-primary-50 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.department} · Confidence {Math.round(item.confidence * 100)}%</p></div><span className="w-fit rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{item.priority}</span></button>)}
              {!recommendationsQuery.isLoading && !recommendations.length ? <EmptyState text="No recommendations are awaiting governance review." /> : null}
            </div>
            <button type="button" onClick={() => navigate('/operations/ai-governance')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">Review governance queue <ArrowRight className="h-4 w-4" /></button>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700"><Layers3 className="h-5 w-5" /></span><div><h2 className="text-base font-semibold text-slate-950">AI context sources</h2><p className="mt-1 text-xs text-slate-500">Only modules you can access are available to Ask LaFlo.</p></div></div>
            <div className="mt-4 divide-y divide-slate-100">
              {authorisedSources.map((source) => <button type="button" onClick={() => setDetail({ title: `${source.label} context`, content: <DetailStack rows={[["Status", "Available"], ["Available context", source.detail], ["Permission", "Authorised"], ["Last refresh", formatTime(briefing?.generatedAt)]]} /> })} key={source.label} className="flex w-full items-center gap-3 py-3 text-left hover:text-primary-700"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600"><Database className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{source.label}</p><p className="truncate text-[11px] text-slate-500">{source.detail}</p></div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Available</span></button>)}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Evidence & audit</h2>
            <div className="mt-4 space-y-3 text-sm">
              <AuditRow icon={LockKeyhole} label="Permission filtering" value="Enforced" onClick={() => setDetail({ title: 'Permission filtering', content: <DetailStack rows={[["Status", "Enforced"], ["Scope", `${authorisedSources.length} authorised modules`], ["Restricted data", "Hidden from summaries and source details"]]} /> })} />
              <AuditRow icon={FileSearch} label="Evidence attribution" value="Enabled" onClick={() => setDetail({ title: 'Evidence attribution', content: <p className="text-sm leading-6 text-text-muted">Ask LaFlo answers identify the authorised operational sources used when evidence is available.</p> })} />
              <AuditRow icon={ShieldCheck} label="Human governance" value="Required" onClick={openGovernance} />
              <AuditRow icon={History} label="Answer history" value={recentQuestions.length ? `${recentQuestions.length} recent` : 'No saved history'} onClick={() => setDetail({ title: 'Answer history', content: recentQuestions.length ? <DetailStack rows={recentQuestions.map((question, index) => [`Question ${index + 1}`, question])} /> : <EmptyState text="No recent Ask LaFlo questions yet." /> })} />
            </div>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Powered by Hotel Brain. Answers use authorised hotel records and require human confirmation for important operational decisions.</p>
          </section>
        </aside>
      </div>
      {detail ? <DetailDrawer title={detail.title} onClose={() => setDetail(null)}>{detail.content}</DetailDrawer> : null}
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, detail, tone, onClick }: { icon: typeof Activity; label: string; value: string; detail: string; tone: 'emerald' | 'sky' | 'violet' | 'amber'; onClick: () => void }) {
  const styles = { emerald: 'bg-emerald-50 text-emerald-700', sky: 'bg-sky-50 text-sky-700', violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700' };
  return <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${styles[tone]}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-0.5 truncate text-lg font-bold text-slate-950">{value}</p><p className="truncate text-[11px] text-slate-500">{detail}</p></div></button>;
}

function ConsoleList({ icon: Icon, title, subtitle, items, empty, actionLabel, onAction, onItem }: { icon: typeof History; title: string; subtitle: string; items: string[]; empty: string; actionLabel?: string; onAction?: () => void; onItem?: (item: string) => void }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 text-slate-600" /><div><h2 className="text-base font-semibold text-slate-950">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div></div><div className="mt-4 space-y-2">{items.length ? items.map((item) => onItem ? <button key={item} type="button" onClick={() => onItem(item)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/40"><span>{item}</span><ArrowRight className="h-3.5 w-3.5 shrink-0" /></button> : <div key={item} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-700">{item}</div>) : <EmptyState text={empty} />}</div>{actionLabel && onAction ? <button type="button" onClick={onAction} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-800">{actionLabel}<ArrowRight className="h-3.5 w-3.5" /></button> : null}</section>;
}

function AuditRow({ icon: Icon, label, value, onClick }: { icon: typeof ShieldCheck; label: string; value: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl p-1 text-left hover:bg-slate-50"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-slate-600"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1 text-xs font-medium text-slate-600">{label}</span><span className="text-xs font-semibold text-slate-900">{value}</span></button>;
}

function DetailStack({ rows }: { rows: Array<[string, string]> }) { return <div className="space-y-3">{rows.map(([label, value]) => <div key={`${label}-${value}`} className="rounded-2xl border border-border p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p><p className="mt-1 text-sm leading-6 text-text-main">{value}</p></div>)}</div>; }
function DetailDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[90] flex justify-end bg-slate-950/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card p-5 shadow-2xl"><div className="mb-5 flex items-start justify-between gap-3"><h2 className="text-lg font-semibold text-text-main">{title}</h2><button type="button" onClick={onClose} aria-label={`Close ${title}`} className="grid h-9 w-9 place-items-center rounded-xl border border-border"><X className="h-4 w-4" /></button></div>{children}</section></div>; }

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500">{text}</p>;
}
