import type { OperationsContext } from '@/services/operations';

type Advisory = NonNullable<OperationsContext['advisories']>[number];

type Props = {
  advisory: Advisory;
  isCreating?: boolean;
  createdTicketId?: string;
  onCreateTicket: (advisory: Advisory) => void;
  onDismiss: (advisoryId: string) => void;
};

const prettyDepartment = (value?: string) =>
  (value || 'FRONT_DESK')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function AdvisoryCard({
  advisory,
  isCreating = false,
  createdTicketId,
  onCreateTicket,
  onDismiss,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{advisory.title}</div>
          <div className="mt-0.5 text-xs text-indigo-700">
            {prettyDepartment(advisory.department)} - {advisory.priority}
          </div>
          <p className="mt-1 text-xs text-slate-600">{advisory.reason}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={Boolean(createdTicketId) || isCreating}
          onClick={() => onCreateTicket(advisory)}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createdTicketId ? 'Task created' : isCreating ? 'Creating...' : 'Create task'}
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
        >
          Assign
        </button>
        <button
          type="button"
          onClick={() => onDismiss(advisory.id)}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
        >
          Dismiss
        </button>
        {createdTicketId ? (
          <span className="text-[11px] font-medium text-emerald-700">Created: {createdTicketId}</span>
        ) : null}
      </div>
    </div>
  );
}
