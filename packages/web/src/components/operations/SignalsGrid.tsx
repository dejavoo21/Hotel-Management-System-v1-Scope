import { useMemo } from 'react';
import type { OperationsContext } from '@/services/operations';

type Props = {
  context?: OperationsContext | null;
  onRefreshWeather?: () => void;
  isRefreshingWeather?: boolean;
};

function IconCloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M20 15a4 4 0 0 0-1-7.9A6 6 0 0 0 7.1 8.7 3.5 3.5 0 0 0 7.5 15H20Z" />
    </svg>
  );
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function IconCalendarClock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M8 2v4M16 2v4M3 10h18" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 14v3l2 1" />
      <circle cx="16" cy="17" r="4" />
    </svg>
  );
}

function IconTrendingUp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m3 17 6-6 4 4 7-7" />
      <path d="M14 8h6v6" />
    </svg>
  );
}

function IconThermometer({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M14 14.76V5a2 2 0 1 0-4 0v9.76a4 4 0 1 0 4 0Z" />
      <path d="M12 9v8" />
    </svg>
  );
}

function card() {
  return 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md';
}
function chip(cls: string) {
  return `inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`;
}
function dot(cls: string) {
  return `h-2 w-2 rounded-full ${cls}`;
}

export default function SignalsGrid({ context, onRefreshWeather, isRefreshingWeather = false }: Props) {
  const weather = context?.weather ?? null;
  const ops = context?.ops ?? null;
  const pricing = context?.pricingSignal ?? context?.pricing ?? null;
  const weatherFresh = Boolean(weather?.isFresh);
  const stale = Boolean(weather?.stale);

  const weatherMeta = useMemo(() => {
    const risk = weather?.next24h?.rainRisk ?? (stale ? 'medium' : 'low');
    if (risk === 'high') return { label: 'High', cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' };
    if (risk === 'medium') return { label: 'Moderate', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' };
    return { label: 'Low', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' };
  }, [weather?.next24h?.rainRisk, stale]);

  const summary = weather?.next24h?.summary?.trim() || 'Forecast available';
  const lowC = weather?.next24h?.lowC;
  const highC = weather?.next24h?.highC;
  const tempRange = typeof lowC === 'number' && typeof highC === 'number' ? `${lowC.toFixed(1)}C - ${highC.toFixed(1)}C` : null;

  const arrivals = ops?.arrivalsNext24h ?? 0;
  const departures = ops?.departuresNext24h ?? 0;
  const inhouse = ops?.inhouseNow ?? 0;

  const demandTrend = pricing?.demandTrend ?? 'flat';
  const opportunityPct = typeof pricing?.opportunityPct === 'number' ? pricing.opportunityPct : 0;
  const confidence = pricing?.confidence ?? 'low';

  const confidenceChip =
    confidence === 'high'
      ? chip('bg-emerald-50 text-emerald-700 ring-emerald-200')
      : confidence === 'medium'
        ? chip('bg-amber-50 text-amber-700 ring-amber-200')
        : chip('bg-slate-50 text-slate-700 ring-slate-200');

  const trendLabel = demandTrend === 'up' ? 'Up' : demandTrend === 'down' ? 'Down' : 'Flat';

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Operational Indicators</div>
          <div className="mt-1 text-sm text-slate-600">
            Forecast-driven indicators used for staffing, service readiness, and pricing decisions.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={card()}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                <IconCloud className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Weather Outlook</div>
                <div className="text-xs text-slate-500">Forecast-based operational planning</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={chip(weatherMeta.cls)}>
                <span className={dot(weatherMeta.dot)} />
                Risk {weatherMeta.label}
              </span>

              <button
                type="button"
                onClick={() => onRefreshWeather?.()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isRefreshingWeather || !onRefreshWeather}
                title="Sync weather"
              >
                <IconRefresh className={`h-4 w-4 ${isRefreshingWeather ? 'animate-spin' : ''}`} />
                {isRefreshingWeather ? 'Syncing' : 'Sync'}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs font-semibold text-slate-500">Summary</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{summary}</div>
              <div className="mt-1 text-xs text-slate-500">{tempRange ? `Range: ${tempRange}` : '-'}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs font-semibold text-slate-500">Freshness</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{weatherFresh ? 'Current' : 'Needs refresh'}</div>
              <div className="mt-1 text-xs text-slate-500">
                {weather?.syncedAtUtc ? `Last sync: ${new Date(weather.syncedAtUtc).toLocaleString()}` : 'No sync recorded'}
              </div>
            </div>
          </div>
        </div>

        <div className={card()}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                <IconCalendarClock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Arrival Forecast</div>
                <div className="text-xs text-slate-500">Operational load next 24h</div>
              </div>
            </div>

            <span className={chip('bg-slate-50 text-slate-700 ring-slate-200')}>
              <span className={dot('bg-slate-400')} />
              Live
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">Arrivals</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{arrivals}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">Departures</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{departures}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">In-house</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{inhouse}</div>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500">Window is calculated from booking activity and current occupancy.</div>
        </div>

        <div className={card()}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                <IconTrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Demand Forecast</div>
                <div className="text-xs text-slate-500">Signal from arrivals vs departures</div>
              </div>
            </div>

            <span className={chip('bg-slate-50 text-slate-700 ring-slate-200')}>{trendLabel}</span>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-xs font-semibold text-slate-500">Interpretation</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {demandTrend === 'up'
                ? 'Demand is strengthening - watch pickup and staffing.'
                : demandTrend === 'down'
                  ? 'Demand is softening - consider promos and channel mix.'
                  : 'Demand is stable - keep monitoring pace.'}
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500">Used by pricing and advisory modules.</div>
        </div>

        <div className={card()}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                <IconThermometer className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Pricing Intelligence</div>
                <div className="text-xs text-slate-500">Rule-based signal (model-ready)</div>
              </div>
            </div>

            <span className={confidenceChip}>
              {confidence === 'high' ? 'High confidence' : confidence === 'medium' ? 'Medium confidence' : 'Low confidence'}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs font-semibold text-slate-500">Opportunity</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {opportunityPct > 0 ? `+${opportunityPct}%` : `${opportunityPct}%`}
              </div>
              <div className="mt-1 text-xs text-slate-500">Suggested adjustment</div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs font-semibold text-slate-500">Recommendation</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {pricing?.suggestion?.trim() || pricing?.note?.trim() || 'Keep current rates and monitor booking pace.'}
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500">This becomes ML-driven once competitor rates + pickup + seasonality are connected.</div>
        </div>
      </div>
    </section>
  );
}

