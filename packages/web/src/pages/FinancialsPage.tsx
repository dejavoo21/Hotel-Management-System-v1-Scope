import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BarChart3, CircleDollarSign, Download, FileBarChart, FilterX, Mail, Percent, ReceiptText, RefreshCcw, ShieldAlert, UsersRound, WalletCards, type LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { reportService } from '@/services';
import { useAuthStore } from '@/stores/authStore';
import { appendAuditLog } from '@/utils/auditLog';
import { formatEnumLabel } from '@/utils';

type ReportPeriod = '7d' | '30d' | '90d' | '365d';
type RevenueMetric = 'revenue' | 'bookedValue' | 'outstanding';
type RevenueRow = { date: string; revenue: number; bookedValue: number; paid: number; outstanding: number; bookings: number };
type OccupancyRow = { date: string; occupancy: number; totalRooms: number; occupiedRooms: number };
type RevenueReport = { total: number; bookedValue: number; paidRevenue: number; outstandingBalance: number; bookingCount: number; breakdown: RevenueRow[] };

const periods: Array<{ value: ReportPeriod; label: string; days: number }> = [
  { value: '7d', label: 'Last 7 Days', days: 7 }, { value: '30d', label: 'Last 30 Days', days: 30 },
  { value: '90d', label: 'Last 90 Days', days: 90 }, { value: '365d', label: 'Last Year', days: 365 },
];

const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

