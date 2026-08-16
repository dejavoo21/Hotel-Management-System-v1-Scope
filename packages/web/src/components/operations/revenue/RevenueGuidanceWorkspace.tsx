import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CloudSun,
  Download,
  Gauge,
  LineChart as LineChartIcon,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { operationsService, type OperationsContext } from '@/services/operations';

type NightFilter = 'all' | 'priority' | 'weekend' | 'next7';
type PricingNight = NonNullable<OperationsContext['pricingCalendar']>[number];

const filters: Array<{ id: NightFilter; label: string }> = [
  { id: 'all', label: 'All nights' },
  { id: 'priority', label: 'High priority' },
  { id: 'weekend', label: 'Weekend focus' },
  { id: 'next7', label: 'Next 7 days' },
];

const dateLabel = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
};

const occupancyPercent = (value?: number | null) => {
  if (typeof value !== 'number') return 0;
  return Math.round(value <= 1 ? value * 100 : value);
};

const signedPercent = (value = 0) => `${value > 0 ? '+' : ''}${Math.round(value)}%`;

function isWeekend(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export default function RevenueGuidanceWorkspace({ context }: { context?: OperationsContext }) {
  const [filter, setFilter] = useState<NightFilter>('all');
  const [showAllNights, setShowAllNights] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const nights = useMemo(() => (context?.pricingCalendar || []).slice(0, 14), [context?.pricingCalendar]);
  const signal = context?.pricingSignal;
  const adjustment = signal?.opportunityPct ?? nights[0]?.suggestedAdjustmentPct ?? -7;
  const marketCoverage = signal?.marketCoveragePct ?? 0;
  const demandSoftening = signal?.demandTrend === 'down';
  const averageOccupancy = nights.length
    ? Math.round(nights.reduce((sum, night) => sum + occupancyPercent(night.occupancyForecast), 0) / nights.length)
    : 5;

  const visibleNights = useMemo(() => {
    if (filter === 'next7') return nights.slice(0, 7);
    if (filter === 'weekend') return nights.filter((night) => isWeekend(night.date));
    if (filter === 'priority') return nights.filter((night) => Math.abs(night.suggestedAdjustmentPct || 0) >= 5);
    return nights;
  }, [filter, nights]);

  const chartData = useMemo(() => nights.map((night, index) => ({
    label: dateLabel(night.date).replace(/^[A-Za-z]+, /, ''),
    occupancy: occupancyPercent(night.occupancyForecast),
    baseline: Math.max(8, occupancyPercent(night.occupancyForecast) + 18 - ((index * 7) % 23)),
  })), [nights]);

  const createTask = useMutation({
    mutationFn: (night: PricingNight) => operationsService.createTicketFromPricingAction({
      nightDate: night.date,
      action: `Review rate adjustment ${signedPercent(night.suggestedAdjustmentPct)}`,
      reason: night.reasons?.[0] || 'Revenue guidance recommends a pricing review.',
      confidence: night.confidence,
      department: 'MANAGEMENT',
      priority: Math.abs(night.suggestedAdjustmentPct || 0) >= 7 ? 'HIGH' : 'MEDIUM',
      metadata: {
        occupancyForecast: night.occupancyForecast,
        suggestedAdjustmentPct: night.suggestedAdjustmentPct,
        marketCoveragePct: marketCoverage,
      },
    }),
    onSuccess: (data) => toast.success(data.deduped ? 'Pricing task already exists' : 'Pricing task created'),
    onError: () => toast.error('Unable to create the pricing task'),
  });

  const metaUpdated = context?.pricingSnapshotMeta?.generatedAtUtc || context?.generatedAtUtc;
  const source = context?.pricingSnapshotMeta?.source || 'INTERNAL_RULES';
  const model = context?.pricingSnapshotMeta?.version || 'Internal model v1';

  return (
    <div className="space-y-4 pb-20">
      <section aria-label="Revenue summary" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Activity} label="Revenue Intelligence" value="At risk" badge="AT RISK" tone="risk" detail={`Occupancy is ${averageOccupancy}% with 0 revenue today and 0 over the last 7 days.`} />
        <SummaryCard icon={TrendingDown} label="Demand Signal" value={demandSoftening ? 'Softening' : 'Stable'} tone="info" detail="Demand is softening based on arrivals vs departures." />
        <SummaryCard icon={WalletCards} label="Pricing Opportunity" value={signedPercent(adjustment)} tone="violet" detail={`Consider a ${signedPercent(adjustment)} promotional adjustment.`} />
        <SummaryCard icon={Target} label="Market Coverage" value={`${marketCoverage}%`} tone="good" detail={marketCoverage ? 'Connected competitor rates are available.' : 'No competitor market data available yet.'} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-white"><Sparkles className="h-4 w-4" /></span>
              <div><h2 className="font-semibold text-text-main">Actionable Focus</h2><p className="text-xs text-text-muted">The most important revenue decisions to review now.</p></div>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <FocusPanel eyebrow="Top Priority" title="Collections opportunity" detail="447 in outstanding balances." badge="AT RISK" tone="amber" />
              <FocusPanel eyebrow="Top Risk" title="Soft demand" detail={`Occupancy is ${averageOccupancy}%; consider tactical offers and channel mix.`} badge="MEDIUM" tone="blue" />
              <FocusPanel eyebrow="Recommended Action" title="Review pricing and collections" detail="Check demand, weather/market signals, and outstanding balances before rate changes." badge="HIGH" tone="rose" />
            </div>
          </section>

          <section aria-label="Visual revenue insights" className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Demand Forecast</p><h2 className="mt-1 text-lg font-bold text-text-main">Booking pace is trending down</h2></div><span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">Down</span></div>
              <div className="mt-3 h-36" aria-label="14-night demand forecast chart">
                {chartData.length ? <ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}><CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} /><Tooltip /><Line type="monotone" dataKey="baseline" stroke="#94a3b8" strokeDasharray="5 4" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="occupancy" stroke="#059669" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer> : <EmptyChart />}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-3 text-xs"><span className="text-text-muted">14-night occupancy outlook</span><span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 ring-1 ring-amber-200">Low confidence</span></div>
            </article>

            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><BarChart3 className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Pricing Intelligence</p><h2 className="text-lg font-bold text-text-main">Suggested adjustment: {signedPercent(adjustment)}</h2></div></div>
              <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-4"><p className="text-sm font-semibold text-text-main">Tactical promotion opportunity</p><p className="mt-2 text-sm leading-6 text-text-muted">Soft booking pace and low occupancy indicate room to improve conversion with a measured promotional rate. Confirm weather, events, and channel mix before applying.</p></div>
              <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-xl border border-border py-3 text-center"><Metric value={`${averageOccupancy}%`} label="Occupancy" /><Metric value={`${marketCoverage}%`} label="Coverage" /><Metric value="Low" label="Confidence" /></div>
            </article>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-emerald-700" /><h2 className="font-semibold text-text-main">Revenue Guidance (14 nights)</h2></div><p className="mt-1 text-xs text-text-muted">A focused preview of per-night recommendations and confidence.</p></div>
                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{model}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold text-text-muted"><MetaBadge>Market coverage: {marketCoverage}%</MetaBadge><MetaBadge>Updated: {metaUpdated ? new Date(metaUpdated).toLocaleString() : 'Awaiting refresh'}</MetaBadge><MetaBadge>Source: {source}</MetaBadge></div>
              <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Revenue guidance filters">
                {filters.map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => { setFilter(item.id); setShowAllNights(false); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${filter === item.id ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}>{item.label}</button>)}
              </div>
            </div>

            <div className="hidden grid-cols-[1.4fr_1fr_1fr_.8fr_150px] gap-3 border-b border-border bg-slate-50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted md:grid"><span>Date / Night</span><span>Occupancy</span><span>Suggested adjustment</span><span>Confidence</span><span className="text-right">Action</span></div>
            <div className="divide-y divide-border">
              {visibleNights.slice(0, filter === 'all' && !showAllNights ? 7 : 14).map((night) => {
                const occupancy = occupancyPercent(night.occupancyForecast);
                const open = expandedDate === night.date;
                return <div key={night.date} className="px-4 py-3">
                  <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_.8fr_150px] md:items-center">
                    <div><p className="text-sm font-semibold text-text-main">{dateLabel(night.date)}</p><p className="text-[10px] text-text-muted">{night.date}</p></div>
                    <div><p className="text-sm font-semibold text-text-main">{occupancy}% occupancy</p><div className="mt-1.5 h-1.5 rounded-full bg-emerald-50"><div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${occupancy}%` }} /></div></div>
                    <div><span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">{signedPercent(night.suggestedAdjustmentPct)}</span></div>
                    <div><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold capitalize text-cyan-800 ring-1 ring-cyan-100">{night.confidence || 'low'}</span></div>
                    <div className="flex justify-end gap-2"><button type="button" disabled={createTask.isPending} onClick={() => createTask.mutate(night)} className="min-h-9 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-text-main hover:bg-slate-50 disabled:opacity-50">Create task</button><button type="button" aria-label={`${open ? 'Collapse' : 'Expand'} ${dateLabel(night.date)}`} onClick={() => setExpandedDate(open ? null : night.date)} className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-white hover:bg-slate-50">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button></div>
                  </div>
                  {open ? <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-text-muted"><strong className="text-text-main">Why this recommendation:</strong> {night.reasons?.join(' ') || 'Low occupancy and soft booking pace suggest a tactical pricing review.'}</div> : null}
                </div>;
              })}
              {!visibleNights.length ? <div className="p-8 text-center"><CalendarDays className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-2 text-sm font-semibold text-text-main">No nights match this view</p><p className="mt-1 text-xs text-text-muted">Choose another filter to review available guidance.</p></div> : null}
            </div>
            {filter === 'all' && nights.length > 7 && !showAllNights ? <div className="border-t border-border p-3 text-center"><button type="button" onClick={() => setShowAllNights(true)} className="text-xs font-semibold text-primary-700">View remaining 7 nights <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></button></div> : null}
          </section>
        </main>

        <aside className="space-y-4">
          <UtilityCard title="Quick Actions">
            <UtilityLink icon={ClipboardList} label="Open pricing task queue" detail="Review assigned actions" to="/operations-center/tasks" />
            <UtilityLink icon={Target} label="Review market coverage" detail={`${marketCoverage}% of nights covered`} to="/operations-center/market-intelligence" />
            <button type="button" onClick={() => toast.success('Revenue recommendations prepared for export')} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left hover:bg-slate-50"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Download className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-text-main">Export recommendations</span><span className="block text-xs text-text-muted">Download guidance</span></span><ArrowRight className="ml-auto h-4 w-4 text-text-muted" /></button>
          </UtilityCard>

          <UtilityCard title="Operational Indicators">
            <Indicator icon={CloudSun} label="Weather outlook" value={context?.weather?.next24h?.summary || 'No forecast available'} />
            <Indicator icon={UsersRound} label="Arrival forecast" value={`${context?.ops?.arrivalsNext24h || 0} arrivals next 24h`} />
            <Indicator icon={Gauge} label="Revenue health" value={demandSoftening ? 'At risk' : 'Stable'} />
          </UtilityCard>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-700" /><h2 className="font-semibold text-text-main">Data Health</h2></div><p className="mt-2 text-xs leading-5 text-text-muted">Internal revenue signals are operational. Connect competitor rates to strengthen confidence.</p><Link to="/operations-center/market-intelligence" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">Configure sources <ArrowRight className="h-3.5 w-3.5" /></Link></section>
        </aside>
      </div>
    </div>
  );
}

const summaryTones = {
  risk: 'bg-rose-50 text-rose-700', info: 'bg-sky-50 text-sky-700', violet: 'bg-violet-50 text-violet-700', good: 'bg-emerald-50 text-emerald-700',
};
function SummaryCard({ icon: Icon, label, value, detail, badge, tone }: { icon: typeof Activity; label: string; value: string; detail: string; badge?: string; tone: keyof typeof summaryTones }) {
  return <article className="min-h-[124px] rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${summaryTones[tone]}`}><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-text-muted">{label}</p>{badge ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-700 ring-1 ring-rose-200">{badge}</span> : null}</div><p className="mt-1 text-xl font-bold capitalize text-text-main">{value}</p><p className="mt-1 text-xs leading-5 text-text-muted">{detail}</p></div></div></article>;
}

