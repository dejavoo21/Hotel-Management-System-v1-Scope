import { useMemo } from 'react';
import type { OperationsContext } from '@/services/operations';

type DemandTrend = 'down' | 'flat' | 'up';
type Confidence = 'low' | 'medium' | 'high';

type Props = {
  context?: OperationsContext | null;
};

function IconCloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M20 15a4 4 0 0 0-1-7.9A6 6 0 0 0 7.1 8.7 3.5 3.5 0 0 0 7.5 15H20Z" />
    </svg>
  );
}

function IconCloudRain({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M20 15a4 4 0 0 0-1-7.9A6 6 0 0 0 7.1 8.7 3.5 3.5 0 0 0 7.5 15H20Z" />
      <path d="m9 17-1 3M13 17l-1 3M17 17l-1 3" />
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

function IconTrendingDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m3 7 6 6 4-4 7 7" />
      <path d="M14 16h6v-6" />
    </svg>
  );
}

function IconMinus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconDollar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 1v22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H7" />
    </svg>
  );
}

function IconActivity({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M22 12h-4l-3 8-4-16-3 8H2" />
    </svg>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPct(n?: number) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '-';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n}%`;
}

function formatTempRange(low?: number | null, high?: number | null) {
  if (typeof low !== 'number' || typeof high !== 'number') return '';
  return `${low.toFixed(1)}C - ${high.toFixed(1)}C`;
}

function riskMeta(risk: 'low' | 'medium' | 'high') {
  if (risk === 'high') {
    return { label: 'High', cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' };
  }
  if (risk === 'medium') {
    return { label: 'Moderate', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' };
  }
  return { label: 'Low', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' };
}

function confidenceMeta(c: Confidence) {
  if (c === 'high') return { label: 'High confidence', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  if (c === 'medium') return { label: 'Medium confidence', cls: 'bg-amber-50 text-amber-700 ring-amber-200' };
  return { label: 'Low confidence', cls: 'bg-slate-50 text-slate-700 ring-slate-200' };
}

function trendMeta(t: DemandTrend) {
  if (t === 'up') return { label: 'Up', icon: <IconTrendingUp className="h-4 w-4" />, cls: 'text-emerald-700' };
  if (t === 'down') return { label: 'Down', icon: <IconTrendingDown className="h-4 w-4" />, cls: 'text-rose-700' };
  return { label: 'Flat', icon: <IconMinus className="h-4 w-4" />, cls: 'text-slate-700' };
}

function cardBase() {
  return 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md';
}

function chip(cls: string) {
  return `inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`;
}

function dot(cls: string) {
  return `h-2 w-2 rounded-full ${cls}`;
}

export default function OpsStatusBar({ context }: Props) {
  const ops = context?.ops ?? {};
  const weather = context?.weather ?? null;
  const pricing = context?.pricingSignal ?? context?.pricing ?? {};

  const arrivals = ops.arrivalsNext24h ?? 0;
  const departures = ops.departuresNext24h ?? 0;
  const inhouse = ops.inhouseNow ?? 0;

  const weatherRisk = useMemo<'low' | 'medium' | 'high'>(() => {
    const r = weather?.next24h?.rainRisk;
    if (r === 'high' || r === 'medium' || r === 'low') return r;
    if (weather?.stale) return 'medium';
    return 'low';
  }, [weather?.next24h?.rainRisk, weather?.stale]);

  const demandTrend = (pricing.demandTrend ?? 'flat') as DemandTrend;
  const opportunityPct = typeof pricing.opportunityPct === 'number' ? pricing.opportunityPct : 0;
  const opportunityScore = clamp(Math.abs(opportunityPct), 0, 20);

  const serviceLoad = useMemo<'light' | 'normal' | 'heavy'>(() => {
    const total = arrivals + departures;
    if (total >= 20) return 'heavy';
    if (total >= 8) return 'normal';
    return 'light';
  }, [arrivals, departures]);

  const serviceLoadChip = useMemo(() => {
    if (serviceLoad === 'heavy') {
      return { label: 'Heavy', cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' };
    }
    if (serviceLoad === 'normal') {
      return { label: 'Normal', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' };
    }
    return { label: 'Light', cls: 'bg-slate-50 text-slate-700 ring-slate-200', dot: 'bg-slate-400' };
  }, [serviceLoad]);

  const wMeta = riskMeta(weatherRisk);
  const tMeta = trendMeta(demandTrend);
  const cMeta = confidenceMeta((pricing.confidence ?? 'low') as Confidence);
  const tempRange = formatTempRange(weather?.next24h?.lowC ?? null, weather?.next24h?.highC ?? null);
  const weatherSummary = weather?.next24h?.summary?.trim() || 'Forecast available';

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className={cardBase()}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
                {weatherRisk === 'high' ? <IconCloudRain className="h-4 w-4" /> : <IconCloud className="h-4 w-4" />}
              </div>
              Weather Risk
            </div>
            <span className={chip(wMeta.cls)}>
              <span className={dot(wMeta.dot)} />
              {wMeta.label}
            </span>
          </div>
          <div className="mt-3 text-sm font-semibold text-slate-900">{weatherSummary}</div>
          <div className="mt-1 text-xs text-slate-500">
            {tempRange ? `Range: ${tempRange}` : weather?.isFresh ? 'Forecast is current' : 'Forecast needs refresh'}
          </div>
        </div>

        <div className={cardBase()}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
                <IconActivity className="h-4 w-4" />
              </div>
              Demand Trend
            </div>
            <div className={`inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold ring-1 ring-slate-200 ${tMeta.cls}`}>
              {tMeta.icon}
              {tMeta.label}
            </div>
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-900">
            {demandTrend === 'up' ? 'Strengthening' : demandTrend === 'down' ? 'Softening' : 'Stable'}
          </div>
          <div className="mt-1 text-xs text-slate-500">Based on arrivals vs departures next 24h</div>
        </div>

        <div className={cardBase()}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
                <IconUsers className="h-4 w-4" />
              </div>
              In-house Now
            </div>
            <span className={chip('bg-slate-50 text-slate-700 ring-slate-200')}>{inhouse <= 1 ? 'Quiet' : 'Active'}</span>
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-900">{inhouse}</div>
          <div className="mt-1 text-xs text-slate-500">Guests currently checked-in</div>
        </div>

        <div className={cardBase()}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
                <IconDollar className="h-4 w-4" />
              </div>
              Pricing Opportunity
            </div>
            <span className={chip(cMeta.cls)}>{cMeta.label}</span>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div className="text-2xl font-semibold text-slate-900">{formatPct(opportunityPct)}</div>
            <div className="text-xs font-semibold text-slate-500">{opportunityScore.toFixed(0)}/20</div>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-slate-900" style={{ width: `${(opportunityScore / 20) * 100}%` }} />
          </div>
          <div className="mt-2 text-xs text-slate-500">Signal strength (rule-based)</div>
        </div>

        <div className={cardBase()}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
                <IconActivity className="h-4 w-4" />
              </div>
              Service Load
            </div>
            <span className={chip(serviceLoadChip.cls)}>
              <span className={dot(serviceLoadChip.dot)} />
              {serviceLoadChip.label}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">Arrivals</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{arrivals}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">Departures</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{departures}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Pricing Signal</div>
              <div className="mt-1 text-sm text-slate-600">{pricing?.suggestion?.trim() || 'No pricing advisory available yet.'}</div>
            </div>
            <span className={chip(cMeta.cls)}>{cMeta.label}</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs font-semibold text-slate-500">Demand</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className={`inline-flex items-center gap-1 ${tMeta.cls}`}>
                  {tMeta.icon}
                  {tMeta.label}
                </span>
                <span className="text-slate-400">-</span>
                <span className="text-slate-700">
                  {demandTrend === 'up' ? 'Strengthening' : demandTrend === 'down' ? 'Softening' : 'Stable'}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs font-semibold text-slate-500">Opportunity</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{formatPct(opportunityPct)}</div>
              <div className="mt-1 text-xs text-slate-500">Suggested rate adjustment</div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs font-semibold text-slate-500">Confidence</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{cMeta.label}</div>
              <div className="mt-1 text-xs text-slate-500">{weather?.isFresh ? 'Forecast current' : 'Refresh forecast for accuracy'}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Executive Summary</div>
          <div className="mt-2 text-sm text-slate-600">
            {demandTrend === 'up'
              ? 'Demand is building. Consider controlled rate lift and watch booking pace closely.'
              : demandTrend === 'down'
                ? 'Demand is softer. Consider value add or short promos to stabilize occupancy.'
                : 'Demand is stable. Keep rates steady and monitor signal changes.'}
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-xs font-semibold text-slate-500">Focus today</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {weatherRisk === 'high' ? 'Prepare weather contingency' : serviceLoad === 'heavy' ? 'Staff allocation and check-in flow' : 'Routine operations'}
            </div>
            <div className="mt-1 text-xs text-slate-500">Based on operational indicators.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

