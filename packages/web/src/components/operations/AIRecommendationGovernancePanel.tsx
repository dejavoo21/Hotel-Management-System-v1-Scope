import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, ClipboardList, RefreshCcw, ShieldCheck, XCircle } from 'lucide-react';
import { aiRecommendationsService, getApiError } from '@/services';
import type { AIRecommendation, AIRecommendationStatus } from '@/services/aiRecommendations';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types';

const statusTabs: { value: AIRecommendationStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'TASK_CREATED', label: 'Task Created' },
  { value: 'EXPIRED', label: 'Expired' },
];

const priorityClass = (priority: string) => {
  if (priority === 'CRITICAL') return 'border-red-200 bg-red-50 text-red-700';
  if (priority === 'HIGH') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (priority === 'MEDIUM') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

function canGovern(user?: User | null) {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'MANAGER') return true;
  return (user.modulePermissions || []).includes('bookings') || (user.modulePermissions || []).includes('settings');
}

function RecommendationCard({
  recommendation,
  canAct,
  onApprove,
  onReject,
  onCreateTask,
  onExpire,
  isPending,
}: {
  recommendation: AIRecommendation;
  canAct: boolean;
  onApprove: (recommendation: AIRecommendation) => void;
  onReject: (recommendation: AIRecommendation) => void;
  onCreateTask: (recommendation: AIRecommendation) => void;
  onExpire: (recommendation: AIRecommendation) => void;
  isPending: boolean;
}) {
  const canApprove = canAct && recommendation.status === 'PENDING';
  const canReject = canAct && (recommendation.status === 'PENDING' || recommendation.status === 'APPROVED');
  const canCreateTask = canAct && recommendation.status === 'APPROVED' && !recommendation.createdTaskId;
  const canExpire = canAct && (recommendation.status === 'PENDING' || recommendation.status === 'APPROVED');

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{recommendation.title}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityClass(recommendation.priority)}`}>
              {recommendation.priority}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {recommendation.department}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{recommendation.description}</p>
          <p className="mt-2 text-xs text-slate-500">
            Rationale: {recommendation.rationale}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
              Confidence {Math.round(recommendation.confidence * 100)}%
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
              {recommendation.sourceType.replace(/_/g, ' ')}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
              {new Date(recommendation.createdAt).toLocaleString()}
            </span>
            {recommendation.createdTaskId ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                Linked task {recommendation.createdTaskId.slice(0, 8)}
              </span>
            ) : null}
            {recommendation.rejectionReason ? (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                Rejected: {recommendation.rejectionReason}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {canApprove ? (
            <button
              type="button"
              onClick={() => onApprove(recommendation)}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </button>
          ) : null}
          {canCreateTask ? (
            <button
              type="button"
              onClick={() => onCreateTask(recommendation)}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Create task
            </button>
          ) : null}
          {canReject ? (
            <button
              type="button"
              onClick={() => onReject(recommendation)}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </button>
          ) : null}
          {canExpire ? (
            <button
              type="button"
              onClick={() => onExpire(recommendation)}
              disabled={isPending}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Expire
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function AIRecommendationGovernancePanel({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [activeStatus, setActiveStatus] = useState<AIRecommendationStatus>('PENDING');
  const [rejecting, setRejecting] = useState<AIRecommendation | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const userCanGovern = canGovern(user);

  const query = useQuery({
    queryKey: ['ai-recommendations', activeStatus],
    queryFn: () => aiRecommendationsService.list(activeStatus),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });
  const actionMutation = useMutation({
    mutationFn: async ({ action, recommendation }: { action: 'approve' | 'create-task' | 'expire'; recommendation: AIRecommendation }) => {
      if (action === 'approve') return aiRecommendationsService.approve(recommendation.id);
      if (action === 'create-task') return aiRecommendationsService.createTask(recommendation.id);
      return aiRecommendationsService.expire(recommendation.id);
    },
    onSuccess: async (_, variables) => {
      toast.success(variables.action === 'create-task' ? 'Task created' : 'Recommendation updated');
      await invalidate();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejecting) throw new Error('No recommendation selected');
      return aiRecommendationsService.reject(rejecting.id, rejectionReason);
    },
    onSuccess: async () => {
      toast.success('Recommendation rejected');
      setRejecting(null);
      setRejectionReason('');
      await invalidate();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const recommendations = useMemo(() => query.data || [], [query.data]);
  const queryError = query.isError ? getApiError(query.error) : null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">AI Recommendation Governance</h2>
            <p className="mt-1 text-sm text-slate-600">
              Review, approve, reject, expire, or convert Hotel Brain recommendations into governed tasks.
            </p>
            {!userCanGovern ? (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Read-only: approval requires Admin, Manager, or Operations access.
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveStatus(tab.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeStatus === tab.value
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`mt-5 space-y-3 ${compact ? 'max-h-[520px] overflow-y-auto pr-1' : ''}`}>
        {query.isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Loading AI recommendations...
          </div>
        ) : query.isError ? (
          <div className={`rounded-2xl border p-4 text-sm ${
            queryError?.errorCode === 'DATABASE_SCHEMA_MISMATCH'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}>
            {queryError?.errorCode === 'DATABASE_SCHEMA_MISMATCH'
              ? queryError.message
              : 'No AI recommendation queue is available yet. Generate a Daily GM or Department briefing to populate this queue.'}
          </div>
        ) : recommendations.length ? (
          recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
              canAct={userCanGovern}
              isPending={actionMutation.isPending || rejectMutation.isPending}
              onApprove={(item) => actionMutation.mutate({ action: 'approve', recommendation: item })}
              onCreateTask={(item) => actionMutation.mutate({ action: 'create-task', recommendation: item })}
              onExpire={(item) => actionMutation.mutate({ action: 'expire', recommendation: item })}
              onReject={(item) => {
                setRejecting(item);
                setRejectionReason('');
              }}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            No {activeStatus.toLowerCase().replace(/_/g, ' ')} AI recommendations yet. Generate a Daily GM or Department briefing to populate this queue.
          </div>
        )}
      </div>

      {rejecting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Reject recommendation</h3>
            <p className="mt-1 text-sm text-slate-600">{rejecting.title}</p>
            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="ai-rejection-reason">
              Rejection reason
            </label>
            <textarea
              id="ai-rejection-reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Explain why this recommendation should not be acted on."
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejecting(null);
                  setRejectionReason('');
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!rejectionReason.trim()) {
                    toast.error('Rejection reason is required');
                    return;
                  }
                  rejectMutation.mutate();
                }}
                disabled={rejectMutation.isPending}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
