import { useQuery } from '@tanstack/react-query';
import { Brain, RefreshCcw } from 'lucide-react';
import { departmentIntelligenceService } from '@/services';
import type {
  DepartmentBriefing,
  DepartmentIntelligenceDepartment,
} from '@/services/departmentIntelligence';

const departmentLabels: Record<DepartmentIntelligenceDepartment, string> = {
  'front-desk': 'Front Desk',
  housekeeping: 'Housekeeping',
  maintenance: 'Maintenance',
  security: 'Security',
  revenue: 'Revenue',
  'guest-experience': 'Guest Experience',
};

const severityClass = (severity?: string) => {
  if (severity === 'CRITICAL') return 'border-red-200 bg-red-50 text-red-700';
  if (severity === 'HIGH') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (severity === 'MEDIUM') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const statusClass = (status?: string) => {
  if (status === 'CRITICAL') return 'bg-red-100 text-red-800';
  if (status === 'AT_RISK') return 'bg-amber-100 text-amber-800';
  if (status === 'BUSY' || status === 'WATCH') return 'bg-sky-100 text-sky-800';
  return 'bg-emerald-100 text-emerald-800';
};

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
      {label}
    </div>
  );
}

export default function DepartmentIntelligenceCard({
  department,
  compact = false,
  hideOnForbidden = true,
}: {
  department: DepartmentIntelligenceDepartment;
  compact?: boolean;
  hideOnForbidden?: boolean;
}) {
  const query = useQuery({
    queryKey: ['department-intelligence', department],
    queryFn: () => departmentIntelligenceService.getDepartmentBriefing(department),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (query.isLoading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-44 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
      </section>
    );
  }

  if (query.isError) {
    const status = (query.error as any)?.response?.status;
    if (hideOnForbidden && status === 403) return null;
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-rose-800">{departmentLabels[department]} Intelligence unavailable</h2>
            <p className="mt-1 text-sm text-rose-700">The briefing could not be generated from hotel context.</p>
          </div>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-200"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  const briefing = query.data as DepartmentBriefing | undefined;
  if (!briefing) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <EmptyState label={`${departmentLabels[department]} intelligence will appear when hotel context is available.`} />
      </section>
    );
  }

  const risks = briefing.topRisks.slice(0, 3);
  const priorities = briefing.topPriorities.slice(0, 3);
  const actions = briefing.recommendedActions.slice(0, 3);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">{departmentLabels[department]} Intelligence</h2>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(briefing.currentStatus)}`}>
                {briefing.currentStatus.replace(/_/g, ' ')}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {briefing.source === 'AI' ? 'AI generated' : 'Rules fallback'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{briefing.summary}</p>
            {!compact ? (
              <p className="mt-2 text-xs text-slate-400">
                Generated {new Date(briefing.generatedAt).toLocaleString()} · {briefing.contextVersion}
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

      <div className={`mt-5 grid grid-cols-1 gap-4 ${compact ? '' : 'lg:grid-cols-3'}`}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top priorities</h3>
          <div className="mt-3 space-y-2">
            {priorities.length ? priorities.map((item, index) => (
              <div key={`${item.title}-${index}`} className="text-sm">
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
              </div>
            )) : <p className="text-sm text-slate-500">No priority pressure detected.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top risks</h3>
          <div className="mt-3 space-y-2">
            {risks.length ? risks.map((item, index) => (
              <div key={`${item.title}-${index}`} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityClass(item.severity)}`}>
                  {item.severity || 'LOW'}
                </span>
              </div>
            )) : <p className="text-sm text-slate-500">No major risks detected.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended actions</h3>
          <div className="mt-3 space-y-3">
            {actions.length ? actions.map((action, index) => (
              <div key={`${action.title}-${index}`} className="text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{action.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{action.detail}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityClass(action.priority)}`}>
                    {action.priority}
                  </span>
                </div>
                {action.supportsTask ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Review in AI Governance to create task.
                  </p>
                ) : null}
              </div>
            )) : <p className="text-sm text-slate-500">No recommended actions right now.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
