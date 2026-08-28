import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import smartBuildingService, {
  type DoorAccessEvent,
  type DoorStatus,
  type IoTDevice,
  type SecurityAlert,
  type SensorReading,
  type SmartBuildingWorkflowTask,
  type SmartBuildingOverview,
} from '@/services/smartBuilding';
import HardwareIntegrationPanel from '@/components/hardware/HardwareIntegrationPanel';
import CollaborationHeader from '@/components/collaboration/CollaborationHeader';
import { useAuthStore } from '@/stores/authStore';

type BuildingMetric = {
  label: string;
  value: string;
  detail?: string;
  tone: 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';
};

type BuildingSection = {
  title: string;
  description: string;
  items: { label: string; value: string; status: string; tone: BuildingMetric['tone'] }[];
};

const toneClasses: Record<BuildingMetric['tone'], { card: string; pill: string; dot: string }> = {
  emerald: {
    card: 'border-emerald-100 bg-emerald-50/60',
    pill: 'bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-500',
  },
  sky: {
    card: 'border-sky-100 bg-sky-50/60',
    pill: 'bg-sky-100 text-sky-800',
    dot: 'bg-sky-500',
  },
  amber: {
    card: 'border-amber-100 bg-amber-50/70',
    pill: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
  },
  rose: {
    card: 'border-rose-100 bg-rose-50/70',
    pill: 'bg-rose-100 text-rose-800',
    dot: 'bg-rose-500',
  },
  slate: {
    card: 'border-border bg-bg/80',
    pill: 'bg-border text-text-main',
    dot: 'bg-bg0',
  },
};

const realtimeQueryOptions = {
  refetchInterval: 15_000,
  refetchIntervalInBackground: true,
  staleTime: 5_000,
};

const formatStatus = (value?: string | null) =>
  (value || 'Unknown')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDateTime = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not recorded';

const askLaflo = (prompt: string, context: Record<string, unknown>) => window.dispatchEvent(new CustomEvent('laflo:open-assistant', { detail: { mode: 'operations', prompt, context: { page: 'Smart Building', ...context } } }));

const emptyMetric = (label: string, tone: BuildingMetric['tone'] = 'slate'): BuildingMetric => ({
  label,
  value: 'No data',
  detail: 'Waiting for events',
  tone,
});

const emptyItem = (label: string) => ({
  label,
  value: 'No records yet',
  status: 'Empty',
  tone: 'slate' as const,
});

const metricList = (overview?: SmartBuildingOverview, hasRecords = false): BuildingMetric[] => {
  if (!overview || !hasRecords) {
    return [
      emptyMetric('Building Health'),
      emptyMetric('Connected Devices', 'emerald'),
      emptyMetric('Offline Devices', 'amber'),
      emptyMetric('Active Device Alerts', 'rose'),
    ];
  }

  const offlineDevices = Math.max(overview.health.totalDevices - overview.health.onlineDevices, 0);
  return [
    {
      label: 'Building Health',
      value: overview.health.totalDevices > 0 ? `${Math.round((overview.health.onlineDevices / overview.health.totalDevices) * 100)}%` : 'No data',
      detail: `${overview.health.onlineDevices}/${overview.health.totalDevices} devices reporting`,
      tone: overview.health.activeAlerts > 0 || offlineDevices > 0 ? 'amber' : 'emerald',
    },
    {
      label: 'Connected Devices',
      value: String(overview.health.onlineDevices),
      detail: 'Currently online',
      tone: 'emerald',
    },
    {
      label: 'Offline Devices',
      value: String(offlineDevices),
      detail: 'Connection attention required',
      tone: offlineDevices > 0 ? 'amber' : 'emerald',
    },
    {
      label: 'Active Device Alerts',
      value: String(overview.health.activeAlerts),
      detail: 'Across doors, sensors, and devices',
      tone: overview.health.activeAlerts > 0 ? 'rose' : 'emerald',
    },
  ];
};

