import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRightIcon,
  BoltIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/stores/authStore';
import { getExplicitPermissions, isSuperAdminUser, type PermissionId, type UserRole } from '@/utils/userAccess';
import dashboardService from '@/services/dashboard';
import bookingService from '@/services/bookings';
import maintenanceCenterService from '@/services/maintenanceCenter';
import incidentService from '@/services/incidents';
import securityCenterService from '@/services/securityCenter';
import smartBuildingService from '@/services/smartBuilding';
import integrationManagerService from '@/services/integrationManager';
import timelineService from '@/services/timeline';
import aiBriefingService from '@/services/aiBriefing';
import reviewService from '@/services/reviews';
import { dashboardDemoData as demo } from './dashboardDemoData';

type Tone = 'teal' | 'blue' | 'amber' | 'rose' | 'slate';
type BookingRow = {
  id: string;
  recordId?: string;
  guest: string;
  room: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  total: number;
  status: string;
  source: string;
};
type AttentionItem = {
  title: string;
  detail: string;
  severity: string;
  route: string;
  owner?: string;
};

const toneStyles: Record<Tone, { icon: string; value: string; trend: string }> = {
  teal: { icon: 'bg-emerald-50 text-emerald-700', value: 'text-slate-950', trend: 'text-emerald-700' },
  blue: { icon: 'bg-sky-50 text-sky-700', value: 'text-slate-950', trend: 'text-sky-700' },
  amber: { icon: 'bg-amber-50 text-amber-700', value: 'text-slate-950', trend: 'text-amber-700' },
  rose: { icon: 'bg-rose-50 text-rose-700', value: 'text-slate-950', trend: 'text-rose-700' },
  slate: { icon: 'bg-slate-100 text-slate-700', value: 'text-slate-950', trend: 'text-slate-600' },
};

function Surface({ children, className = '', testId }: { children: React.ReactNode; className?: string; testId?: string }) {
  return <section data-testid={testId} className={`rounded-xl border border-slate-200/90 bg-white shadow-[0_3px_14px_rgba(15,23,42,0.035)] ${className}`}>{children}</section>;
}

function PanelHeader({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
      <div>
        <h2 className="text-sm font-bold text-slate-950">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p> : null}
      </div>
      {action && onAction ? <button type="button" onClick={onAction} className="shrink-0 text-[11px] font-semibold text-teal-700 hover:text-teal-900">{action}</button> : null}
    </div>
  );
}

function DataBadge({ state }: { state: 'live' | 'loading' | 'demo' }) {
  const styles = state === 'live' ? 'bg-emerald-50 text-emerald-700' : state === 'loading' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700';
  return <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${styles}`}>{state}</span>;
}

function SmartAction({ icon: Icon, title, description, cta, status, tone, onClick }: { icon: React.ElementType; title: string; description: string; cta: string; status?: string; tone: Tone; onClick: () => void }) {
  return (
    <Surface className="min-w-0 p-3.5">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneStyles[tone].icon}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-bold text-slate-950">{title}</h2>{status ? <span className="text-[9px] font-semibold text-slate-500">{status}</span> : null}</div>
          <p className="mt-1 line-clamp-2 min-h-8 text-[10px] leading-4 text-slate-500">{description}</p>
        </div>
      </div>
      <button type="button" onClick={onClick} className="mt-3 flex min-h-8 w-full items-center justify-between rounded-lg border border-slate-200 px-2.5 text-[10px] font-semibold text-slate-700 hover:border-teal-200 hover:bg-teal-50">
        {cta}<ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </Surface>
  );
}

function KpiCard({ label, value, trend, tone, icon: Icon, onClick }: { label: string; value: string | number; trend: string; tone: Tone; icon: React.ElementType; onClick: () => void }) {
  const styles = toneStyles[tone];
  return (
    <button type="button" onClick={onClick} aria-label={`${label}: ${value}. ${trend}`} className="min-w-0 rounded-xl border border-slate-200/90 bg-white p-3 text-left shadow-[0_3px_14px_rgba(15,23,42,0.035)] transition hover:border-teal-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
      <div className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${styles.icon}`}><Icon className="h-4 w-4" aria-hidden="true" /></span><span className="truncate text-xs font-semibold text-slate-600">{label}</span></div>
      <p className={`mt-2 text-xl font-extrabold tracking-tight ${styles.value}`}>{value}</p>
      <p className={`mt-1 truncate text-[10px] font-semibold ${styles.trend}`}>{trend}</p>
    </button>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="min-w-0 border-l-2 pl-2.5" style={{ borderColor: color }}><p className="truncate text-[9px] font-medium text-slate-500">{label}</p><p className="mt-0.5 text-base font-extrabold text-slate-950">{value}</p></div>;
}

