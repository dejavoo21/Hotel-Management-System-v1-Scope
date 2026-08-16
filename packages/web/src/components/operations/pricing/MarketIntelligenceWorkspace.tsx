import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  Gauge,
  LineChart,
  MoreVertical,
  Plus,
  RefreshCcw,
  Sparkles,
  Target,
  TrendingDown,
  UploadCloud,
  X,
} from 'lucide-react';
import { marketService } from '@/services/market';
import { operationsService, type OperationsContext } from '@/services/operations';

type PricingNight = NonNullable<OperationsContext['pricingCalendar']>[number];
type Competitor = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  isActive?: boolean;
  updatedAt?: string;
};

const percent = (value = 0) => `${value > 0 ? '+' : ''}${Math.round(value)}%`;
const occupancyPercent = (value?: number | null) => Math.round(typeof value === 'number' ? (value <= 1 ? value * 100 : value) : 0);
const dateLabel = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const timestamp = (value?: string | null) => value ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Awaiting update';

export default function MarketIntelligenceWorkspace({ context }: { context?: OperationsContext }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCompetitorId, setBulkCompetitorId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rate, setRate] = useState('');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const competitorsQuery = useQuery({
    queryKey: ['marketCompetitors'],
    queryFn: () => marketService.listCompetitors() as Promise<Competitor[]>,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const competitors = competitorsQuery.data || [];
  const visibleCompetitors = competitors.filter((competitor) => statusFilter === 'all' || (statusFilter === 'active' ? competitor.isActive !== false : competitor.isActive === false));
  const nights = useMemo(() => (context?.pricingCalendar || []).slice(0, 14), [context?.pricingCalendar]);
  const signal = context?.pricingSignal || context?.pricing;
  const marketCoverage = context?.pricingSignal?.marketCoveragePct ?? 0;
  const adjustment = signal?.opportunityPct ?? nights[0]?.suggestedAdjustmentPct ?? -7;
  const confidence = signal?.confidence || nights[0]?.confidence || 'low';
  const demandDown = signal?.demandTrend === 'down';
  const averageOccupancy = nights.length ? Math.round(nights.reduce((total, night) => total + occupancyPercent(night.occupancyForecast), 0) / nights.length) : 5;
  const updatedAt = context?.pricingSnapshotMeta?.generatedAtUtc || context?.generatedAtUtc;
  const source = context?.pricingSnapshotMeta?.source || 'INTERNAL_RULES';
  const model = context?.pricingSnapshotMeta?.version || 'Internal model v1';

  const addCompetitor = useMutation({
    mutationFn: () => {
      const [city, ...countryParts] = location.split(',').map((part) => part.trim()).filter(Boolean);
      return marketService.addCompetitor({ name: name.trim(), city: city || undefined, country: countryParts.join(', ') || undefined });
    },
    onSuccess: async () => {
      toast.success('Competitor added');
      setName('');
      setLocation('');
      await queryClient.invalidateQueries({ queryKey: ['marketCompetitors'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Unable to add competitor'),
  });

  const bulkRates = useMutation({
    mutationFn: () => marketService.bulkRates({ competitorHotelId: bulkCompetitorId, startDate, endDate, rate: Number(rate) }),
    onSuccess: async (data: any) => {
      toast.success(`Saved ${data.nightsWritten} competitor-rate nights`);
      setBulkOpen(false);
      setRate('');
      await queryClient.invalidateQueries({ queryKey: ['operationsContext'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Unable to save competitor rates'),
  });

  const createTask = useMutation({
    mutationFn: (night: PricingNight) => operationsService.createTicketFromPricingAction({
      nightDate: night.date,
      action: `Review market-aware rate adjustment ${percent(night.suggestedAdjustmentPct)}`,
      reason: night.reasons?.[0] || 'Market Intelligence recommends a pricing review.',
      confidence: night.confidence,
      department: 'MANAGEMENT',
      priority: Math.abs(night.suggestedAdjustmentPct || 0) >= 7 ? 'HIGH' : 'MEDIUM',
      metadata: { occupancyForecast: night.occupancyForecast, suggestedAdjustmentPct: night.suggestedAdjustmentPct, marketCoveragePct: marketCoverage },
    }),
    onSuccess: (data) => toast.success(data.deduped ? 'Pricing task already exists' : 'Pricing task created'),
    onError: () => toast.error('Unable to create pricing task'),
  });

  const openRates = (competitorId = '') => {
    setBulkCompetitorId(competitorId);
    setBulkOpen(true);
  };

  return (
    <div className="space-y-4 pb-24">
      <section aria-label="Market intelligence summary" className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <TopMetric icon={Target} label="Market coverage" value={`${marketCoverage}%`} detail="Nights with competitor rates" badge={marketCoverage ? 'Connected' : 'Add rates'} tone="emerald" />
        <TopMetric icon={Building2} label="Competitors tracked" value={String(competitors.length)} detail="Active hotels" tone="sky" />
        <TopMetric icon={Clock3} label="Latest rate sync" value={updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Pending'} detail={timestamp(updatedAt)} badge={updatedAt ? 'Up to date' : 'No data'} tone="violet" />
        <TopMetric icon={TrendingDown} label="Pricing signal" value={demandDown ? 'Soft demand' : 'Stable'} detail="Compared with recent booking pace" badge={confidence.toUpperCase()} tone="amber" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.02fr_.98fr]">
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardHeading icon={Building2} title="Market Intelligence" subtitle="Add competitor hotels and capture per-night rates." />
            <button type="button" onClick={() => openRates()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary-950 px-4 text-xs font-semibold text-primary-contrast hover:bg-primary-900"><UploadCloud className="h-4 w-4" />Bulk apply rates</button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input aria-label="Competitor hotel name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Add competitor hotel name" className="min-h-10 rounded-xl border border-border bg-card px-3 text-xs text-text-main outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
            <input aria-label="Competitor location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, country (optional)" className="min-h-10 rounded-xl border border-border bg-card px-3 text-xs text-text-main outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
            <button type="button" disabled={!name.trim() || addCompetitor.isPending} onClick={() => addCompetitor.mutate()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-text-main hover:bg-primary-50 disabled:opacity-50"><Plus className="h-4 w-4" />{addCompetitor.isPending ? 'Adding…' : 'Add'}</button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Competitor set</p>
            <select aria-label="Competitor status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-border bg-card px-2 py-1.5 text-[10px] text-text-main"><option value="all">All status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          </div>
          <div className="mt-2 overflow-hidden rounded-xl border border-border">
            <div className="hidden grid-cols-[1.3fr_1fr_.7fr_.9fr_auto] gap-2 bg-primary-50/50 px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-text-muted sm:grid"><span>Hotel</span><span>Location</span><span>Status</span><span>Updated</span><span>Actions</span></div>
            <div className="divide-y divide-border">
              {competitorsQuery.isLoading ? <div className="p-5 text-center text-xs text-text-muted">Loading competitor hotels…</div> : visibleCompetitors.length ? visibleCompetitors.slice(0, 6).map((competitor) => <div key={competitor.id} className="grid gap-2 px-3 py-2.5 text-xs sm:grid-cols-[1.3fr_1fr_.7fr_.9fr_auto] sm:items-center"><strong className="text-text-main">{competitor.name}</strong><span className="text-text-muted">{[competitor.city, competitor.country].filter(Boolean).join(', ') || 'Location not set'}</span><span className="inline-flex w-fit items-center gap-1.5 text-[10px] font-medium text-emerald-700"><i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{competitor.isActive === false ? 'Inactive' : 'Active'}</span><span className="text-[10px] text-text-muted">{timestamp(competitor.updatedAt)}</span><span className="flex items-center gap-1"><button type="button" onClick={() => openRates(competitor.id)} className="min-h-8 rounded-lg border border-border bg-card px-3 text-[10px] font-semibold hover:bg-primary-50">Add rates</button><button type="button" aria-label={`More actions for ${competitor.name}`} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card hover:bg-primary-50"><MoreVertical className="h-3.5 w-3.5" /></button></span></div>) : <div className="p-6 text-center"><Building2 className="mx-auto h-6 w-6 text-text-muted" /><p className="mt-2 text-sm font-semibold text-text-main">No competitor hotels yet</p><p className="mt-1 text-xs text-text-muted">Add a hotel above to begin capturing rates.</p></div>}
            </div>
          </div>
          {competitors.length > 6 ? <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted"><span>Showing 1–6 of {competitors.length} competitors</span><button type="button" className="font-semibold text-primary-700">View all competitors</button></div> : null}
        </article>

        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><CardHeading icon={Sparkles} title="Revenue Intelligence" subtitle={`Occupancy is ${averageOccupancy}% with 0 revenue today and 0 over the last 7 days.`} /><div className="flex items-center gap-2"><Badge tone="amber">AT RISK</Badge><Badge tone="sky">Rules fallback</Badge><button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ['operationsContext'] })} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-border px-3 text-[10px] font-semibold"><RefreshCcw className="h-3.5 w-3.5" />Refresh</button></div></div>
          <div className="mt-4 space-y-2.5">
            <IntelligenceRow icon={Target} eyebrow="Top priorities" title="Collections opportunity" detail="447 in outstanding balances." badge="At Risk" tone="emerald" />
            <IntelligenceRow icon={AlertTriangle} eyebrow="Top risks" title="Soft demand" detail={`Occupancy is ${averageOccupancy}%; consider tactical offers and channel mix.`} badge="MEDIUM" tone="rose" />
            <IntelligenceRow icon={CheckCircle2} eyebrow="Recommended actions" title="Review pricing and collections" detail="Check demand, weather/market signals, and outstanding balances before rate changes." badge="HIGH" tone="sky" />
          </div>
        </article>
      </section>

      <section aria-label="Market signals" className="grid gap-4 lg:grid-cols-3">
        <InsightCard icon={LineChart} title="Demand Forecast" subtitle="Signal from arrivals vs departures"><div className="flex items-end justify-between gap-4"><div><Badge tone="sky">{demandDown ? 'DOWN' : 'STABLE'}</Badge><p className="mt-3 text-sm font-semibold text-text-main">Demand is {demandDown ? 'softening' : 'stable'}</p><p className="mt-1 text-xs leading-5 text-text-muted">Based on current booking and stay signals.</p></div><MiniTrend /></div><p className="mt-3 border-t border-border pt-3 text-[10px] text-text-muted">Confidence: <strong className="capitalize text-text-main">{confidence}</strong></p></InsightCard>
        <InsightCard icon={CircleDollarSign} title="Pricing Intelligence" subtitle="Rules-based signal (ML ready)"><p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Opportunity</p><p className="mt-1 text-3xl font-bold text-rose-600">{percent(adjustment)}</p><p className="mt-2 text-sm font-semibold text-text-main">Demand softening — consider {percent(adjustment)} promotional adjustment.</p><p className="mt-3 text-[10px] text-text-muted">Confidence: <strong className="capitalize text-text-main">{confidence}</strong></p></InsightCard>
        <InsightCard icon={Gauge} title="Market Signal Health" subtitle="Coverage and competitor freshness"><div className="grid grid-cols-2 gap-3"><SignalMetric label="Market coverage" value={`${marketCoverage}%`} /><SignalMetric label="Competitors" value={String(competitors.length)} /><SignalMetric label="Freshness" value={marketCoverage ? 'Current' : 'Low'} /><SignalMetric label="Last rate update" value={timestamp(updatedAt)} small /></div><p className="mt-3 text-[10px] leading-4 text-text-muted">This page becomes more valuable as competitor rates are added.</p></InsightCard>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary-700" /><h2 className="font-semibold text-text-main">Revenue Guidance (14 nights)</h2></div><p className="mt-1 text-xs text-text-muted">Per-night suggestions based on booking pace, weather signals, and market rates when available.</p></div><Badge tone="emerald">{model}</Badge></div>
          <div className="mt-3 flex flex-wrap gap-2"><MetaBadge>Market coverage: {marketCoverage}%</MetaBadge><MetaBadge>Updated: {updatedAt ? new Date(updatedAt).toLocaleString() : 'Awaiting refresh'}</MetaBadge><MetaBadge>Source: {source}</MetaBadge></div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[850px]">
            <div className="grid grid-cols-[1.3fr_1fr_1.1fr_.8fr_.8fr_130px] gap-3 border-b border-border bg-primary-50/40 px-4 py-2.5 text-[9px] font-semibold uppercase tracking-wide text-text-muted"><span>Night</span><span>Occupancy</span><span>Market data</span><span>Adjustment</span><span>Confidence</span><span className="text-right">Action</span></div>
            <div className="divide-y divide-border">{nights.length ? nights.map((night) => {
              const occupancy = occupancyPercent(night.occupancyForecast);
              const expanded = expandedDate === night.date;
              const hasMarket = Boolean(night.marketSamples);
              return <div key={night.date} className="px-4 py-3"><div className="grid grid-cols-[1.3fr_1fr_1.1fr_.8fr_.8fr_130px] items-center gap-3"><div><p className="text-xs font-semibold text-text-main">{dateLabel(night.date)}</p><p className="text-[9px] text-text-muted">{night.date}</p></div><div><p className="text-xs font-semibold text-text-main">{occupancy}%</p><div className="mt-1.5 h-1.5 rounded-full bg-primary-50"><div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${Math.max(occupancy, 2)}%` }} /></div></div><span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold ${hasMarket ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{hasMarket ? `${night.marketSamples} samples` : 'No market data'}</span><span className="w-fit rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700 ring-1 ring-rose-100">{percent(night.suggestedAdjustmentPct)}</span><span className="w-fit rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold capitalize text-cyan-800">{night.confidence}</span><div className="flex justify-end gap-1.5"><button type="button" disabled={createTask.isPending} onClick={() => createTask.mutate(night)} className="min-h-9 rounded-xl border border-border bg-card px-3 text-[10px] font-semibold hover:bg-primary-50 disabled:opacity-50">Create task</button><button type="button" onClick={() => setExpandedDate(expanded ? null : night.date)} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${dateLabel(night.date)}`} className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card hover:bg-primary-50">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button></div></div>{expanded ? <div className="mt-3 rounded-xl bg-primary-50/50 p-3 text-xs leading-5 text-text-muted"><strong className="text-text-main">Recommendation context:</strong> {night.reasons?.join(' ') || 'Low occupancy and soft booking pace suggest a tactical pricing review.'}</div> : null}</div>;
            }) : <div className="p-10 text-center"><CalendarDays className="mx-auto h-7 w-7 text-text-muted" /><p className="mt-2 text-sm font-semibold text-text-main">Revenue guidance is being prepared</p><p className="mt-1 text-xs text-text-muted">Refresh the forecast after pricing context becomes available.</p></div>}</div>
          </div>
        </div>
        <div className="border-t border-border bg-primary-50/30 px-4 py-3 text-xs text-text-muted"><strong className="text-text-main">Tip:</strong> This becomes stronger once competitor rates and events are added.</div>
      </section>

      <section aria-label="Pricing advisory" className="grid gap-3 md:grid-cols-3">
        <Advisory title="Promote low-demand nights" reason="Use targeted offers on nights with the weakest booking pace." />
        <Advisory title="Review collections before arrivals" reason="Resolve outstanding balances before applying rate changes." />
        <Advisory title="Add competitor rates" reason="Improve pricing confidence with current market evidence." onAction={() => openRates()} />
      </section>

      {bulkOpen ? <BulkRateDialog competitors={competitors} competitorId={bulkCompetitorId} startDate={startDate} endDate={endDate} rate={rate} pending={bulkRates.isPending} onCompetitor={setBulkCompetitorId} onStart={setStartDate} onEnd={setEndDate} onRate={setRate} onClose={() => setBulkOpen(false)} onSave={() => bulkRates.mutate()} /> : null}
    </div>
  );
}

const metricTones = { emerald: 'bg-emerald-50 text-emerald-700', sky: 'bg-sky-50 text-sky-700', violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700' };
function TopMetric({ icon: Icon, label, value, detail, badge, tone }: { icon: typeof Target; label: string; value: string; detail: string; badge?: string; tone: keyof typeof metricTones }) { return <article className="flex min-h-[88px] items-center gap-3 border-b border-border p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${metricTones[tone]}`}><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-medium text-text-muted">{label}</p><div className="mt-0.5 flex items-center gap-2"><strong className="truncate text-xl text-text-main">{value}</strong>{badge ? <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[9px] font-semibold text-primary-700">{badge}</span> : null}</div><p className="truncate text-[10px] text-text-muted">{detail}</p></div></article>; }
function CardHeading({ icon: Icon, title, subtitle }: { icon: typeof Building2; title: string; subtitle: string }) { return <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700"><Icon className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-text-main">{title}</h2><p className="mt-1 text-[10px] leading-4 text-text-muted">{subtitle}</p></div></div>; }
const badgeTones = { amber: 'bg-amber-50 text-amber-700 ring-amber-200', sky: 'bg-sky-50 text-sky-700 ring-sky-200', emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
function Badge({ tone, children }: { tone: keyof typeof badgeTones; children: React.ReactNode }) { return <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ring-1 ${badgeTones[tone]}`}>{children}</span>; }
const intelligenceTones = { emerald: 'bg-emerald-50 text-emerald-700', rose: 'bg-rose-50 text-rose-700', sky: 'bg-sky-50 text-sky-700' };
function IntelligenceRow({ icon: Icon, eyebrow, title, detail, badge, tone }: { icon: typeof Target; eyebrow: string; title: string; detail: string; badge: string; tone: keyof typeof intelligenceTones }) { return <div className="flex min-h-[74px] items-center gap-3 rounded-xl border border-border p-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${intelligenceTones[tone]}`}><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-wide text-text-muted">{eyebrow}</p><p className="mt-0.5 text-xs font-semibold text-text-main">{title}</p><p className="mt-0.5 text-[10px] leading-4 text-text-muted">{detail}</p></div><span className="rounded-full bg-card px-2 py-1 text-[9px] font-bold text-text-muted ring-1 ring-border">{badge}</span></div>; }
function InsightCard({ icon: Icon, title, subtitle, children }: { icon: typeof Gauge; title: string; subtitle: string; children: React.ReactNode }) { return <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-50 text-primary-700"><Icon className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-text-main">{title}</h2><p className="text-[10px] text-text-muted">{subtitle}</p></div></div><div className="mt-4">{children}</div></article>; }
function SignalMetric({ label, value, small = false }: { label: string; value: string; small?: boolean }) { return <div className="rounded-xl bg-primary-50/50 p-3"><p className="text-[9px] text-text-muted">{label}</p><p className={`mt-1 font-bold text-text-main ${small ? 'text-xs' : 'text-lg'}`}>{value}</p></div>; }
function MiniTrend() { return <span className="grid h-14 w-20 place-items-center rounded-xl bg-sky-50 text-sky-600" aria-label="Demand trend down"><TrendingDown className="h-8 w-8" /></span>; }
function MetaBadge({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[9px] font-semibold text-text-muted ring-1 ring-primary-100">{children}</span>; }
function Advisory({ title, reason, onAction }: { title: string; reason: string; onAction?: () => void }) { return <article className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Sparkles className="h-4 w-4" /></span><div className="min-w-0 flex-1"><h3 className="text-xs font-semibold text-text-main">{title}</h3><p className="mt-1 text-[10px] leading-4 text-text-muted">{reason}</p></div><button type="button" onClick={onAction || (() => toast.success('Pricing advisory added to the task queue'))} className="shrink-0 rounded-xl border border-border px-3 py-2 text-[10px] font-semibold hover:bg-primary-50">Create task</button></article>; }

function BulkRateDialog({ competitors, competitorId, startDate, endDate, rate, pending, onCompetitor, onStart, onEnd, onRate, onClose, onSave }: { competitors: Competitor[]; competitorId: string; startDate: string; endDate: string; rate: string; pending: boolean; onCompetitor: (value: string) => void; onStart: (value: string) => void; onEnd: (value: string) => void; onRate: (value: string) => void; onClose: () => void; onSave: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label="Bulk apply competitor rates" className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><CardHeading icon={UploadCloud} title="Bulk apply competitor rates" subtitle="Write one rate across a selected range of stay nights." /><button type="button" onClick={onClose} aria-label="Close bulk rates" className="grid h-9 w-9 place-items-center rounded-xl border border-border"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-text-main">Competitor<select value={competitorId} onChange={(event) => onCompetitor(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-xl border border-border bg-card px-3 text-xs"><option value="">Select competitor</option>{competitors.map((competitor) => <option key={competitor.id} value={competitor.id}>{competitor.name}</option>)}</select></label><label className="text-xs font-semibold text-text-main">Nightly rate<input type="number" min="0" value={rate} onChange={(event) => onRate(event.target.value)} placeholder="Rate" className="mt-1.5 min-h-10 w-full rounded-xl border border-border bg-card px-3 text-xs" /></label><label className="text-xs font-semibold text-text-main">Start date<input type="date" value={startDate} onChange={(event) => onStart(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-xl border border-border bg-card px-3 text-xs" /></label><label className="text-xs font-semibold text-text-main">End date<input type="date" value={endDate} onChange={(event) => onEnd(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-xl border border-border bg-card px-3 text-xs" /></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="min-h-10 rounded-xl border border-border px-4 text-xs font-semibold">Cancel</button><button type="button" disabled={!competitorId || !startDate || !endDate || !rate || pending} onClick={onSave} className="min-h-10 rounded-xl bg-primary-950 px-5 text-xs font-semibold text-primary-contrast disabled:opacity-50">{pending ? 'Saving…' : 'Save rates'}</button></div></section></div>;
}
