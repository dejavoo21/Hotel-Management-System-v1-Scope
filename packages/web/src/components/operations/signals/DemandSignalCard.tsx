import type { OperationsContext } from '@/services/operations';

type Props = {
  context?: OperationsContext | null;
};

export default function DemandSignalCard({ context }: Props) {
  const pricing = context?.pricingSignal ?? context?.pricing;
  const trend = pricing?.demandTrend || 'flat';
  const tone =
    trend === 'up'
      ? 'bg-rose-100 text-rose-700'
      : trend === 'down'
        ? 'bg-sky-100 text-sky-700'
        : 'bg-slate-100 text-slate-700';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Demand Forecast</h3>
      <p className="mt-1 text-xs text-slate-500">Signal from arrivals vs departures</p>
      <div className="mt-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{trend}</span>
      </div>
      <p className="mt-3 text-sm text-slate-700">
        Confidence: {pricing?.confidence || 'low'}
      </p>
    </div>
  );
}
