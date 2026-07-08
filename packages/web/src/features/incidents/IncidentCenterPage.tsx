import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import incidentService, { type Incident, type IncidentView } from '@/services/incidents';
import CollaborationHeader from '@/components/collaboration/CollaborationHeader';

const views: { id: IncidentView; label: string }[] = [
  { id: 'active', label: 'Active Incidents' },
  { id: 'critical', label: 'Critical' },
  { id: 'assigned_to_me', label: 'Assigned to Me' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
];

const severityClass: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700 border-slate-200',
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
  CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function EmptyState({ view }: { view: IncidentView }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-800">No incidents found</p>
      <p className="mt-1 text-sm text-slate-500">
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
}: {
  incident: Incident;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const taskCount = incident.tasks?.length || 0;
  const linkedTask = incident.tasks?.[0]?.ticket;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">{incident.incidentNumber}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${severityClass[incident.severity]}`}>
              {incident.severity}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass[incident.status]}`}>
              {incident.status.replace(/_/g, ' ')}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {incident.sourceModule}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-950">{incident.title}</h3>
          {incident.description ? <p className="mt-1 text-sm text-slate-600">{incident.description}</p> : null}
          <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
            <span>Category: {incident.category.replace(/_/g, ' ')}</span>
            <span>Started: {fmt(incident.startedAt)}</span>
            <span>Linked: {incident.linkedEntityType || '-'} {incident.linkedEntityId ? `#${incident.linkedEntityId.slice(0, 8)}` : ''}</span>
            <span>Tasks: {taskCount}</span>
          </div>
          {linkedTask ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Linked task: {linkedTask.conversation?.subject || linkedTask.id} - {linkedTask.department} - {linkedTask.status}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {incident.status === 'NEW' ? (
            <button
              type="button"
              onClick={() => onAcknowledge(incident.id)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Acknowledge
            </button>
          ) : null}
          {!['RESOLVED', 'CLOSED'].includes(incident.status) ? (
            <button
              type="button"
              onClick={() => onResolve(incident.id)}
              className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Resolve
            </button>
          ) : null}
          {incident.status === 'RESOLVED' ? (
            <button
              type="button"
              onClick={() => onClose(incident.id)}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function IncidentCenterPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view') as IncidentView | null;
  const view = views.some((item) => item.id === requestedView) ? requestedView! : 'active';
  const queryClient = useQueryClient();

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

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['incidents'] });
  };

  const acknowledgeMutation = useMutation({
    mutationFn: incidentService.acknowledge,
    onSuccess: () => {
      toast.success('Incident acknowledged');
      refresh();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: incidentService.resolve,
    onSuccess: () => {
      toast.success('Incident resolved');
      refresh();
    },
  });

  const closeMutation = useMutation({
    mutationFn: incidentService.close,
    onSuccess: () => {
      toast.success('Incident closed');
      refresh();
    },
  });

  const overview = overviewQuery.data;
  const incidents = incidentsQuery.data || [];
  const topDepartment = useMemo(() => overview?.byDepartment?.[0], [overview]);
  const topSource = useMemo(() => overview?.bySourceModule?.[0], [overview]);

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
          <button
            type="button"
            onClick={refresh}
            className="min-h-10 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            Refresh
          </button>
        }
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card label="Active Incidents" value={overview?.active ?? '-'} />
          <Card label="Critical Incidents" value={overview?.critical ?? '-'} />
          <Card label="Avg Resolution" value={minutesLabel(overview?.averageResolutionMinutes || 0)} />
          <Card label="Top Department" value={topDepartment?.count ?? '-'} hint={topDepartment?.department?.replace(/_/g, ' ') || 'No data'} />
          <Card label="Top Source" value={topSource?.count ?? '-'} hint={topSource?.sourceModule || 'No data'} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSearchParams(item.id === 'active' ? {} : { view: item.id })}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                view === item.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {incidentsQuery.isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading incidents...</div>
        ) : incidents.length === 0 ? (
          <EmptyState view={view} />
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => (
              <IncidentRow
                key={incident.id}
                incident={incident}
                onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
                onResolve={(id) => resolveMutation.mutate(id)}
                onClose={(id) => closeMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
