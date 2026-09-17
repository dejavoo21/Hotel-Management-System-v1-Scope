import { ClipboardList, Loader2, X } from 'lucide-react';
import type { OperationsContext } from '@/services/operations';

type PricingNight = NonNullable<OperationsContext['pricingCalendar']>[number];

const occupancyPercent = (value?: number | null) => Math.round(typeof value === 'number' ? (value <= 1 ? value * 100 : value) : 0);
const signedPercent = (value = 0) => `${value > 0 ? '+' : ''}${Math.round(value)}%`;

export default function PricingTaskDialog({ night, source, pending, onClose, onConfirm }: {
  night: PricingNight;
  source: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const priority = Math.abs(night.suggestedAdjustmentPct || 0) >= 7 ? 'High' : 'Medium';
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Create pricing task" className="w-full max-w-xl rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Prefilled task</p><h2 className="mt-1 text-lg font-semibold text-text-main">Create pricing task</h2><p className="mt-1 text-xs text-text-muted">Review the authorised pricing evidence before creating this operational task.</p></div>
          <button type="button" onClick={onClose} aria-label="Close pricing task" className="grid h-9 w-9 place-items-center rounded-xl border border-border"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 divide-y divide-border rounded-xl border border-border text-sm">
          <TaskRow label="Task" value={`Review rate adjustment ${signedPercent(night.suggestedAdjustmentPct)}`} />
          <TaskRow label="Night" value={night.date} />
          <TaskRow label="Rationale" value={night.reasons?.[0] || 'Pricing guidance recommends a rate review.'} />
          <TaskRow label="Occupancy" value={`${occupancyPercent(night.occupancyForecast)}%`} />
          <TaskRow label="Confidence" value={night.confidence || 'Low'} />
          <TaskRow label="Department" value="Management" />
          <TaskRow label="Priority" value={priority} />
          <TaskRow label="Source" value={source} />
        </div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={pending} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button><button type="button" onClick={onConfirm} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}{pending ? 'Creating…' : 'Create task'}</button></div>
      </section>
    </div>
  );
}

function TaskRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[110px_1fr] gap-3 p-3"><strong className="text-text-main">{label}</strong><span className="text-text-muted">{value}</span></div>;
}
