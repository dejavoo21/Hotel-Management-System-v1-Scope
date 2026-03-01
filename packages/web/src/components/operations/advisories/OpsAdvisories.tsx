import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { operationsService, type OperationsContext, type CreateAdvisoryTicketInput } from '@/services/operations';

type Priority = 'low' | 'medium' | 'high';
type AdvisorySource = 'WEATHER_ACTIONS' | string;
type Advisory = {
  id: string;
  title: string;
  reason: string;
  priority: Priority;
  department: string;
  source: AdvisorySource;
  createdTicket?: {
    ticketId: string;
    conversationId: string;
    createdAtUtc: string;
  } | null;
};

type Props = {
  context?: OperationsContext | null;
  onCreateTask?: (advisory: Advisory) => void;
  onAssign?: (advisory: Advisory) => void;
  onDismiss?: (advisory: Advisory) => void;
};

const normalizeDepartment = (value?: string): CreateAdvisoryTicketInput['department'] => {
  const v = (value ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  if (v === 'FRONT_DESK' || v === 'FRONTDESK') return 'FRONT_DESK';
  if (v === 'HOUSEKEEPING') return 'HOUSEKEEPING';
  if (v === 'MAINTENANCE') return 'MAINTENANCE';
  if (v === 'CONCIERGE') return 'CONCIERGE';
  if (v === 'BILLING') return 'BILLING';
  if (v === 'MANAGEMENT') return 'MANAGEMENT';
  return 'FRONT_DESK';
};

function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 9v5" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="7" y="4" width="10" height="16" rx="2" />
      <path d="M9 4h6v3H9z" />
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

function IconShield({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 3 5 6v6c0 5 3 7.5 7 9 4-1.5 7-4 7-9V6l-7-3Z" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function formatTimeAgo(iso?: string) {
  if (!iso) return 'Updated just now';
  const dt = new Date(iso);
  const diffMs = Date.now() - dt.getTime();
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `Updated ${hrs}h ago`;
}

function prettyDepartment(department: string): string {
  return department
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function priorityMeta(priority: Priority) {
  switch (priority) {
    case 'high':
      return {
        label: 'High priority',
        ring: 'ring-rose-200',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        icon: <IconAlertTriangle className="h-4 w-4" />,
      };
    case 'medium':
      return {
        label: 'Medium priority',
        ring: 'ring-amber-200',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        icon: <IconShield className="h-4 w-4" />,
      };
    default:
      return {
        label: 'Low priority',
        ring: 'ring-emerald-200',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        icon: <IconCheckCircle className="h-4 w-4" />,
      };
  }
}

function departmentIcon(dept: string) {
  const d = dept.toLowerCase();
  if (d.includes('front')) return <IconClipboard className="h-4 w-4" />;
  if (d.includes('house')) return <IconCheckCircle className="h-4 w-4" />;
  if (d.includes('maint')) return <IconAlertTriangle className="h-4 w-4" />;
  if (d.includes('concierge')) return <IconShield className="h-4 w-4" />;
  if (d.includes('bill')) return <IconClipboard className="h-4 w-4" />;
  if (d.includes('manage')) return <IconShield className="h-4 w-4" />;
  return <IconCloudRain className="h-4 w-4" />;
}

export default function OpsAdvisories({ context, onCreateTask, onAssign, onDismiss }: Props) {
  const navigate = useNavigate();
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | Priority>('All');
  const [createdFilter, setCreatedFilter] = useState<'ALL' | 'NOT_CREATED' | 'CREATED'>('ALL');
  const [dismissedIds, setDismissedIds] = useState<Record<string, boolean>>({});
  const [createdTicketIds, setCreatedTicketIds] = useState<
    Record<string, { ticketId: string; conversationId: string; createdAtUtc: string }>
  >({});
  const advisories = (context?.advisories ?? []) as Advisory[];
  const updatedLabel = formatTimeAgo(context?.generatedAtUtc);

  const departments = useMemo(() => {
    const set = new Set(advisories.map((a) => a.department).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [advisories]);

  const filtered = useMemo(() => {
    return advisories.filter((a) => {
      if (dismissedIds[a.id]) return false;
      const createdTicket = a.createdTicket ?? createdTicketIds[a.id] ?? null;
      const deptOk = deptFilter === 'All' ? true : a.department === deptFilter;
      const prOk = priorityFilter === 'All' ? true : a.priority === priorityFilter;
      const createdOk =
        createdFilter === 'ALL'
          ? true
          : createdFilter === 'CREATED'
            ? Boolean(createdTicket)
            : !createdTicket;
      return deptOk && prOk && createdOk;
    });
  }, [advisories, deptFilter, priorityFilter, createdFilter, dismissedIds, createdTicketIds]);

  const createTicketMutation = useMutation({
    mutationFn: async (input: { advisoryId: string; advisory: Advisory }) => {
      const { advisory } = input;
      const payload: CreateAdvisoryTicketInput = {
        advisoryId: advisory.id,
        title: advisory.title,
        reason: advisory.reason,
        priority: advisory.priority,
        department: normalizeDepartment(advisory.department),
        source: advisory.source as CreateAdvisoryTicketInput['source'],
        meta: {
          weatherSyncedAtUtc: context?.weather?.syncedAtUtc ?? null,
          generatedAtUtc: context?.generatedAtUtc ?? null,
        },
      };
      const result = await operationsService.createAdvisoryTicket(payload);
      return { result, advisoryId: input.advisoryId };
    },
    onSuccess: ({ result, advisoryId }) => {
      setCreatedTicketIds((prev) => ({
        ...prev,
        [advisoryId]: {
          ticketId: result.ticketId,
          conversationId: result.conversationId,
          createdAtUtc: new Date().toISOString(),
        },
      }));
      const assigneeName = result.assignedTo
        ? `${result.assignedTo.firstName} ${result.assignedTo.lastName}`.trim()
        : null;
      if (result.deduped) {
        toast.success(
          assigneeName
            ? `Ticket already exists for ${prettyDepartment(result.department)} (assigned to ${assigneeName})`
            : `Ticket already exists for ${prettyDepartment(result.department)}`
        );
      } else {
        toast.success(
          assigneeName
            ? `Task created for ${prettyDepartment(result.department)} and assigned to ${assigneeName}`
            : 'Ticket created (Unassigned)'
        );
      }
    },
    onError: (error) => {
      const message =
        (error as any)?.response?.data?.error ||
        (error as Error | null)?.message ||
        'Failed to create ticket';
      toast.error(message);
    },
  });

  const handleCreateTask = (advisory: Advisory) => {
    if (onCreateTask) {
      onCreateTask(advisory);
      return;
    }
    createTicketMutation.mutate({ advisoryId: advisory.id, advisory });
  };

  const handleAssign = (advisory: Advisory) => {
    if (onAssign) {
      onAssign(advisory);
      return;
    }
    toast('Auto-assignment already runs when task is created.');
  };

  const handleDismiss = (advisory: Advisory) => {
    onDismiss?.(advisory);
    setDismissedIds((prev) => ({ ...prev, [advisory.id]: true }));
  };

  const handleViewTask = (createdTicket: NonNullable<Advisory['createdTicket']>) => {
    navigate(`/tickets/${encodeURIComponent(createdTicket.ticketId)}`);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">Operations Advisory</div>
          <div className="mt-1 text-sm text-slate-600">
            Actionable recommendations based on current operational indicators.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            {updatedLabel}
          </span>

          <div className="flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'NOT_CREATED', label: 'Not created' },
              { id: 'CREATED', label: 'Created' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCreatedFilter(tab.id as typeof createdFilter)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                  createdFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
            {(['All', 'low', 'medium', 'high'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p === 'All' ? 'All' : p)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                  (priorityFilter === 'All' && p === 'All') || priorityFilter === p
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'All' ? 'All priorities' : `${p.charAt(0).toUpperCase()}${p.slice(1)}`}
              </button>
            ))}
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm"
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d === 'All' ? 'All departments' : prettyDepartment(d)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
              <IconCheckCircle className="h-5 w-5" />
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-900">No advisories right now</div>
            <div className="mt-1 text-sm text-slate-600">
              You are all set. Refresh context if you want the latest indicators.
            </div>
          </div>
        ) : (
          filtered.map((a) => {
            const meta = priorityMeta(a.priority);
            const createdTicket = a.createdTicket ?? createdTicketIds[a.id] ?? null;
            const creatingThis =
              createTicketMutation.isPending &&
              createTicketMutation.variables?.advisoryId === a.id;

            return (
              <div
                key={a.id}
                className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200 transition group-hover:bg-slate-100">
                        {departmentIcon(a.department)}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {a.title}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                            {prettyDepartment(a.department)}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.bg} ${meta.text} ${meta.ring}`}
                          >
                            {meta.icon}
                            {meta.label}
                          </span>

                          {createdTicket && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                              <IconCheckCircle className="h-3.5 w-3.5" />
                              Created
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-sm leading-relaxed text-slate-600">
                      {a.reason}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {createdTicket ? (
                      <button
                        type="button"
                        onClick={() => handleViewTask(createdTicket)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
                      >
                        <IconClipboard className="h-4 w-4" />
                        View task
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={creatingThis}
                        onClick={() => handleCreateTask(a)}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <IconClipboard className="h-4 w-4" />
                        {creatingThis ? 'Creating...' : 'Create task'}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={Boolean(createdTicket)}
                      onClick={() => handleAssign(a)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Assign
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDismiss(a)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      aria-label="Dismiss"
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
