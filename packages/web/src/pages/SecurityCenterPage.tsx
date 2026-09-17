import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import securityCenterService, {
  type CreateVisitorPayload,
  type SecurityActivity,
  type Visitor,
} from '@/services/securityCenter';
import type { CameraFeed, DoorAccessEvent, SecurityAlert, SmartBuildingWorkflowTask } from '@/services/smartBuilding';
import DepartmentIntelligenceCard from '@/components/operations/DepartmentIntelligenceCard';
import CollaborationHeader from '@/components/collaboration/CollaborationHeader';
import HardwareIntegrationPanel from '@/components/hardware/HardwareIntegrationPanel';
import { useAuthStore } from '@/stores/authStore';

type TabId = 'overview' | 'cctv' | 'access-logs' | 'visitors' | 'alerts';
type Tone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';

const tabs: { id: TabId; label: string; href: string }[] = [
  { id: 'overview', label: 'Overview', href: '/security-center' },
  { id: 'cctv', label: 'CCTV', href: '/security-center?tab=cctv' },
  { id: 'access-logs', label: 'Access Logs', href: '/security-center?tab=access-logs' },
  { id: 'visitors', label: 'Visitors', href: '/security-center?tab=visitors' },
  { id: 'alerts', label: 'Alerts', href: '/security-center?tab=alerts' },
];

const realtimeQueryOptions = {
  refetchInterval: 15_000,
  refetchIntervalInBackground: true,
  staleTime: 5_000,
};

