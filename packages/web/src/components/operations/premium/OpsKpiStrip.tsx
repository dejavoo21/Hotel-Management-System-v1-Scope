import { useMemo } from 'react';
import { Cloud, TrendingDown, TrendingUp, Target, ClipboardList } from 'lucide-react';
import type { OperationsContext } from '@/services/operations';

type Props = {
  context?: OperationsContext | null;
  isLoading?: boolean;
};

function Card({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = 'neutral',
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  tone?: 'good' | 'warn' | 'bad' | 'info' | 'neutral';
}) {
  const toneClass =
    tone === 'good'
      ? 'from-emerald-50 to-white ring-emerald-100'
      : tone === 'warn'
        ? 'from-amber-50 to-white ring-amber-100'
        : tone === 'bad'
          ? 'from-rose-50 to-white ring-rose-100'
          : tone === 'info'
            ? 'from-sky-50 to-white ring-sky-100'
            : 'from-slate-50 to-white ring-slate-100';

  const iconTone =
    tone === 'good'
      ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
      : tone === 'warn'
        ? 'bg-amber-100 text-amber-700 ring-amber-200'
        : tone === 'bad'
          ? 'bg-rose-100 text-rose-700 ring-rose-200'
          : tone === 'info'
            ? 'bg-sky-100 text-sky-700 ring-sky-200'
            : 'bg-slate-100 text-slate-700 ring-slate-200';

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${toneClass} p-5 ring-1 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
          {subtitle ? <div className="mt-1 text-xs text-slate-600">{subtitle}</div> : null}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${iconTone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function OpsKpiStrip({ context, isLoading }: Props) {
  const items = useMemo(() => {
    if (isLoading) {
      return [
        { title: 'Forecast status', value: '...', subtitle: 'Loading', icon: Cloud, tone: 'info' as const },
        { title: 'Demand signal', value: '...', subtitle: 'Loading', icon: Target, tone: 'neutral' as const },
        { title: 'Market coverage', value: '...', subtitle: 'Loading', icon: TrendingUp, tone: 'neutral' as const },
        { title: 'Open tasks', value: '...', subtitle: 'Loading', icon: ClipboardList, tone: 'neutral' as const },
      ];
    }

    const forecastFresh = Boolean(context?.weather?.isFresh);
    const demandTrend = (context?.pricingSignal?.demandTrend ?? 'flat') as 'up' | 'down' | 'flat';
    const coveragePct = Number(context?.pricingSignal?.marketCoveragePct ?? 0);
    const nightsWithMarket = Number(context?.pricingSignal?.nightsWithMarket ?? 0);
    const nightsTotal = Number(context?.pricingSignal?.nightsTotal ?? 0);
    const openTasks = null;

    return [
      {
        title: 'Forecast status',
        value: forecastFresh ? 'Fresh' : 'Stale',
        subtitle: forecastFresh ? 'Forecast is current' : 'Refresh recommended',
        icon: Cloud,
        tone: forecastFresh ? ('good' as const) : ('warn' as const),
      },
      {
        title: 'Demand signal',
        value: demandTrend === 'up' ? 'Rising' : demandTrend === 'down' ? 'Softening' : 'Stable',
        subtitle: context?.pricingSignal?.note ?? 'Monitor booking pace',
        icon: demandTrend === 'up' ? TrendingUp : demandTrend === 'down' ? TrendingDown : Target,
        tone: demandTrend === 'down' ? ('warn' as const) : ('info' as const),
      },
      {
        title: 'Market coverage',
        value: `${coveragePct}%`,
        subtitle: `${nightsWithMarket}/${nightsTotal} nights`,
        icon: TrendingUp,
        tone: coveragePct >= 60 ? ('good' as const) : coveragePct >= 25 ? ('warn' as const) : ('neutral' as const),
      },
      {
        title: 'Open tasks',
        value: openTasks === null ? '-' : String(openTasks),
        subtitle: openTasks === null ? 'Task metrics coming next' : 'Live tasks in queue',
        icon: ClipboardList,
        tone: openTasks === null ? ('neutral' as const) : openTasks > 0 ? ('warn' as const) : ('good' as const),
      },
    ];
  }, [context, isLoading]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((x) => (
        <Card key={x.title} {...x} />
      ))}
    </div>
  );
}

