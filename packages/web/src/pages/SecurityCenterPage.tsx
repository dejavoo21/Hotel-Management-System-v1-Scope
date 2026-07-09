import { useMemo, useState, type FormEvent } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import securityCenterService, {
  type CreateVisitorPayload,
  type SecurityActivity,
  type Visitor,
} from '@/services/securityCenter';
import type { CameraFeed, DoorAccessEvent, SecurityAlert, SmartBuildingWorkflowTask } from '@/services/smartBuilding';
import DepartmentIntelligenceCard from '@/components/operations/DepartmentIntelligenceCard';
import AICopilotPanel from '@/components/ai/AICopilotPanel';
import CollaborationHeader from '@/components/collaboration/CollaborationHeader';
import HardwareIntegrationPanel from '@/components/hardware/HardwareIntegrationPanel';
import { useAuthStore } from '@/stores/authStore';

type TabId = 'overview' | 'cctv' | 'access-logs' | 'visitors' | 'alerts';
type Tone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';

const tabs: { id: TabId; label: string; href: string }[] = [
  { id: 'overview', label: 'Overview', href: '/security-center' },
  { id: 'cctv', label: 'CCTV', href: '/security-center/cctv' },
  { id: 'access-logs', label: 'Access Logs', href: '/security-center/access-logs' },
  { id: 'visitors', label: 'Visitors', href: '/security-center/visitors' },
  { id: 'alerts', label: 'Alerts', href: '/security-center/alerts' },
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
  slate: { card: 'border-slate-100 bg-slate-50/80', pill: 'bg-slate-200 text-slate-800', dot: 'bg-slate-500' },
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
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
    <p className="text-sm font-medium text-slate-700">{label}</p>
    <p className="mt-1 text-sm text-slate-500">Waiting for security data.</p>
  </div>
);

