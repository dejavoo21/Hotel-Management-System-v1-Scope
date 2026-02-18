import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { conciergeService } from '@/services';
import toast from 'react-hot-toast';
import { formatEnumLabel } from '@/utils/format';
import { useAuthStore } from '@/stores/authStore';
import { appendAuditLog } from '@/utils/auditLog';
import type { ConciergeRequest } from '@/types';

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

const priorityStyles: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-emerald-50 text-emerald-700',
  HIGH: 'bg-amber-50 text-amber-700',
  URGENT: 'bg-red-50 text-red-700',
};

export default function ConciergePage() {
  const { user: currentUser } = useAuthStore();
  const { data: requests, isLoading } = useQuery({
    queryKey: ['concierge-requests'],
    queryFn: () => conciergeService.list(),
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [draftRequest, setDraftRequest] = useState({
    title: '',
    details: '',
    priority: 'MEDIUM' as ConciergeRequest['priority'],
    dueAt: '',
  });
  const [localRequests, setLocalRequests] = useState<ConciergeRequest[]>([]);

  const combinedRequests = useMemo(
    () => [...localRequests, ...(requests ?? [])],
    [localRequests, requests]
  );

  const stats = useMemo(() => {
    const list = combinedRequests;
    const statusCounts = list.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});
    const urgent = list.filter((item) => item.priority === 'URGENT').length;
    const assigned = list.filter((item) => item.assignedTo).length;
    return {
      total: list.length,
      statusCounts,
      urgent,
      assigned,
    };
  }, [combinedRequests]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Concierge</h1>
        <p className="mt-1 text-sm text-slate-500">Track guest requests and VIP services.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">Active requests</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {(stats.statusCounts.PENDING ?? 0) + (stats.statusCounts.IN_PROGRESS ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Pending and in progress</p>
        </div>
        <div className="card card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">Urgent</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{stats.urgent}</p>
          <p className="mt-1 text-xs text-slate-500">Needs immediate attention</p>
        </div>
        <div className="card card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">Assigned</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{stats.assigned}</p>
          <p className="mt-1 text-xs text-slate-500">With staff owner</p>
        </div>
        <div className="card card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">Completed</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{stats.statusCounts.COMPLETED ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">This cycle</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Active requests</h2>
            <button className="btn-outline" type="button" onClick={() => setShowCreateModal(true)}>
              New request
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {isLoading ? (
              [...Array(4)].map((_, i) => <div key={i} className="h-16 animate-shimmer rounded-xl" />)
            ) : combinedRequests.length > 0 ? (
              combinedRequests.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.room?.number ? `Room ${item.room.number}` : 'Guest request'}
                      {item.guest ? ` - ${item.guest.firstName} ${item.guest.lastName}` : ''}
                    </p>
                    <p className="text-sm text-slate-600">{item.title}</p>
                    {item.details ? <p className="text-xs text-slate-500">{item.details}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityStyles[item.priority]}`}>
                      {item.priority}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[item.status]}`}>
                      {formatEnumLabel(item.status)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {item.dueAt ? new Date(item.dueAt).toLocaleString() : 'No due time'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No concierge requests available.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900">Queue breakdown</h2>
            <p className="text-sm text-slate-500">Status distribution for today.</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Pending</span>
                <span className="font-semibold text-slate-900">{stats.statusCounts.PENDING ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>In progress</span>
                <span className="font-semibold text-slate-900">{stats.statusCounts.IN_PROGRESS ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Completed</span>
                <span className="font-semibold text-slate-900">{stats.statusCounts.COMPLETED ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cancelled</span>
                <span className="font-semibold text-slate-900">{stats.statusCounts.CANCELLED ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900">Assignments</h2>
            <p className="text-sm text-slate-500">Owners and escalation.</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Assigned requests</span>
                <span className="font-semibold text-slate-900">{stats.assigned}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Unassigned</span>
                <span className="font-semibold text-slate-900">
                  {stats.total - stats.assigned}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Urgent SLA</span>
                <span className="font-semibold text-slate-900">{stats.urgent}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">New Concierge Request</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!draftRequest.title.trim()) {
                  toast.error('Title is required');
                  return;
                }
                const newItem: ConciergeRequest = {
                  id: (globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}`),
                  title: draftRequest.title.trim(),
                  details: draftRequest.details.trim() || undefined,
                  priority: draftRequest.priority,
                  status: 'PENDING',
                  createdAt: new Date().toISOString(),
                  dueAt: draftRequest.dueAt ? new Date(draftRequest.dueAt).toISOString() : undefined,
                };
                setLocalRequests((prev) => [newItem, ...prev]);
                appendAuditLog({
                  action: 'CONCIERGE_REQUEST_CREATED',
                  actorId: currentUser?.id,
                  actorName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System',
                  targetLabel: draftRequest.title,
                  details: {
                    priority: draftRequest.priority,
                    dueAt: draftRequest.dueAt,
                  },
                });
                setDraftRequest({ title: '', details: '', priority: 'MEDIUM', dueAt: '' });
                setShowCreateModal(false);
                toast.success('Request created (local only)');
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="label">Title *</label>
                <input
                  className="input"
                  value={draftRequest.title}
                  onChange={(event) =>
                    setDraftRequest((prev) => ({ ...prev, title: event.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="label">Details</label>
                <textarea
                  className="input"
                  rows={3}
                  value={draftRequest.details}
                  onChange={(event) =>
                    setDraftRequest((prev) => ({ ...prev, details: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Priority</label>
                  <select
                    className="input"
                    value={draftRequest.priority}
                    onChange={(event) =>
                      setDraftRequest((prev) => ({
                        ...prev,
                        priority: event.target.value as ConciergeRequest['priority'],
                      }))
                    }
                  >
                    {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Due at</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={draftRequest.dueAt}
                    onChange={(event) =>
                      setDraftRequest((prev) => ({ ...prev, dueAt: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Create Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

