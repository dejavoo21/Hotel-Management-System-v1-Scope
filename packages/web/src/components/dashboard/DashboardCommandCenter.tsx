import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRightIcon,
  BellAlertIcon,
  BoltIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/stores/authStore';
import { getExplicitPermissions, isSuperAdminUser, type PermissionId, type UserRole } from '@/utils/userAccess';
import dashboardService from '@/services/dashboard';
import maintenanceCenterService from '@/services/maintenanceCenter';
import incidentService from '@/services/incidents';
import securityCenterService from '@/services/securityCenter';
import smartBuildingService from '@/services/smartBuilding';
import integrationManagerService from '@/services/integrationManager';
import timelineService from '@/services/timeline';
import aiBriefingService from '@/services/aiBriefing';

type Tone = 'teal' | 'blue' | 'amber' | 'rose' | 'slate';

const toneStyles: Record<Tone, { icon: string; value: string; badge: string }> = {
  teal: { icon: 'bg-teal-50 text-teal-700', value: 'text-teal-800', badge: 'bg-teal-50 text-teal-700' },
  blue: { icon: 'bg-sky-50 text-sky-700', value: 'text-sky-800', badge: 'bg-sky-50 text-sky-700' },
  amber: { icon: 'bg-amber-50 text-amber-700', value: 'text-amber-800', badge: 'bg-amber-50 text-amber-700' },
  rose: { icon: 'bg-rose-50 text-rose-700', value: 'text-rose-800', badge: 'bg-rose-50 text-rose-700' },
  slate: { icon: 'bg-slate-100 text-slate-700', value: 'text-slate-900', badge: 'bg-slate-100 text-slate-600' },
};

const sample = {
  summary: { todayArrivals: 18, todayDepartures: 11, currentOccupancy: 86, totalRooms: 144, occupiedRooms: 124, availableRooms: 20, outOfServiceRooms: 3, inHouseGuests: 186, todayRevenue: 18420, monthRevenue: 286300 },
  housekeeping: { clean: 102, dirty: 17, inspection: 9, outOfService: 3, priorityRooms: [] },
  maintenance: { workOrders: { open: 8 }, faults: { urgent: 2 }, repairs: { inProgress: 4 }, preventiveMaintenance: { overdue: 1 }, assets: { dueInspection: 3 }, completed: { today: 7 }, recentActivity: [] },
  incidents: { active: 4, critical: 1, resolved: 6, closed: 18, total: 28, averageResolutionMinutes: 42, byDepartment: [], bySourceModule: [] },
  security: { cctv: { total: 24, online: 22, offline: 2 }, accessEvents: { today: 312 }, visitors: { onsite: 8 }, alerts: { open: 3 }, recentActivity: [] },
  smart: { cameras: { online: 22, offline: 2 }, doors: { locked: 31, open: 2 }, accessEvents: { today: 312 }, motionAlerts: { active: 1 }, temperatureSensors: { normal: 38, warning: 2 }, waterLeakSensors: { alerts: 0 }, panicButtons: { active: 0 }, health: { activeAlerts: 3, onlineDevices: 93, totalDevices: 98 } },
};

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.045)] ${className}`}>{children}</section>;
}

function SourceBadge({ sampleView }: { sampleView: boolean }) {
  return sampleView ? <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">Sample view</span> : <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-700"><span className="h-1.5 w-1.5 rounded-full bg-teal-500" />Live</span>;
}

function KpiCard({ label, value, detail, tone, icon: Icon, onClick }: { label: string; value: string | number; detail: string; tone: Tone; icon: React.ElementType; onClick: () => void }) {
  const styles = toneStyles[tone];
  return (
    <button type="button" onClick={onClick} className="group min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_6px_22px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500">
      <div className="flex items-start justify-between gap-2"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${styles.icon}`}><Icon className="h-5 w-5" aria-hidden="true" /></span><ChevronRightIcon className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-600" /></div>
      <p className="mt-3 text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tracking-tight ${styles.value}`}>{value}</p>
      <p className="mt-1 truncate text-[11px] font-medium text-slate-500">{detail}</p>
    </button>
  );
}

