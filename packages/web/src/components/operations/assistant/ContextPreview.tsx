import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { OperationsContext } from '@/services/operations';

type Props = {
  context?: OperationsContext | null;
};

export default function ContextPreview({ context }: Props) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const sources = useMemo(() => [
    { label: 'Weather', live: Boolean(context?.weather), summary: context?.weather ? `Current weather context: ${context.weather.current?.summary || context.weather.next24h?.summary || 'Connected forecast data'}.` : 'Weather source is unavailable.' },
    { label: 'Operations', live: Boolean(context?.ops), summary: context?.ops ? `${context.ops.arrivalsNext24h || 0} arrivals and ${context.ops.departuresNext24h || 0} departures expected in the next 24 hours.` : 'Operations source is unavailable.' },
    { label: 'Pricing', live: Boolean(context?.pricingSignal), summary: context?.pricingSignal ? `Demand signal is ${context.pricingSignal.demandTrend || 'stable'} with ${context.pricingSignal.confidence || 'unknown'} confidence.` : 'Pricing source is not connected.' },
    { label: 'Calendar', live: Boolean(context?.pricingCalendar?.length), summary: context?.pricingCalendar?.length ? `${context.pricingCalendar.length} pricing-calendar nights are available.` : 'Calendar source is unavailable.' },
    { label: 'Advisories', live: Boolean(context?.advisories?.length), summary: context?.advisories?.length ? `${context.advisories.length} operational advisories are available.` : 'Advisory feed is disconnected or empty.' },
    { label: 'Hotel', live: Boolean(context?.hotelId), summary: context?.hotelId ? 'Authorised hotel identity and operational scope are available.' : 'Hotel context is permission restricted or unavailable.' },
  ], [context]);
  const selected = sources.find((source) => source.label === selectedSource);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div><div className="text-sm font-semibold text-text-main">Context Preview</div><div className="mt-1 text-xs text-text-muted">Live sources currently available to the AI.</div></div>
        <button
          type="button"
          onClick={() => setSelectedSource('All Context Sources')}
          className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-text-muted hover:bg-bg"
        >
          Show
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">{sources.map((source) => <button type="button" key={source.label} onClick={() => setSelectedSource(source.label)} className="rounded-xl border border-border bg-bg/40 p-2 text-center hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"><span className={`mx-auto block h-2 w-2 rounded-full ${source.live ? 'bg-emerald-500' : 'bg-slate-300'}`} /><p className="mt-1 text-[10px] font-semibold text-text-main">{source.label}</p><p className="text-[9px] text-text-muted">{source.live ? 'Live' : 'Unavailable'}</p></button>)}</div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[10px] text-text-muted"><span>Last context refresh</span><span>{context?.generatedAtUtc ? new Date(context.generatedAtUtc).toLocaleString() : 'Not available'}</span></div>
      {selectedSource ? <div className="fixed inset-0 z-[90] flex justify-end bg-slate-950/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSource(null); }}><section role="dialog" aria-modal="true" aria-label={selectedSource} className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-text-main">{selectedSource}</h2><p className="mt-1 text-xs text-text-muted">Permission-filtered operational context used by Ask LaFlo.</p></div><button type="button" onClick={() => setSelectedSource(null)} aria-label={`Close ${selectedSource}`} className="grid h-9 w-9 place-items-center rounded-xl border border-border"><X className="h-4 w-4" /></button></div>{selectedSource === 'All Context Sources' ? <div className="mt-5 space-y-3">{sources.map((source) => <article key={source.label} className="rounded-2xl border border-border p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-text-main">{source.label}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${source.live ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{source.live ? 'Live' : 'Unavailable'}</span></div><p className="mt-2 text-xs leading-5 text-text-muted">{source.summary}</p></article>)}</div> : <div className="mt-5 rounded-2xl border border-border p-4"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${selected?.live ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{selected?.live ? 'Live' : 'Unavailable'}</span><p className="mt-3 text-sm leading-6 text-text-main">{selected?.summary}</p><p className="mt-4 text-xs text-text-muted">Last refresh: {context?.generatedAtUtc ? new Date(context.generatedAtUtc).toLocaleString() : 'Not available'}</p></div>}</section></div> : null}
    </div>
  );
}
