import type { OperationsContext } from '@/services/operations';

type Props = {
  context?: OperationsContext | null;
};

export default function ArrivalsSignalCard({ context }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Arrival Forecast</h3>
      <p className="mt-1 text-xs text-slate-500">Operational load next 24h</p>
      <div className="mt-3 space-y-1 text-sm text-slate-700">
        <div>Arrivals expected: {context?.ops?.arrivalsNext24h ?? 0}</div>
        <div>Departures expected: {context?.ops?.departuresNext24h ?? 0}</div>
        <div>In-house now: {context?.ops?.inhouseNow ?? 0}</div>
      </div>
    </div>
  );
}