export default function FinancialsPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const canView = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [period, setPeriod] = useState<ReportPeriod>('30d');
  const [metric, setMetric] = useState<RevenueMetric>('revenue');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [roomTypeFilter, setRoomTypeFilter] = useState('ALL');

  const range = useMemo(() => {
    const days = periods.find((item) => item.value === period)?.days || 30;
    const end = new Date(); const start = new Date(); start.setDate(start.getDate() - days + 1);
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }, [period]);
  const periodLabel = periods.find((item) => item.value === period)?.label || 'Selected period';
  const currency = user?.hotel?.currency || 'USD';
  const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value || 0);

  const revenueQuery = useQuery({ queryKey: ['financials', 'revenue', period], enabled: canView, queryFn: async () => (await api.get('/reports/revenue', { params: range })).data.data as RevenueReport });
  const occupancyQuery = useQuery({ queryKey: ['financials', 'occupancy', period], enabled: canView, queryFn: async () => {
    const data = (await api.get('/reports/occupancy', { params: range })).data.data as { breakdown?: Array<{ date: string; rate: number; total: number; occupied: number }> };
    return (data.breakdown || []).map((row) => ({ date: row.date, occupancy: Number(row.rate) || 0, totalRooms: Number(row.total) || 0, occupiedRooms: Number(row.occupied) || 0 }));
  }});
  const sourcesQuery = useQuery({ queryKey: ['financials', 'sources', period], enabled: canView, queryFn: async () => (await api.get('/reports/sources', { params: range })).data.data as Array<{ source: string; count: number; revenue: number }> });
  const roomTypesQuery = useQuery({ queryKey: ['financials', 'room-types', period], enabled: canView, queryFn: async () => (await api.get('/reports/room-types', { params: range })).data.data as Array<{ name: string; roomCount: number; bookings: number; baseRate: number }> });
  const guestsQuery = useQuery({ queryKey: ['financials', 'guests', period], enabled: canView, queryFn: async () => (await api.get('/reports/guests', { params: range })).data.data as { totalGuests: number; newGuests: number; topGuests: Array<{ firstName: string; lastName: string; totalSpent: number; totalStays: number }> } });

  if (!canView) return <AccessDenied />;
  const loading = revenueQuery.isLoading || occupancyQuery.isLoading;
  const error = revenueQuery.isError || occupancyQuery.isError || sourcesQuery.isError || roomTypesQuery.isError || guestsQuery.isError;
  const report = revenueQuery.data;
  const revenueRows = report?.breakdown || [];
  const occupancyRows = occupancyQuery.data || [];
  const avgOccupancy = occupancyRows.length ? occupancyRows.reduce((sum, row) => sum + row.occupancy, 0) / occupancyRows.length : 0;
  const avgRevenue = report?.bookingCount ? report.total / report.bookingCount : 0;
  const revenueHasSignal = revenueRows.some((row) => row[metric] > 0);
  const occupancyHasSignal = occupancyRows.some((row) => row.occupancy > 0 || row.occupiedRooms > 0);
  const sources = (sourcesQuery.data || []).filter((row) => sourceFilter === 'ALL' || row.source === sourceFilter);
  const roomTypes = (roomTypesQuery.data || []).filter((row) => roomTypeFilter === 'ALL' || row.name === roomTypeFilter);
  const topSourceValue = Math.max(...sources.map((row) => row.revenue), 0);
  const topRoomBookings = Math.max(...roomTypes.map((row) => row.bookings), 0);

  const auditExport = (format: string) => appendAuditLog({ action: 'Financial Report Exported', actorId: user?.id, actorName: user?.email || 'Finance user', targetLabel: 'Financials', details: { format, period, startDate: range.startDate, endDate: range.endDate } });
  const exportReport = async (format: 'csv' | 'pdf') => {
    try { const blob = await reportService.exportReport('summary', range, format); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `laflo-financials-${range.startDate}-${range.endDate}.${format}`; link.click(); URL.revokeObjectURL(url); auditExport(format.toUpperCase()); toast.success(`${format.toUpperCase()} report downloaded`); }
    catch { toast.error('Financial report could not be exported.'); }
  };
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['financials'] }); toast.success('Financial data refreshed'); };
  const summaryCards: Array<{ icon: LucideIcon; label: string; value: string | number; help: string }> = [
    { icon: CircleDollarSign, label: 'Total Revenue', value: money(report?.total || 0), help: periodLabel },
    { icon: ReceiptText, label: 'Total Bookings', value: report?.bookingCount || 0, help: periodLabel },
    { icon: Percent, label: 'Average Occupancy', value: `${avgOccupancy.toFixed(1)}%`, help: periodLabel },
    { icon: BarChart3, label: 'Revenue / Booking', value: money(avgRevenue), help: 'Posted revenue average' },
    { icon: AlertTriangle, label: 'Outstanding Balance', value: money(report?.outstandingBalance || 0), help: report?.outstandingBalance ? 'Needs collection' : 'No balance due' },
    { icon: WalletCards, label: 'Paid Revenue', value: money(report?.paidRevenue || 0), help: 'Recorded booking payments' },
  ];

  return <div className="space-y-4 pb-8">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex items-center gap-3"><span className="theme-kpi-icon grid h-12 w-12 place-items-center rounded-2xl"><CircleDollarSign className="h-6 w-6" /></span><div><h1 className="text-2xl font-bold tracking-tight text-text-main">Financials</h1><p className="mt-1 text-sm text-text-muted">Monitor revenue, occupancy, payments, booking performance, and financial reports.</p></div></div>
      <div className="flex flex-wrap items-center gap-2"><div className="flex flex-wrap rounded-xl border border-border bg-card p-1">{periods.map((item) => <button key={item.value} type="button" onClick={() => setPeriod(item.value)} aria-pressed={period === item.value} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${period === item.value ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-bg hover:text-text-main'}`}>{item.label}</button>)}</div><button className="btn-outline" onClick={refresh}><RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button><button className="btn-outline" onClick={() => exportReport('csv')}><Download className="h-4 w-4" />Export</button><a className="btn-primary" href="/reports"><FileBarChart className="h-4 w-4" />Financial reports</a></div>
    </header>

    <RevenueIntelligence report={report} occupancy={avgOccupancy} money={money} loading={loading} onRefresh={refresh} />

    {error ? <ErrorState onRetry={refresh} /> : null}
    <section aria-label="Financial summary" className="theme-kpi-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {summaryCards.map(({ icon: Icon, label, value, help }) => <article key={label} className="theme-stat-card flex min-h-28 items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><span className="theme-kpi-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-medium text-text-muted">{label}</p>{loading ? <div className="mt-2 h-7 w-24 animate-shimmer rounded" /> : <p className="mt-1 truncate text-xl font-bold text-text-main">{value}</p>}<p className="mt-1 truncate text-xs text-text-muted">{help}</p></div></article>)}
    </section>

    <FinancialFilters source={sourceFilter} roomType={roomTypeFilter} metric={metric} sources={sourcesQuery.data || []} roomTypes={roomTypesQuery.data || []} onSource={setSourceFilter} onRoomType={setRoomTypeFilter} onMetric={setMetric} />

    <section className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Revenue Overview" subtitle="Daily financial movement for the selected period" loading={loading} empty={!revenueHasSignal} emptyText={metric === 'revenue' ? 'No completed revenue posted for this period.' : metric === 'bookedValue' ? 'No booked stay value available for this period.' : 'No outstanding balances for this period.'}>
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={revenueRows.slice(-45).map((row) => ({ ...row, label: dateLabel(row.date) }))}><defs><linearGradient id="financeArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="rgb(var(--laflo-chart-primary))" stopOpacity="0.35" /><stop offset="95%" stopColor="rgb(var(--laflo-chart-primary))" stopOpacity="0.03" /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--color-border))" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--color-text-muted))' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: 'rgb(var(--color-text-muted))' }} axisLine={false} tickLine={false} tickFormatter={(value) => new Intl.NumberFormat('en', { notation: 'compact' }).format(value)} /><Tooltip formatter={(value) => [money(Number(value)), metric === 'revenue' ? 'Posted Revenue' : metric === 'bookedValue' ? 'Booked Stay Value' : 'Outstanding']} contentStyle={{ borderRadius: 12, background: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-main))' }} /><Area type="monotone" dataKey={metric} stroke="rgb(var(--laflo-chart-primary))" strokeWidth={2.5} fill="url(#financeArea)" /></AreaChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Occupancy Rate" subtitle="Daily occupied rooms for the selected period" loading={loading} empty={!occupancyHasSignal} emptyText="No occupancy activity available for this period.">
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={occupancyRows.slice(-45).map((row) => ({ ...row, label: dateLabel(row.date) }))}><defs><linearGradient id="occupancyArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="rgb(var(--laflo-chart-secondary))" stopOpacity="0.32" /><stop offset="95%" stopColor="rgb(var(--laflo-chart-secondary))" stopOpacity="0.03" /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--color-border))" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--color-text-muted))' }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: 'rgb(var(--color-text-muted))' }} axisLine={false} tickLine={false} /><Tooltip formatter={(value, name, item) => name === 'occupancy' ? [`${Number(value).toFixed(1)}% (${item.payload.occupiedRooms}/${item.payload.totalRooms} rooms)`, 'Occupancy'] : [value, name]} contentStyle={{ borderRadius: 12, background: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-main))' }} /><Area type="monotone" dataKey="occupancy" stroke="rgb(var(--laflo-chart-secondary))" strokeWidth={2.5} fill="url(#occupancyArea)" /></AreaChart></ResponsiveContainer>
      </ChartCard>
    </section>

    <section className="grid gap-4 xl:grid-cols-2"><DailyTable title="Revenue by Day" rows={revenueRows} type="revenue" money={money} /><DailyTable title="Occupancy by Day" rows={occupancyRows} type="occupancy" money={money} /></section>
    <section className="grid gap-4 xl:grid-cols-2"><PerformancePanel title="Booking Sources" subtitle="Bookings and booked value by channel" emptyText="No booking-source revenue available for this period." rows={sources.map((row) => ({ label: formatEnumLabel(row.source), primary: `${row.count} bookings`, secondary: money(row.revenue), percentage: topSourceValue ? (row.revenue / topSourceValue) * 100 : 0 }))} /><PerformancePanel title="Room Type Performance" subtitle="Booking contribution by room category" emptyText="No room type booking activity for this period." rows={roomTypes.map((row) => ({ label: row.name, primary: `${row.bookings} bookings`, secondary: `${row.roomCount} rooms`, percentage: topRoomBookings ? (row.bookings / topRoomBookings) * 100 : 0 }))} /></section>
    <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]"><GuestPanel data={guestsQuery.data} money={money} /><ExportPanel onExport={exportReport} /></section>
  </div>;
}