const toneForStatus = (status: string): BuildingMetric['tone'] => {
  if (['ALERT', 'OFFLINE', 'CRITICAL', 'FORCED_OPEN', 'FORCED', 'ACTIVE'].includes(status)) return 'rose';
  if (['WARNING', 'HELD_OPEN', 'OPEN', 'DENIED', 'ACKNOWLEDGED'].includes(status)) return 'amber';
  if (['ONLINE', 'NORMAL', 'LOCKED', 'RESOLVED', 'GRANTED'].includes(status)) return 'emerald';
  return 'sky';
};

const buildDoorItems = (doors: DoorStatus[], accessEvents: DoorAccessEvent[]) => {
  const doorItems = doors.slice(0, 3).map((door) => ({
    label: door.name,
    value: `${formatStatus(door.lockState)} / ${formatStatus(door.openState)}`,
    status: door.batteryLevel == null ? formatStatus(door.openState) : `${door.batteryLevel}% battery`,
    tone: toneForStatus(door.openState),
  }));

  if (doorItems.length > 0) return doorItems;

  return accessEvents.slice(0, 3).map((event) => ({
    label: event.doorName || event.doorExternalId || 'Door access',
    value: formatStatus(event.result),
    status: event.actorName || formatStatus(event.actorType),
    tone: toneForStatus(event.result),
  }));
};

const buildSensorItems = (readings: SensorReading[], alerts: SecurityAlert[]) => {
  const sensorItems = readings
    .filter((reading) => !['ENERGY', 'POWER', 'HVAC'].includes(reading.sensorType))
    .slice(0, 3)
    .map((reading) => ({
      label: formatStatus(reading.sensorType),
      value: `${reading.value} ${reading.unit}`,
      status: reading.location || formatStatus(reading.status),
      tone: toneForStatus(reading.status),
    }));

  if (sensorItems.length > 0) return sensorItems;

  return alerts
    .filter((alert) => ['WATER_LEAK', 'PANIC', 'MOTION', 'OTHER'].includes(alert.alertType))
    .slice(0, 3)
    .map((alert) => ({
      label: alert.title,
      value: formatStatus(alert.severity),
      status: formatStatus(alert.status),
      tone: toneForStatus(alert.status),
    }));
};

const buildEnergyItems = (readings: SensorReading[]) =>
  readings
    .filter((reading) => ['ENERGY', 'POWER'].includes(reading.sensorType))
    .slice(0, 3)
    .map((reading) => ({
      label: reading.location || formatStatus(reading.sensorType),
      value: `${reading.value} ${reading.unit}`,
      status: formatStatus(reading.status),
      tone: toneForStatus(reading.status),
    }));

const buildHvacItems = (devices: IoTDevice[], readings: SensorReading[]) => {
  const hvacDevices = devices
    .filter((device) => device.deviceType === 'HVAC')
    .slice(0, 3)
    .map((device) => ({
      label: device.name,
      value: device.location || device.zone || 'Connected unit',
      status: formatStatus(device.status),
      tone: toneForStatus(device.status),
    }));

  if (hvacDevices.length > 0) return hvacDevices;

  return readings
    .filter((reading) => reading.sensorType === 'HVAC')
    .slice(0, 3)
    .map((reading) => ({
      label: reading.location || 'HVAC reading',
      value: `${reading.value} ${reading.unit}`,
      status: formatStatus(reading.status),
      tone: toneForStatus(reading.status),
    }));
};

const buildAssetItems = (devices: IoTDevice[], alerts: SecurityAlert[]) => {
  const deviceItems = devices
    .filter((device) => !['CAMERA', 'DOOR_LOCK', 'HVAC'].includes(device.deviceType))
    .slice(0, 3)
    .map((device) => ({
      label: device.name,
      value: device.location || device.vendor || formatStatus(device.deviceType),
      status: formatStatus(device.status),
      tone: toneForStatus(device.status),
    }));

  if (deviceItems.length > 0) return deviceItems;

  return alerts.slice(0, 3).map((alert) => ({
    label: alert.title,
    value: alert.location || formatStatus(alert.alertType),
    status: formatStatus(alert.status),
    tone: toneForStatus(alert.status),
  }));
};