const toneClasses: Record<Tone, { card: string; pill: string; dot: string }> = {
  emerald: { card: 'border-emerald-100 bg-emerald-50/60', pill: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  sky: { card: 'border-sky-100 bg-sky-50/60', pill: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  amber: { card: 'border-amber-100 bg-amber-50/70', pill: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  rose: { card: 'border-rose-100 bg-rose-50/70', pill: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500' },
  slate: { card: 'border-border bg-bg/80', pill: 'bg-border text-text-main', dot: 'bg-bg0' },
};

const formatStatus = (value?: string | null) =>
  (value || 'Unknown')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDateTime = (value?: string | null) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not recorded';

const toneForStatus = (status: string): Tone => {
  if (['ACTIVE', 'OFFLINE', 'DENIED', 'FORCED', 'CRITICAL'].includes(status)) return 'rose';
  if (['WARNING', 'ACKNOWLEDGED', 'HELD_OPEN', 'CHECKED_IN'].includes(status)) return 'amber';
  if (['ONLINE', 'GRANTED', 'RESOLVED', 'CHECKED_OUT'].includes(status)) return 'emerald';
  return 'slate';
};

const EmptyState = ({ label }: { label: string }) => (
  <div className="rounded-2xl border border-dashed border-border bg-bg px-6 py-10 text-center">
    <p className="text-sm font-medium text-text-main">{label}</p>
    <p className="mt-1 text-sm text-text-muted">Waiting for security data.</p>
  </div>
);

const LoadingState = ({ label }: { label: string }) => (
  <div aria-label={`Loading ${label}`} className="grid gap-3 sm:grid-cols-2">
    {[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-shimmer rounded-2xl" />)}
  </div>
);

const DisconnectedState = ({ label, onRetry, isRetrying }: { label: string; onRetry: () => void; isRetrying: boolean }) => (
  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-900">
    <p className="font-semibold">{label} service is disconnected.</p>
    <p className="mt-1">Live records are unavailable. No placeholder data is being shown.</p>
    <button type="button" onClick={onRetry} disabled={isRetrying} className="mt-3 rounded-xl border border-amber-300 px-3 py-2 font-semibold disabled:opacity-50">
      {isRetrying ? 'Retrying…' : 'Retry connection'}
    </button>
  </div>
);

const MetricCard = ({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone: Tone }) => (
  <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses[tone].card}`}>
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-semibold text-text-main">{label}</div>
      <span className={`h-2.5 w-2.5 rounded-full ${toneClasses[tone].dot}`} />
    </div>
    <div className="mt-3 text-2xl font-bold tracking-tight text-text-main">{value}</div>
    {detail ? <div className="mt-1 text-sm font-semibold text-text-muted">{detail}</div> : null}
  </div>
);

const ActivityList = ({ activities }: { activities: SecurityActivity[] }) => {
  if (activities.length === 0) return <EmptyState label="No recent security activity." />;

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="rounded-2xl border border-border bg-bg p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-text-main">{activity.title}</div>
              <div className="mt-1 text-sm text-text-muted">{activity.detail || formatStatus(activity.type)}</div>
              {activity.sourceModule ? (
                <div className="mt-1 text-xs font-semibold text-sky-700">Source: {formatStatus(activity.sourceModule)}</div>
              ) : null}
              <div className="mt-1 text-xs text-text-muted">{formatDateTime(activity.occurredAt)}</div>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(activity.status)].pill}`}>
              {formatStatus(activity.status)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

const SecurityTaskCard = ({ task }: { task: SmartBuildingWorkflowTask }) => (
  <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-text-main">{task.title}</div>
        <div className="mt-1 text-sm text-text-muted">{task.sourceSummary || task.description || task.sourceSignal || 'Smart Building security task'}</div>
        <div className="mt-1 text-xs font-semibold text-sky-700">Source: {formatStatus(task.sourceModule)}</div>
        {task.incidentNumber ? (
          <div className="mt-1 text-xs font-semibold text-rose-700">
            Incident: {task.incidentNumber} / {formatStatus(task.incidentStatus)}
          </div>
        ) : null}
        <div className="mt-1 text-xs text-text-muted">
          {[
            task.location ? `Location: ${task.location}` : null,
            task.deviceExternalId ? `Device: ${task.deviceExternalId}` : null,
            task.dueAt ? `Due ${formatDateTime(task.dueAt)}` : null,
          ].filter(Boolean).join(' / ') || formatDateTime(task.createdAt)}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {task.incidentSeverity ? (
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(task.incidentSeverity)].pill}`}>
            {formatStatus(task.incidentSeverity)}
          </span>
        ) : null}
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(task.priority)].pill}`}>
          {formatStatus(task.priority)}
        </span>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(task.status)].pill}`}>
          {formatStatus(task.status)}
        </span>
      </div>
    </div>
  </div>
);

const SecurityTasksPanel = ({ tasks }: { tasks: SmartBuildingWorkflowTask[] }) => (
  <div className="space-y-3">
    <div>
      <div className="text-sm font-bold text-text-main">Smart Building security tasks</div>
      <p className="mt-1 text-sm text-text-muted">Auto-created by forced door, camera offline, and panic button events.</p>
    </div>
    {tasks.length === 0 ? (
      <EmptyState label="No Smart Building security tasks yet." />
    ) : (
      tasks.map((task) => <SecurityTaskCard key={task.id} task={task} />)
    )}
  </div>
);

const CctvPanel = ({ cameras, canManage }: { cameras: CameraFeed[]; canManage: boolean }) => {
  const [expandedCameraId, setExpandedCameraId] = useState<string | null>(null);
  if (cameras.length === 0) return <EmptyState label="No CCTV feeds connected." />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {cameras.map((camera) => (
        <div key={camera.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-text-main">{camera.name}</div>
              <div className="mt-1 text-sm text-text-muted">{camera.location || 'Location not set'}</div>
              <div className="mt-2 text-xs text-text-muted">Last seen {formatDateTime(camera.lastSeenAt)}</div>
              <div className="mt-1 text-xs text-text-muted">Integration: {camera.externalId ? 'Configured' : 'Not configured'}</div>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(camera.status)].pill}`}>
              {formatStatus(camera.status)}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setExpandedCameraId((current) => current === camera.id ? null : camera.id)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-main">
              {expandedCameraId === camera.id ? 'Hide camera details' : 'View camera details'}
            </button>
            {canManage ? <Link to="/settings?tab=integrations" className="rounded-lg bg-primary-solid px-3 py-2 text-xs font-semibold text-primary-contrast">Open Integration Manager</Link> : <button type="button" disabled title="Permission required" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-muted opacity-60">Integration Manager · Permission required</button>}
          </div>
          {expandedCameraId === camera.id ? <div className="mt-3 grid gap-2 rounded-xl border border-border bg-bg p-3 text-xs text-text-muted sm:grid-cols-2"><span><strong className="text-text-main">Camera ID:</strong> {camera.externalId || 'Unavailable'}</span><span><strong className="text-text-main">Stream:</strong> {camera.streamUrl ? 'Available to authorised integration' : 'Unavailable'}</span><span><strong className="text-text-main">Snapshot:</strong> {camera.snapshotUrl ? 'Available' : 'Unavailable'}</span><span><strong className="text-text-main">Connection:</strong> {formatStatus(camera.status)}</span></div> : null}
        </div>
      ))}
    </div>
  );
};

