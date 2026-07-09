import { useQuery } from '@tanstack/react-query';
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
    card: 'border-slate-100 bg-slate-50/80',
    pill: 'bg-slate-200 text-slate-800',
    dot: 'bg-slate-500',
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

const plural = (count: number, singular: string, pluralLabel = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralLabel}`;

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
      emptyMetric('Active Cameras', 'emerald'),
      emptyMetric('Doors', 'sky'),
      emptyMetric('Access Events'),
      emptyMetric('Motion Alerts', 'amber'),
      emptyMetric('Temperature Sensors', 'amber'),
      emptyMetric('Water Leak Sensors', 'rose'),
      emptyMetric('Panic Buttons', 'emerald'),
    ];
  }

  return [
    {
      label: 'Active Cameras',
      value: `${overview.cameras.online} Online`,
      detail: `${overview.cameras.offline} Offline`,
      tone: overview.cameras.offline > 0 ? 'amber' : 'emerald',
    },
    {
      label: 'Doors',
      value: `${overview.doors.locked} Locked`,
      detail: `${overview.doors.open} Open`,
      tone: overview.doors.open > 0 ? 'amber' : 'sky',
    },
    { label: 'Access Events', value: `${overview.accessEvents.today} Today`, tone: 'slate' },
    {
      label: 'Motion Alerts',
      value: `${overview.motionAlerts.active} Active`,
      tone: overview.motionAlerts.active > 0 ? 'amber' : 'emerald',
    },
    {
      label: 'Temperature Sensors',
      value: `${overview.temperatureSensors.normal} Normal`,
      detail: `${overview.temperatureSensors.warning} Warning`,
      tone: overview.temperatureSensors.warning > 0 ? 'amber' : 'emerald',
    },
    {
      label: 'Water Leak Sensors',
      value: plural(overview.waterLeakSensors.alerts, 'Alert'),
      tone: overview.waterLeakSensors.alerts > 0 ? 'rose' : 'emerald',
    },
    {
      label: 'Panic Buttons',
      value: `${overview.panicButtons.active} Active`,
      tone: overview.panicButtons.active > 0 ? 'rose' : 'emerald',
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
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
        <p className="text-sm font-medium text-slate-700">No Smart Building alert workflows yet.</p>
        <p className="mt-1 text-sm text-slate-500">Generated tasks will appear here after critical IoT events.</p>
      </div>
    );
  }

  const recentAlerts = alerts.slice(0, 6);
  const unmatchedTasks = tasks
    .filter((task) => !recentAlerts.some((alert) => findTaskForAlert(alert, [task])))
    .slice(0, 4);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Alert Workflows</h2>
          <p className="mt-1 text-sm text-slate-600">Shows whether Smart Building alerts already created a Platform Core task.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {tasks.length} linked tasks
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {recentAlerts.map((alert) => {
          const task = findTaskForAlert(alert, tasks);
          return (
            <div key={alert.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">{alert.title}</div>
                  <div className="mt-1 text-sm text-slate-600">{alert.message || alert.location || formatStatus(alert.alertType)}</div>
                  <div className="mt-1 text-xs text-slate-500">{alert.location || 'Location not set'}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClasses[toneForStatus(alert.status)].pill}`}>
                    {formatStatus(alert.status)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      task ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
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
          <div key={task.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-900">{task.title}</div>
                <div className="mt-1 text-sm text-slate-600">{task.sourceSummary || task.description || task.sourceSignal}</div>
                <div className="mt-1 text-xs text-slate-500">
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
  const metrics = metricList(overviewQuery.data, hasRecords);
  const sections = sectionList({ doors, accessEvents, readings, alerts, devices });
  const activeAlerts = overviewQuery.data?.health.activeAlerts || 0;
  const onlineDevices = overviewQuery.data?.health.onlineDevices || 0;
  const totalDevices = overviewQuery.data?.health.totalDevices || 0;
  const canManageHardware = user?.role === 'ADMIN' || user?.role === 'MANAGER' || (user?.modulePermissions || []).includes('smart_building');

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
      />

      <div>
        {hasError ? (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            Smart Building data could not be loaded.
          </div>
        ) : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Smart building summary">
        {metrics.map((metric) => (
          <div key={metric.label} className={`rounded-2xl border p-4 shadow-sm ${toneClasses[metric.tone].card}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-700">{metric.label}</div>
              <span className={`h-2.5 w-2.5 rounded-full ${toneClasses[metric.tone].dot}`} />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{metric.value}</div>
            {metric.detail ? <div className="mt-1 text-sm font-semibold text-slate-500">{metric.detail}</div> : null}
          </div>
        ))}
      </section>

      <AlertWorkflowPanel alerts={alerts} tasks={linkedTasks} />

      <HardwareIntegrationPanel mode="smart-building" canManage={Boolean(canManageHardware)} surface="module" />

      <section className="grid gap-5 xl:grid-cols-5">
        {sections.map((section) => (
          <div key={section.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-base font-bold text-slate-900">{section.title}</div>
            <p className="mt-2 min-h-[56px] text-sm text-slate-600">{section.description}</p>
            <div className="mt-4 space-y-3">
              {section.items.map((item) => (
                <div key={`${section.title}-${item.label}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-500">{item.label}</div>
                      <div className="mt-1 text-sm font-bold text-slate-900">{item.value}</div>
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
      </section>
    </div>
  );
}
