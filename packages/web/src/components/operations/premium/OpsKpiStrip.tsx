import type { ReactNode } from 'react';
import { CloudRain, TrendingDown, TrendingUp, Target, ClipboardList } from 'lucide-react';

type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

function toneStyles(tone: Tone) {
  switch (tone) {
    case 'good':
      return {
        card: 'from-emerald-50/70 via-white to-white ring-emerald-100',
        icon: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
        pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      };
    case 'warn':
      return {
        card: 'from-amber-50/70 via-white to-white ring-amber-100',
        icon: 'bg-amber-100 text-amber-700 ring-amber-200',
        pill: 'bg-amber-50 text-amber-700 ring-amber-200',
      };
    case 'bad':
      return {
        card: 'from-rose-50/70 via-white to-white ring-rose-100',
        icon: 'bg-rose-100 text-rose-700 ring-rose-200',
        pill: 'bg-rose-50 text-rose-700 ring-rose-200',
      };
    case 'info':
      return {
        card: 'from-sky-50/70 via-white to-white ring-sky-100',
        icon: 'bg-sky-100 text-sky-700 ring-sky-200',
        pill: 'bg-sky-50 text-sky-700 ring-sky-200',
      };
    default:
      return {
        card: 'from-slate-50/70 via-white to-white ring-slate-100',
        icon: 'bg-slate-100 text-slate-700 ring-slate-200',
        pill: 'bg-slate-50 text-slate-700 ring-slate-200',
      };
  }
}

function Tile({
  icon,
  label,
  value,
  sub,
  tone = 'neutral',
  pill,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  pill?: string;
}) {
  const s = toneStyles(tone);

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${s.card} p-5 ring-1 shadow-sm`}>
      <div className="pointer-events-none absolute -top-16 right-[-70px] h-40 w-40 rounded-full bg-white/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-[-70px] h-40 w-40 rounded-full bg-white/40 blur-3xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
            {pill ? (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${s.pill}`}>
                {pill}
              </span>
            ) : null}
          </div>

          <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>

          {sub ? (
            <div className="mt-1 line-clamp-2 text-xs text-slate-600">
              {sub}
            </div>
          ) : null}
        </div>

        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 shadow-sm ${s.icon}`}>
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
        <div className="h-[116px] animate-pulse rounded-3xl border border-slate-200 bg-white" />
        <div className="h-[116px] animate-pulse rounded-3xl border border-slate-200 bg-white" />
        <div className="h-[116px] animate-pulse rounded-3xl border border-slate-200 bg-white" />
        <div className="h-[116px] animate-pulse rounded-3xl border border-slate-200 bg-white" />
      </div>
    );
  }

  const weather = context?.weather;
  const pricing = context?.pricingSignal;

  const forecastIsFresh = Boolean(weather?.isFresh);
  const forecastValue = forecastIsFresh ? 'Fresh' : 'Needs refresh';
  const forecastSub = weather?.syncedAtUtc
    ? `Forecast updated ${new Date(weather.syncedAtUtc).toLocaleString()}`
    : 'Forecast not synced yet';
  const forecastTone: Tone = forecastIsFresh ? 'good' : 'warn';
  const forecastPill = forecastIsFresh ? 'OK' : 'STALE';

  const demand: 'up' | 'down' | 'flat' = pricing?.demandTrend ?? 'flat';
  const demandValue = demand === 'up' ? 'Rising' : demand === 'down' ? 'Softening' : 'Stable';
  const demandSub = pricing?.note ?? 'Monitor booking pace';
  const demandTone: Tone = demand === 'up' ? 'info' : demand === 'down' ? 'warn' : 'neutral';

  const demandIcon =
    demand === 'up' ? <TrendingUp className="h-5 w-5" /> : demand === 'down' ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />;

  const coveragePctNum =
    typeof pricing?.marketCoveragePct === 'number' ? pricing.marketCoveragePct : null;

  const coverageValue = coveragePctNum === null ? '-' : `${coveragePctNum}%`;

  const coverageSub =
    typeof pricing?.nightsWithMarket === 'number' && typeof pricing?.nightsTotal === 'number'
      ? `${pricing.nightsWithMarket}/${pricing.nightsTotal} nights`
      : 'Add competitor rates to improve coverage';

  const coverageTone: Tone =
    coveragePctNum === null
      ? 'neutral'
      : coveragePctNum >= 60
        ? 'good'
        : coveragePctNum >= 25
          ? 'warn'
          : 'neutral';

  const coveragePill =
    coveragePctNum === null ? undefined : coveragePctNum >= 60 ? 'STRONG' : coveragePctNum >= 25 ? 'GROWING' : 'LOW';

  const tasksValue = '-';
  const tasksSub = 'Task metrics coming next';
  const tasksTone: Tone = 'neutral';

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Tile
        icon={<CloudRain className="h-5 w-5" />}
        label="Forecast status"
        value={forecastValue}
        sub={forecastSub}
        tone={forecastTone}
        pill={forecastPill}
      />

      <Tile
        icon={demandIcon}
        label="Demand signal"
        value={demandValue}
        sub={demandSub}
        tone={demandTone}
        pill={demand === 'flat' ? 'FLAT' : demand.toUpperCase()}
      />

      <Tile
        icon={<Target className="h-5 w-5" />}
        label="Market coverage"
        value={coverageValue}
        sub={coverageSub}
        tone={coverageTone}
        pill={coveragePill}
      />

      <Tile
        icon={<ClipboardList className="h-5 w-5" />}
        label="Open tasks"
        value={tasksValue}
        sub={tasksSub}
        tone={tasksTone}
      />
    </div>
  );
}