const MetricCard = ({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone: Tone }) => (
  <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses[tone].card}`}>
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-semibold text-slate-700">{label}</div>
      <span className={`h-2.5 w-2.5 rounded-full ${toneClasses[tone].dot}`} />
    </div>
    <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
    {detail ? <div className="mt-1 text-sm font-semibold text-slate-500">{detail}</div> : null}
  </div>
);

const ActivityList = ({ activities }: { activities: SecurityActivity[] }) => {
  if (activities.length === 0) return <EmptyState label="No recent security activity." />;

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">{activity.title}</div>
              <div className="mt-1 text-sm text-slate-600">{activity.detail || formatStatus(activity.type)}</div>
              {activity.sourceModule ? (
                <div className="mt-1 text-xs font-semibold text-sky-700">Source: {formatStatus(activity.sourceModule)}</div>
              ) : null}
              <div className="mt-1 text-xs text-slate-500">{formatDateTime(activity.occurredAt)}</div>
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
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-slate-900">{task.title}</div>
        <div className="mt-1 text-sm text-slate-600">{task.sourceSummary || task.description || task.sourceSignal || 'Smart Building security task'}</div>
        <div className="mt-1 text-xs font-semibold text-sky-700">Source: {formatStatus(task.sourceModule)}</div>
        {task.incidentNumber ? (
          <div className="mt-1 text-xs font-semibold text-rose-700">
            Incident: {task.incidentNumber} / {formatStatus(task.incidentStatus)}
          </div>
        ) : null}
        <div className="mt-1 text-xs text-slate-500">
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
      <div className="text-sm font-bold text-slate-900">Smart Building security tasks</div>
      <p className="mt-1 text-sm text-slate-500">Auto-created by forced door, camera offline, and panic button events.</p>
    </div>
    {tasks.length === 0 ? (
      <EmptyState label="No Smart Building security tasks yet." />
    ) : (
      tasks.map((task) => <SecurityTaskCard key={task.id} task={task} />)
    )}
  </div>
);

const CctvPanel = ({ cameras }: { cameras: CameraFeed[] }) => {
  if (cameras.length === 0) return <EmptyState label="No CCTV feeds connected." />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {cameras.map((camera) => (
        <div key={camera.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">{camera.name}</div>
              <div className="mt-1 text-sm text-slate-600">{camera.location || 'Location not set'}</div>
              <div className="mt-2 text-xs text-slate-500">Last seen {formatDateTime(camera.lastSeenAt)}</div>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(camera.status)].pill}`}>
              {formatStatus(camera.status)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

const AccessLogsPanel = ({ logs }: { logs: DoorAccessEvent[] }) => {
  if (logs.length === 0) return <EmptyState label="No access logs recorded." />;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {logs.slice(0, 50).map((event) => (
        <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
          <div>
            <div className="text-sm font-bold text-slate-900">{event.doorName || event.doorExternalId || 'Door access'}</div>
            <div className="mt-1 text-sm text-slate-600">{event.actorName || formatStatus(event.actorType)}</div>
            <div className="mt-1 text-xs text-slate-500">{formatDateTime(event.occurredAt)}</div>
          </div>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(event.result)].pill}`}>
            {formatStatus(event.result)}
          </span>
        </div>
      ))}
    </div>
  );
};

const VisitorsPanel = ({
  visitors,
  onCreate,
  onCheckout,
  isCreating,
  isCheckingOut,
}: {
  visitors: Visitor[];
  onCreate: (payload: CreateVisitorPayload) => void;
  onCheckout: (visitorId: string) => void;
  isCreating: boolean;
  isCheckingOut: boolean;
}) => {
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [purpose, setPurpose] = useState('');
  const [hostName, setHostName] = useState('');

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
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-bold text-slate-900">Register visitor</div>
        <div className="mt-4 space-y-3">
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" />
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose" />
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="Host" />
        </div>
        <button type="submit" disabled={isCreating || !fullName.trim()} className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
          Check in
        </button>
      </form>

      <div className="space-y-3">
        {visitors.length === 0 ? (
          <EmptyState label="No visitors recorded." />
        ) : (
          visitors.map((visitor) => (
            <div key={visitor.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">{visitor.fullName}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {[visitor.company, visitor.purpose, visitor.hostName ? `Host: ${visitor.hostName}` : null].filter(Boolean).join(' / ') || 'Visitor'}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    In {formatDateTime(visitor.checkInAt)}{visitor.checkOutAt ? ` / Out ${formatDateTime(visitor.checkOutAt)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(visitor.status)].pill}`}>
                    {formatStatus(visitor.status)}
                  </span>
                  {visitor.status === 'CHECKED_IN' ? (
                    <button type="button" disabled={isCheckingOut} onClick={() => onCheckout(visitor.id)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
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
}: {
  alerts: SecurityAlert[];
  tasks: SmartBuildingWorkflowTask[];
  onAcknowledge: (alertId: string) => void;
  onResolve: (alertId: string) => void;
}) => {
  return (
    <div className="space-y-3">
      <SecurityTasksPanel tasks={tasks} />
      {alerts.length === 0 ? (
        <EmptyState label="No security alerts recorded." />
      ) : (
        alerts.map((alert) => (
          <div key={alert.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-900">{alert.title}</div>
                <div className="mt-1 text-sm text-slate-600">{alert.message || alert.location || formatStatus(alert.alertType)}</div>
                <div className="mt-1 text-xs text-slate-500">{formatDateTime(alert.occurredAt)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(alert.status)].pill}`}>
                  {formatStatus(alert.status)}
                </span>
                {alert.status === 'ACTIVE' ? (
                  <button type="button" onClick={() => onAcknowledge(alert.id)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    Acknowledge
                  </button>
                ) : null}
                {alert.status !== 'RESOLVED' ? (
                  <button type="button" onClick={() => onResolve(alert.id)} className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    Resolve
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default function SecurityCenterPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const activeTab = (params.tab || 'overview') as TabId;
  const validTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : 'overview';

  const overviewQuery = useQuery({ queryKey: ['security-center', 'overview'], queryFn: securityCenterService.getOverview, ...realtimeQueryOptions });
  const cctvQuery = useQuery({ queryKey: ['security-center', 'cctv'], queryFn: securityCenterService.listCctv, ...realtimeQueryOptions });
  const accessLogsQuery = useQuery({ queryKey: ['security-center', 'access-logs'], queryFn: securityCenterService.listAccessLogs, ...realtimeQueryOptions });
  const visitorsQuery = useQuery({ queryKey: ['security-center', 'visitors'], queryFn: securityCenterService.listVisitors, ...realtimeQueryOptions });
  const alertsQuery = useQuery({ queryKey: ['security-center', 'alerts'], queryFn: securityCenterService.listAlerts, ...realtimeQueryOptions });
  const tasksQuery = useQuery({ queryKey: ['security-center', 'tasks'], queryFn: securityCenterService.listTasks, ...realtimeQueryOptions });

  const invalidateSecurityCenter = () => queryClient.invalidateQueries({ queryKey: ['security-center'] });
  const createVisitorMutation = useMutation({ mutationFn: securityCenterService.createVisitor, onSuccess: invalidateSecurityCenter });
  const checkoutVisitorMutation = useMutation({ mutationFn: securityCenterService.checkoutVisitor, onSuccess: invalidateSecurityCenter });
  const acknowledgeAlertMutation = useMutation({ mutationFn: securityCenterService.acknowledgeAlert, onSuccess: invalidateSecurityCenter });
  const resolveAlertMutation = useMutation({ mutationFn: securityCenterService.resolveAlert, onSuccess: invalidateSecurityCenter });

  const overview = overviewQuery.data;
  const cameras = cctvQuery.data || [];
  const accessLogs = accessLogsQuery.data || [];
  const visitors = visitorsQuery.data || [];
  const alerts = alertsQuery.data || [];
  const tasks = tasksQuery.data || [];
  const canManageHardware = user?.role === 'ADMIN' || user?.role === 'MANAGER' || (user?.modulePermissions || []).includes('security_center');
  const hasError = overviewQuery.isError || cctvQuery.isError || accessLogsQuery.isError || visitorsQuery.isError || alertsQuery.isError || tasksQuery.isError;

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

  return (
    <div className="space-y-6">
      <CollaborationHeader
        workspace="security"
        eyebrow="Operations / Security Center"
        title="Security Center"
        subtitle="CCTV, access logs, visitors, and alerts for the property security workflow."
        statusLabel="Live security workspace"
        statusTone={overview && overview.alerts.open > 0 ? 'warning' : 'live'}
      />

      {hasError ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          Security Center data could not be loaded.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Security Center summary">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} tone={metric.tone} />
        ))}
      </section>

      <DepartmentIntelligenceCard department="security" />
      <AICopilotPanel
        title="Security Copilot"
        contextScope={['hotelProfile', 'security', 'smartBuilding', 'incidents', 'tasks']}
      />

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Security Center tabs">
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.href}
            className={({ isActive }) =>
              `rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                (tab.id === 'overview' && validTab === 'overview') || isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {validTab === 'overview' ? <ActivityList activities={overview?.recentActivity || []} /> : null}
      {validTab === 'cctv' ? (
        <div className="space-y-6">
          <HardwareIntegrationPanel mode="cctv" canManage={Boolean(canManageHardware)} surface="module" />
          <CctvPanel cameras={cameras} />
        </div>
      ) : null}
      {validTab === 'access-logs' ? <AccessLogsPanel logs={accessLogs} /> : null}
      {validTab === 'visitors' ? (
        <VisitorsPanel
          visitors={visitors}
          onCreate={(payload) => createVisitorMutation.mutate(payload)}
          onCheckout={(visitorId) => checkoutVisitorMutation.mutate(visitorId)}
          isCreating={createVisitorMutation.isPending}
          isCheckingOut={checkoutVisitorMutation.isPending}
        />
      ) : null}
      {validTab === 'alerts' ? (
        <AlertsPanel
          alerts={alerts}
          tasks={tasks}
          onAcknowledge={(alertId) => acknowledgeAlertMutation.mutate(alertId)}
          onResolve={(alertId) => resolveAlertMutation.mutate(alertId)}
        />
      ) : null}
    </div>
  );
}
