import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import incidentService, { type Incident, type IncidentView } from '@/services/incidents';
import CollaborationHeader from '@/components/collaboration/CollaborationHeader';
import { useAuthStore } from '@/stores/authStore';

type IncidentTab = 'overview' | 'active' | 'critical' | 'assigned-to-me' | 'resolved' | 'closed';
const views: { id: IncidentTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'active', label: 'Active Incidents' },
  { id: 'critical', label: 'Critical' },
  { id: 'assigned-to-me', label: 'Assigned to Me' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
];

const severityClass: Record<string, string> = {
  LOW: 'bg-border/50 text-text-main border-border',
  MEDIUM: 'bg-sky-50 text-sky-700 border-sky-200',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-200',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
};

const statusClass: Record<string, string> = {
  NEW: 'bg-blue-50 text-blue-700 border-blue-200',
  ACKNOWLEDGED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  INVESTIGATING: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_PROGRESS: 'bg-purple-50 text-purple-700 border-purple-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-border/50 text-text-muted border-border',
};

function fmt(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function minutesLabel(minutes: number) {
  if (!minutes) return '-';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}

function Card({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-main">{value}</p>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

function EmptyState({ view }: { view: IncidentView }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="text-sm font-semibold text-text-main">No incidents found</p>
      <p className="mt-1 text-sm text-text-muted">
        {view === 'active' ? 'New incidents will appear here when modules raise operational events.' : 'This view is clear.'}
      </p>
    </div>
  );
}

function IncidentRow({
  incident,
  onAcknowledge,
  onResolve,
  onClose,
  canManage,
  isUpdating,
}: {
  incident: Incident;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onClose: (id: string) => void;
  canManage: boolean;
  isUpdating: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const taskCount = incident.tasks?.length || 0;
  const linkedTask = incident.tasks?.[0]?.ticket;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-text-muted">{incident.incidentNumber}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${severityClass[incident.severity]}`}>
              {incident.severity}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass[incident.status]}`}>
              {incident.status.replace(/_/g, ' ')}
            </span>
            <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-xs font-semibold text-text-muted">
              {incident.sourceModule}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-text-main">{incident.title}</h3>
          {incident.description ? <p className="mt-1 text-sm text-text-muted">{incident.description}</p> : null}
          <div className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-2 lg:grid-cols-4">
            <span>Category: {incident.category.replace(/_/g, ' ')}</span>
            <span>Started: {fmt(incident.startedAt)}</span>
            <span>Linked: {incident.linkedEntityType || '-'} {incident.linkedEntityId ? `#${incident.linkedEntityId.slice(0, 8)}` : ''}</span>
            <span>Tasks: {taskCount}</span>
          </div>
          {linkedTask ? (
            <div className="mt-3 rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text-muted">
              Linked task: {linkedTask.conversation?.subject || linkedTask.id} - {linkedTask.department} - {linkedTask.status}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => setShowDetails((current) => !current)} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-text-main hover:bg-bg">{showDetails ? 'Hide details' : 'View incident'}</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('laflo:open-assistant', { detail: { mode: 'operations', prompt: `Review incident ${incident.incidentNumber}: ${incident.title}`, context: { page: 'Incident Center', incidentId: incident.id, severity: incident.severity, status: incident.status, source: incident.sourceModule } } }))} className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700">Ask LaFlo</button>
          <button type="button" disabled title="Incident assignment service is not connected" className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-text-muted disabled:cursor-not-allowed disabled:opacity-60">Assign unavailable</button>
          <button type="button" disabled title="Incident task creation service is not connected" className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-text-muted disabled:cursor-not-allowed disabled:opacity-60">Task unavailable</button>
          {incident.status === 'NEW' && canManage ? (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onAcknowledge(incident.id)}
              className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-text-main hover:bg-bg"
            >
              Acknowledge
            </button>
          ) : incident.status === 'NEW' ? (
            <button type="button" disabled title="Permission required" className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-text-muted opacity-60">Acknowledge · Permission required</button>
          ) : null}
          {!['RESOLVED', 'CLOSED'].includes(incident.status) && canManage ? (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onResolve(incident.id)}
              className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Resolve
            </button>
          ) : !['RESOLVED', 'CLOSED'].includes(incident.status) ? (
            <button type="button" disabled title="Permission required" className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-text-muted opacity-60">Resolve · Permission required</button>
          ) : null}
          {incident.status === 'RESOLVED' && canManage ? (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onClose(incident.id)}
              className="rounded-xl bg-primary-solid px-3 py-2 text-sm font-semibold text-primary-contrast hover:opacity-90"
            >
              Close
            </button>
          ) : incident.status === 'RESOLVED' ? (
            <button type="button" disabled title="Permission required" className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-text-muted opacity-60">Close · Permission required</button>
          ) : null}
        </div>
      </div>
      {showDetails ? <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-bg p-4 text-xs text-text-muted sm:grid-cols-2"><span><strong className="text-text-main">Assigned owner:</strong> {incident.assignedManagerId || 'Unassigned'}</span><span><strong className="text-text-main">Last updated:</strong> {fmt(incident.updatedAt)}</span><span><strong className="text-text-main">Source:</strong> {incident.sourceModule}</span><span><strong className="text-text-main">Related record:</strong> {incident.linkedEntityId || 'Unavailable'}</span></div> : null}
    </div>
  );
}

