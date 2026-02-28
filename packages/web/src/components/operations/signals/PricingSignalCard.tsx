import type { OperationsContext } from '@/services/operations';

type Props = {
  context?: OperationsContext | null;
};

export default function PricingSignalCard({ context }: Props) {
  const pricing = context?.pricing;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Pricing Intelligence</h3>
      <p className="mt-1 text-xs text-slate-500">Rules-based signal (ML ready)</p>
      <div className="mt-3 text-sm text-slate-700">
        Opportunity: {pricing?.opportunityPct != null ? `${pricing.opportunityPct >= 0 ? '+' : ''}${pricing.opportunityPct}%` : 'N/A'}
      </div>
      <p className="mt-2 text-sm text-slate-700">{pricing?.suggestion || 'No pricing advisory available yet.'}</p>
    </div>
  );
}
