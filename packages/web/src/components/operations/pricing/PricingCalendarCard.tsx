import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CalendarDays, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { operationsService } from '@/services/operations';

type Confidence = 'low' | 'medium' | 'high';

type PricingNight = {
  date: string; // YYYY-MM-DD
  occupancyForecast?: number;
  suggestedAdjustmentPct?: number;
  confidence?: Confidence;
  reasons?: string[];
  marketMedian?: number | null;
  marketSamples?: number;
  positionVsMarketPct?: number | null;
};

function chip(cls: string) {
  return `inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`;
}

function confidenceChip(c: Confidence) {
  if (c === 'high') return chip('bg-emerald-50 text-emerald-700 ring-emerald-200');
  if (c === 'medium') return chip('bg-amber-50 text-amber-700 ring-amber-200');
  return chip('bg-slate-50 text-slate-700 ring-slate-200');
}

function pctChip(pct: number) {
  if (pct > 0) return chip('bg-emerald-50 text-emerald-700 ring-emerald-200');
  if (pct < 0) return chip('bg-rose-50 text-rose-700 ring-rose-200');
  return chip('bg-slate-50 text-slate-700 ring-slate-200');
}

function trendIcon(pct: number) {
  if (pct > 0) return <TrendingUp className="h-4 w-4" />;
  if (pct < 0) return <TrendingDown className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

function fmtDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function pct(n: number) {
  const v = Math.round(n);
  return v > 0 ? `+${v}%` : `${v}%`;
}

export default function PricingCalendarCard({
  pricingCalendar,
  pricingSummary,
  snapshotMeta,
  title = 'Pricing Calendar (14 nights)',
  subtitle = 'Per-night guidance based on booking pace + weather signals (v1)',
}: {
  pricingCalendar: PricingNight[] | null | undefined;
  pricingSummary?: {
    marketCoveragePct?: number;
  } | null;
  snapshotMeta?: {
    generatedAtUtc?: string;
    source?: string;
  } | null;
  title?: string;
  subtitle?: string;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const createTask = useMutation({
    mutationFn: (payload: {
      nightDate: string;
      action: string;
      reason: string;
      confidence: 'low' | 'medium' | 'high';
      metadata: {
        suggestedAdjustmentPct: number;
        occupancyForecast: number | null;
        marketMedian: number | null;
        marketSamples: number;
        positionVsMarketPct: number | null;
        confidence: 'low' | 'medium' | 'high';
      };
    }) => operationsService.createTicketFromPricingAction(payload),
    onSuccess: (data) => {
      toast.success(data.deduped ? 'Task already exists - opening it' : 'Task created');
      if (data.ticketUrl) {
        window.location.href = data.ticketUrl;
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || error?.message || 'Failed to create task';
      toast.error(message);
    },
  });

  const nights = useMemo(() => {
    const list = (pricingCalendar ?? []).slice(0, 14);
    return list.map((n) => ({
      date: n.date,
      occupancyForecast: typeof n.occupancyForecast === 'number' ? n.occupancyForecast : null,
      suggestedAdjustmentPct: typeof n.suggestedAdjustmentPct === 'number' ? n.suggestedAdjustmentPct : 0,
      confidence: (n.confidence ?? 'low') as Confidence,
      reasons: Array.isArray(n.reasons) ? n.reasons : [],
      marketMedian: typeof n.marketMedian === 'number' ? n.marketMedian : null,
      marketSamples: typeof n.marketSamples === 'number' ? n.marketSamples : 0,
      positionVsMarketPct: typeof n.positionVsMarketPct === 'number' ? n.positionVsMarketPct : null,
    }));
  }, [pricingCalendar]);

  if (!pricingCalendar) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">{title}</div>
              <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Pricing calendar not available yet. Run the pricing snapshot job or refresh operations context.
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
          </div>
        </div>

        <span className={chip('bg-slate-50 text-slate-700 ring-slate-200')}>Internal model v1</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {typeof pricingSummary?.marketCoveragePct === 'number' ? (
          <span className={chip('bg-slate-50 text-slate-700 ring-slate-200')}>
            Market coverage: {pricingSummary.marketCoveragePct}%
          </span>
        ) : null}

        {snapshotMeta?.generatedAtUtc ? (
          <span className={chip('bg-slate-50 text-slate-700 ring-slate-200')}>
            Updated: {new Date(snapshotMeta.generatedAtUtc).toLocaleString()}
          </span>
        ) : null}

        {snapshotMeta?.source ? (
          <span className={chip('bg-slate-50 text-slate-700 ring-slate-200')}>Source: {snapshotMeta.source}</span>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-[11px] font-semibold text-slate-500">
          <div className="col-span-4">Night</div>
          <div className="col-span-3">Occupancy</div>
          <div className="col-span-3">Adjustment</div>
          <div className="col-span-2 text-right">Details</div>
        </div>

        <div className="divide-y divide-slate-200">
          {nights.map((n) => {
            const occ = n.occupancyForecast == null ? null : Math.round(n.occupancyForecast * 100);
            const isOpen = expandedKey === n.date;

            return (
              <div key={n.date} className="bg-white px-4 py-3">
                <div className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-4">
                    <div className="text-sm font-semibold text-slate-900">{fmtDate(n.date)}</div>
                    <div className="text-xs text-slate-500">{n.date}</div>
                  </div>

                  <div className="col-span-3">
                    <div className="text-sm font-semibold text-slate-900">{occ == null ? '-' : `${occ}%`}</div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-900"
                        style={{ width: `${occ == null ? 0 : Math.max(0, Math.min(100, occ))}%` }}
                      />
                    </div>
                    {n.marketSamples === 0 ? (
                      <div className="mt-1 text-xs font-semibold text-amber-700">No market data</div>
                    ) : n.marketMedian != null ? (
                      <div className="mt-1 text-xs text-slate-500">Market median: {n.marketMedian}</div>
                    ) : null}
                  </div>

                  <div className="col-span-3 flex items-center gap-2">
                    <span className={pctChip(n.suggestedAdjustmentPct)}>{pct(n.suggestedAdjustmentPct)}</span>
                    <span className={confidenceChip(n.confidence)}>{n.confidence}</span>
                    {typeof n.positionVsMarketPct === 'number' ? (
                      <span className={chip('bg-slate-50 text-slate-700 ring-slate-200')}>
                        vs market: {n.positionVsMarketPct > 0 ? '+' : ''}
                        {n.positionVsMarketPct}%
                      </span>
                    ) : null}
                  </div>

                  <div className="col-span-2 flex justify-end">
                    <button
                      type="button"
                      className="mr-2 inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={createTask.isPending}
                      onClick={() => {
                        const positionText =
                          n.positionVsMarketPct == null
                            ? ''
                            : ` | Position vs market: ${n.positionVsMarketPct > 0 ? '+' : ''}${n.positionVsMarketPct}%`;
                        createTask.mutate({
                          nightDate: n.date,
                          action: `Adjust rates ${pct(n.suggestedAdjustmentPct)}`,
                          reason: `${n.reasons?.[0] || 'Pricing adjustment recommended'}${positionText}`,
                          confidence: n.confidence,
                          metadata: {
                            suggestedAdjustmentPct: n.suggestedAdjustmentPct,
                            occupancyForecast: n.occupancyForecast,
                            marketMedian: n.marketMedian,
                            marketSamples: n.marketSamples,
                            positionVsMarketPct: n.positionVsMarketPct,
                            confidence: n.confidence,
                          },
                        });
                      }}
                    >
                      {createTask.isPending ? 'Creating...' : 'Create task'}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      onClick={() => setExpandedKey(isOpen ? null : n.date)}
                    >
                      {trendIcon(n.suggestedAdjustmentPct)}
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <div className="mb-2 text-xs text-slate-600">
                      Market median: {n.marketMedian == null ? '-' : `$${n.marketMedian.toFixed(2)}`} | Position vs market:{' '}
                      {n.positionVsMarketPct == null
                        ? '-'
                        : `${n.positionVsMarketPct > 0 ? '+' : ''}${n.positionVsMarketPct}%`}
                    </div>
                    <div className="text-xs font-semibold text-slate-500">Drivers</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {(n.reasons?.length ? n.reasons : ['No detailed drivers available yet.'])
                        .slice(0, 6)
                        .map((r, idx) => (
                          <li key={`${n.date}-${idx}`}>{r}</li>
                        ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 text-xs text-slate-500">
        Tip: This becomes stronger once competitor rates + events are added (same per-night calendar structure).
      </div>
    </section>
  );
}