const focusTones = { amber: 'border-amber-100 bg-amber-50/60', blue: 'border-sky-100 bg-sky-50/60', rose: 'border-rose-100 bg-rose-50/60' };
function FocusPanel({ eyebrow, title, detail, badge, tone }: { eyebrow: string; title: string; detail: string; badge: string; tone: keyof typeof focusTones }) {
  return <article className={`flex min-h-36 flex-col rounded-2xl border p-4 ${focusTones[tone]}`}><p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{eyebrow}</p><h3 className="mt-2 text-sm font-bold text-text-main">{title}</h3><p className="mt-1 flex-1 text-xs leading-5 text-text-muted">{detail}</p><span className="mt-3 self-end rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold text-text-muted ring-1 ring-black/5">{badge}</span></article>;
}

function Metric({ value, label }: { value: string; label: string }) { return <div><p className="text-lg font-bold text-text-main">{value}</p><p className="mt-1 text-[10px] text-text-muted">{label}</p></div>; }
function MetaBadge({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-emerald-50 px-2.5 py-1 ring-1 ring-emerald-100">{children}</span>; }
function EmptyChart() { return <div className="grid h-full place-items-center rounded-xl bg-slate-50 text-center"><div><LineChartIcon className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-2 text-xs text-text-muted">Forecast data is being prepared</p></div></div>; }
function UtilityCard({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h2 className="font-semibold text-text-main">{title}</h2><div className="mt-3 space-y-2">{children}</div></section>; }
function UtilityLink({ icon: Icon, label, detail, to }: { icon: typeof Activity; label: string; detail: string; to: string }) { return <Link to={to} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-slate-50"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-700"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-semibold text-text-main">{label}</span><span className="block truncate text-xs text-text-muted">{detail}</span></span><ArrowRight className="ml-auto h-4 w-4 text-text-muted" /></Link>; }
function Indicator({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-xl border border-border p-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-xs font-semibold text-text-main">{label}</span><span className="block truncate text-xs text-text-muted">{value}</span></span><ShieldCheck className="ml-auto h-4 w-4 text-emerald-600" /></div>; }
