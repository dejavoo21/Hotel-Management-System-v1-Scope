import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  Bot,
  Building2,
  CloudSun,
  DollarSign,
  Gauge,
  ShieldAlert,
  Users,
  Wrench,
} from 'lucide-react';
import OperationalTimeline from '@/components/timeline/OperationalTimeline';
import {
  dashboardService,
  maintenanceCenterService,
  operationsService,
  securityCenterService,
  smartBuildingService,
} from '@/services';
import incidentService from '@/services/incidents';
import { useAuthStore } from '@/stores/authStore';
import { getExplicitPermissions, isSuperAdminUser, type PermissionId, type UserRole } from '@/utils/userAccess';

type Tone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';

const realtimeQueryOptions = {
  refetchInterval: 15_000,
  refetchIntervalInBackground: true,
  staleTime: 5_000,
};

const toneClasses: Record<Tone, { card: string; pill: string; text: string; dot: string }> = {
  emerald: {
    card: 'border-emerald-100 bg-emerald-50/60',
    pill: 'bg-emerald-100 text-emerald-800',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  sky: {
    card: 'border-sky-100 bg-sky-50/60',
    pill: 'bg-sky-100 text-sky-800',
    text: 'text-sky-700',
    dot: 'bg-sky-500',
  },
  amber: {
    card: 'border-amber-100 bg-amber-50/70',
    pill: 'bg-amber-100 text-amber-800',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  rose: {
    card: 'border-rose-100 bg-rose-50/70',
    pill: 'bg-rose-100 text-rose-800',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
  },
  slate: {
    card: 'border-slate-100 bg-slate-50/80',
    pill: 'bg-slate-200 text-slate-800',
    text: 'text-slate-700',
    dot: 'bg-slate-500',
  },
};

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const formatStatus = (value?: string | null) =>
  (value || 'Unknown')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const scoreTone = (score: number): Tone => {
  if (score >= 85) return 'emerald';
  if (score >= 70) return 'sky';
  if (score >= 55) return 'amber';
  return 'rose';
};

const statusTone = (value: number, warningAt: number, criticalAt: number): Tone => {
  if (value >= criticalAt) return 'rose';
  if (value >= warningAt) return 'amber';
  return 'emerald';
};

function useModuleAccess() {
  const { user } = useAuthStore();
  const isSuperAdmin = isSuperAdminUser(user?.id, user?.role as UserRole | undefined);
  const permissions = getExplicitPermissions(user?.id, user?.modulePermissions as PermissionId[] | undefined);

  return (permission: PermissionId) => isSuperAdmin || permissions.includes(permission);
}

const MetricCard = ({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  tone: Tone;
  icon: typeof Activity;
}) => (
  <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses[tone].card}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        <div className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</div>
        {detail ? <div className="mt-1 text-sm font-semibold text-slate-500">{detail}</div> : null}
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-slate-700 ring-1 ring-slate-200">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const Panel = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4">
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
    {children}
  </section>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
    {label}
  </div>
);

const RestrictedState = ({ moduleName }: { moduleName: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
    {moduleName} access is required to show this signal.
  </div>
);

export default function EnterpriseCommandCenterPage() {
  const { user } = useAuthStore();
  const canAccess = useModuleAccess();
  const hotelId = user?.hotel?.id || '';

  const canDashboard = canAccess('dashboard');
  const canBookings = canAccess('bookings');
  const canFinancials = canAccess('financials');
  const canHousekeeping = canAccess('housekeeping');
  const canSecurity = canAccess('security_center');
  const canMaintenance = canAccess('maintenance_center');
  const canSmartBuilding = canAccess('smart_building');
  const canIncidents = canAccess('incident_management');

  const dashboardQuery = useQuery({
    queryKey: ['enterprise-command-center', 'dashboard-summary'],
    queryFn: dashboardService.getSummary,
    enabled: canDashboard,
    ...realtimeQueryOptions,
  });

  const housekeepingQuery = useQuery({
    queryKey: ['enterprise-command-center', 'housekeeping-summary'],
    queryFn: dashboardService.getHousekeepingSummary,
    enabled: canHousekeeping || canDashboard,
    ...realtimeQueryOptions,
  });

  const operationsQuery = useQuery({
    queryKey: ['enterprise-command-center', 'operations-context', hotelId],
    queryFn: () => operationsService.getOperationsContext(hotelId),
    enabled: Boolean(hotelId) && canBookings,
    ...realtimeQueryOptions,
  });

  const incidentsQuery = useQuery({
    queryKey: ['enterprise-command-center', 'incidents-overview'],
    queryFn: incidentService.overview,
    enabled: canIncidents,
    ...realtimeQueryOptions,
  });

  const criticalIncidentsQuery = useQuery({
    queryKey: ['enterprise-command-center', 'critical-incidents'],
    queryFn: () => incidentService.list('critical'),
    enabled: canIncidents,
    ...realtimeQueryOptions,
  });

  const securityQuery = useQuery({
    queryKey: ['enterprise-command-center', 'security-overview'],
    queryFn: securityCenterService.getOverview,
    enabled: canSecurity,
    ...realtimeQueryOptions,
  });

  const securityAlertsQuery = useQuery({
    queryKey: ['enterprise-command-center', 'security-alerts'],
    queryFn: securityCenterService.listAlerts,
    enabled: canSecurity,
    ...realtimeQueryOptions,
  });

  const maintenanceQuery = useQuery({
    queryKey: ['enterprise-command-center', 'maintenance-overview'],
    queryFn: maintenanceCenterService.getOverview,
    enabled: canMaintenance,
    ...realtimeQueryOptions,
  });

  const smartBuildingQuery = useQuery({
    queryKey: ['enterprise-command-center', 'smart-building-overview'],
    queryFn: smartBuildingService.getOverview,
    enabled: canSmartBuilding,
    ...realtimeQueryOptions,
  });

  const smartBuildingTasksQuery = useQuery({
    queryKey: ['enterprise-command-center', 'smart-building-tasks'],
    queryFn: smartBuildingService.listLinkedTasks,
    enabled: canSmartBuilding,
    ...realtimeQueryOptions,
  });

  const dashboard = dashboardQuery.data;
  const housekeeping = housekeepingQuery.data;
  const operations = operationsQuery.data;
  const incidents = incidentsQuery.data;
  const security = securityQuery.data;
  const maintenance = maintenanceQuery.data;
  const smartBuilding = smartBuildingQuery.data;
  const criticalIncidents = criticalIncidentsQuery.data || [];
  const securityAlerts = securityAlertsQuery.data || [];
  const smartTasks = smartBuildingTasksQuery.data || [];

  const openMaintenance =
    (maintenance?.workOrders.open || 0) +
    (maintenance?.faults.urgent || 0) +
    (maintenance?.repairs.inProgress || 0) +
    (maintenance?.preventiveMaintenance.overdue || 0);
  const criticalIncidentCount = incidents?.critical || criticalIncidents.length || 0;
  const openSecurityAlerts = security?.alerts.open || 0;
  const occupancy = dashboard?.currentOccupancy || 0;
  const aiRisk =
    (operations?.weather?.stale ? 1 : 0) +
    (operations?.pricingSignal?.confidence === 'low' ? 1 : 0) +
    ((operations?.advisories || []).filter((item) => item.priority === 'high').length > 0 ? 1 : 0);

  const healthScore = clamp(
    100 -
      Math.min(35, criticalIncidentCount * 9) -
      Math.min(20, openMaintenance * 3) -
      Math.min(20, openSecurityAlerts * 6) -
      (occupancy > 95 || occupancy < 25 ? 8 : 0) -
      Math.min(12, (maintenance?.smartBuildingTasks?.criticalOpen || 0) * 4) -
      aiRisk * 4
  );
  const healthTone = scoreTone(healthScore);

  const criticalAlerts = useMemo(() => {
    const incidentAlerts = criticalIncidents.slice(0, 5).map((incident) => ({
      id: `incident:${incident.id}`,
      title: incident.title,
      detail: `${formatStatus(incident.category)} incident / ${formatStatus(incident.status)}`,
      tone: 'rose' as Tone,
    }));
    const securityItems = securityAlerts
      .filter((alert) => alert.severity === 'CRITICAL' || ['WATER_LEAK', 'FORCED_DOOR', 'CAMERA_OFFLINE', 'PANIC'].includes(alert.alertType))
      .slice(0, 5)
      .map((alert) => ({
        id: `alert:${alert.id}`,
        title: alert.title,
        detail: [formatStatus(alert.alertType), alert.location, formatStatus(alert.status)].filter(Boolean).join(' / '),
        tone: 'rose' as Tone,
      }));
    const taskItems = smartTasks
      .filter((task) => task.priority === 'URGENT' || task.incidentSeverity === 'CRITICAL')
      .slice(0, 5)
      .map((task) => ({
        id: `task:${task.id}`,
        title: task.title,
        detail: [task.incidentNumber ? `Incident ${task.incidentNumber}` : null, task.location, formatStatus(task.status)]
          .filter(Boolean)
          .join(' / '),
        tone: 'amber' as Tone,
      }));
    return [...incidentAlerts, ...securityItems, ...taskItems].slice(0, 8);
  }, [criticalIncidents, securityAlerts, smartTasks]);

  const recommendations = (operations?.advisories || []).slice(0, 5);
  const highAdvisories = recommendations.filter((item) => item.priority === 'high').length;

  const departmentStatus = [
    {
      name: 'Reception',
      value: `${operations?.ops?.arrivalsNext24h ?? 0} arrivals`,
      detail: `${operations?.ops?.departuresNext24h ?? 0} departures next 24h`,
      tone: (operations?.ops?.arrivalsNext24h || 0) > 8 ? 'amber' : 'emerald',
    },
    {
      name: 'Housekeeping',
      value: `${housekeeping?.dirty ?? 0} dirty`,
      detail: `${housekeeping?.inspection ?? 0} inspection / ${housekeeping?.clean ?? 0} clean`,
      tone: statusTone((housekeeping?.dirty || 0) + (housekeeping?.inspection || 0), 5, 12),
    },
    {
      name: 'Maintenance',
      value: `${openMaintenance} active`,
      detail: `${maintenance?.faults.urgent ?? 0} urgent faults`,
      tone: statusTone(openMaintenance, 3, 8),
    },
    {
      name: 'Security',
      value: `${openSecurityAlerts} open alerts`,
      detail: `${security?.cctv.offline ?? 0} cameras offline`,
      tone: statusTone(openSecurityAlerts + (security?.cctv.offline || 0), 1, 4),
    },
    {
      name: 'Operations',
      value: operations?.pricingSignal?.demandTrend ? formatStatus(operations.pricingSignal.demandTrend) : 'No signal',
      detail: `${operations?.pricingSignal?.marketCoveragePct ?? 0}% market coverage`,
      tone: operations?.pricingSignal?.confidence === 'low' ? 'amber' : 'sky',
    },
    {
      name: 'AI',
      value: highAdvisories > 0 ? `${highAdvisories} high advisory` : 'Stable',
      detail: operationsQuery.isError ? 'Operations AI unavailable' : 'Operations AI connected',
      tone: operationsQuery.isError ? 'rose' : highAdvisories > 0 ? 'amber' : 'emerald',
    },
  ] as const;

  const moduleErrors = [
    dashboardQuery.isError ? 'Dashboard' : null,
    operationsQuery.isError ? 'Operations' : null,
    incidentsQuery.isError ? 'Incidents' : null,
    securityQuery.isError ? 'Security' : null,
    maintenanceQuery.isError ? 'Maintenance' : null,
    smartBuildingQuery.isError ? 'Smart Building' : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Executive Operations</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Enterprise Command Center</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              One operational picture across incidents, smart building signals, maintenance, security, occupancy,
              revenue, weather, AI recommendations, and the live Event Bus timeline.
            </p>
          </div>
          <div className={`rounded-3xl border px-5 py-4 ${toneClasses[healthTone].card}`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hotel Health Score</div>
            <div className="mt-2 flex items-end gap-3">
              <span className={`text-5xl font-bold tracking-tight ${toneClasses[healthTone].text}`}>{healthScore}</span>
              <span className="pb-2 text-sm font-semibold text-slate-500">/ 100</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
              <div className={`h-full rounded-full ${toneClasses[healthTone].dot}`} style={{ width: `${healthScore}%` }} />
            </div>
          </div>
        </div>
        {moduleErrors.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            Some command signals could not be loaded: {moduleErrors.join(', ')}.
          </div>
        ) : null}
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="Enterprise KPI cards">
        <MetricCard
          label="Critical Incidents"
          value={String(criticalIncidentCount)}
          detail="Active critical response"
          tone={criticalIncidentCount > 0 ? 'rose' : 'emerald'}
          icon={ShieldAlert}
        />
        <MetricCard
          label="Occupancy"
          value={`${occupancy}%`}
          detail={`${dashboard?.occupiedRooms ?? 0}/${dashboard?.totalRooms ?? 0} rooms occupied`}
          tone={occupancy > 90 ? 'amber' : 'sky'}
          icon={BedDouble}
        />
        <MetricCard
          label="Open Maintenance"
          value={String(openMaintenance)}
          detail="Work orders, faults, repairs, overdue"
          tone={statusTone(openMaintenance, 3, 8)}
          icon={Wrench}
        />
        <MetricCard
          label="Revenue Today"
          value={canFinancials || canDashboard ? currency.format(dashboard?.todayRevenue || 0) : 'Restricted'}
          detail={`Month ${currency.format(dashboard?.monthRevenue || 0)}`}
          tone="emerald"
          icon={DollarSign}
        />
        <MetricCard
          label="AI Health"
          value={operationsQuery.isError ? 'Offline' : aiRisk > 0 ? 'Watch' : 'Ready'}
          detail={`${recommendations.length} recommendations`}
          tone={operationsQuery.isError ? 'rose' : aiRisk > 0 ? 'amber' : 'emerald'}
          icon={Bot}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel title="Critical Alerts" subtitle="Incidents, Security Center alerts, and Smart Building generated tasks.">
          {canIncidents || canSecurity || canSmartBuilding ? (
            criticalAlerts.length > 0 ? (
              <div className="space-y-3">
                {criticalAlerts.map((alert) => (
                  <div key={alert.id} className={`rounded-2xl border p-4 ${toneClasses[alert.tone].card}`}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`mt-0.5 h-5 w-5 ${toneClasses[alert.tone].text}`} />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-950">{alert.title}</div>
                        <div className="mt-1 text-sm text-slate-600">{alert.detail}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="No critical enterprise alerts right now." />
            )
          ) : (
            <RestrictedState moduleName="Incident, Security, or Smart Building" />
          )}
        </Panel>

        <Panel title="Revenue Snapshot" subtitle="Current financial and pricing guidance.">
          <div className="grid gap-3">
            <MetricCard
              label="Today"
              value={currency.format(dashboard?.todayRevenue || 0)}
              detail="Posted revenue"
              tone="emerald"
              icon={DollarSign}
            />
            <MetricCard
              label="Demand Signal"
              value={operations?.pricingSignal?.demandTrend ? formatStatus(operations.pricingSignal.demandTrend) : 'No signal'}
              detail={operations?.pricingSignal?.suggestion || operations?.pricingSignal?.note || 'Waiting for operations context'}
              tone={operations?.pricingSignal?.confidence === 'low' ? 'amber' : 'sky'}
              icon={Gauge}
            />
          </div>
        </Panel>

        <Panel title="Weather Snapshot" subtitle="Forecast signal used by Operations AI.">
          {canBookings ? (
            <div className="space-y-3">
              <div className={`rounded-2xl border p-4 ${operations?.weather?.stale ? toneClasses.amber.card : toneClasses.sky.card}`}>
                <div className="flex items-start gap-3">
                  <CloudSun className="mt-0.5 h-5 w-5 text-sky-700" />
                  <div>
                    <div className="text-sm font-bold text-slate-950">{operations?.weather?.next24h?.summary || 'Forecast pending'}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {operations?.weather?.next24h
                        ? `Range ${operations.weather.next24h.lowC ?? '-'}C - ${operations.weather.next24h.highC ?? '-'}C`
                        : 'No weather data connected yet'}
                    </div>
                  </div>
                </div>
              </div>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${operations?.weather?.isFresh ? toneClasses.emerald.pill : toneClasses.amber.pill}`}>
                {operations?.weather?.isFresh ? 'Forecast current' : 'Refresh recommended'}
              </span>
            </div>
          ) : (
            <RestrictedState moduleName="Operations Center" />
          )}
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Department Status" subtitle="Live operating posture by team.">
          <div className="grid gap-3 md:grid-cols-2">
            {departmentStatus.map((department) => (
              <div key={department.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-950">{department.name}</div>
                    <div className="mt-2 text-lg font-bold text-slate-900">{department.value}</div>
                    <div className="mt-1 text-sm text-slate-500">{department.detail}</div>
                  </div>
                  <span className={`h-3 w-3 rounded-full ${toneClasses[department.tone].dot}`} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="AI Recommendations" subtitle="Operations AI advisories and actions.">
          {canBookings ? (
            recommendations.length > 0 ? (
              <div className="space-y-3">
                {recommendations.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-slate-950">{item.title}</div>
                        <div className="mt-1 text-sm text-slate-600">{item.reason}</div>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.priority === 'high' ? toneClasses.amber.pill : toneClasses.sky.pill}`}>
                        {formatStatus(item.priority)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="No Operations AI recommendations right now." />
            )
          ) : (
            <RestrictedState moduleName="Operations AI" />
          )}
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <MetricCard
          label="Occupancy Snapshot"
          value={`${dashboard?.currentOccupancy ?? 0}%`}
          detail={`${dashboard?.availableRooms ?? 0} available / ${dashboard?.outOfServiceRooms ?? 0} out of service`}
          tone="sky"
          icon={Building2}
        />
        <MetricCard
          label="Guest Movement"
          value={`${dashboard?.todayArrivals ?? 0} / ${dashboard?.todayDepartures ?? 0}`}
          detail="Arrivals / departures today"
          tone="emerald"
          icon={Users}
        />
        <MetricCard
          label="Smart Building"
          value={`${smartBuilding?.health.onlineDevices ?? 0}/${smartBuilding?.health.totalDevices ?? 0}`}
          detail={`${smartBuilding?.health.activeAlerts ?? 0} active building alerts`}
          tone={(smartBuilding?.health.activeAlerts || 0) > 0 ? 'rose' : 'emerald'}
          icon={Activity}
        />
      </section>

      <OperationalTimeline />
    </div>
  );
}