const signalForAlert = (alert: SecurityAlert) => {
  if (alert.alertType === 'WATER_LEAK') return 'WATER_LEAK';
  if (alert.alertType === 'PANIC') return 'PANIC_BUTTON';
  if (alert.alertType === 'FORCED_DOOR') return 'DOOR_FORCED';
  if (alert.alertType === 'CAMERA_OFFLINE') return 'CAMERA_OFFLINE';
  if (alert.alertType === 'HVAC') return 'HVAC_ALERT';
  if (alert.alertType === 'DEVICE_OFFLINE') return 'SENSOR_OFFLINE';
  return alert.alertType;
};

const findTaskForAlert = (alert: SecurityAlert, tasks: SmartBuildingWorkflowTask[]) => {
  const signal = signalForAlert(alert);
  return tasks.find((task) => {
    if (task.sourceSignal === signal) {
      if (alert.location && task.location) return alert.location === task.location;
      return true;
    }
    if (alert.location && task.location) return alert.location === task.location;
    return false;
  });
};

const AlertWorkflowPanel = ({ alerts, tasks }: { alerts: SecurityAlert[]; tasks: SmartBuildingWorkflowTask[] }) => {
  if (alerts.length === 0 && tasks.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-bg px-6 py-8 text-center">
        <p className="text-sm font-medium text-text-main">No Smart Building alert workflows yet.</p>
        <p className="mt-1 text-sm text-text-muted">Generated tasks will appear here after critical IoT events.</p>
      </div>
    );
  }

  const recentAlerts = alerts.slice(0, 6);
  const unmatchedTasks = tasks
    .filter((task) => !recentAlerts.some((alert) => findTaskForAlert(alert, [task])))
    .slice(0, 4);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-text-main">Alert Workflows</h2>
          <p className="mt-1 text-sm text-text-muted">Shows whether Smart Building alerts already created a Platform Core task.</p>
        </div>
        <span className="rounded-full bg-border/50 px-3 py-1 text-xs font-semibold text-text-main">
          {tasks.length} linked tasks
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {recentAlerts.map((alert) => {
          const task = findTaskForAlert(alert, tasks);
          return (
            <div key={alert.id} className="rounded-2xl border border-border bg-bg p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-text-main">{alert.title}</div>
                  <div className="mt-1 text-sm text-text-muted">{alert.message || alert.location || formatStatus(alert.alertType)}</div>
                  <div className="mt-1 text-xs text-text-muted">{alert.location || 'Location not set'}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(alert.status)].pill}`}>
                    {formatStatus(alert.status)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      task ? 'bg-emerald-100 text-emerald-800' : 'bg-border text-text-main'
                    }`}
                  >
                    {task ? `Task linked: ${formatStatus(task.status)}` : 'No linked task yet'}
                  </span>
                  {task?.incidentNumber ? (
                    <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">
                      Incident {task.incidentNumber}: {formatStatus(task.incidentStatus)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {unmatchedTasks.map((task) => (
          <div key={task.id} className="rounded-2xl border border-border bg-bg p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-text-main">{task.title}</div>
                <div className="mt-1 text-sm text-text-muted">{task.sourceSummary || task.description || task.sourceSignal}</div>
                <div className="mt-1 text-xs text-text-muted">
                  {[task.location, task.deviceExternalId].filter(Boolean).join(' / ') || 'Smart Building task'}
                </div>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(task.status)].pill}`}>
                {formatStatus(task.status)}
              </span>
              {task.incidentNumber ? (
                <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">
                  Incident {task.incidentNumber}: {formatStatus(task.incidentStatus)}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const WorkspaceEmptyState = ({ label }: { label: string }) => <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center"><p className="text-sm font-semibold text-text-main">{label}</p><p className="mt-1 text-sm text-text-muted">Waiting for a connected building service.</p></div>;

const WorkspaceDisconnectedState = ({ label, onRetry, isRetrying }: { label: string; onRetry: () => void; isRetrying: boolean }) => <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-900"><p className="font-semibold">{label} service is disconnected.</p><p className="mt-1">Live records are unavailable. No placeholder data is being shown.</p><button type="button" onClick={onRetry} disabled={isRetrying} className="mt-3 rounded-xl border border-amber-300 px-3 py-2 font-semibold disabled:opacity-50">{isRetrying ? 'Retrying…' : 'Retry connection'}</button></div>;

const DoorsPanel = ({ doors, accessEvents }: { doors: DoorStatus[]; accessEvents: DoorAccessEvent[] }) => {
  if (doors.length === 0) return <WorkspaceEmptyState label="No doors connected." />;
  return <div className="space-y-3">{doors.map((door) => {
    const lastEvent = accessEvents.find((event) => event.doorExternalId === door.externalId || event.doorName === door.name);
    const heldOpen = ['HELD_OPEN', 'FORCED_OPEN', 'OPEN'].includes(door.openState);
    return <article key={door.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="text-sm font-bold text-text-main">{door.name}</h2><p className="mt-1 text-sm text-text-muted">{door.location || `Floor ${door.floor ?? 'not set'}`}</p><div className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-3"><span><strong className="text-text-main">Lock:</strong> {formatStatus(door.lockState)}</span><span><strong className="text-text-main">Access:</strong> {formatStatus(door.openState)}</span><span><strong className="text-text-main">Last activity:</strong> {formatDateTime(door.lastEventAt || lastEvent?.occurredAt)}</span></div>{heldOpen ? <p className="mt-2 text-xs font-semibold text-amber-700">Held-open or open state requires review.</p> : null}</div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(door.openState)].pill}`}>{formatStatus(door.openState)}</span><button type="button" onClick={() => askLaflo(`Review door ${door.name} and its latest access state.`, { tab: 'doors', doorId: door.id, door: door.name, lockState: door.lockState, accessState: door.openState, lastActivity: door.lastEventAt || lastEvent?.occurredAt })} className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-text-main">Ask LaFlo</button></div></div></article>;
  })}</div>;
};

