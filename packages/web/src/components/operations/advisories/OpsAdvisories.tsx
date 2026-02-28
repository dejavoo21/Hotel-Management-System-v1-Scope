import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { operationsService, type OperationsContext, type CreateAdvisoryTicketInput } from '@/services/operations';
import AdvisoryCard from './AdvisoryCard';
import AdvisoryFilters from './AdvisoryFilters';

type Props = {
  context?: OperationsContext | null;
};

type Advisory = NonNullable<OperationsContext['advisories']>[number];

const departmentMap: Record<string, CreateAdvisoryTicketInput['department']> = {
  FRONT_DESK: 'FRONT_DESK',
  HOUSEKEEPING: 'HOUSEKEEPING',
  CONCIERGE: 'CONCIERGE',
  MAINTENANCE: 'MAINTENANCE',
  BILLING: 'BILLING',
  MANAGEMENT: 'MANAGEMENT',
  'Front Desk': 'FRONT_DESK',
  Housekeeping: 'HOUSEKEEPING',
  Concierge: 'CONCIERGE',
  Maintenance: 'MAINTENANCE',
  'F&B': 'MANAGEMENT',
};

export default function OpsAdvisories({ context }: Props) {
  const [department, setDepartment] = useState('all');
  const [priority, setPriority] = useState('all');
  const [dismissedIds, setDismissedIds] = useState<Record<string, boolean>>({});
  const [createdTicketIds, setCreatedTicketIds] = useState<Record<string, string>>({});

  const advisories = useMemo(() => {
    const rows = context?.advisories ?? [];
    return rows.filter((row) => {
      if (dismissedIds[row.id]) return false;
      if (department !== 'all' && (row.department || 'FRONT_DESK') !== department) return false;
      if (priority !== 'all' && row.priority !== priority) return false;
      return true;
    });
  }, [context?.advisories, department, priority, dismissedIds]);

  const createTicketMutation = useMutation({
    mutationFn: async (advisory: Advisory) => {
      const payload: CreateAdvisoryTicketInput = {
        advisoryId: advisory.id,
        title: advisory.title,
        reason: advisory.reason,
        priority: advisory.priority,
        department: departmentMap[advisory.department || 'FRONT_DESK'] || 'FRONT_DESK',
        source: advisory.source,
        meta: {
          weatherSyncedAtUtc: context?.weather?.syncedAtUtc ?? null,
          generatedAtUtc: context?.generatedAtUtc ?? null,
        },
      };
      const result = await operationsService.createAdvisoryTicket(payload);
      return { result, advisory };
    },
    onSuccess: ({ result, advisory }) => {
      setCreatedTicketIds((prev) => ({ ...prev, [advisory.id]: result.ticketId }));
      if (result.deduped) {
        toast.success(`Ticket already exists for ${result.department}`);
      } else {
        toast.success(`Task created for ${result.department}`);
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

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Operations Advisory</h2>
        <AdvisoryFilters
          department={department}
          priority={priority}
          onDepartmentChange={setDepartment}
          onPriorityChange={setPriority}
        />
      </div>
      <div className="space-y-2">
        {advisories.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
            No advisories for this filter selection.
          </div>
        ) : (
          advisories.map((advisory) => {
            const creatingThis =
              createTicketMutation.isPending && createTicketMutation.variables?.id === advisory.id;
            return (
              <AdvisoryCard
                key={advisory.id}
                advisory={advisory}
                isCreating={creatingThis}
                createdTicketId={createdTicketIds[advisory.id]}
                onCreateTicket={(item) => createTicketMutation.mutate(item)}
                onDismiss={(id) => setDismissedIds((prev) => ({ ...prev, [id]: true }))}
              />
            );
          })
        )}
      </div>
      {context?.generatedAtUtc ? (
        <div className="text-xs text-slate-500">Context generated {new Date(context.generatedAtUtc).toLocaleString()}</div>
      ) : null}
    </div>
  );
}