const AccessLogsPanel = ({ logs }: { logs: DoorAccessEvent[] }) => {
  const [date, setDate] = useState('');
  const [source, setSource] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [userQuery, setUserQuery] = useState('');
  const sources = [...new Set(logs.map((event) => event.doorName || event.doorExternalId).filter(Boolean))] as string[];
  const statuses = [...new Set(logs.map((event) => event.result))];
  const filtered = logs.filter((event) => {
    if (date && !event.occurredAt.startsWith(date)) return false;
    if (source !== 'ALL' && (event.doorName || event.doorExternalId) !== source) return false;
    if (status !== 'ALL' && event.result !== status) return false;
    if (userQuery && !(event.actorName || event.actorType).toLowerCase().includes(userQuery.toLowerCase())) return false;
    return true;
  });

  if (logs.length === 0) return <EmptyState label="No access logs recorded." />;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Access log filters">
        <input aria-label="Access date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm" />
        <select aria-label="Access door or source" value={source} onChange={(event) => setSource(event.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm"><option value="ALL">All doors and sources</option>{sources.map((item) => <option key={item}>{item}</option>)}</select>
        <select aria-label="Access status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm"><option value="ALL">All decisions</option>{statuses.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select>
        <input aria-label="Access user or visitor" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="User or visitor" className="rounded-xl border border-border px-3 py-2 text-sm" />
      </div>
      {filtered.length === 0 ? <EmptyState label="No access events match these filters." /> : <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {filtered.slice(0, 50).map((event) => (
        <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
          <div>
            <div className="text-sm font-bold text-text-main">{event.doorName || event.doorExternalId || 'Door access'}</div>
            <div className="mt-1 text-sm text-text-muted">{event.actorName || formatStatus(event.actorType)}</div>
            <div className="mt-1 text-xs text-text-muted">{formatDateTime(event.occurredAt)}</div>
          </div>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(event.result)].pill}`}>
            {formatStatus(event.result)}
          </span>
        </div>
      ))}
      </div>}
    </div>
  );
};

const VisitorsPanel = ({
  visitors,
  onCreate,
  onCheckout,
  isCreating,
  isCheckingOut,
  canManage,
}: {
  visitors: Visitor[];
  onCreate: (payload: CreateVisitorPayload) => void;
  onCheckout: (visitorId: string) => void;
  isCreating: boolean;
  isCheckingOut: boolean;
  canManage: boolean;
}) => {
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [purpose, setPurpose] = useState('');
  const [hostName, setHostName] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [visitorQuery, setVisitorQuery] = useState('');
  const filteredVisitors = visitors.filter((visitor) => {
    if (statusFilter !== 'ALL' && visitor.status !== statusFilter) return false;
    if (visitorQuery && ![visitor.fullName, visitor.company, visitor.hostName].filter(Boolean).some((value) => value!.toLowerCase().includes(visitorQuery.toLowerCase()))) return false;
    return true;
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!fullName.trim()) return;
    onCreate({
      fullName: fullName.trim(),
      company: company.trim() || undefined,
      purpose: purpose.trim() || undefined,
      hostName: hostName.trim() || undefined,
    });
    setFullName('');
    setCompany('');
    setPurpose('');
    setHostName('');
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      {canManage ? <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="text-sm font-bold text-text-main">Register visitor</div>
        <div className="mt-4 space-y-3">
          <input className="w-full rounded-xl border border-border px-3 py-2 text-sm" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
          <input className="w-full rounded-xl border border-border px-3 py-2 text-sm" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" />
          <input className="w-full rounded-xl border border-border px-3 py-2 text-sm" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose" />
          <input className="w-full rounded-xl border border-border px-3 py-2 text-sm" value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="Host" />
        </div>
        <button type="submit" disabled={isCreating || !fullName.trim()} className="mt-4 w-full rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast disabled:cursor-not-allowed disabled:bg-border">
          Check in
        </button>
      </form> : <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-semibold text-text-main">Visitor management restricted</p><p className="mt-1 text-sm text-text-muted">Permission required to check visitors in or out.</p></div>}

      <div className="space-y-3">
        <div className="grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-2" aria-label="Visitor filters">
          <input aria-label="Visitor or host" value={visitorQuery} onChange={(event) => setVisitorQuery(event.target.value)} placeholder="Visitor, company, or host" className="rounded-xl border border-border px-3 py-2 text-sm" />
          <select aria-label="Visitor status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm"><option value="ALL">All visitor statuses</option><option value="CHECKED_IN">Checked in</option><option value="CHECKED_OUT">Checked out</option><option value="DENIED">Denied</option></select>
        </div>
        {visitors.length === 0 ? (
          <EmptyState label="No visitors recorded." />
        ) : filteredVisitors.length === 0 ? (
          <EmptyState label="No visitors match these filters." />
        ) : (
          filteredVisitors.map((visitor) => (
            <div key={visitor.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-text-main">{visitor.fullName}</div>
                  <div className="mt-1 text-sm text-text-muted">
                    {[visitor.company, visitor.purpose, visitor.hostName ? `Host: ${visitor.hostName}` : null].filter(Boolean).join(' / ') || 'Visitor'}
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    In {formatDateTime(visitor.checkInAt)}{visitor.checkOutAt ? ` / Out ${formatDateTime(visitor.checkOutAt)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(visitor.status)].pill}`}>
                    {formatStatus(visitor.status)}
                  </span>
                  {visitor.status === 'CHECKED_IN' && canManage ? (
                    <button type="button" disabled={isCheckingOut} onClick={() => onCheckout(visitor.id)} className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-text-main hover:bg-bg disabled:opacity-50">
                      Check out
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const AlertsPanel = ({
  alerts,
  tasks,
  onAcknowledge,
  onResolve,
  isUpdating,
  canManage,
}: {
  alerts: SecurityAlert[];
  tasks: SmartBuildingWorkflowTask[];
  onAcknowledge: (alertId: string) => void;
  onResolve: (alertId: string) => void;
  isUpdating: boolean;
  canManage: boolean;
}) => {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const statuses = [...new Set(alerts.map((alert) => alert.status))];
  const severities = [...new Set(alerts.map((alert) => alert.severity))];
  const filteredAlerts = alerts.filter((alert) => (statusFilter === 'ALL' || alert.status === statusFilter) && (severityFilter === 'ALL' || alert.severity === severityFilter));
  return (
    <div className="space-y-3">
      <SecurityTasksPanel tasks={tasks} />
      <div className="grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-2" aria-label="Security alert filters"><select aria-label="Security alert status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm"><option value="ALL">All alert statuses</option>{statuses.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select><select aria-label="Security alert severity" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm"><option value="ALL">All severities</option>{severities.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select></div>
      {alerts.length === 0 ? (
        <EmptyState label="No security alerts recorded." />
      ) : filteredAlerts.length === 0 ? (
        <EmptyState label="No alerts match these filters." />
      ) : (
        filteredAlerts.map((alert) => (
          <div key={alert.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-text-main">{alert.title}</div>
                <div className="mt-1 text-sm text-text-muted">{alert.message || alert.location || formatStatus(alert.alertType)}</div>
                <div className="mt-1 text-xs text-text-muted">{alert.location || 'Location unavailable'} · {formatDateTime(alert.occurredAt)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(alert.severity)].pill}`}>{formatStatus(alert.severity)}</span>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(alert.status)].pill}`}>
                  {formatStatus(alert.status)}
                </span>
                <button type="button" onClick={() => setExpandedAlertId((current) => current === alert.id ? null : alert.id)} className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-text-main">{expandedAlertId === alert.id ? 'Hide details' : 'View details'}</button>
                {alert.status === 'ACTIVE' && canManage ? (
                  <button type="button" disabled={isUpdating} onClick={() => onAcknowledge(alert.id)} className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-text-main hover:bg-bg disabled:opacity-50">
                    {isUpdating ? 'Updating…' : 'Acknowledge'}
                  </button>
                ) : alert.status === 'ACTIVE' ? (
                  <button type="button" disabled title="Permission required" className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-text-muted opacity-60">Acknowledge · Permission required</button>
                ) : null}
                <button type="button" disabled title="Security task workflow is not connected" className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-text-muted opacity-60">Create task unavailable</button>
                <button type="button" disabled title="Security assignment service is not connected" className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-text-muted opacity-60">Assign unavailable</button>
                {alert.status !== 'RESOLVED' && canManage ? (
                  <button type="button" disabled={isUpdating} onClick={() => onResolve(alert.id)} className="rounded-lg bg-primary-solid px-3 py-1 text-xs font-semibold text-primary-contrast disabled:opacity-50">
                    {isUpdating ? 'Updating…' : 'Resolve'}
                  </button>
                ) : null}
              </div>
            </div>
            {expandedAlertId === alert.id ? <div className="mt-3 grid gap-2 rounded-xl border border-border bg-bg p-3 text-xs text-text-muted sm:grid-cols-2"><span><strong className="text-text-main">Source:</strong> {formatStatus(alert.alertType)}</span><span><strong className="text-text-main">Owner:</strong> Unassigned</span><span><strong className="text-text-main">Detected:</strong> {formatDateTime(alert.occurredAt)}</span><span><strong className="text-text-main">Last action:</strong> {formatDateTime(alert.resolvedAt || alert.acknowledgedAt)}</span></div> : null}
          </div>
        ))
      )}
    </div>
  );
};

export default function SecurityCenterPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const activeTab = (searchParams.get('tab') || params.tab || 'overview') as TabId;
  const validTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : 'overview';

  const overviewQuery = useQuery({ queryKey: ['security-center', 'overview'], queryFn: securityCenterService.getOverview, ...realtimeQueryOptions });
  const cctvQuery = useQuery({ queryKey: ['security-center', 'cctv'], queryFn: securityCenterService.listCctv, ...realtimeQueryOptions });
  const accessLogsQuery = useQuery({ queryKey: ['security-center', 'access-logs'], queryFn: securityCenterService.listAccessLogs, ...realtimeQueryOptions });
  const visitorsQuery = useQuery({ queryKey: ['security-center', 'visitors'], queryFn: securityCenterService.listVisitors, ...realtimeQueryOptions });
  const alertsQuery = useQuery({ queryKey: ['security-center', 'alerts'], queryFn: securityCenterService.listAlerts, ...realtimeQueryOptions });
  const tasksQuery = useQuery({ queryKey: ['security-center', 'tasks'], queryFn: securityCenterService.listTasks, ...realtimeQueryOptions });

  const invalidateSecurityCenter = () => queryClient.invalidateQueries({ queryKey: ['security-center'] });
  const createVisitorMutation = useMutation({ mutationFn: securityCenterService.createVisitor, onSuccess: () => { toast.success('Visitor checked in'); void invalidateSecurityCenter(); }, onError: () => toast.error('Visitor service is unavailable.') });
  const checkoutVisitorMutation = useMutation({ mutationFn: securityCenterService.checkoutVisitor, onSuccess: () => { toast.success('Visitor checked out'); void invalidateSecurityCenter(); }, onError: () => toast.error('Visitor checkout is unavailable.') });
  const acknowledgeAlertMutation = useMutation({ mutationFn: securityCenterService.acknowledgeAlert, onSuccess: () => { toast.success('Security alert acknowledged'); void invalidateSecurityCenter(); }, onError: () => toast.error('Alert service is unavailable.') });
  const resolveAlertMutation = useMutation({ mutationFn: securityCenterService.resolveAlert, onSuccess: () => { toast.success('Security alert resolved'); void invalidateSecurityCenter(); }, onError: () => toast.error('Alert service is unavailable.') });

  const overview = overviewQuery.data;
  const cameras = cctvQuery.data || [];
  const accessLogs = accessLogsQuery.data || [];
  const visitors = visitorsQuery.data || [];
  const alerts = alertsQuery.data || [];
  const tasks = tasksQuery.data || [];
  const canManageSecurity = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canManageHardware = canManageSecurity;
  const hasError = overviewQuery.isError || cctvQuery.isError || accessLogsQuery.isError || visitorsQuery.isError || alertsQuery.isError || tasksQuery.isError;
  const isRefreshing = overviewQuery.isFetching || cctvQuery.isFetching || accessLogsQuery.isFetching || visitorsQuery.isFetching || alertsQuery.isFetching || tasksQuery.isFetching;
  const refresh = async () => {
    const results = await Promise.all([overviewQuery.refetch(), cctvQuery.refetch(), accessLogsQuery.refetch(), visitorsQuery.refetch(), alertsQuery.refetch(), tasksQuery.refetch()]);
    const failed = results.filter((result) => result.isError).length;
    if (!failed) toast.success('Security Center refreshed');
    else if (failed < results.length) toast.error('Security Center partially refreshed. Some services are unavailable.');
    else toast.error('Security Center refresh failed.');
  };

  const metrics = useMemo(
    () => [
      {
        label: 'CCTV status',
        value: overview ? `${overview.cctv.online}/${overview.cctv.total} Online` : 'No data',
        detail: overview ? `${overview.cctv.offline} Offline` : 'Waiting for feeds',
        tone: overview && overview.cctv.offline > 0 ? 'amber' : 'emerald',
      },
      {
        label: 'Access events today',
        value: overview ? String(overview.accessEvents.today) : 'No data',
        detail: 'Door access records',
        tone: 'sky',
      },
      {
        label: 'Visitors onsite',
        value: overview ? String(overview.visitors.onsite) : 'No data',
        detail: 'Currently checked in',
        tone: overview && overview.visitors.onsite > 0 ? 'amber' : 'slate',
      },
      {
        label: 'Open alerts',
        value: overview ? String(overview.alerts.open) : 'No data',
        detail: 'Active or acknowledged',
        tone: overview && overview.alerts.open > 0 ? 'rose' : 'emerald',
      },
      {
        label: 'Smart Building tasks',
        value: overview ? String(overview.smartBuildingTasks?.security || 0) : 'No data',
        detail: 'Generated by IoT alerts',
        tone: overview && (overview.smartBuildingTasks?.security || 0) > 0 ? 'amber' : 'emerald',
      },
    ] as const,
    [overview]
  );
  const activeQuery = validTab === 'overview' ? overviewQuery : validTab === 'cctv' ? cctvQuery : validTab === 'access-logs' ? accessLogsQuery : validTab === 'visitors' ? visitorsQuery : alertsQuery;
  const activeLabel = tabs.find((tab) => tab.id === validTab)?.label || 'Security Center';

  return (
    <div className="space-y-6">
      <CollaborationHeader
        workspace="security"
        eyebrow="Operations / Security Center"
        title="Security Center"
        subtitle="CCTV, access logs, visitors, and alerts for the property security workflow."
        statusLabel="Live security workspace"
        statusTone={overview && overview.alerts.open > 0 ? 'warning' : 'live'}
        actions={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('laflo:open-assistant', { detail: { mode: 'operations', prompt: 'Review current security activity and recommend the next authorised action.', context: { page: 'Security Center', tab: validTab, openAlerts: overview?.alerts.open, visitorsOnsite: overview?.visitors.onsite } } }))} className="min-h-10 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-text-main">Ask LaFlo</button><button type="button" onClick={() => void refresh()} disabled={isRefreshing} className="min-h-10 rounded-xl bg-primary-solid px-4 text-sm font-semibold text-primary-contrast disabled:opacity-50">{isRefreshing ? 'Refreshing…' : 'Refresh security'}</button></div>}
      />

      {hasError && !activeQuery.isError ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          <span>Some Security Center services are disconnected.</span> <button type="button" onClick={() => void refresh()} disabled={isRefreshing} className="ml-2 font-semibold underline disabled:opacity-50">{isRefreshing ? 'Retrying…' : 'Try again'}</button>
        </div>
      ) : null}

      {validTab === 'overview' ? <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="Security Center summary">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} tone={metric.tone} />
        ))}
      </section> : null}

      {validTab === 'overview' ? <DepartmentIntelligenceCard department="security" /> : null}
      <nav className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm" aria-label="Security Center tabs">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to={tab.href}
            aria-current={validTab === tab.id ? 'page' : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${validTab === tab.id ? 'bg-primary-solid text-primary-contrast' : 'text-text-muted hover:bg-border/50 hover:text-text-main'}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeQuery.isLoading ? <LoadingState label={activeLabel} /> : activeQuery.isError ? <DisconnectedState label={activeLabel} onRetry={() => void activeQuery.refetch()} isRetrying={activeQuery.isFetching} /> : null}
      {!activeQuery.isLoading && !activeQuery.isError && validTab === 'overview' ? <ActivityList activities={overview?.recentActivity || []} /> : null}
      {!activeQuery.isLoading && !activeQuery.isError && validTab === 'cctv' ? (
        <div className="space-y-6">
          <HardwareIntegrationPanel mode="cctv" canManage={Boolean(canManageHardware)} surface="module" />
          <CctvPanel cameras={cameras} canManage={canManageHardware} />
        </div>
      ) : null}
      {!activeQuery.isLoading && !activeQuery.isError && validTab === 'access-logs' ? <AccessLogsPanel logs={accessLogs} /> : null}
      {!activeQuery.isLoading && !activeQuery.isError && validTab === 'visitors' ? (
        <VisitorsPanel
          visitors={visitors}
          onCreate={(payload) => createVisitorMutation.mutate(payload)}
          onCheckout={(visitorId) => checkoutVisitorMutation.mutate(visitorId)}
          isCreating={createVisitorMutation.isPending}
          isCheckingOut={checkoutVisitorMutation.isPending}
          canManage={canManageSecurity}
        />
      ) : null}
      {!activeQuery.isLoading && !activeQuery.isError && validTab === 'alerts' ? (
        <AlertsPanel
          alerts={alerts}
          tasks={tasks}
          onAcknowledge={(alertId) => acknowledgeAlertMutation.mutate(alertId)}
          onResolve={(alertId) => resolveAlertMutation.mutate(alertId)}
          isUpdating={acknowledgeAlertMutation.isPending || resolveAlertMutation.isPending}
          canManage={canManageSecurity}
        />
      ) : null}
    </div>
  );
}
