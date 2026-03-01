type PricingSummary = {
  demandTrend?: 'down' | 'flat' | 'up';
  opportunityPct?: number;
  confidence?: 'low' | 'medium' | 'high';
  note?: string;
};

type PricingForecast = {
  mode?: 'SNAPSHOT' | 'LIVE_FALLBACK';
  generatedAtUtc?: string;
  summary?: PricingSummary;
};

export default function PricingSignalCard({
  pricingForecast,
}: {
  pricingForecast?: PricingForecast | null;
}) {
  const summary = pricingForecast?.summary;

  const trendLabel =
    summary?.demandTrend === 'up'
      ? 'Demand accelerating'
      : summary?.demandTrend === 'down'
        ? 'Demand softening'
        : 'Demand stable';

  const pctValue = summary?.opportunityPct ?? 0;
  const pctLabel = pctValue > 0 ? `+${pctValue}%` : `${pctValue}%`;

  const confidenceColor =
    summary?.confidence === 'high'
      ? 'text-emerald-700 bg-emerald-50 ring-emerald-200'
      : summary?.confidence === 'medium'
        ? 'text-amber-700 bg-amber-50 ring-amber-200'
        : 'text-slate-700 bg-slate-50 ring-slate-200';

  const trendColor =
    summary?.demandTrend === 'up'
      ? 'text-emerald-700'
      : summary?.demandTrend === 'down'
        ? 'text-rose-700'
        : 'text-slate-700';

  const generated = pricingForecast?.generatedAtUtc
    ? new Date(pricingForecast.generatedAtUtc).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50/40 via-transparent to-transparent" />

      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Revenue Intelligence
          </div>
          <div className={`mt-1 text-sm font-medium ${trendColor}`}>
            {trendLabel}
          </div>
        </div>

        <div className="rounded-xl bg-slate-900 px-4 py-2 text-lg font-semibold text-white shadow-sm">
          {pctLabel}
        </div>
      </div>

      <div className="relative mt-4 text-sm leading-relaxed text-slate-700">
        {summary?.note || 'Pricing guidance will appear as operational signals accumulate.'}
      </div>

      <div className="relative mt-5 flex items-center justify-between">
        <div
          className={`rounded-lg px-3 py-1 text-xs font-semibold ring-1 ${confidenceColor}`}
        >
          Confidence: {summary?.confidence ?? 'low'}
        </div>

        <div className="text-xs text-slate-500">
          {generated
            ? `Updated ${generated}`
            : 'Awaiting pricing snapshot'}
        </div>
      </div>

      {pricingForecast?.mode && (
        <div className="mt-3 text-[11px] text-slate-400">
          {pricingForecast.mode === 'SNAPSHOT'
            ? 'Forecast model synced'
            : 'Forecast generated from live operational signals'}
        </div>
      )}
    </div>
  );
}
