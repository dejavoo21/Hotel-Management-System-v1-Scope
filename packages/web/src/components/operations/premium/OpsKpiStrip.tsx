import type { ReactNode } from 'react';
import { CloudRain, TrendingUp, Target, ClipboardList } from 'lucide-react';

function Tile({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
          {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function OpsKpiStrip({ context, isLoading }: { context: any; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="h-[104px] rounded-3xl border border-slate-200 bg-white" />
        <div className="h-[104px] rounded-3xl border border-slate-200 bg-white" />
        <div className="h-[104px] rounded-3xl border border-slate-200 bg-white" />
        <div className="h-[104px] rounded-3xl border border-slate-200 bg-white" />
      </div>
    );
  }

  const weather = context?.weather;
  const pricing = context?.pricingSignal;

  const forecastFresh = weather?.isFresh ? 'Fresh' : 'Needs refresh';
  const forecastSub = weather?.syncedAtUtc
    ? `Forecast updated ${new Date(weather.syncedAtUtc).toLocaleString()}`
    : 'Forecast not synced yet';

  const demand = pricing?.demandTrend ?? 'flat';
  const demandValue = demand === 'up' ? 'Rising' : demand === 'down' ? 'Softening' : 'Stable';

  const coverage = typeof pricing?.marketCoveragePct === 'number' ? `${pricing.marketCoveragePct}%` : '-';
  const coverageSub =
    typeof pricing?.nightsWithMarket === 'number' && typeof pricing?.nightsTotal === 'number'
      ? `${pricing.nightsWithMarket}/${pricing.nightsTotal} nights`
      : 'Add competitor rates to improve coverage';

  const tasksValue = '-';
  const tasksSub = 'Task metrics coming next';

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Tile
        icon={<CloudRain className="h-5 w-5" />}
        label="Forecast status"
        value={forecastFresh}
        sub={forecastSub}
      />
      <Tile
        icon={<TrendingUp className="h-5 w-5" />}
        label="Demand signal"
        value={demandValue}
        sub={pricing?.note ?? '-'}
      />
      <Tile
        icon={<Target className="h-5 w-5" />}
        label="Market coverage"
        value={coverage}
        sub={coverageSub}
      />
      <Tile
        icon={<ClipboardList className="h-5 w-5" />}
        label="Open tasks"
        value={tasksValue}
        sub={tasksSub}
      />
    </div>
  );
}
