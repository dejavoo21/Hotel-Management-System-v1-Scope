import { useState } from 'react';
import type { OperationsContext } from '@/services/operations';

type Props = {
  context?: OperationsContext | null;
};

export default function ContextPreview({ context }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div><div className="text-sm font-semibold text-text-main">Context Preview</div><div className="mt-1 text-xs text-text-muted">Live sources currently available to the AI.</div></div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-text-muted hover:bg-bg"
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">{[
        ['Weather', Boolean(context?.weather)], ['Operations', Boolean(context?.ops)], ['Pricing', Boolean(context?.pricingSignal)],
        ['Calendar', Boolean(context?.pricingCalendar?.length)], ['Advisories', Boolean(context?.advisories?.length)], ['Hotel', Boolean(context?.hotelId)],
      ].map(([label, live]) => <div key={String(label)} className="rounded-xl border border-border bg-bg/40 p-2 text-center"><span className={`mx-auto block h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-slate-300'}`} /><p className="mt-1 text-[10px] font-semibold text-text-main">{label}</p><p className="text-[9px] text-text-muted">{live ? 'Live' : 'No data'}</p></div>)}</div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[10px] text-text-muted"><span>Last context refresh</span><span>{context?.generatedAtUtc ? new Date(context.generatedAtUtc).toLocaleString() : 'Not available'}</span></div>
      {open ? (
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-950 p-2 text-[10px] leading-4 text-slate-100">
          {JSON.stringify(context ?? {}, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
