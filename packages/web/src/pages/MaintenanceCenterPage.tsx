import { useMemo, useState, type FormEvent } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import maintenanceCenterService, {
  type AssetMaintenanceRecord,
  type CreateFaultPayload,
  type CreateRepairPayload,
  type CreateWorkOrderPayload,
  type MaintenanceActivity,
  type MaintenanceFault,
  type MaintenanceRepair,
  type MaintenanceWorkOrder,
  type PreventiveMaintenanceSchedule,
} from '@/services/maintenanceCenter';
import type { SmartBuildingWorkflowTask } from '@/services/smartBuilding';
import DepartmentIntelligenceCard from '@/components/operations/DepartmentIntelligenceCard';

type TabId = 'overview' | 'work-orders' | 'faults' | 'repairs' | 'preventive-maintenance' | 'assets';
type Tone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';

const tabs: { id: TabId; label: string; href: string }[] = [
  { id: 'overview', label: 'Overview', href: '/maintenance-center' },
  { id: 'work-orders', label: 'Work Orders', href: '/maintenance-center/work-orders' },
  { id: 'faults', label: 'Faults', href: '/maintenance-center/faults' },
  { id: 'repairs', label: 'Repairs', href: '/maintenance-center/repairs' },
  { id: 'preventive-maintenance', label: 'Preventive Maintenance', href: '/maintenance-center/preventive-maintenance' },
  { id: 'assets', label: 'Assets', href: '/maintenance-center/assets' },
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
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not scheduled';

const toneForStatus = (status: string): Tone => {
  if (['URGENT', 'CRITICAL', 'OVERDUE', 'NEEDS_REPAIR', 'OPEN'].includes(status)) return 'rose';
  if (['HIGH', 'IN_PROGRESS', 'WAITING_PARTS', 'DUE', 'ON_HOLD'].includes(status)) return 'amber';
  if (['COMPLETED', 'CLOSED', 'RESOLVED', 'OK'].includes(status)) return 'emerald';
  return 'slate';
};

const EmptyState = ({ label }: { label: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
    <p className="text-sm font-medium text-slate-700">{label}</p>
    <p className="mt-1 text-sm text-slate-500">Waiting for maintenance data.</p>
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

const ActivityList = ({ activities }: { activities: MaintenanceActivity[] }) => {
  if (activities.length === 0) return <EmptyState label="No recent maintenance activity." />;

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

const SmartBuildingTaskCard = ({ task }: { task: SmartBuildingWorkflowTask }) => (
  <RecordCard
    title={task.title}
    detail={task.sourceSummary || task.description || task.sourceSignal || 'Smart Building workflow task'}
    status={task.status}
    meta={[
      task.incidentNumber ? `Incident: ${task.incidentNumber} (${formatStatus(task.incidentStatus)})` : null,
      task.location ? `Location: ${task.location}` : null,
      task.deviceExternalId ? `Device: ${task.deviceExternalId}` : null,
      task.dueAt ? `Due ${formatDateTime(task.dueAt)}` : null,
    ].filter(Boolean).join(' / ')}
    sourceModule={task.sourceModule}
  />
);

const GeneratedTasksPanel = ({ tasks, emptyLabel }: { tasks: SmartBuildingWorkflowTask[]; emptyLabel: string }) => (
  <div className="space-y-3">
    <div>
      <div className="text-sm font-bold text-slate-900">Smart Building generated work</div>
      <p className="mt-1 text-sm text-slate-500">Auto-created by water leak, HVAC, and sensor workflow events.</p>
    </div>
    {tasks.length === 0 ? (
      <EmptyState label={emptyLabel} />
    ) : (
      tasks.map((task) => <SmartBuildingTaskCard key={task.id} task={task} />)
    )}
  </div>
);

const CreateForm = ({
  label,
  placeholder,
  onSubmit,
  disabled,
}: {
  label: string;
  placeholder: string;
  onSubmit: (title: string) => void;
  disabled?: boolean;
}) => {
  const [title, setTitle] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onSubmit(title.trim());
    setTitle('');
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-bold text-slate-900">{label}</div>
      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={placeholder}
        />
        <button
          type="submit"
          disabled={disabled || !title.trim()}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Add
        </button>
      </div>
    </form>
  );
};

const WorkOrdersPanel = ({
  workOrders,
  smartBuildingTasks,
  onCreate,
  isCreating,
}: {
  workOrders: MaintenanceWorkOrder[];
  smartBuildingTasks: SmartBuildingWorkflowTask[];
  onCreate: (payload: CreateWorkOrderPayload) => void;
  isCreating: boolean;
}) => (
  <div className="space-y-4">
    <GeneratedTasksPanel tasks={smartBuildingTasks} emptyLabel="No Smart Building maintenance tasks yet." />
    <CreateForm label="Create work order" placeholder="Work order title" disabled={isCreating} onSubmit={(title) => onCreate({ title, priority: 'MEDIUM', status: 'OPEN' })} />
    {workOrders.length === 0 ? (
      <EmptyState label="No work orders recorded." />
    ) : (
      <div className="space-y-3">
        {workOrders.map((item) => (
          <RecordCard key={item.id} title={item.title} detail={item.location || item.assetName || item.category} status={item.status} meta={item.dueAt ? `Due ${formatDateTime(item.dueAt)}` : item.assignedTo || 'Unassigned'} />
        ))}
      </div>
    )}
  </div>
);

const FaultsPanel = ({ faults, onCreate, isCreating }: { faults: MaintenanceFault[]; onCreate: (payload: CreateFaultPayload) => void; isCreating: boolean }) => (
  <div className="space-y-4">
    <CreateForm label="Record fault" placeholder="Fault title" disabled={isCreating} onSubmit={(title) => onCreate({ title, severity: 'MEDIUM', status: 'OPEN' })} />
    {faults.length === 0 ? (
      <EmptyState label="No faults recorded." />
    ) : (
      <div className="space-y-3">
        {faults.map((item) => (
          <RecordCard key={item.id} title={item.title} detail={item.location || item.assetName || item.description} status={item.severity} meta={`${formatStatus(item.status)} / ${formatDateTime(item.reportedAt)}`} />
        ))}
      </div>
    )}
  </div>
);

const RepairsPanel = ({ repairs, onCreate, isCreating }: { repairs: MaintenanceRepair[]; onCreate: (payload: CreateRepairPayload) => void; isCreating: boolean }) => (
  <div className="space-y-4">
    <CreateForm label="Record repair" placeholder="Repair title" disabled={isCreating} onSubmit={(title) => onCreate({ title, status: 'SCHEDULED' })} />
    {repairs.length === 0 ? (
      <EmptyState label="No repairs recorded." />
    ) : (
      <div className="space-y-3">
        {repairs.map((item) => (
          <RecordCard key={item.id} title={item.title} detail={item.technician || item.description} status={item.status} meta={item.completedAt ? `Completed ${formatDateTime(item.completedAt)}` : item.startedAt ? `Started ${formatDateTime(item.startedAt)}` : 'Not started'} />
        ))}
      </div>
    )}
  </div>
);

const PreventivePanel = ({ schedules }: { schedules: PreventiveMaintenanceSchedule[] }) => (
  schedules.length === 0 ? (
    <EmptyState label="No preventive maintenance schedules." />
  ) : (
    <div className="space-y-3">
      {schedules.map((item) => (
        <RecordCard key={item.id} title={item.title} detail={`${item.assetName} / ${formatStatus(item.frequency)}`} status={item.status} meta={`Next due ${formatDateTime(item.nextDueAt)}`} />
      ))}
    </div>
  )
);

const AssetsPanel = ({ assets }: { assets: AssetMaintenanceRecord[] }) => (
  assets.length === 0 ? (
    <EmptyState label="No asset maintenance records." />
  ) : (
    <div className="space-y-3">
      {assets.map((item) => (
        <RecordCard key={item.id} title={item.assetName} detail={item.location || item.device?.deviceType || item.notes} status={item.inspectionStatus} meta={item.nextInspectionAt ? `Next inspection ${formatDateTime(item.nextInspectionAt)}` : 'No inspection scheduled'} />
      ))}
    </div>
  )
);

const RecordCard = ({
  title,
  detail,
  status,
  meta,
  sourceModule,
}: {
  title: string;
  detail?: string | null;
  status: string;
  meta?: string;
  sourceModule?: string | null;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-slate-900">{title}</div>
        {detail ? <div className="mt-1 text-sm text-slate-600">{detail}</div> : null}
        {sourceModule ? <div className="mt-1 text-xs font-semibold text-sky-700">Source: {formatStatus(sourceModule)}</div> : null}
        {meta ? <div className="mt-1 text-xs text-slate-500">{meta}</div> : null}
      </div>
      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(status)].pill}`}>
        {formatStatus(status)}
      </span>
    </div>
  </div>
);

export default function MaintenanceCenterPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const activeTab = (params.tab || 'overview') as TabId;
  const validTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : 'overview';

  const overviewQuery = useQuery({ queryKey: ['maintenance-center', 'overview'], queryFn: maintenanceCenterService.getOverview, ...realtimeQueryOptions });
  const workOrdersQuery = useQuery({ queryKey: ['maintenance-center', 'work-orders'], queryFn: maintenanceCenterService.listWorkOrders, ...realtimeQueryOptions });
  const faultsQuery = useQuery({ queryKey: ['maintenance-center', 'faults'], queryFn: maintenanceCenterService.listFaults, ...realtimeQueryOptions });
  const repairsQuery = useQuery({ queryKey: ['maintenance-center', 'repairs'], queryFn: maintenanceCenterService.listRepairs, ...realtimeQueryOptions });
  const preventiveQuery = useQuery({ queryKey: ['maintenance-center', 'preventive-maintenance'], queryFn: maintenanceCenterService.listPreventiveMaintenance, ...realtimeQueryOptions });
  const assetsQuery = useQuery({ queryKey: ['maintenance-center', 'assets'], queryFn: maintenanceCenterService.listAssets, ...realtimeQueryOptions });
  const smartBuildingTasksQuery = useQuery({ queryKey: ['maintenance-center', 'smart-building-tasks'], queryFn: maintenanceCenterService.listSmartBuildingTasks, ...realtimeQueryOptions });

  const invalidateMaintenanceCenter = () => queryClient.invalidateQueries({ queryKey: ['maintenance-center'] });
  const createWorkOrderMutation = useMutation({ mutationFn: maintenanceCenterService.createWorkOrder, onSuccess: invalidateMaintenanceCenter });
  const createFaultMutation = useMutation({ mutationFn: maintenanceCenterService.createFault, onSuccess: invalidateMaintenanceCenter });
  const createRepairMutation = useMutation({ mutationFn: maintenanceCenterService.createRepair, onSuccess: invalidateMaintenanceCenter });

  const overview = overviewQuery.data;
  const smartBuildingTasks = smartBuildingTasksQuery.data || [];
  const hasError = overviewQuery.isError || workOrdersQuery.isError || faultsQuery.isError || repairsQuery.isError || preventiveQuery.isError || assetsQuery.isError || smartBuildingTasksQuery.isError;

  const metrics = useMemo(
    () => [
      { label: 'Open work orders', value: overview ? String(overview.workOrders.open) : 'No data', detail: 'Open or active', tone: overview && overview.workOrders.open > 0 ? 'amber' : 'emerald' },
      { label: 'Urgent faults', value: overview ? String(overview.faults.urgent) : 'No data', detail: 'Urgent or critical', tone: overview && overview.faults.urgent > 0 ? 'rose' : 'emerald' },
      { label: 'Repairs in progress', value: overview ? String(overview.repairs.inProgress) : 'No data', detail: 'Currently active', tone: overview && overview.repairs.inProgress > 0 ? 'sky' : 'slate' },
      { label: 'Overdue maintenance', value: overview ? String(overview.preventiveMaintenance.overdue) : 'No data', detail: 'Past due schedules', tone: overview && overview.preventiveMaintenance.overdue > 0 ? 'rose' : 'emerald' },
      { label: 'Assets due inspection', value: overview ? String(overview.assets.dueInspection) : 'No data', detail: 'Due or needs repair', tone: overview && overview.assets.dueInspection > 0 ? 'amber' : 'emerald' },
      { label: 'Completed today', value: overview ? String(overview.completed.today) : 'No data', detail: 'Work completed', tone: 'emerald' },
      { label: 'Smart Building tasks', value: overview ? String(overview.smartBuildingTasks?.maintenance || 0) : 'No data', detail: 'Generated by IoT alerts', tone: overview && (overview.smartBuildingTasks?.maintenance || 0) > 0 ? 'amber' : 'emerald' },
    ] as const,
    [overview]
  );

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operations / Maintenance Center</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Maintenance Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Work orders, faults, repairs, preventive maintenance, and asset inspection records.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Maintenance workspace
          </span>
        </div>
        {hasError ? (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            Maintenance Center data could not be loaded.
          </div>
        ) : null}
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6" aria-label="Maintenance Center summary">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} tone={metric.tone} />
        ))}
      </section>

      <DepartmentIntelligenceCard department="maintenance" />

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Maintenance Center tabs">
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
      {validTab === 'work-orders' ? <WorkOrdersPanel workOrders={workOrdersQuery.data || []} smartBuildingTasks={smartBuildingTasks} onCreate={(payload) => createWorkOrderMutation.mutate(payload)} isCreating={createWorkOrderMutation.isPending} /> : null}
      {validTab === 'faults' ? <FaultsPanel faults={faultsQuery.data || []} onCreate={(payload) => createFaultMutation.mutate(payload)} isCreating={createFaultMutation.isPending} /> : null}
      {validTab === 'repairs' ? <RepairsPanel repairs={repairsQuery.data || []} onCreate={(payload) => createRepairMutation.mutate(payload)} isCreating={createRepairMutation.isPending} /> : null}
      {validTab === 'preventive-maintenance' ? <PreventivePanel schedules={preventiveQuery.data || []} /> : null}
      {validTab === 'assets' ? <AssetsPanel assets={assetsQuery.data || []} /> : null}
    </div>
  );
}
