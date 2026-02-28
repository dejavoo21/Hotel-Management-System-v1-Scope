import { useState } from 'react';
import type { OperationsContext } from '@/services/operations';

type Props = {
  context?: OperationsContext | null;
};

export default function ContextPreview({ context }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Context Preview</div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open ? (
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-950 p-2 text-[10px] leading-4 text-slate-100">
          {JSON.stringify(context ?? {}, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