const SensorsPanel = ({ readings, alerts }: { readings: SensorReading[]; alerts: SecurityAlert[] }) => {
  const sensorReadings = readings.filter((reading) => !['ENERGY', 'POWER', 'HVAC'].includes(reading.sensorType));
  if (sensorReadings.length === 0) return <WorkspaceEmptyState label="No sensor readings available." />;
  return <div className="space-y-3">{sensorReadings.map((reading) => {
    const relatedAlerts = alerts.filter((alert) => alert.location && reading.location && alert.location === reading.location && alert.status !== 'RESOLVED');
    return <article key={reading.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold text-text-main">{formatStatus(reading.sensorType)} sensor</h2><span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(reading.status)].pill}`}>{formatStatus(reading.status)}</span></div><p className="mt-1 text-sm text-text-muted">{reading.location || 'Location not set'}</p><div className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-3"><span><strong className="text-text-main">Last reading:</strong> {reading.value} {reading.unit}</span><span><strong className="text-text-main">Last seen:</strong> {formatDateTime(reading.recordedAt)}</span><span><strong className="text-text-main">Alerts:</strong> {relatedAlerts.length}</span></div></div><button type="button" onClick={() => askLaflo(`Review the ${formatStatus(reading.sensorType)} sensor at ${reading.location || 'the property'}.`, { tab: 'sensors', sensorId: reading.id, sensorType: reading.sensorType, status: reading.status, lastReading: `${reading.value} ${reading.unit}`, alerts: relatedAlerts.length })} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-main">Ask LaFlo</button></div></article>;
  })}</div>;
};

const DevicesPanel = ({ devices, canManage }: { devices: IoTDevice[]; canManage: boolean }) => {
  if (devices.length === 0) return <WorkspaceEmptyState label="No devices connected." />;
  return <div className="space-y-3"><div className="flex justify-end">{canManage ? <Link to="/settings?tab=integrations" className="rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast">Open Integration Manager</Link> : <button type="button" disabled title="Permission required" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-muted opacity-60">Integration Manager · Permission required</button>}</div>{devices.map((device) => <article key={device.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold text-text-main">{device.name}</h2><span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(device.status)].pill}`}>{formatStatus(device.status)}</span></div><p className="mt-1 text-sm text-text-muted">{device.location || device.zone || 'Location not set'}</p><div className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-4"><span><strong className="text-text-main">Provider:</strong> {device.vendor || 'Unknown'}</span><span><strong className="text-text-main">Health:</strong> {device.status === 'ONLINE' ? 'Healthy' : 'Attention required'}</span><span><strong className="text-text-main">Connection:</strong> {formatStatus(device.status)}</span><span><strong className="text-text-main">Last sync:</strong> {formatDateTime(device.lastSeenAt)}</span></div></div><button type="button" onClick={() => askLaflo(`Review device ${device.name} and its connection health.`, { tab: 'devices', deviceId: device.id, deviceType: device.deviceType, provider: device.vendor, status: device.status, lastSync: device.lastSeenAt })} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-main">Ask LaFlo</button></div></article>)}</div>;
};

const sectionList = ({
  doors,
  accessEvents,
  readings,
  alerts,
  devices,
}: {
  doors: DoorStatus[];
  accessEvents: DoorAccessEvent[];
  readings: SensorReading[];
  alerts: SecurityAlert[];
  devices: IoTDevice[];
}): BuildingSection[] => [
  {
    title: 'Doors',
    description: 'Lock state, forced-open activity, and high-traffic entries.',
    items: buildDoorItems(doors, accessEvents),
  },
  {
    title: 'Sensors',
    description: 'Temperature, motion, leak detection, and panic button telemetry.',
    items: buildSensorItems(readings, alerts),
  },
  {
    title: 'Energy',
    description: 'Consumption, savings opportunities, and abnormal usage patterns.',
    items: buildEnergyItems(readings),
  },
  {
    title: 'HVAC',
    description: 'Climate control health across rooms, public areas, and plant systems.',
    items: buildHvacItems(devices, readings),
  },
  {
    title: 'Assets',
    description: 'Connected devices, inspection status, and maintenance readiness.',
    items: buildAssetItems(devices, alerts),
  },
].map((section) => ({
  ...section,
  items: section.items.length > 0 ? section.items : [emptyItem(section.title)],
}));

export default function SmartBuildingPage() {
  const { user } = useAuthStore();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  type SmartTab = 'overview' | 'doors' | 'sensors' | 'devices';
  const legacyTab = location.pathname.endsWith('/doors') ? 'doors' : location.pathname.endsWith('/sensors') ? 'sensors' : location.pathname.endsWith('/devices') ? 'devices' : null;
  const requestedTab = (searchParams.get('tab') || legacyTab || 'overview') as SmartTab;
  const activeTab: SmartTab = ['overview', 'doors', 'sensors', 'devices'].includes(requestedTab) ? requestedTab : 'overview';
  const overviewQuery = useQuery({
    queryKey: ['smart-building', 'overview'],
    queryFn: smartBuildingService.getOverview,
    ...realtimeQueryOptions,
  });
  const devicesQuery = useQuery({
    queryKey: ['smart-building', 'devices'],
    queryFn: smartBuildingService.listDevices,
    ...realtimeQueryOptions,
  });
  const camerasQuery = useQuery({
    queryKey: ['smart-building', 'cameras'],
    queryFn: smartBuildingService.listCameraFeeds,
    ...realtimeQueryOptions,
  });
  const accessEventsQuery = useQuery({
    queryKey: ['smart-building', 'access-events'],
    queryFn: smartBuildingService.listDoorAccessEvents,
    ...realtimeQueryOptions,
  });
  const doorStatusesQuery = useQuery({
    queryKey: ['smart-building', 'door-statuses'],
    queryFn: smartBuildingService.listDoorStatuses,
    ...realtimeQueryOptions,
  });
  const sensorReadingsQuery = useQuery({
    queryKey: ['smart-building', 'sensor-readings'],
    queryFn: smartBuildingService.listSensorReadings,
    ...realtimeQueryOptions,
  });
  const alertsQuery = useQuery({
    queryKey: ['smart-building', 'alerts'],
    queryFn: smartBuildingService.listSecurityAlerts,
    ...realtimeQueryOptions,
  });
  const linkedTasksQuery = useQuery({
    queryKey: ['smart-building', 'linked-tasks'],
    queryFn: smartBuildingService.listLinkedTasks,
    ...realtimeQueryOptions,
  });

  const devices = devicesQuery.data || [];
  const cameras = camerasQuery.data || [];
  const accessEvents = accessEventsQuery.data || [];
  const doors = doorStatusesQuery.data || [];
  const readings = sensorReadingsQuery.data || [];
  const alerts = alertsQuery.data || [];
  const linkedTasks = linkedTasksQuery.data || [];
  const hasRecords =
    devices.length + cameras.length + accessEvents.length + doors.length + readings.length + alerts.length + linkedTasks.length > 0;
  const isLoading =
    overviewQuery.isLoading ||
    devicesQuery.isLoading ||
    camerasQuery.isLoading ||
    accessEventsQuery.isLoading ||
    doorStatusesQuery.isLoading ||
    sensorReadingsQuery.isLoading ||
    alertsQuery.isLoading ||
    linkedTasksQuery.isLoading;
  const hasError =
    overviewQuery.isError ||
    devicesQuery.isError ||
    camerasQuery.isError ||
    accessEventsQuery.isError ||
    doorStatusesQuery.isError ||
    sensorReadingsQuery.isError ||
    alertsQuery.isError ||
    linkedTasksQuery.isError;
  const isRefreshing = overviewQuery.isFetching || devicesQuery.isFetching || camerasQuery.isFetching || accessEventsQuery.isFetching || doorStatusesQuery.isFetching || sensorReadingsQuery.isFetching || alertsQuery.isFetching || linkedTasksQuery.isFetching;
  const refresh = async () => {
    const results = await Promise.all([overviewQuery.refetch(), devicesQuery.refetch(), camerasQuery.refetch(), accessEventsQuery.refetch(), doorStatusesQuery.refetch(), sensorReadingsQuery.refetch(), alertsQuery.refetch(), linkedTasksQuery.refetch()]);
    const failed = results.filter((result) => result.isError).length;
    if (!failed) toast.success('Smart Building status refreshed');
    else if (failed < results.length) toast.error('Smart Building partially refreshed. Some systems are unavailable.');
    else toast.error('Smart Building refresh failed.');
  };
  const metrics = metricList(overviewQuery.data, hasRecords);
  const sections = sectionList({ doors, accessEvents, readings, alerts, devices });
  const activeAlerts = overviewQuery.data?.health.activeAlerts || 0;
  const onlineDevices = overviewQuery.data?.health.onlineDevices || 0;
  const totalDevices = overviewQuery.data?.health.totalDevices || 0;
  const canManageHardware = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const activeIsLoading = activeTab === 'overview' ? isLoading : activeTab === 'doors' ? doorStatusesQuery.isLoading || accessEventsQuery.isLoading : activeTab === 'sensors' ? sensorReadingsQuery.isLoading || alertsQuery.isLoading : devicesQuery.isLoading;
  const activeHasError = activeTab === 'overview' ? hasError : activeTab === 'doors' ? doorStatusesQuery.isError || accessEventsQuery.isError : activeTab === 'sensors' ? sensorReadingsQuery.isError || alertsQuery.isError : devicesQuery.isError;
  const activeIsFetching = activeTab === 'overview' ? isRefreshing : activeTab === 'doors' ? doorStatusesQuery.isFetching || accessEventsQuery.isFetching : activeTab === 'sensors' ? sensorReadingsQuery.isFetching || alertsQuery.isFetching : devicesQuery.isFetching;
  const retryActiveTab = () => {
    if (activeTab === 'overview') return void refresh();
    if (activeTab === 'doors') { void Promise.all([doorStatusesQuery.refetch(), accessEventsQuery.refetch()]); return; }
    if (activeTab === 'sensors') { void Promise.all([sensorReadingsQuery.refetch(), alertsQuery.refetch()]); return; }
    void devicesQuery.refetch();
  };

  return (
    <div className="space-y-6">
      <CollaborationHeader
        workspace="smart-building"
        eyebrow="Operations / Smart Building"
        title="Smart Building Dashboard"
        subtitle="Monitor security, access control, environmental sensors, utilities, HVAC, and connected assets from one interface."
        statusLabel={
          isLoading
            ? 'Loading systems'
            : totalDevices > 0
              ? `${onlineDevices}/${totalDevices} devices online`
              : 'Waiting for IoT data'
        }
        statusTone={activeAlerts > 0 ? 'critical' : 'live'}
        actions={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => askLaflo('Review Smart Building health and recommend the next authorised operational action.', { tab: activeTab, onlineDevices, totalDevices, activeAlerts })} className="min-h-10 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-text-main">Ask LaFlo</button><button type="button" onClick={() => void refresh()} disabled={isRefreshing} className="min-h-10 rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast disabled:opacity-50">{isRefreshing ? 'Refreshing…' : 'Refresh status'}</button></div>}
      />

      <div>
        {hasError ? (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            <span>Smart Building data could not be loaded.</span><button type="button" onClick={() => void refresh()} disabled={isRefreshing} className="ml-2 font-semibold underline disabled:opacity-50">{isRefreshing ? 'Retrying…' : 'Try again'}</button>
          </div>
        ) : null}
      </div>

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm" aria-label="Smart Building tabs">{(['overview', 'doors', 'sensors', 'devices'] as SmartTab[]).map((tab) => <button key={tab} type="button" onClick={() => setSearchParams({ tab })} className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-colors ${activeTab === tab ? 'bg-primary-solid text-primary-contrast' : 'text-text-muted hover:bg-border/50'}`}>{tab}</button>)}</nav>

      {activeIsLoading ? <div aria-label={`Loading Smart Building ${activeTab}`} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-24 animate-shimmer rounded-2xl" />)}</div> : activeHasError ? <WorkspaceDisconnectedState label={formatStatus(activeTab)} onRetry={retryActiveTab} isRetrying={activeIsFetching} /> : null}

      {!activeIsLoading && !activeHasError && activeTab === 'overview' ? <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Smart building summary">
        {metrics.map((metric) => (
          <div key={metric.label} className={`rounded-2xl border p-4 shadow-sm ${toneClasses[metric.tone].card}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-text-main">{metric.label}</div>
              <span className={`h-2.5 w-2.5 rounded-full ${toneClasses[metric.tone].dot}`} />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-text-main">{metric.value}</div>
            {metric.detail ? <div className="mt-1 text-sm font-semibold text-text-muted">{metric.detail}</div> : null}
          </div>
        ))}
      </section> : null}

      {!activeIsLoading && !activeHasError && activeTab === 'overview' ? <AlertWorkflowPanel alerts={alerts} tasks={linkedTasks} /> : null}

      {!activeIsLoading && !activeHasError && activeTab === 'doors' ? <DoorsPanel doors={doors} accessEvents={accessEvents} /> : null}
      {!activeIsLoading && !activeHasError && activeTab === 'sensors' ? <SensorsPanel readings={readings} alerts={alerts} /> : null}
      {!activeIsLoading && !activeHasError && activeTab === 'devices' ? <div className="space-y-6"><HardwareIntegrationPanel mode="smart-building" canManage={Boolean(canManageHardware)} surface="module" /><DevicesPanel devices={devices} canManage={canManageHardware} /></div> : null}

      {!activeIsLoading && !activeHasError && activeTab === 'overview' ? <section className="grid gap-5 xl:grid-cols-5">
        {sections.map((section) => (
          <div key={section.title} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="text-base font-bold text-text-main">{section.title}</div>
            <p className="mt-2 min-h-[56px] text-sm text-text-muted">{section.description}</p>
            <div className="mt-4 space-y-3">
              {section.items.map((item) => (
                <div key={`${section.title}-${item.label}`} className="rounded-2xl border border-border bg-bg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-text-muted">{item.label}</div>
                      <div className="mt-1 text-sm font-bold text-text-main">{item.value}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${toneClasses[item.tone].pill}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section> : null}
    </div>
  );
}
