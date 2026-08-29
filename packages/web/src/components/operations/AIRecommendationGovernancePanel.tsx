import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, Bot, CheckCircle2, ClipboardList, Eye, ExternalLink, History, MessageSquare, RefreshCcw, ShieldCheck, UserPlus, X, XCircle } from 'lucide-react';
import { aiRecommendationsService, getApiError } from '@/services';
import type { AIRecommendation, AIRecommendationStatus } from '@/services/aiRecommendations';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types';
import { appendAuditLog } from '@/utils/auditLog';
import { openLafloAssistant } from '@/lib/assistantEvents';

type GovernanceTarget = { status?: AIRecommendationStatus; priority?: string; department?: string; recommendationId?: string };
type NoteState = { owner?: string; comments: { text: string; at: string; author: string }[] };
const notesKey = 'laflo:ai-governance-notes';
const readNotes = (): Record<string, NoteState> => {
  try { return JSON.parse(localStorage.getItem(notesKey) || '{}'); } catch { return {}; }
};

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
  return 'border-border bg-bg text-text-muted';
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
  onInspect,
  onAssign,
  onComment,
  onAsk,
  note,
  isPending,
}: {
  recommendation: AIRecommendation;
  canAct: boolean;
  onApprove: (recommendation: AIRecommendation) => void;
  onReject: (recommendation: AIRecommendation) => void;
  onCreateTask: (recommendation: AIRecommendation) => void;
  onExpire: (recommendation: AIRecommendation) => void;
  onInspect: (recommendation: AIRecommendation, view: 'details' | 'source' | 'audit') => void;
  onAssign: (recommendation: AIRecommendation) => void;
  onComment: (recommendation: AIRecommendation) => void;
  onAsk: (recommendation: AIRecommendation) => void;
  note?: NoteState;
  isPending: boolean;
}) {
  const canApprove = canAct && recommendation.status === 'PENDING';
  const canReject = canAct && (recommendation.status === 'PENDING' || recommendation.status === 'APPROVED');
  const canCreateTask = canAct && recommendation.status === 'APPROVED' && !recommendation.createdTaskId;
  const canExpire = canAct && (recommendation.status === 'PENDING' || recommendation.status === 'APPROVED');

  return (
    <article id={`recommendation-${recommendation.id}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-text-main">{recommendation.title}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityClass(recommendation.priority)}`}>
              {recommendation.priority}
            </span>
            <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[11px] font-medium text-text-muted">
              {recommendation.department}
            </span>
          </div>
          <p className="mt-2 text-sm text-text-muted">{recommendation.description}</p>
          <p className="mt-2 text-xs text-text-muted">
            Rationale: {recommendation.rationale}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
            <span className="rounded-full border border-border bg-bg px-2 py-0.5">
              Confidence {Math.round(recommendation.confidence * 100)}%
            </span>
            <span className="rounded-full border border-border bg-bg px-2 py-0.5">
              {recommendation.sourceType.replace(/_/g, ' ')}
            </span>
            <span className="rounded-full border border-border bg-bg px-2 py-0.5">
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
            {note?.owner ? <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">Owner: {note.owner}</span> : null}
            {note?.comments.length ? <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">{note.comments.length} comment{note.comments.length === 1 ? '' : 's'}</span> : null}
          </div>
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Recommendation actions</p>
          <div className="flex flex-wrap gap-2">
          {canApprove ? (
            <button
              type="button"
              onClick={() => onApprove(recommendation)}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-primary-contrast hover:bg-emerald-700 disabled:opacity-60"
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-solid px-3 py-2 text-xs font-semibold text-primary-contrast hover:opacity-90 disabled:opacity-60"
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-card px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
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
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-text-muted hover:bg-bg disabled:opacity-60"
            >
              Expire
            </button>
          ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 border-t border-dashed border-border pt-2">
          <button type="button" onClick={() => onInspect(recommendation, 'details')} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-text-muted hover:bg-bg"><Eye className="h-3.5 w-3.5" />View details</button>
          <button type="button" onClick={() => onInspect(recommendation, 'source')} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-text-muted hover:bg-bg"><ExternalLink className="h-3.5 w-3.5" />View source</button>
          <button type="button" disabled={!canAct} onClick={() => onAssign(recommendation)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-muted disabled:cursor-not-allowed disabled:opacity-50"><UserPlus className="h-3.5 w-3.5" />Assign owner</button>
          <button type="button" disabled={!canAct} onClick={() => onComment(recommendation)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-muted disabled:cursor-not-allowed disabled:opacity-50"><MessageSquare className="h-3.5 w-3.5" />Add comment</button>
          <button type="button" onClick={() => onInspect(recommendation, 'audit')} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-text-muted hover:bg-bg"><History className="h-3.5 w-3.5" />Audit trail</button>
          <button type="button" onClick={() => onAsk(recommendation)} className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100"><Bot className="h-3.5 w-3.5" />Ask LaFlo about this recommendation</button>
          </div>
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
  const [expiring, setExpiring] = useState<AIRecommendation | null>(null);
  const [creatingTask, setCreatingTask] = useState<AIRecommendation | null>(null);
  const [assigning, setAssigning] = useState<AIRecommendation | null>(null);
  const [commenting, setCommenting] = useState<AIRecommendation | null>(null);
  const [notes] = useState<Record<string, NoteState>>(readNotes);
  const [target, setTarget] = useState<GovernanceTarget>({});
  const [rejectionReason, setRejectionReason] = useState('');
  const [inspection, setInspection] = useState<{ recommendation: AIRecommendation; view: 'details' | 'source' | 'audit' } | null>(null);
  const userCanGovern = canGovern(user);

  useEffect(() => {
    const handleTarget = (event: Event) => {
      const detail = (event as CustomEvent<GovernanceTarget>).detail || {};
      setTarget(detail);
      setActiveStatus(detail.status || 'PENDING');
      requestAnimationFrame(() => document.getElementById('ai-recommendation-governance')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    window.addEventListener('laflo:governance-filter', handleTarget);
    return () => window.removeEventListener('laflo:governance-filter', handleTarget);
  }, []);

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
      audit(`AI Recommendation ${variables.action === 'create-task' ? 'Task Created' : variables.action === 'approve' ? 'Approved' : 'Expired'}`, variables.recommendation);
      await invalidate();
      if (variables.action === 'expire') setExpiring(null);
      if (variables.action === 'create-task') setCreatingTask(null);
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
      if (rejecting) audit('AI Recommendation Rejected', rejecting, { reason: rejectionReason.trim() || 'No reason provided' });
      setRejecting(null);
      setRejectionReason('');
      await invalidate();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const recommendations = useMemo(() => (query.data || []).filter((item) => {
    if (target.priority === 'HIGH_OR_CRITICAL' && !['HIGH', 'CRITICAL'].includes(item.priority)) return false;
    if (target.priority && target.priority !== 'HIGH_OR_CRITICAL' && item.priority !== target.priority) return false;
    if (target.department && !item.department.toLowerCase().includes(target.department.toLowerCase().replace(/\s+/g, '_'))) return false;
    if (target.recommendationId && item.id !== target.recommendationId) return false;
    return true;
  }), [query.data, target]);
  const queryError = query.isError ? getApiError(query.error) : null;
  const audit = (action: string, recommendation: AIRecommendation, details?: Record<string, unknown>) => appendAuditLog({ action, actorId: user?.id, actorName: user?.email || 'Recommendation reviewer', targetId: recommendation.id, targetLabel: recommendation.title, details });
  const refreshRecommendations = async () => {
    const result = await query.refetch();
    if (result.error) {
      toast.error(getApiError(result.error).message);
      return;
    }
    toast.success('Recommendation queue refreshed');
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-solid text-primary-contrast">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-main">Recommendation Review Queue</h2>
            <p className="mt-1 text-sm text-text-muted">
              Review AI-generated recommendations and decide whether to approve, reject, expire, assign, or convert them into tasks.
            </p>
            {!userCanGovern ? (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Read-only: approval requires Admin, Manager, or Operations access.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openLafloAssistant({ mode: 'operations', prompt: 'Summarise the AI Recommendations queue and identify the recommendations that require authorised review.', context: { page: 'AI Recommendations', status: activeStatus, visibleRecommendations: recommendations.length, canGovern: userCanGovern } })} className="inline-flex items-center gap-2 rounded-2xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100"><Bot className="h-4 w-4" />Ask LaFlo about this queue</button>
          <button
            type="button"
            onClick={refreshRecommendations}
            disabled={query.isFetching}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-sm font-semibold text-text-main hover:bg-bg disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => { setActiveStatus(tab.value); setTarget({}); }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeStatus === tab.value
                ? 'bg-primary-solid text-primary-contrast'
                : 'border border-border bg-card text-text-muted hover:bg-bg'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`mt-5 space-y-3 ${compact ? 'max-h-[520px] overflow-y-auto pr-1' : ''}`}>
        {query.isLoading ? (
          <div className="rounded-2xl border border-border bg-bg p-4 text-sm text-text-muted">
            Loading AI recommendations...
          </div>
        ) : query.isError ? (
          <div className={`rounded-2xl border p-4 text-sm ${
            queryError?.errorCode === 'DATABASE_SCHEMA_MISMATCH'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-border bg-bg text-text-muted'
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
              onCreateTask={(item) => setCreatingTask(item)}
              onExpire={(item) => setExpiring(item)}
              onReject={(item) => {
                setRejecting(item);
                setRejectionReason('');
              }}
              onInspect={(item, view) => setInspection({ recommendation: item, view })}
              onAssign={setAssigning}
              onComment={setCommenting}
              onAsk={(item) => openLafloAssistant({ mode: 'operations', prompt: `Explain this AI recommendation and the authorised evidence behind it: ${item.title}`, context: { page: 'AI Recommendations', recommendationId: item.id, status: item.status, department: item.department, priority: item.priority, confidence: item.confidence, sourceType: item.sourceType, sourceId: item.sourceId } })}
              note={notes[recommendation.id]}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-bg p-8 text-center">
            <ShieldCheck className="mx-auto h-7 w-7 text-text-muted" />
            <p className="mt-2 text-sm font-semibold text-text-main">No {activeStatus.toLowerCase().replace(/_/g, ' ')} recommendations</p>
            <p className="mt-1 text-xs text-text-muted">There are no recommendations matching this queue and its current filters.</p>
            <div className="mt-4 flex justify-center gap-2">{activeStatus !== 'PENDING' || Object.keys(target).length ? <button type="button" onClick={() => { setActiveStatus('PENDING'); setTarget({}); }} className="rounded-xl bg-primary-solid px-3 py-2 text-xs font-semibold text-primary-contrast">Return to Pending</button> : null}<button type="button" onClick={refreshRecommendations} disabled={query.isFetching} className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-text-main disabled:opacity-60">Refresh queue</button></div>
          </div>
        )}
      </div>

      {rejecting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-main/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold text-text-main">Reject recommendation</h3>
            <p className="mt-1 text-sm text-text-muted">{rejecting.title}</p>
            <label className="mt-4 block text-sm font-medium text-text-main" htmlFor="ai-rejection-reason">
              Rejection reason
            </label>
            <textarea
              id="ai-rejection-reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-border p-3 text-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Explain why this recommendation should not be acted on."
            />
            {!rejectionReason.trim() ? <p className="mt-2 text-xs font-medium text-rose-700">A rejection reason is required.</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejecting(null);
                  setRejectionReason('');
                }}
                className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-text-main hover:bg-bg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  rejectMutation.mutate();
                }}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-primary-contrast hover:bg-rose-700 disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {expiring ? <ConfirmDialog title="Expire recommendation?" description="This recommendation will move to Expired and will no longer appear in the active recommendation queue." item={expiring.title} confirmLabel="Expire recommendation" onCancel={() => setExpiring(null)} onConfirm={() => { audit('AI Recommendation Expired', expiring); actionMutation.mutate({ action: 'expire', recommendation: expiring }); }} pending={actionMutation.isPending} /> : null}
      {creatingTask ? <RecommendationTaskDialog recommendation={creatingTask} pending={actionMutation.isPending} onCancel={() => setCreatingTask(null)} onConfirm={() => actionMutation.mutate({ action: 'create-task', recommendation: creatingTask })} /> : null}
      {assigning ? <UnavailableDialog title="Assign recommendation owner" item={assigning.title} message="Recommendation assignment is not connected to the user and team service. No owner has been changed." onClose={() => setAssigning(null)} /> : null}
      {commenting ? <UnavailableDialog title="Add recommendation comment" item={commenting.title} message="Recommendation comments are not connected to persistent storage. No comment has been saved." onClose={() => setCommenting(null)} /> : null}
      {inspection ? <div className="fixed inset-0 z-[90] flex justify-end bg-text-main/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInspection(null); }}><section role="dialog" aria-modal="true" aria-label={`Recommendation ${inspection.view}`} className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{inspection.view.replace('_', ' ')}</p><h2 className="mt-1 text-lg font-semibold text-text-main">{inspection.recommendation.title}</h2></div><button type="button" onClick={() => setInspection(null)} aria-label="Close recommendation details" className="grid h-9 w-9 place-items-center rounded-xl border border-border"><X className="h-4 w-4" /></button></div>{inspection.view === 'details' ? <div className="mt-5 space-y-4 text-sm"><p className="leading-6 text-text-main">{inspection.recommendation.description}</p><InfoRow label="Rationale" value={inspection.recommendation.rationale} /><InfoRow label="Confidence" value={`${Math.round(inspection.recommendation.confidence * 100)}%`} /><InfoRow label="Department" value={inspection.recommendation.department} /><InfoRow label="Status" value={inspection.recommendation.status.replace(/_/g, ' ')} /></div> : inspection.view === 'source' ? <div className="mt-5 space-y-4"><InfoRow label="Source type" value={inspection.recommendation.sourceType.replace(/_/g, ' ')} /><InfoRow label="Source reference" value={inspection.recommendation.sourceId} /><p className="rounded-2xl bg-bg p-4 text-sm leading-6 text-text-muted">This recommendation was generated from authorised, permission-filtered operational context.</p></div> : <div className="mt-5 space-y-3"><InfoRow label="Generated" value={new Date(inspection.recommendation.createdAt).toLocaleString()} /><InfoRow label="Last updated" value={new Date(inspection.recommendation.updatedAt).toLocaleString()} /><InfoRow label="Reviewed" value={inspection.recommendation.reviewedAt ? new Date(inspection.recommendation.reviewedAt).toLocaleString() : 'Not reviewed'} /><InfoRow label="Current state" value={inspection.recommendation.status.replace(/_/g, ' ')} /></div>}</section></div> : null}
    </section>
  );
}

function ConfirmDialog({ title, description, item, confirmLabel, onCancel, onConfirm, pending }: { title: string; description: string; item: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void; pending: boolean }) {
  return <div className="fixed inset-0 z-[95] grid place-items-center bg-text-main/45 p-4" role="alertdialog" aria-modal="true" aria-label={title}><div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-2xl"><AlertTriangle className="h-6 w-6 text-amber-500" /><h2 className="mt-3 text-lg font-semibold text-text-main">{title}</h2><p className="mt-2 text-sm leading-6 text-text-muted">{description}</p><p className="mt-3 rounded-xl bg-bg p-3 text-sm font-semibold text-text-main">{item}</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" disabled={pending} onClick={onConfirm} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-primary-contrast disabled:opacity-50">{confirmLabel}</button></div></div></div>;
}

function RecommendationTaskDialog({ recommendation, pending, onCancel, onConfirm }: { recommendation: AIRecommendation; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[95] grid place-items-center overflow-y-auto bg-text-main/45 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-label="Create task from recommendation" className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Prefilled recommendation task</p><h2 className="mt-1 text-lg font-semibold text-text-main">Create task from recommendation</h2><p className="mt-1 text-sm text-text-muted">Review the Hotel Brain evidence before creating the operational task.</p></div><button type="button" onClick={onCancel} aria-label="Close task form" className="grid h-9 w-9 place-items-center rounded-xl border border-border"><X className="h-4 w-4" /></button></div><div className="mt-5 divide-y divide-border rounded-2xl border border-border text-sm"><InfoRow label="Task" value={recommendation.title} /><InfoRow label="Description" value={recommendation.description} /><InfoRow label="Department" value={recommendation.department} /><InfoRow label="Priority" value={recommendation.priority} /><InfoRow label="Confidence" value={`${Math.round(recommendation.confidence * 100)}%`} /><InfoRow label="Source" value={recommendation.sourceType.replace(/_/g, ' ')} /></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} disabled={pending} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button><button type="button" onClick={onConfirm} disabled={pending} className="rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast disabled:opacity-50">{pending ? 'Creating…' : 'Create task'}</button></div></section></div>;
}

function UnavailableDialog({ title, item, message, onClose }: { title: string; item: string; message: string; onClose: () => void }) {
  return <div className="fixed inset-0 z-[95] grid place-items-center bg-text-main/45 p-4" role="dialog" aria-modal="true" aria-label={title}><div className="w-full max-w-lg rounded-3xl bg-card p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-text-main">{title}</h2><p className="mt-1 text-sm text-text-muted">{item}</p></div><button type="button" onClick={onClose} aria-label={`Close ${title}`}><X className="h-4 w-4" /></button></div><div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Unavailable by design.</strong> {message}</div><div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast">Close</button></div></div></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p><p className="mt-1 text-sm leading-6 text-text-main">{value}</p></div>;
}