function RevenueIntelligence({ report, occupancy, money, loading, onRefresh }: { report?: RevenueReport; occupancy: number; money: (value: number) => string; loading: boolean; onRefresh: () => void }) {
  const outstanding = report?.outstandingBalance || 0;
  const risk = occupancy < 20 ? 'High' : occupancy < 50 ? 'Medium' : 'Low';
  return <section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-text-main">Revenue Intelligence</h2><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${risk === 'High' ? 'bg-rose-50 text-rose-700' : risk === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{risk} risk</span><span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold text-text-muted">Rules fallback</span></div><p className="mt-1 text-sm text-text-muted">Collections, demand, and pricing guidance from authorised financial data.</p></div><button type="button" onClick={onRefresh} disabled={loading} className="btn-outline"><RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh insight</button></div><div className="mt-4 grid gap-3 md:grid-cols-3"><Insight title="Top Priority" badge={outstanding ? 'Collections' : 'Monitor'} text={outstanding ? `${money(outstanding)} in outstanding balances needs collection.` : 'No outstanding balances currently require action.'} tone="good" /><Insight title="Top Risk" badge={risk} text={occupancy < 20 ? `Soft demand: average occupancy is ${occupancy.toFixed(1)}%. Consider tactical offers and channel mix.` : `Average occupancy is ${occupancy.toFixed(1)}%; continue monitoring demand and booking pace.`} tone="risk" /><Insight title="Recommended Action" badge="Review" text="Review pricing, collections, demand, and connected market signals before changing rates." tone="warn" /></div></section>;
}
function Insight({ title, badge, text, tone }: { title: string; badge: string; text: string; tone: 'good' | 'risk' | 'warn' }) { const style = tone === 'risk' ? 'border-rose-200 bg-rose-50/40' : tone === 'warn' ? 'border-amber-200 bg-amber-50/40' : 'border-emerald-200 bg-emerald-50/40'; return <article className={`rounded-xl border p-4 ${style}`}><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-text-main">{title}</h3><span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-text-muted">{badge}</span></div><p className="mt-3 text-sm leading-5 text-text-muted">{text}</p></article>; }

