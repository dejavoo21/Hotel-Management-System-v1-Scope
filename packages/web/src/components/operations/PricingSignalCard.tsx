type Pricing = {
  demandTrend?: 'down' | 'flat' | 'up';
  opportunityPct?: number;
  confidence?: 'low' | 'medium' | 'high';
  suggestion?: string;
};

export default function PricingSignalCard({ pricing }: { pricing?: Pricing | null }) {
  const trendLabel =
    pricing?.demandTrend === 'up'
      ? 'Demand rising'
      : pricing?.demandTrend === 'down'
        ? 'Demand softening'
        : 'Demand stable';

  const pctValue = pricing?.opportunityPct ?? 0;
  const pctLabel = pctValue > 0 ? `+${pctValue}%` : `${pctValue}%`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Pricing Signal</div>
          <div className="mt-1 text-sm text-slate-600">{trendLabel}</div>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-800 ring-1 ring-slate-200">
          {pctLabel}
        </div>
      </div>

      <div className="mt-3 text-sm text-slate-700">
        {pricing?.suggestion || 'No pricing advisory available yet.'}
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Confidence: <span className="font-semibold">{pricing?.confidence || 'low'}</span>
      </div>
    </div>
  );
}