function StatusMetric({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const width = total > 0 ? Math.max(3, Math.min(100, Math.round((value / total) * 100))) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-slate-600">{label}</span><span className="text-sm font-extrabold text-slate-900">{value}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}><div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} /></div>
    </div>
  );
}

function PanelHeader({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) {
  return <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-extrabold text-slate-950">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>{action && onAction ? <button type="button" onClick={onAction} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-teal-700 hover:bg-teal-50">{action}</button> : null}</div>;
}

export default function DashboardCommandCenter() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const permissions = useMemo(() => getExplicitPermissions(user?.id, user?.modulePermissions as PermissionId[] | undefined), [user?.id, user?.modulePermissions]);
  const admin = isSuperAdminUser(user?.id, user?.role as UserRole | undefined);
  const can = (permission: PermissionId) => admin || permissions.includes(permission);

  const summaryQuery = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardService.getSummary, retry: false });
  const housekeepingQuery = useQuery({ queryKey: ['dashboard', 'housekeeping'], queryFn: dashboardService.getHousekeepingSummary, enabled: can('housekeeping') || can('rooms'), retry: false });
  const maintenanceQuery = useQuery({ queryKey: ['dashboard', 'maintenance'], queryFn: maintenanceCenterService.getOverview, enabled: can('maintenance_center'), retry: false });
  const incidentQuery = useQuery({ queryKey: ['dashboard', 'incidents'], queryFn: incidentService.overview, enabled: can('incident_management'), retry: false });
  const securityQuery = useQuery({ queryKey: ['dashboard', 'security'], queryFn: securityCenterService.getOverview, enabled: can('security_center'), retry: false });
  const smartQuery = useQuery({ queryKey: ['dashboard', 'smart-building'], queryFn: smartBuildingService.getOverview, enabled: can('smart_building'), retry: false });
  const integrationQuery = useQuery({ queryKey: ['dashboard', 'integrations'], queryFn: integrationManagerService.overview, enabled: can('settings'), retry: false });
  const timelineQuery = useQuery({ queryKey: ['dashboard', 'timeline'], queryFn: () => timelineService.list({ time: '24h', limit: 7 }), retry: false });
  const brainQuery = useQuery({ queryKey: ['dashboard', 'attention'], queryFn: aiBriefingService.getDailyBriefing, enabled: can('bookings') || can('settings'), retry: false });

  const summary = summaryQuery.data ?? sample.summary;
  const housekeeping = housekeepingQuery.data ?? sample.housekeeping;
  const maintenance = maintenanceQuery.data ?? sample.maintenance;
  const incidents = incidentQuery.data ?? sample.incidents;
  const security = securityQuery.data ?? sample.security;
  const smart = smartQuery.data ?? sample.smart;
  const sampleView = summaryQuery.isError || !summaryQuery.data;
  const totalReadiness = housekeeping.clean + housekeeping.dirty + housekeeping.inspection + housekeeping.outOfService;
  const roomsNotReady = housekeeping.dirty + housekeeping.inspection + housekeeping.outOfService;
  const buildingScore = smart.health.totalDevices ? Math.round((smart.health.onlineDevices / smart.health.totalDevices) * 100) : 0;
  const integrationCategories = integrationQuery.data?.categories ?? [];
  const connectedIntegrations = integrationCategories.filter((item) => item.connectionStatus === 'Connected').length;
  const failedIntegrations = integrationCategories.filter((item) => ['Sync Failed', 'Requires Attention', 'Credentials Expired'].includes(item.connectionStatus)).length;
  const attentionItems = brainQuery.data?.todayPriorities?.slice(0, 5) ?? [
    { title: 'Three arrival rooms may miss readiness target', detail: 'Prioritise inspection and maintenance clearance before 14:00.', severity: 'HIGH' as const },
    { title: 'Two guest follow-ups remain open', detail: 'Front desk ownership is needed before the evening shift.', severity: 'MEDIUM' as const },
    { title: 'Security devices require attention', detail: `${smart.cameras.offline} cameras and ${smart.health.activeAlerts} building alerts need review.`, severity: 'HIGH' as const },
  ];
  const timeline = timelineQuery.data?.events ?? [];
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); if (search.trim()) navigate(`/operations-center/search?q=${encodeURIComponent(search.trim())}`); };

  return (
    <div className="min-h-full bg-[#f7faf9] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1680px] space-y-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Good morning, {user?.firstName || 'team'}</h1><SourceBadge sampleView={sampleView} /></div><p className="mt-1 text-sm text-slate-500">{user?.hotel?.name || 'Your property'} · {dateLabel}</p></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form onSubmit={submitSearch} className="relative min-w-0 sm:w-[330px]"><MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15" placeholder="Search guests, rooms, bookings…" aria-label="Enterprise search" /></form>
            <button type="button" onClick={() => navigate('/ai/hotel-brain')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 text-sm font-bold text-teal-800 hover:bg-teal-100"><SparklesIcon className="h-4 w-4" />Ask Hotel Brain</button>
            {can('bookings') ? <button type="button" onClick={() => navigate('/bookings')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#087f72] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#06695f]"><CalendarDaysIcon className="h-4 w-4" />New booking</button> : null}
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <KpiCard label="Occupancy" value={`${Math.round(summary.currentOccupancy)}%`} detail={`${summary.occupiedRooms} of ${summary.totalRooms} rooms`} tone="teal" icon={ChartBarIcon} onClick={() => navigate('/rooms')} />
          <KpiCard label="Today's arrivals" value={summary.todayArrivals} detail="Expected before night audit" tone="blue" icon={ArrowRightIcon} onClick={() => navigate('/bookings')} />
          <KpiCard label="Today's departures" value={summary.todayDepartures} detail="Checkout plan" tone="slate" icon={UserGroupIcon} onClick={() => navigate('/bookings')} />
          <KpiCard label="Rooms ready" value={housekeeping.clean} detail="Available for assignment" tone="teal" icon={CheckCircleIcon} onClick={() => navigate('/housekeeping')} />
          <KpiCard label="Rooms not ready" value={roomsNotReady} detail="Dirty, inspection or OOS" tone={roomsNotReady > 10 ? 'amber' : 'teal'} icon={HomeModernIcon} onClick={() => navigate('/housekeeping')} />
          <KpiCard label="Open incidents" value={incidents.active} detail={`${incidents.critical} critical`} tone={incidents.critical ? 'rose' : 'teal'} icon={BellAlertIcon} onClick={() => navigate('/incidents')} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.7fr)]">
          <div className="space-y-5">
            {(can('rooms') || can('housekeeping')) && <SectionCard><PanelHeader title="Room readiness" subtitle="The operational source of truth for today's room plan" action="Open housekeeping" onAction={() => navigate('/housekeeping')} /><div className="grid gap-6 p-5 lg:grid-cols-[1fr_240px]"><div className="grid gap-4 sm:grid-cols-2"><StatusMetric label="Ready" value={housekeeping.clean} total={totalReadiness} tone="bg-teal-500" /><StatusMetric label="Dirty" value={housekeeping.dirty} total={totalReadiness} tone="bg-rose-400" /><StatusMetric label="In cleaning / inspection" value={housekeeping.inspection} total={totalReadiness} tone="bg-amber-400" /><StatusMetric label="Out of service" value={housekeeping.outOfService} total={totalReadiness} tone="bg-slate-500" /></div><div className="rounded-2xl bg-[#073f3b] p-5 text-white"><p className="text-xs font-semibold text-teal-100/75">READINESS SCORE</p><p className="mt-2 text-4xl font-extrabold">{totalReadiness ? Math.round((housekeeping.clean / totalReadiness) * 100) : 0}%</p><p className="mt-2 text-xs leading-5 text-teal-50/70">{roomsNotReady} rooms still require operational clearance.</p><button type="button" onClick={() => navigate('/rooms')} className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-teal-100 hover:text-white">Review room plan <ChevronRightIcon className="h-4 w-4" /></button></div></div></SectionCard>}

            <div className="grid gap-5 lg:grid-cols-2">
              {can('housekeeping') && <SectionCard><PanelHeader title="Housekeeping operations" subtitle="Progress, delays and inspection workload" action="View team" onAction={() => navigate('/housekeeping')} /><div className="grid grid-cols-2 gap-3 p-5"><div className="rounded-xl bg-teal-50 p-4"><p className="text-xs font-semibold text-teal-700">Completed</p><p className="mt-1 text-2xl font-extrabold text-teal-900">{housekeeping.clean}</p></div><div className="rounded-xl bg-sky-50 p-4"><p className="text-xs font-semibold text-sky-700">In progress</p><p className="mt-1 text-2xl font-extrabold text-sky-900">{housekeeping.dirty}</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700">Awaiting inspection</p><p className="mt-1 text-2xl font-extrabold text-amber-900">{housekeeping.inspection}</p></div><div className="rounded-xl bg-rose-50 p-4"><p className="text-xs font-semibold text-rose-700">Blocked</p><p className="mt-1 text-2xl font-extrabold text-rose-900">{housekeeping.outOfService}</p></div></div></SectionCard>}
              {(can('maintenance_center') || can('incident_management')) && <SectionCard><PanelHeader title="Maintenance & incidents" subtitle="Issues that can disrupt rooms or service" action="Open operations" onAction={() => navigate(can('maintenance_center') ? '/maintenance-center' : '/incidents')} /><div className="divide-y divide-slate-100 px-5"><div className="flex items-center justify-between py-4"><span className="flex items-center gap-3 text-sm font-semibold text-slate-700"><WrenchScrewdriverIcon className="h-5 w-5 text-amber-600" />Open maintenance</span><strong className="text-slate-950">{maintenance.workOrders.open}</strong></div><div className="flex items-center justify-between py-4"><span className="flex items-center gap-3 text-sm font-semibold text-slate-700"><ClockIcon className="h-5 w-5 text-rose-600" />Overdue preventive work</span><strong className="text-slate-950">{maintenance.preventiveMaintenance.overdue}</strong></div><div className="flex items-center justify-between py-4"><span className="flex items-center gap-3 text-sm font-semibold text-slate-700"><ExclamationTriangleIcon className="h-5 w-5 text-rose-600" />Critical incidents</span><strong className="text-rose-700">{incidents.critical}</strong></div></div></SectionCard>}
            </div>

            {(can('security_center') || can('smart_building')) && <SectionCard><PanelHeader title="Security & smart building" subtitle="Live physical-system health across the property" action="View systems" onAction={() => navigate(can('security_center') ? '/security-center' : '/operations/smart-building')} /><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border border-slate-100 p-4"><ShieldCheckIcon className="h-5 w-5 text-teal-700" /><p className="mt-3 text-xs font-semibold text-slate-500">CCTV online</p><p className="mt-1 text-xl font-extrabold text-slate-950">{security.cctv.online}/{security.cctv.total}</p></div><div className="rounded-xl border border-slate-100 p-4"><BellAlertIcon className="h-5 w-5 text-rose-600" /><p className="mt-3 text-xs font-semibold text-slate-500">Open security alerts</p><p className="mt-1 text-xl font-extrabold text-slate-950">{security.alerts.open}</p></div><div className="rounded-xl border border-slate-100 p-4"><BoltIcon className="h-5 w-5 text-sky-700" /><p className="mt-3 text-xs font-semibold text-slate-500">Devices online</p><p className="mt-1 text-xl font-extrabold text-slate-950">{smart.health.onlineDevices}/{smart.health.totalDevices}</p></div><div className="rounded-xl border border-slate-100 p-4"><BuildingOffice2Icon className="h-5 w-5 text-teal-700" /><p className="mt-3 text-xs font-semibold text-slate-500">Building health</p><p className="mt-1 text-xl font-extrabold text-slate-950">{buildingScore}%</p></div></div></SectionCard>}
          </div>

          <aside className="space-y-5">
            <SectionCard className="overflow-hidden border-teal-200/80"><div className="bg-gradient-to-br from-[#073f3b] to-[#087f72] px-5 py-4 text-white"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><SparklesIcon className="h-5 w-5 text-teal-200" /><h2 className="text-sm font-extrabold">Today’s attention items</h2></div><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">{brainQuery.data ? brainQuery.data.source : 'Sample'}</span></div><p className="mt-1 text-xs text-teal-50/70">Hotel Brain operational priorities</p></div><div className="divide-y divide-slate-100">{attentionItems.map((item, index) => <button type="button" key={`${item.title}-${index}`} onClick={() => navigate('/ai/hotel-brain')} className="flex w-full gap-3 px-5 py-4 text-left hover:bg-slate-50"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.severity === 'CRITICAL' || item.severity === 'HIGH' ? 'bg-rose-500' : item.severity === 'MEDIUM' ? 'bg-amber-400' : 'bg-teal-500'}`} /><span><span className="block text-sm font-bold leading-5 text-slate-900">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span></span></button>)}</div><button type="button" onClick={() => navigate('/ai/hotel-brain')} className="flex w-full items-center justify-between border-t border-slate-100 px-5 py-3 text-xs font-bold text-teal-700 hover:bg-teal-50"><span>Open Hotel Brain</span><ArrowRightIcon className="h-4 w-4" /></button></SectionCard>

            {can('settings') && <SectionCard><PanelHeader title="Integration health" subtitle="Connected systems and sync status" action="Manage" onAction={() => navigate('/settings?tab=integration-manager')} /><div className="grid grid-cols-3 gap-2 p-5 text-center"><div className="rounded-xl bg-teal-50 p-3"><p className="text-xl font-extrabold text-teal-900">{connectedIntegrations}</p><p className="mt-1 text-[10px] font-bold uppercase text-teal-700">Connected</p></div><div className="rounded-xl bg-rose-50 p-3"><p className="text-xl font-extrabold text-rose-900">{failedIntegrations}</p><p className="mt-1 text-[10px] font-bold uppercase text-rose-700">Issues</p></div><div className="rounded-xl bg-slate-100 p-3"><p className="text-xl font-extrabold text-slate-900">{integrationCategories.length}</p><p className="mt-1 text-[10px] font-bold uppercase text-slate-600">Systems</p></div></div>{!integrationQuery.data ? <p className="px-5 pb-4 text-[11px] text-amber-700">Live integration totals are unavailable.</p> : null}</SectionCard>}

            <SectionCard><PanelHeader title="Recent activity" subtitle="Latest operational changes" action="View all" onAction={() => navigate('/settings?tab=audit-trail')} /><div className="divide-y divide-slate-100 px-5">{timeline.length ? timeline.slice(0, 6).map((event) => <div key={event.id} className="flex gap-3 py-3"><span className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${event.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700' : event.severity === 'WARNING' ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'}`}><ClockIcon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-xs font-bold leading-5 text-slate-800">{event.summary}</p><p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">{event.module} · {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(event.timestamp))}</p></div></div>) : <div className="py-8 text-center"><ClockIcon className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-xs font-semibold text-slate-500">No live activity available</p><p className="mt-1 text-[11px] text-slate-400">Events will appear as teams update operations.</p></div>}</div></SectionCard>
          </aside>
        </div>
      </div>
    </div>
  );
}