function FinancialFilters({ source, roomType, metric, sources, roomTypes, onSource, onRoomType, onMetric }: { source: string; roomType: string; metric: RevenueMetric; sources: Array<{ source: string }>; roomTypes: Array<{ name: string }>; onSource: (value: string) => void; onRoomType: (value: string) => void; onMetric: (value: RevenueMetric) => void }) {
  const active = source !== 'ALL' || roomType !== 'ALL' || metric !== 'revenue';
  return <section className="grid gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]"><select aria-label="Booking source" className="input h-10" value={source} onChange={(event) => onSource(event.target.value)}><option value="ALL">All booking sources</option>{sources.map((item) => <option key={item.source} value={item.source}>{formatEnumLabel(item.source)}</option>)}</select><select aria-label="Room type" className="input h-10" value={roomType} onChange={(event) => onRoomType(event.target.value)}><option value="ALL">All room types</option>{roomTypes.map((item) => <option key={item.name}>{item.name}</option>)}</select><select aria-label="Revenue type" className="input h-10" value={metric} onChange={(event) => onMetric(event.target.value as RevenueMetric)}><option value="revenue">Posted revenue</option><option value="bookedValue">Booked stay value</option><option value="outstanding">Outstanding balance</option></select><button type="button" className="btn-ghost h-10" disabled={!active} onClick={() => { onSource('ALL'); onRoomType('ALL'); onMetric('revenue'); }}><FilterX className="h-4 w-4" />Clear filters</button></section>;
}

function ChartCard({ title, subtitle, loading, empty, emptyText, children }: { title: string; subtitle: string; loading: boolean; empty: boolean; emptyText: string; children: React.ReactNode }) { return <article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="text-lg font-semibold text-text-main">{title}</h2><p className="mt-1 text-sm text-text-muted">{subtitle}</p><div className="mt-4 h-64">{loading ? <div className="h-full animate-shimmer rounded-xl" /> : empty ? <div className="grid h-full place-items-center rounded-xl border border-dashed border-border bg-bg/50 text-center"><div><BarChart3 className="mx-auto h-8 w-8 text-text-muted" /><p className="mt-3 font-semibold text-text-main">{emptyText}</p><p className="mt-1 text-xs text-text-muted">Change the period or review connected payment and booking sources.</p></div></div> : children}</div></article>; }

function DailyTable({ title, rows, type, money }: { title: string; rows: RevenueRow[] | OccupancyRow[]; type: 'revenue' | 'occupancy'; money: (value: number) => string }) {
  const hasActivity = type === 'revenue' ? (rows as RevenueRow[]).some((row) => row.revenue || row.bookings || row.outstanding) : (rows as OccupancyRow[]).some((row) => row.occupiedRooms);
  return <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border px-4 py-3"><h2 className="font-semibold text-text-main">{title}</h2></div>{hasActivity ? <div className="max-h-80 overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-card text-xs uppercase text-text-muted"><tr className="border-b border-border"><th className="px-4 py-3 text-left">Date</th>{type === 'revenue' ? <><th className="px-3 py-3 text-right">Bookings</th><th className="px-3 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Outstanding</th></> : <><th className="px-3 py-3 text-right">Rooms</th><th className="px-3 py-3 text-right">Available</th><th className="px-4 py-3 text-right">Occupancy</th></>}</tr></thead><tbody className="divide-y divide-border">{[...rows].reverse().slice(0, 30).map((item) => type === 'revenue' ? <tr key={item.date} className="hover:bg-bg/50"><td className="px-4 py-3 text-text-main">{dateLabel(item.date)}</td><td className="px-3 py-3 text-right text-text-muted">{(item as RevenueRow).bookings}</td><td className="px-3 py-3 text-right font-semibold text-text-main">{money((item as RevenueRow).revenue)}</td><td className="px-4 py-3 text-right text-amber-700">{money((item as RevenueRow).outstanding)}</td></tr> : <tr key={item.date} className="hover:bg-bg/50"><td className="px-4 py-3 text-text-main">{dateLabel(item.date)}</td><td className="px-3 py-3 text-right text-text-muted">{(item as OccupancyRow).occupiedRooms}/{(item as OccupancyRow).totalRooms}</td><td className="px-3 py-3 text-right text-text-muted">{Math.max(0, (item as OccupancyRow).totalRooms - (item as OccupancyRow).occupiedRooms)}</td><td className="px-4 py-3 text-right font-semibold text-text-main">{(item as OccupancyRow).occupancy.toFixed(1)}%</td></tr>)}</tbody></table></div> : <div className="p-8 text-center text-sm text-text-muted">No financial activity available for this period.</div>}</article>;
}

