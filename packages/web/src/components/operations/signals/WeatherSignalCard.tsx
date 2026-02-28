import type { OperationsContext } from '@/services/operations';

type Props = {
  context?: OperationsContext | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

export default function WeatherSignalCard({ context, onRefresh, isRefreshing = false }: Props) {
  const weather = context?.weather;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Weather Outlook</h3>
          <p className="mt-1 text-xs text-slate-500">Forecast-based operational planning</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {isRefreshing ? 'Syncing...' : 'Sync'}
        </button>
      </div>
      <div className="mt-3 space-y-1 text-sm text-slate-700">
        <div>Summary: {weather?.next24h?.summary || 'No forecast summary yet'}</div>
        <div>
          Range:{' '}
          {weather?.next24h?.lowC != null && weather?.next24h?.highC != null
            ? `${weather.next24h.lowC}C to ${weather.next24h.highC}C`
            : 'Not available'}
        </div>
        <div>Risk: {weather?.next24h?.rainRisk || 'low'}</div>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {weather?.syncedAtUtc ? `Synced: ${new Date(weather.syncedAtUtc).toLocaleString()}` : 'Not synced yet'}
      </div>
    </div>
  );
}
