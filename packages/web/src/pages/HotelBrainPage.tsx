import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 via-[#05254b] to-[#123a67] text-white shadow-sm">
        <div className="flex flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10"><Brain className="h-7 w-7" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-200">AI / Hotel Brain</p>
              <h1 className="mt-1 text-2xl font-semibold">Operational intelligence with evidence</h1>
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
        <StatusCard icon={Activity} label="AI readiness" value={readinessLabel} detail={statusQuery.data?.model || 'Ask LaFlo service'} tone="emerald" />
        <StatusCard icon={Database} label="Context sources" value={String(authorisedSources.length)} detail="Authorised connected modules" tone="sky" />
        <StatusCard icon={Sparkles} label="Governance queue" value={recommendationsQuery.isLoading ? '—' : String(recommendations.length)} detail="Pending AI recommendations" tone="violet" />
        <StatusCard icon={Clock3} label="Last intelligence run" value={briefingQuery.isLoading ? 'Loading…' : formatTime(briefing?.generatedAt)} detail={briefing?.source === 'AI' ? 'AI generated' : 'Rules-assisted evidence'} tone="amber" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-base font-semibold text-slate-950">Latest operational briefing</h2><p className="mt-1 text-sm text-slate-500">Evidence-backed intelligence available to Ask LaFlo.</p></div>
              <button type="button" onClick={() => void briefingQuery.refetch()} disabled={briefingQuery.isFetching} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCcw className={`h-4 w-4 ${briefingQuery.isFetching ? 'animate-spin' : ''}`} />Refresh evidence</button>
            </div>
            {briefingQuery.isLoading ? <div className="mt-4 h-32 animate-pulse rounded-xl bg-slate-100" /> : briefing ? (
              <div className="mt-4">
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{briefing.executiveSummary}</p>
                <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {briefing.todayPriorities.slice(0, 5).map((item) => <div key={`${item.title}-${item.detail}`} className="flex items-start gap-3 px-4 py-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><div><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{item.detail}</p></div>{item.department ? <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{item.department}</span> : null}</div>)}
                </div>
              </div>
            ) : <EmptyState text="No operational briefing is available yet." />}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <ConsoleList icon={History} title="Recent Ask LaFlo questions" subtitle="Evidence-backed questions from your saved assistant history" items={recentQuestions} empty="No recent questions saved for this user." actionLabel="Open Ask LaFlo" onAction={() => openAssistant()} />
            <ConsoleList icon={ClipboardCheck} title="Saved operational prompts" subtitle="Reusable prompts run through the same Ask LaFlo assistant" items={savedPrompts} empty="No saved prompts available." onItem={(prompt) => openAssistant(prompt)} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-950">Recommendation governance</h2><p className="mt-1 text-sm text-slate-500">Hotel Brain produces recommendations; authorised reviewers approve, reject, expire, or convert them to tasks.</p></div><ShieldCheck className="h-5 w-5 text-emerald-700" /></div>
            <div className="mt-4 space-y-2">
              {recommendations.slice(0, 3).map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.department} · Confidence {Math.round(item.confidence * 100)}%</p></div><span className="w-fit rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{item.priority}</span></div>)}
              {!recommendationsQuery.isLoading && !recommendations.length ? <EmptyState text="No recommendations are awaiting governance review." /> : null}
            </div>
            <button type="button" onClick={() => navigate('/operations-center/ai')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">Review governance queue <ArrowRight className="h-4 w-4" /></button>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700"><Layers3 className="h-5 w-5" /></span><div><h2 className="text-base font-semibold text-slate-950">AI context sources</h2><p className="mt-1 text-xs text-slate-500">Only modules you can access are available to Ask LaFlo.</p></div></div>
            <div className="mt-4 divide-y divide-slate-100">
              {authorisedSources.map((source) => <div key={source.label} className="flex items-center gap-3 py-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600"><Database className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{source.label}</p><p className="truncate text-[11px] text-slate-500">{source.detail}</p></div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Available</span></div>)}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Evidence & audit</h2>
            <div className="mt-4 space-y-3 text-sm">
              <AuditRow icon={LockKeyhole} label="Permission filtering" value="Enforced" />
              <AuditRow icon={FileSearch} label="Evidence attribution" value="Enabled" />
              <AuditRow icon={ShieldCheck} label="Human governance" value="Required" />
              <AuditRow icon={History} label="Answer history" value={recentQuestions.length ? `${recentQuestions.length} recent` : 'No saved history'} />
            </div>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Powered by Hotel Brain. Answers use authorised hotel records and require human confirmation for important operational decisions.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Activity; label: string; value: string; detail: string; tone: 'emerald' | 'sky' | 'violet' | 'amber' }) {
  const styles = { emerald: 'bg-emerald-50 text-emerald-700', sky: 'bg-sky-50 text-sky-700', violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700' };
  return <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${styles[tone]}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-0.5 truncate text-lg font-bold text-slate-950">{value}</p><p className="truncate text-[11px] text-slate-500">{detail}</p></div></article>;
}

function ConsoleList({ icon: Icon, title, subtitle, items, empty, actionLabel, onAction, onItem }: { icon: typeof History; title: string; subtitle: string; items: string[]; empty: string; actionLabel?: string; onAction?: () => void; onItem?: (item: string) => void }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 text-slate-600" /><div><h2 className="text-base font-semibold text-slate-950">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div></div><div className="mt-4 space-y-2">{items.length ? items.map((item) => onItem ? <button key={item} type="button" onClick={() => onItem(item)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/40"><span>{item}</span><ArrowRight className="h-3.5 w-3.5 shrink-0" /></button> : <div key={item} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-700">{item}</div>) : <EmptyState text={empty} />}</div>{actionLabel && onAction ? <button type="button" onClick={onAction} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-800">{actionLabel}<ArrowRight className="h-3.5 w-3.5" /></button> : null}</section>;
}

function AuditRow({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-slate-600"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1 text-xs font-medium text-slate-600">{label}</span><span className="text-xs font-semibold text-slate-900">{value}</span></div>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500">{text}</p>;
}