function PerformancePanel({ title, subtitle, rows, emptyText }: { title: string; subtitle: string; rows: Array<{ label: string; primary: string; secondary: string; percentage: number }>; emptyText: string }) { return <article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="text-lg font-semibold text-text-main">{title}</h2><p className="mt-1 text-sm text-text-muted">{subtitle}</p>{rows.length && rows.some((row) => row.percentage > 0) ? <div className="mt-4 space-y-4">{rows.map((row) => <div key={row.label}><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium text-text-main">{row.label}</span><span className="text-right text-text-muted">{row.primary} · <strong className="text-text-main">{row.secondary}</strong></span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-border/50"><div className="h-full rounded-full bg-primary-500" style={{ width: `${row.percentage}%` }} /></div></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-border bg-bg/50 p-8 text-center text-sm text-text-muted">{emptyText}</div>}</article>; }

function GuestPanel({ data, money }: { data?: { totalGuests: number; newGuests: number; topGuests: Array<{ firstName: string; lastName: string; totalSpent: number; totalStays: number }> }; money: (value: number) => string }) { const top = data?.topGuests?.find((guest) => Number(guest.totalSpent) > 0); return <article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-text-main">Guest Analytics</h2><p className="mt-1 text-sm text-text-muted">Guest contribution and stay activity.</p></div><UsersRound className="h-5 w-5 text-primary-600" /></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Total Guests" value={data?.totalGuests || 0} /><Metric label="New Guests" value={data?.newGuests || 0} /><Metric label="Returning Guests" value={Math.max(0, (data?.totalGuests || 0) - (data?.newGuests || 0))} /></div><div className="mt-3 rounded-xl border border-border bg-bg/40 p-4">{top ? <><p className="text-xs text-text-muted">Top guest by recorded contribution</p><p className="mt-1 font-semibold text-text-main">{top.firstName} {top.lastName}</p><p className="mt-1 text-sm text-text-muted">{money(Number(top.totalSpent))} across {top.totalStays} stays</p></> : <p className="text-sm text-text-muted">No guest revenue data yet.</p>}</div></article>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-border bg-bg/30 p-4"><p className="text-xs text-text-muted">{label}</p><p className="mt-2 text-xl font-bold text-text-main">{value}</p></div>; }
function ExportPanel({ onExport }: { onExport: (format: 'csv' | 'pdf') => void }) { return <article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="text-lg font-semibold text-text-main">Export Reports</h2><p className="mt-1 text-sm text-text-muted">Download or share financial reports for the selected period.</p><div className="mt-5 grid gap-2"><button className="btn-outline justify-start" onClick={() => onExport('csv')}><Download className="h-4 w-4" />Export CSV</button><button className="btn-outline justify-start" onClick={() => onExport('pdf')}><FileBarChart className="h-4 w-4" />Export PDF</button><button className="btn-outline justify-start" disabled title="Email delivery is not enabled for this workspace"><Mail className="h-4 w-4" />Email Report <span className="ml-auto text-xs">Coming soon</span></button></div></article>; }
function ErrorState({ onRetry }: { onRetry: () => void }) { return <div className="flex items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800"><div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5" /><div><p className="font-semibold">Financial data could not be loaded.</p><p className="text-sm">Please try again.</p></div></div><button className="btn-outline" onClick={onRetry}>Try again</button></div>; }
function AccessDenied() { return <div className="grid min-h-[28rem] place-items-center rounded-2xl border border-border bg-card p-8 text-center"><div><ShieldAlert className="mx-auto h-10 w-10 text-text-muted" /><h1 className="mt-4 text-xl font-semibold text-text-main">Financial access restricted</h1><p className="mt-2 max-w-md text-sm text-text-muted">Only authorised administrators and managers can view revenue, payments, guest contribution, and financial exports.</p></div></div>; }
