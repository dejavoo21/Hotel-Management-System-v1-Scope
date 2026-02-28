import type { OperationsContext } from '@/services/operations';

type Props = {
  context?: OperationsContext | null;
};

function badgeTone(value: string): string {
  if (value.toLowerCase().includes('high') || value.toLowerCase().includes('up')) return 'bg-rose-100 text-rose-700';
  if (value.toLowerCase().includes('moderate') || value.toLowerCase().includes('medium')) return 'bg-amber-100 text-amber-700';
  if (value.toLowerCase().includes('normal') || value.toLowerCase().includes('low') || value.toLowerCase().includes('flat'))
    return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-700';
}

export default function OpsStatusBar({ context }: Props) {
  const pricingSignal = context?.pricingSignal ?? context?.pricing;
  const rainRisk = context?.weather?.next24h?.rainRisk || 'low';
  const demand = pricingSignal?.demandTrend || 'flat';
  const inhouse = context?.ops?.inhouseNow ?? 0;
  const pricing = pricingSignal?.opportunityPct ?? 0;
  const serviceLoad = inhouse > 100 ? 'high' : inhouse > 50 ? 'moderate' : 'normal';

  const items = [
    { label: 'Weather Risk', value: rainRisk },
    { label: 'Demand Trend', value: demand },
    { label: 'Occupancy Now', value: `${inhouse}%` },
    { label: 'Pricing Opportunity', value: `${pricing >= 0 ? '+' : ''}${pricing}%` },
    { label: 'Service Load', value: serviceLoad },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeTone(item.value)}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