function EmptyState({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  return <div className="px-4 py-7 text-center text-xs text-slate-500"><p>{label}</p>{action && onAction ? <button type="button" onClick={onAction} className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-teal-700 hover:bg-teal-50">{action}</button> : null}</div>;
}

function statusClass(status: string) {
  const value = status.toLowerCase();
  if (value.includes('check') || value.includes('confirm')) return 'bg-emerald-50 text-emerald-700';
  if (value.includes('pending')) return 'bg-amber-50 text-amber-700';
  if (value.includes('cancel') || value.includes('blocked')) return 'bg-rose-50 text-rose-700';
  return 'bg-sky-50 text-sky-700';
}

export default function DashboardCommandCenter() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatus, setBookingStatus] = useState('All');
  const [bookingPage, setBookingPage] = useState(1);
  const permissions = useMemo(() => getExplicitPermissions(user?.id, user?.modulePermissions as PermissionId[] | undefined), [user?.id, user?.modulePermissions]);
  const admin = isSuperAdminUser(user?.id, user?.role as UserRole | undefined);
  const can = (permission: PermissionId) => admin || permissions.includes(permission);

  const summaryQuery = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardService.getSummary, retry: false });
  const departuresQuery = useQuery({ queryKey: ['dashboard', 'departures'], queryFn: dashboardService.getDepartures, enabled: can('bookings'), retry: false });
  const alertsQuery = useQuery({ queryKey: ['dashboard', 'alerts'], queryFn: dashboardService.getAlerts, retry: false });
  const revenueTrendQuery = useQuery({ queryKey: ['dashboard', 'revenue-trend'], queryFn: dashboardService.getRevenueTrend, enabled: can('financials'), retry: false });
  const bookingMixQuery = useQuery({ queryKey: ['dashboard', 'booking-mix'], queryFn: dashboardService.getBookingMix, enabled: can('bookings'), retry: false });
  const recentBookingsQuery = useQuery({
    queryKey: ['dashboard', 'recent-bookings'],
    queryFn: () => bookingService.getBookings({ page: 1, limit: 50 }),
    enabled: can('bookings'),
    retry: false,
  });
  const housekeepingQuery = useQuery({ queryKey: ['dashboard', 'housekeeping'], queryFn: dashboardService.getHousekeepingSummary, enabled: can('housekeeping') || can('rooms'), retry: false });
  const maintenanceQuery = useQuery({ queryKey: ['dashboard', 'maintenance'], queryFn: maintenanceCenterService.getOverview, enabled: can('maintenance_center'), retry: false });
  const incidentQuery = useQuery({ queryKey: ['dashboard', 'incidents'], queryFn: incidentService.overview, enabled: can('incident_management'), retry: false });
  const securityQuery = useQuery({ queryKey: ['dashboard', 'security'], queryFn: securityCenterService.getOverview, enabled: can('security_center'), retry: false });
  const smartQuery = useQuery({ queryKey: ['dashboard', 'smart-building'], queryFn: smartBuildingService.getOverview, enabled: can('smart_building'), retry: false });
  const integrationQuery = useQuery({ queryKey: ['dashboard', 'integrations'], queryFn: integrationManagerService.overview, enabled: can('settings'), retry: false });
  const timelineQuery = useQuery({ queryKey: ['dashboard', 'timeline'], queryFn: () => timelineService.list({ time: '24h', limit: 8 }), retry: false });
  const brainQuery = useQuery({ queryKey: ['dashboard', 'attention'], queryFn: aiBriefingService.getDailyBriefing, enabled: can('bookings') || can('settings'), retry: false });
  const reviewsQuery = useQuery({ queryKey: ['dashboard', 'reviews'], queryFn: () => reviewService.list(), enabled: can('reviews'), retry: false });

  const summary = summaryQuery.data ?? demo.summary;
  const housekeeping = housekeepingQuery.data ?? demo.housekeeping;
  const maintenance = maintenanceQuery.data ?? demo.maintenance;
  const incidents = incidentQuery.data ?? demo.incidents;
  const security = securityQuery.data ?? demo.security;
  const smart = smartQuery.data ?? demo.smart;
  const canViewBookings = can('bookings');
  const canViewRooms = can('rooms');
  const canViewHousekeeping = can('housekeeping');
  const canViewMaintenance = can('maintenance_center');
  const canViewIncidents = can('incident_management');
  const canViewSecurity = can('security_center');
  const canViewSmartBuilding = can('smart_building');
  const canViewReviews = can('reviews');
  const canViewSettings = can('settings');
  const canViewFinancials = can('financials');
  const dataState: 'live' | 'loading' | 'demo' = summaryQuery.data ? 'live' : summaryQuery.isLoading ? 'loading' : 'demo';
  const housekeepingIsLive = Boolean(housekeepingQuery.data);
  const maintenanceIsLive = Boolean(maintenanceQuery.data);
  const securityIsLive = Boolean(securityQuery.data);
  const smartIsLive = Boolean(smartQuery.data);
  const totalReadiness = housekeeping.clean + housekeeping.dirty + housekeeping.inspection + housekeeping.outOfService;
  const inCleaning = Math.max(0, housekeeping.dirty - Math.ceil(housekeeping.dirty * 0.35));
  const buildingScore = smart.health.totalDevices ? Math.round((smart.health.onlineDevices / smart.health.totalDevices) * 100) : 0;
  const categories = integrationQuery.data?.categories ?? [];
  const failedIntegrations = categories.filter((item) => ['Sync Failed', 'Requires Attention', 'Credentials Expired'].includes(item.connectionStatus)).length;
  const reviews = reviewsQuery.data ?? [];
  const averageRating = reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0;
  const positive = reviews.filter((review) => review.rating >= 4).length;
  const neutral = reviews.filter((review) => review.rating === 3).length;
  const negative = reviews.filter((review) => review.rating < 3).length;
  const ratingBreakdown = [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((review) => review.rating === rating).length;
    return { rating, count, percentage: reviews.length ? Math.round((count / reviews.length) * 100) : 0 };
  });
  const operationalAttention: AttentionItem[] = [];
  if (canViewIncidents && incidents.critical > 0) operationalAttention.push({ title: `${incidents.critical} critical incident${incidents.critical === 1 ? '' : 's'}`, detail: 'Immediate incident review is required.', severity: 'CRITICAL', route: '/incidents', owner: 'Incident response' });
  if (canViewSecurity && security.cctv.offline > 0) operationalAttention.push({ title: `${security.cctv.offline} camera${security.cctv.offline === 1 ? '' : 's'} offline`, detail: 'Review CCTV connectivity and provider status.', severity: 'HIGH', route: '/security-center/cctv', owner: 'Security' });
  const offlineDevices = Math.max(0, smart.health.totalDevices - smart.health.onlineDevices);
  if (canViewSmartBuilding && offlineDevices > 0) operationalAttention.push({ title: `${offlineDevices} smart device${offlineDevices === 1 ? '' : 's'} offline`, detail: 'Review Smart Building device health.', severity: 'HIGH', route: '/operations/smart-building', owner: 'Engineering' });
  if (canViewSecurity && smart.doors.open > 0) operationalAttention.push({ title: `${smart.doors.open} door alert${smart.doors.open === 1 ? '' : 's'}`, detail: 'Confirm open-door state with Security.', severity: 'HIGH', route: '/security-center/alerts', owner: 'Security' });
  if (canViewMaintenance && maintenance.faults.urgent > 0) operationalAttention.push({ title: `${maintenance.faults.urgent} urgent maintenance alert${maintenance.faults.urgent === 1 ? '' : 's'}`, detail: 'Engineering attention is required.', severity: 'HIGH', route: '/maintenance-center', owner: 'Engineering' });
  if (canViewSettings && failedIntegrations > 0) operationalAttention.push({ title: `${failedIntegrations} integration issue${failedIntegrations === 1 ? '' : 's'}`, detail: 'Review provider connection health.', severity: 'MEDIUM', route: '/settings?tab=integration-manager', owner: 'Platform administration' });
  const sourceAttention: AttentionItem[] = brainQuery.data?.todayPriorities?.map((item) => ({ title: item.title, detail: item.detail, severity: item.severity ?? 'LOW', route: '/ai/hotel-brain', owner: 'Hotel Brain' }))
    ?? alertsQuery.data?.map((alert) => ({ title: alert.title, detail: alert.description, severity: alert.level.toUpperCase(), route: '/incidents', owner: 'Operations' }))
    ?? [];
  const attentionItems = (operationalAttention.length ? operationalAttention : sourceAttention).slice(0, 6);
  const timeline = timelineQuery.data?.events ?? [];
  const recentTimeline = useMemo(() => {
    const seen = new Set<string>();
    return timeline.filter((event) => {
      const key = `${event.module}:${event.summary}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 6);
  }, [timeline]);
  const dateLabel = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
  const role = String(user?.role || '');
  const roleView = role === 'HOUSEKEEPING' ? 'Housekeeping focus' : role === 'MAINTENANCE' ? 'Maintenance focus' : role === 'SECURITY' ? 'Security focus' : role === 'FINANCE' ? 'Finance focus' : role === 'FRONT_DESK' || role === 'RECEPTIONIST' ? 'Front desk focus' : 'Management overview';
  const todayRevenue = Number(summary.todayRevenue ?? 0);
  const currency = user?.hotel?.currency || 'USD';
  const currencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 });
  const adr = todayRevenue > 0 && summary.occupiedRooms > 0 ? Math.round(todayRevenue / summary.occupiedRooms) : null;
  const revenueTrend = revenueTrendQuery.data ?? [];
  const hasRevenueTrend = revenueTrend.some((point) => Number(point.value) > 0);

  const recentBookings = useMemo(
    () => recentBookingsQuery.data?.data ?? [],
    [recentBookingsQuery.data]
  );
  const liveBookingRows = useMemo<BookingRow[]>(() => recentBookings.map((booking) => {
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000));
    const formatDate = (date: Date) => new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
    const formatLabel = (value: string) => value
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());

    return {
      id: booking.bookingRef,
      recordId: booking.id,
      guest: `${booking.guest.firstName} ${booking.guest.lastName}`,
      room: booking.room?.number || 'TBA',
      roomType: booking.room?.roomType?.name || 'Not assigned',
      checkIn: formatDate(checkIn),
      checkOut: formatDate(checkOut),
      nights,
      total: Number(booking.totalAmount),
      status: formatLabel(booking.status),
      source: formatLabel(booking.source),
    };
  }), [recentBookings]);
  const hasMonthBookingMix = Boolean(bookingMixQuery.data?.length);
  const bookingSources = useMemo(() => {
    const palette = ['#2fbf9f', '#75d8ca', '#9db9f5', '#f8cf69', '#f39a96', '#cbd5e1'];
    const monthlyMix = bookingMixQuery.data ?? [];
    const fallbackMix = Array.from(recentBookings.reduce((counts, booking) => {
      counts.set(booking.source, (counts.get(booking.source) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())).map(([source, count]) => ({
      source,
      count,
      percentage: recentBookings.length ? Math.round((count / recentBookings.length) * 100) : 0,
    }));
    return (monthlyMix.length ? monthlyMix : fallbackMix).map((item, index) => ({
      name: item.source.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()),
      value: item.percentage,
      count: item.count,
      color: palette[index % palette.length],
    }));
  }, [bookingMixQuery.data, recentBookings]);
  const filteredBookings = liveBookingRows.filter((booking) => {
    const query = bookingSearch.trim().toLowerCase();
    const matchesSearch = !query || `${booking.id} ${booking.guest} ${booking.room}`.toLowerCase().includes(query);
    const matchesStatus = bookingStatus === 'All' || booking.status === bookingStatus;
    return matchesSearch && matchesStatus;
  });
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const bookingRows = filteredBookings.slice((bookingPage - 1) * pageSize, bookingPage * pageSize);

  return (
    <div data-dashboard-view={roleView} className="min-h-full bg-[#f8faf9]">
      <div className="mx-auto w-full max-w-[2200px] space-y-3">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-extrabold tracking-tight text-slate-950">Good morning, {user?.firstName || 'team'}</h1><DataBadge state={dataState} /><span className="text-[10px] font-semibold text-slate-400">{roleView}</span></div>
            <p className="mt-1 text-xs text-slate-500">{user?.hotel?.name || 'Your property'} · {dateLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <time dateTime={new Date().toISOString().slice(0, 10)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"><CalendarDaysIcon className="h-4 w-4" />Today</time>
            {can('bookings') ? <button type="button" onClick={() => navigate('/bookings?action=new')} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#087f72] px-3 text-xs font-bold text-white hover:bg-[#06695f]"><PlusIcon className="h-4 w-4" />New booking</button> : null}
            {can('guests') ? <button type="button" onClick={() => navigate('/guests?action=add')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"><PlusIcon className="h-4 w-4" />Add guest</button> : null}
          </div>
        </header>

        {dataState === 'demo' ? <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">Live dashboard data is unavailable. Clearly labelled demo values are shown where a live source has not responded.</div> : null}

        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]" data-testid="dashboard-smart-actions">
          {canViewBookings ? <SmartAction icon={MagnifyingGlassIcon} title="Enterprise Search" description="Guests, bookings, rooms, invoices, incidents, devices, messages and audit records." cta="Search everything" tone="teal" onClick={() => navigate('/operations-center/search')} /> : null}
          {canViewBookings ? <SmartAction icon={SparklesIcon} title="Hotel Brain" description="Ask authorised operational questions and generate hotel insights." cta="Ask a question" tone="blue" onClick={() => navigate('/ai/hotel-brain')} /> : null}
          {canViewIncidents ? <SmartAction icon={ExclamationTriangleIcon} title="Attention" description={`${attentionItems.length} operational issue${attentionItems.length === 1 ? '' : 's'} need review.`} cta="View alerts" status={`${incidents.critical} critical`} tone={attentionItems.length ? 'amber' : 'teal'} onClick={() => navigate('/incidents')} /> : null}
          {canViewSettings ? <SmartAction icon={BoltIcon} title="Integration Health" description="CCTV, Smart Building and provider connection health." cta="View integrations" status={failedIntegrations ? `${failedIntegrations} issues` : 'Operational'} tone={failedIntegrations ? 'rose' : 'teal'} onClick={() => navigate('/settings?tab=integration-manager')} /> : null}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-sm font-bold text-slate-950">Today’s operations</h2><p className="text-[10px] text-slate-500">Property-local activity for {dateLabel}</p></div>
          <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-700">Today</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:[grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]" data-testid="dashboard-kpi-row">
          {canViewBookings ? <KpiCard label="Bookings created" value={summary.todayBookings} trend="Created today" tone="teal" icon={CalendarDaysIcon} onClick={() => navigate('/bookings')} /> : null}
          {canViewBookings ? <KpiCard label="Scheduled check-ins" value={summary.todayArrivals} trend="Arrivals today" tone="teal" icon={CheckCircleIcon} onClick={() => navigate('/bookings?filter=arrivals')} /> : null}
          {canViewBookings ? <KpiCard label="Scheduled check-outs" value={departuresQuery.data?.length ?? summary.todayDepartures} trend="Departures today" tone="blue" icon={ArrowRightIcon} onClick={() => navigate('/bookings?filter=departures')} /> : null}
          {canViewFinancials ? <KpiCard label="Revenue posted" value={currencyFormatter.format(todayRevenue)} trend={`Completed payments · ${currency}`} tone="teal" icon={CurrencyDollarIcon} onClick={() => navigate('/reports')} /> : null}
          {canViewRooms ? <KpiCard label="Occupancy" value={`${Math.round(summary.currentOccupancy)}%`} trend={`${summary.occupiedRooms} of ${summary.totalRooms} rooms`} tone="teal" icon={HomeModernIcon} onClick={() => navigate('/rooms')} /> : null}
          {canViewFinancials ? <KpiCard label="ADR estimate" value={adr === null ? '—' : currencyFormatter.format(adr)} trend={adr === null ? 'Unavailable: no posted room revenue' : 'Posted revenue per occupied room'} tone={adr === null ? 'slate' : 'teal'} icon={ChartBarIcon} onClick={() => navigate('/reports')} /> : null}
        </div>

        <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_clamp(300px,18vw,340px)] 2xl:gap-4">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
              <Surface testId="room-readiness-panel">
                <PanelHeader title="Room readiness" subtitle={housekeepingIsLive ? 'Live room availability and housekeeping blockers' : 'Live room availability · Housekeeping demo fallback'} action={canViewHousekeeping ? 'Open housekeeping' : undefined} onAction={canViewHousekeeping ? () => navigate('/housekeeping') : undefined} />
                <div className="px-4 pb-4">
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Availability</p>
                  <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-label="Room availability distribution">
                    <span className="bg-emerald-400" style={{ width: `${summary.totalRooms ? (summary.occupiedRooms / summary.totalRooms) * 100 : 0}%` }} />
                    <span className="bg-sky-300" style={{ width: `${summary.totalRooms ? (summary.availableRooms / summary.totalRooms) * 100 : 0}%` }} />
                    <span className="bg-slate-400" style={{ width: `${summary.totalRooms ? (summary.outOfServiceRooms / summary.totalRooms) * 100 : 0}%` }} />
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <Metric label="Occupied" value={summary.occupiedRooms} color="#34d399" />
                    <Metric label="Available" value={summary.availableRooms} color="#7dd3fc" />
                    <Metric label="Out of service" value={summary.outOfServiceRooms} color="#94a3b8" />
                    <Metric label="Total rooms" value={summary.totalRooms} color="#2dd4bf" />
                  </div>
                  <p className="mb-1 mt-4 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Housekeeping readiness</p>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-label="Housekeeping readiness distribution">
                    <span className="bg-emerald-400" style={{ width: `${totalReadiness ? (housekeeping.clean / totalReadiness) * 100 : 0}%` }} />
                    <span className="bg-rose-300" style={{ width: `${totalReadiness ? (housekeeping.dirty / totalReadiness) * 100 : 0}%` }} />
                    <span className="bg-amber-300" style={{ width: `${totalReadiness ? (housekeeping.inspection / totalReadiness) * 100 : 0}%` }} />
                    <span className="bg-slate-400" style={{ width: `${totalReadiness ? (housekeeping.outOfService / totalReadiness) * 100 : 0}%` }} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                    <span className="rounded-lg bg-rose-50 px-2.5 py-2 font-semibold text-rose-700">{housekeeping.dirty} dirty rooms</span>
                    <span className="rounded-lg bg-sky-50 px-2.5 py-2 font-semibold text-sky-700">{inCleaning} in cleaning</span>
                    <span className="rounded-lg bg-amber-50 px-2.5 py-2 font-semibold text-amber-700">{housekeeping.inspection} pending inspection</span>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-2 font-semibold text-slate-700">{housekeeping.outOfService} maintenance blocks</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[9px] font-semibold text-rose-700">{housekeeping.priorityRooms.length} Priority clean</span>
                    <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-700">{maintenance.faults.urgent} Maintenance alerts</span>
                    <span className="rounded-lg border border-slate-200 px-2 py-1 text-[9px] font-semibold text-slate-600">{summary.todayDepartures} Late check-out risks</span>
                  </div>
                </div>
              </Surface>

              {canViewFinancials ? <Surface testId="revenue-panel">
                <PanelHeader title="Revenue" subtitle={hasRevenueTrend ? `Completed payments · Last 6 months · ${currency}` : 'No posted revenue in the selected six-month period'} action="Financial reports" onAction={() => navigate('/reports')} />
                {hasRevenueTrend ? <div className="h-56 px-2 pb-3">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 500, height: 224 }}>
                    <AreaChart data={revenueTrend} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
                      <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#49b63f" stopOpacity={0.24} /><stop offset="100%" stopColor="#49b63f" stopOpacity={0.02} /></linearGradient></defs>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(value) => currencyFormatter.format(Number(value))} />
                      <Tooltip formatter={(value) => currencyFormatter.format(Number(value))} />
                      <Area type="monotone" dataKey="value" stroke="#49a942" strokeWidth={2} fill="url(#revenueFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div> : <div className="flex h-56 items-center justify-center"><EmptyState label="No completed payment records are available for this period." action="Open financial reports" onAction={() => navigate('/reports')} /></div>}
              </Surface> : null}

              {canViewReviews ? <Surface testId="guest-experience-panel">
                <PanelHeader title="Guest experience" subtitle={reviews.length ? `${reviews.length} live reviews` : 'No live review data'} action="View reviews" onAction={() => navigate('/reviews')} />
                <div className="px-4 pb-4">
                  {reviews.length ? <><div className="flex items-end gap-3"><span className="rounded-lg bg-lime-200 px-2 py-1 text-2xl font-extrabold text-slate-950">{averageRating.toFixed(1)}</span><div className="pb-1"><p className="text-xs font-bold text-slate-900">{reviews.length < 5 ? 'Early signal' : averageRating >= 4 ? 'Impressive' : averageRating >= 3 ? 'Stable' : 'Needs attention'}</p><p className="text-[10px] text-slate-500">{reviews.length} live reviews</p></div></div>
                  {reviews.length < 5 ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-medium text-amber-800">Limited sample: treat this score as directional until more guest reviews arrive.</p> : null}
                  <div className="mt-4 space-y-2">
                    {ratingBreakdown.map((item) => <div key={item.rating} className="grid grid-cols-[70px_1fr_24px] items-center gap-2 text-[9px]"><span className="text-slate-500">{item.rating} star</span><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-lime-300" style={{ width: `${item.percentage}%` }} /></div><strong className="text-right text-slate-700">{item.count}</strong></div>)}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-1.5 text-center text-[9px]"><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><strong className="block text-sm">{positive}</strong>Positive</div><div className="rounded-lg bg-sky-50 p-2 text-sky-700"><strong className="block text-sm">{neutral}</strong>Neutral</div><div className="rounded-lg bg-rose-50 p-2 text-rose-700"><strong className="block text-sm">{negative}</strong>Negative</div></div>
                  <div className="mt-2 text-[10px] text-slate-500">{negative} low-rating reviews</div></> : <EmptyState label="No live guest reviews are available." action="Open reviews" onAction={() => navigate('/reviews')} />}
                </div>
              </Surface> : null}
            </div>

            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]">
              {(canViewHousekeeping || canViewRooms || canViewMaintenance) ? <Surface testId="housekeeping-maintenance-panel">
                <PanelHeader title="Housekeeping & maintenance" subtitle={housekeepingIsLive && maintenanceIsLive ? 'Live today execution and room blockers' : 'Demo / simulation fallback · Live service unavailable'} />
                <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-4">
                  <Metric label="Assigned" value={totalReadiness} color="#38bdf8" />
                  <Metric label="In progress" value={housekeeping.dirty} color="#fbbf24" />
                  <Metric label="Completed" value={housekeeping.clean} color="#34d399" />
                  <Metric label="Delayed" value={housekeeping.inspection} color="#fb7185" />
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 px-4 py-3 text-center text-[9px]"><span><strong className="block text-base text-slate-950">{maintenance.workOrders.open}</strong>Open maintenance</span><span><strong className="block text-base text-rose-700">{maintenance.preventiveMaintenance.overdue}</strong>Overdue</span><span><strong className="block text-base text-amber-700">{maintenance.faults.urgent}</strong>Critical blockers</span></div>
              </Surface> : null}

              {(canViewSecurity || canViewSmartBuilding) ? <Surface testId="security-building-panel">
                <PanelHeader title="Security & Smart Building" subtitle={securityIsLive && smartIsLive ? 'Live physical-system health' : 'Demo / simulation fallback · One or more live services unavailable'} action="View systems" onAction={() => navigate(can('security_center') ? '/security-center' : '/operations/smart-building')} />
                <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-4 lg:grid-cols-6">
                  <Metric label="CCTV online" value={security.cctv.online} color="#34d399" />
                  <Metric label="Offline cameras" value={security.cctv.offline} color="#fb7185" />
                  <Metric label="Door alerts" value={smart.doors.open} color="#fbbf24" />
                  <Metric label="Offline devices" value={smart.health.totalDevices - smart.health.onlineDevices} color="#94a3b8" />
                  <Metric label="Sensor alerts" value={smart.temperatureSensors.warning + smart.waterLeakSensors.alerts} color="#38bdf8" />
                  <Metric label="Health score" value={buildingScore} color="#2dd4bf" />
                </div>
              </Surface> : null}
            </div>

            {canViewBookings ? <div className="grid flex-1 items-stretch gap-3 xl:grid-cols-[minmax(320px,.55fr)_minmax(0,1.95fr)]">
              <Surface testId="booking-platform-panel" className="flex min-h-[280px] flex-col">
                <PanelHeader
                  title="Booking by platform"
                  subtitle={hasMonthBookingMix
                    ? 'Live month-to-date distribution'
                    : bookingSources.length
                      ? 'Recent live booking distribution'
                      : bookingMixQuery.isLoading || recentBookingsQuery.isLoading
                        ? 'Loading booking distribution'
                        : 'No live booking source data'}
                />
                {bookingSources.length ? <><div className="grid flex-1 items-center gap-2 px-3 pb-3 sm:grid-cols-[180px_1fr]">
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 180, height: 176 }}>
                      <PieChart><Pie data={bookingSources} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={1}>{bookingSources.map((source) => <Cell key={source.name} fill={source.color} />)}</Pie><Tooltip formatter={(value) => `${value}%`} /></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5">{bookingSources.map((source) => <div key={source.name} className="flex items-center justify-between gap-2 text-[9px]"><span className="flex items-center gap-2 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: source.color }} />{source.name}</span><strong>{source.value}%</strong></div>)}</div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 border-t border-slate-100 p-3 text-[9px]"><div className="rounded-lg bg-emerald-50 p-2"><span className="text-slate-500">Top channel</span><strong className="mt-1 block text-slate-900">{bookingSources[0].name}</strong></div><div className="rounded-lg bg-sky-50 p-2"><span className="text-slate-500">{hasMonthBookingMix ? 'Bookings this month' : 'Recent bookings'}</span><strong className="mt-1 block text-slate-900">{bookingSources.reduce((total, source) => total + source.count, 0)}</strong></div></div></> : <div className="flex flex-1 items-center justify-center"><EmptyState label="No live booking source data is available." /></div>}
              </Surface>

              <Surface testId="booking-list-panel" className="flex min-h-[280px] min-w-0 flex-col overflow-hidden">
                <div className="grid gap-3 px-4 pb-3 pt-4 lg:grid-cols-[minmax(130px,1fr)_auto] lg:items-center">
                  <div className="min-w-0"><h2 className="text-sm font-bold text-slate-950">Booking list</h2><p className="text-[10px] text-slate-500">{recentBookingsQuery.data ? 'Live recent booking records' : recentBookingsQuery.isLoading ? 'Loading booking records' : 'Booking records unavailable'}</p></div>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(160px,1fr)_minmax(120px,auto)_minmax(84px,auto)]">
                    <input value={bookingSearch} onChange={(event) => { setBookingSearch(event.target.value); setBookingPage(1); }} className="h-8 w-full min-w-0 rounded-lg border border-slate-200 px-2.5 text-[10px]" placeholder="Search bookings…" aria-label="Search bookings" />
                    <select className="h-8 min-w-0 rounded-lg border border-slate-200 px-2 text-[10px]" aria-label="Property filter"><option>All properties</option></select>
                    <select value={bookingStatus} onChange={(event) => { setBookingStatus(event.target.value); setBookingPage(1); }} className="h-8 min-w-0 rounded-lg border border-slate-200 px-2 text-[10px]" aria-label="Booking status filter"><option>All</option>{Array.from(new Set(liveBookingRows.map((booking) => booking.status))).map((status) => <option key={status}>{status}</option>)}</select>
                  </div>
                </div>
                <div className="flex flex-1 flex-col overflow-hidden" role="region" aria-label="Booking list table">
                  <table className="w-full table-fixed text-left text-[9px]">
                    <colgroup>
                      <col className="w-[9%]" />
                      <col className="w-[13%]" />
                      <col className="w-[5%]" />
                      <col className="w-[8%]" />
                      <col className="w-[12%]" />
                      <col className="w-[9%]" />
                      <col className="w-[6%]" />
                      <col className="w-[8%]" />
                      <col className="w-[11%]" />
                      <col className="w-[15%]" />
                      <col className="w-[4%]" />
                    </colgroup>
                    <thead className="border-y border-slate-100 bg-slate-50 text-slate-500"><tr>{['Booking ID', 'Guest name', 'Room', 'Room type', 'Check-in', 'Check-out', 'Nights', 'Total', 'Status', 'Source', ''].map((label) => <th key={label} className="truncate px-2 py-2 font-semibold">{label}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">{bookingRows.map((booking) => <tr key={booking.id} className="hover:bg-slate-50"><td className="truncate px-2 py-2 font-bold text-slate-800" title={booking.id}>{booking.id}</td><td className="truncate px-2 py-2" title={booking.guest}>{booking.guest}</td><td className="truncate px-2 py-2" title={booking.room}>{booking.room}</td><td className="truncate px-2 py-2" title={booking.roomType}>{booking.roomType}</td><td className="truncate px-2 py-2" title={booking.checkIn}>{booking.checkIn}</td><td className="truncate px-2 py-2" title={booking.checkOut}>{booking.checkOut}</td><td className="truncate px-2 py-2">{booking.nights}</td><td className="truncate px-2 py-2" title={booking.total ? currencyFormatter.format(booking.total) : '—'}>{booking.total ? currencyFormatter.format(booking.total) : '—'}</td><td className="px-2 py-2"><span className={`block truncate rounded-full px-2 py-1 text-center font-semibold ${statusClass(booking.status)}`} title={booking.status}>{booking.status}</span></td><td className="truncate px-2 py-2" title={booking.source}>{booking.source}</td><td className="px-1 py-2 text-center"><button type="button" onClick={() => navigate(`/bookings/${encodeURIComponent(booking.recordId || booking.id)}`)} aria-label={`Open booking ${booking.id}`} className="rounded p-1 text-slate-500 hover:bg-slate-100"><ChevronRightIcon className="h-3.5 w-3.5" /></button></td></tr>)}</tbody>
                  </table>
                  {!bookingRows.length ? <div className="flex flex-1 items-center justify-center"><EmptyState label={recentBookingsQuery.isLoading ? 'Loading booking records…' : recentBookings.length ? 'No bookings match the selected filters.' : 'No live booking records are available.'} /></div> : null}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[9px] text-slate-500"><span>Showing {bookingRows.length} of {filteredBookings.length}</span><div className="flex items-center gap-1"><button type="button" disabled={bookingPage === 1} onClick={() => setBookingPage((page) => Math.max(1, page - 1))} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">Previous</button><span className="px-2">{bookingPage}/{pageCount}</span><button type="button" disabled={bookingPage === pageCount} onClick={() => setBookingPage((page) => Math.min(pageCount, page + 1))} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">Next</button></div></div>
              </Surface>
            </div> : null}
          </div>

          <aside className="min-w-0 space-y-3" data-testid="dashboard-right-rail">
            {canViewBookings ? <Surface>
              <PanelHeader title="Tasks" subtitle="Demo task queue — task service not connected" action="View all" onAction={() => navigate('/operations-center/tasks')} />
              <div className="divide-y divide-slate-100 px-3">{demo.tasks.map((task) => <div key={task.id} className="py-3"><div className="flex items-start gap-2"><span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-slate-300" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-[10px] font-bold leading-4 text-slate-900">{task.title}</p><p className="mt-1 text-[9px] text-slate-500">{task.category} · {task.owner}</p><div className="mt-2 flex items-center justify-between"><span className="text-[9px] text-slate-400">Due {task.due}</span><span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${task.priority === 'High' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{task.priority}</span></div></div></div></div>)}</div>
            </Surface> : null}
            <Surface className="overflow-hidden border-teal-200">
              <div className="bg-teal-950 px-4 py-3 text-white"><div className="flex items-center gap-2"><SparklesIcon className="h-4 w-4 text-teal-200" /><h2 className="text-xs font-bold">Operational attention</h2></div><p className="mt-1 text-[9px] text-teal-100/70">Authorised live priorities and Hotel Brain guidance</p></div>
              <div className="divide-y divide-slate-100">{attentionItems.length ? attentionItems.map((item, index) => <button key={`${item.title}-${index}`} type="button" onClick={() => navigate(item.route)} className="w-full px-4 py-3 text-left hover:bg-slate-50"><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-bold text-slate-900">{item.title}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${item.severity === 'CRITICAL' || item.severity === 'HIGH' ? 'bg-rose-50 text-rose-700' : item.severity === 'MEDIUM' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{item.severity}</span></div><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-600">{item.detail}</p>{item.owner ? <p className="mt-1 text-[9px] font-semibold text-teal-700">Owner: {item.owner}</p> : null}</button>) : <EmptyState label="No operational priorities require attention." />}</div>
            </Surface>
            <Surface>
              <PanelHeader title="Recent activities" subtitle="Latest unique operational changes" action="View all" onAction={() => navigate('/settings?tab=audit-trail')} />
              <div className="px-3 pb-2">{recentTimeline.length ? recentTimeline.map((event) => <div key={event.id} className="relative border-l border-teal-200 py-2 pl-4"><span className="absolute -left-1 top-3 h-2 w-2 rounded-full bg-teal-500 ring-2 ring-white" /><p className="text-[10px] font-bold text-slate-900">{event.summary}</p><p className="mt-1 text-[9px] text-slate-500">{event.module} · {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(event.timestamp))}</p></div>) : <EmptyState label="No live activity is available yet." />}</div>
            </Surface>
          </aside>
        </div>
      </div>
    </div>
  );
}