export default function IncidentCenterPage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedParam = searchParams.get('tab') || searchParams.get('view');
  const requestedView = (requestedParam === 'assigned_to_me' ? 'assigned-to-me' : requestedParam) as IncidentTab | null;
  const activeTab: IncidentTab = views.some((item) => item.id === requestedView) ? requestedView! : 'overview';
  const view: IncidentView = activeTab === 'overview' ? 'active' : activeTab === 'assigned-to-me' ? 'assigned_to_me' : activeTab;
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [transition, setTransition] = useState<{ action: 'resolve' | 'close'; incident: Incident } | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['incidents', 'overview'],
    queryFn: incidentService.overview,
    refetchInterval: 15000,
  });

  const incidentsQuery = useQuery({
    queryKey: ['incidents', view],
    queryFn: () => incidentService.list(view),
    refetchInterval: 15000,
  });

  const refresh = async (showFeedback = true) => {
    const results = await Promise.all([overviewQuery.refetch(), incidentsQuery.refetch()]);
    const failed = results.filter((result) => result.isError).length;
    if (showFeedback) {
      if (!failed) toast.success('Incident Center refreshed');
      else if (failed < results.length) toast.error('Incident Center partially refreshed.');
      else toast.error('Incident Center refresh failed.');
    }
  };

  const acknowledgeMutation = useMutation({
    mutationFn: incidentService.acknowledge,
    onSuccess: () => {
      toast.success('Incident acknowledged');
      void refresh(false);
    },
    onError: () => toast.error('Incident acknowledgement is unavailable.'),
  });

  const resolveMutation = useMutation({
    mutationFn: incidentService.resolve,
    onSuccess: () => {
      toast.success('Incident resolved');
      setTransition(null);
      void refresh(false);
    },
    onError: () => toast.error('Incident resolution is unavailable.'),
  });

  const closeMutation = useMutation({
    mutationFn: incidentService.close,
    onSuccess: () => {
      toast.success('Incident closed');
      setTransition(null);
      void refresh(false);
    },
    onError: () => toast.error('Incident closure is unavailable.'),
  });

  const overview = overviewQuery.data;
  const incidents = incidentsQuery.data || [];
  const sources = [...new Set(incidents.map((incident) => incident.sourceModule))];
  const filteredIncidents = incidents.filter((incident) => {
    if (severityFilter !== 'ALL' && incident.severity !== severityFilter) return false;
    if (sourceFilter !== 'ALL' && incident.sourceModule !== sourceFilter) return false;
    if (ownerFilter === 'ASSIGNED' && !incident.assignedManagerId) return false;
    if (ownerFilter === 'UNASSIGNED' && incident.assignedManagerId) return false;
    return true;
  });
  const topDepartment = useMemo(() => overview?.byDepartment?.[0], [overview]);
  const topSource = useMemo(() => overview?.bySourceModule?.[0], [overview]);
  const isRefreshing = overviewQuery.isFetching || incidentsQuery.isFetching;
  const hasError = overviewQuery.isError || incidentsQuery.isError;
  const canManageIncidents = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isUpdating = acknowledgeMutation.isPending || resolveMutation.isPending || closeMutation.isPending;

  return (
    <div className="space-y-6">
      <CollaborationHeader
        workspace="incidents"
        eyebrow="Operations response"
        title="Incident Center"
        subtitle="Central response layer for operational, security, maintenance, and Smart Building incidents."
        statusLabel={overview && overview.critical > 0 ? 'Critical incidents active' : 'Incident workspace'}
        statusTone={overview && overview.critical > 0 ? 'critical' : overview && overview.active > 0 ? 'warning' : 'live'}
        actions={
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('laflo:open-assistant', { detail: { mode: 'operations', prompt: 'Summarise the highest-priority incidents and recommend the next authorised response.', context: { page: 'Incident Center', tab: activeTab, active: overview?.active, critical: overview?.critical } } }))} className="min-h-10 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-text-main">Ask LaFlo</button><button
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="min-h-10 rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button></div>
        }
      />

      {hasError ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"><span>Incident data could not be loaded.</span><button type="button" onClick={() => void refresh()} disabled={isRefreshing} className="ml-2 font-semibold underline disabled:opacity-50">{isRefreshing ? 'Retrying…' : 'Try again'}</button></div> : null}

      {!canManageIncidents ? <div className="rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text-muted"><strong className="text-text-main">Read-only access.</strong> Permission required to acknowledge, assign, resolve, or close incidents.</div> : null}

      {activeTab === 'overview' ? <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card label="Active Incidents" value={overview?.active ?? '-'} />
          <Card label="Critical Incidents" value={overview?.critical ?? '-'} />
          <Card label="Avg Resolution" value={minutesLabel(overview?.averageResolutionMinutes || 0)} />
          <Card label="Top Department" value={topDepartment?.count ?? '-'} hint={topDepartment?.department?.replace(/_/g, ' ') || 'No data'} />
          <Card label="Top Source" value={topSource?.count ?? '-'} hint={topSource?.sourceModule || 'No data'} />
        </div>
      </section> : null}

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSearchParams({ tab: item.id })}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                activeTab === item.id
                  ? 'border-primary-950 bg-primary-solid text-primary-contrast'
                  : 'border-border bg-card text-text-muted hover:bg-bg'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-3" aria-label="Incident filters"><select aria-label="Incident severity" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm"><option value="ALL">All severities</option>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Incident owner" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm"><option value="ALL">All owners</option><option value="ASSIGNED">Assigned</option><option value="UNASSIGNED">Unassigned</option></select><select aria-label="Incident source" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm"><option value="ALL">All sources</option>{sources.map((item) => <option key={item}>{item}</option>)}</select><button type="button" onClick={() => { setSeverityFilter('ALL'); setSourceFilter('ALL'); setOwnerFilter('ALL'); }} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold">Clear filters</button></div>

        {incidentsQuery.isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-text-muted">Loading incidents...</div>
        ) : filteredIncidents.length === 0 ? (
          <EmptyState view={view} />
        ) : (
          <div className="space-y-3">
            {activeTab === 'overview' ? <p className="text-sm font-semibold text-text-main">Latest active incidents</p> : null}
            {filteredIncidents.map((incident) => (
              <IncidentRow
                key={incident.id}
                incident={incident}
                onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
                onResolve={() => setTransition({ action: 'resolve', incident })}
                onClose={() => setTransition({ action: 'close', incident })}
                canManage={canManageIncidents}
                isUpdating={isUpdating}
              />
            ))}
          </div>
        )}
      </section>
      {transition ? <div className="fixed inset-0 z-[95] grid place-items-center bg-text-main/45 p-4" role="presentation"><section role="alertdialog" aria-modal="true" aria-label={`${transition.action === 'resolve' ? 'Resolve' : 'Close'} incident?`} className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"><h2 className="text-lg font-semibold text-text-main">{transition.action === 'resolve' ? 'Resolve incident?' : 'Close incident?'}</h2><p className="mt-2 text-sm text-text-muted">Confirm this state change for {transition.incident.incidentNumber}: {transition.incident.title}.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setTransition(null)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" disabled={resolveMutation.isPending || closeMutation.isPending} onClick={() => transition.action === 'resolve' ? resolveMutation.mutate(transition.incident.id) : closeMutation.mutate(transition.incident.id)} className="rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast disabled:opacity-50">{resolveMutation.isPending || closeMutation.isPending ? 'Updating…' : transition.action === 'resolve' ? 'Resolve incident' : 'Close incident'}</button></div></section></div> : null}
    </div>
  );
}
