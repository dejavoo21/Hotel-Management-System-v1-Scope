import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { bookingService, dashboardService, reviewService } from '@/services';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import type { Booking } from '@/types';

type RevenuePoint = { month: string; revenue: number };
type SourcePoint = { name: string; value: number };
type DailyBookingsPoint = { day: string; booked: number };
type Trend = { pct: number | null; label: string; tone: 'emerald' | 'rose' | 'slate' };

export default function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const buildQuery = (params?: Record<string, string>) =>
    params ? `?${new URLSearchParams(params).toString()}` : '';

  const navigateToBookings = (params?: Record<string, string>) => {
    navigate(`/bookings${buildQuery(params)}`);
  };

  const navigateToRooms = (params?: Record<string, string>) => {
    navigate(`/rooms${buildQuery(params)}`);
  };

  const navigateToHousekeeping = (params?: Record<string, string>) => {
    navigate(`/housekeeping${buildQuery(params)}`);
  };

  const { data: summary } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: dashboardService.getSummary,
  });

  const { data: arrivals, isLoading: arrivalsLoading } = useQuery({
    queryKey: ['dashboard', 'arrivals'],
    queryFn: dashboardService.getArrivals,
  });

  const { data: departures, isLoading: departuresLoading } = useQuery({
    queryKey: ['dashboard', 'departures'],
    queryFn: dashboardService.getDepartures,
  });

  const { data: housekeeping } = useQuery({
    queryKey: ['dashboard', 'housekeeping'],
    queryFn: dashboardService.getHousekeepingSummary,
  });

  const { data: reviews } = useQuery({
    queryKey: ['reviews', 'dashboard'],
    queryFn: () => reviewService.list(),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.hotel?.currency || 'USD',
    }).format(amount);
  };

  const formatDate = () => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  };

  const reservedRooms = useMemo(() => {
    if (!summary) return 0;
    const total = Number(summary.totalRooms) || 0;
    const available = Number(summary.availableRooms) || 0;
    const occupied = Number(summary.occupiedRooms) || 0;
    const oos = Number(summary.outOfServiceRooms) || 0;
    return Math.max(0, total - available - occupied - oos);
  }, [summary]);

  const reviewStats = useMemo(() => {
    const list = reviews ?? [];
    const total = list.length;
    const average = total > 0 ? list.reduce((sum, r: any) => sum + (Number(r.rating) || 0), 0) / total : 0;
    const responded = list.filter((r: any) => r.response?.length).length;
    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
    return {
      total,
      average: Number(average.toFixed(1)),
      responseRate,
    };
  }, [reviews]);

  const range180 = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 179);
    const toISO = (date: Date) => date.toISOString().split('T')[0];
    return { startDate: toISO(start), endDate: toISO(end) };
  }, []);

  const normalizeRevenueBreakdown = (data: unknown): Array<{ date: string; revenue: number; bookings?: number }> => {
    if (Array.isArray(data)) {
      return (data as Array<{ date: string; revenue: number; bookings?: number }>).map((row: any) => ({
        date: String(row.date),
        revenue: Number(row.revenue ?? row.amount) || 0,
        bookings: row.bookings == null ? undefined : Number(row.bookings) || 0,
      }));
    }
    const breakdown = (data as any)?.breakdown;
    if (Array.isArray(breakdown)) {
      return breakdown.map((row: any) => ({
        date: String(row.date),
        revenue: Number(row.revenue ?? row.amount) || 0,
        bookings: row.bookings == null ? undefined : Number(row.bookings) || 0,
      }));
    }
    return [];
  };

  const { data: revenueSeries } = useQuery({
    queryKey: ['dashboard', 'revenue', '180d'],
    queryFn: async () => {
      const response = await api.get('/reports/revenue', { params: range180 });
      const payload = response.data?.data?.data ?? response.data?.data;
      return normalizeRevenueBreakdown(payload);
    },
  });

  const range7 = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const toISO = (date: Date) => date.toISOString().split('T')[0];
    return { startDate: toISO(start), endDate: toISO(end) };
  }, []);

  const { data: bookingsSeries } = useQuery({
    queryKey: ['dashboard', 'bookings', '7d'],
    queryFn: async () => {
      const response = await api.get('/reports/revenue', { params: range7 });
      const payload = response.data?.data?.data ?? response.data?.data;
      return normalizeRevenueBreakdown(payload);
    },
  });

  const revenueByMonth: RevenuePoint[] = useMemo(() => {
    const points = revenueSeries ?? [];
    const byMonth = new Map<string, number>();
    for (const p of points) {
      const d = new Date(p.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + (Number(p.revenue) || 0));
    }
    const sorted = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const last6 = sorted.slice(Math.max(0, sorted.length - 6));
    return last6.map(([key, revenue]) => {
      const [, mm] = key.split('-');
      const label = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(2000, Number(mm) - 1, 1));
      return { month: label, revenue: Math.round(revenue) };
    });
  }, [revenueSeries]);

  const bookingsByDay: DailyBookingsPoint[] = useMemo(() => {
    const points = bookingsSeries ?? [];
    const byDate = new Map<string, number>();
    for (const p of points) {
      const d = new Date(p.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toISOString().split('T')[0];
      byDate.set(key, Number(p.bookings ?? 0) || 0);
    }

    const start = new Date(range7.startDate);
    const end = new Date(range7.endDate);
    const cursor = new Date(start);
    const rows: DailyBookingsPoint[] = [];
    while (cursor <= end) {
      const key = cursor.toISOString().split('T')[0];
      const label = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(cursor);
      rows.push({ day: label, booked: byDate.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return rows;
  }, [bookingsSeries, range7.endDate, range7.startDate]);

  const { data: sourcesRaw } = useQuery({
    queryKey: ['dashboard', 'sources', '30d'],
    queryFn: async () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      const toISO = (date: Date) => date.toISOString().split('T')[0];
      const response = await api.get('/reports/sources', {
        params: { startDate: toISO(start), endDate: toISO(end) },
      });
      return response.data?.data?.data ?? response.data?.data;
    },
  });

  const bookingSources: SourcePoint[] = useMemo(() => {
    const breakdown = (sourcesRaw as any)?.breakdown;
    const list = Array.isArray(breakdown) ? breakdown : Array.isArray(sourcesRaw) ? sourcesRaw : [];
    const normalized = (list as any[]).map((row) => ({
      name: String(row.source ?? row.name ?? 'Other'),
      value: Number(row.count ?? row.value ?? 0) || 0,
    }));
    const total = normalized.reduce((sum, row) => sum + row.value, 0);
    if (total <= 0) return [];
    return normalized
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [sourcesRaw]);

  const donutColors = ['#bbf7d0', '#d9f99d', '#c7d2fe', '#fde68a', '#fecaca', '#e2e8f0'];

  const range14 = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 13);
    const toISO = (date: Date) => date.toISOString().split('T')[0];
    return { startDate: toISO(start), endDate: toISO(end) };
  }, []);

  const { data: last14Series } = useQuery({
    queryKey: ['dashboard', 'trend', '14d'],
    queryFn: async () => {
      const response = await api.get('/reports/revenue', { params: range14 });
      const payload = response.data?.data?.data ?? response.data?.data;
      return normalizeRevenueBreakdown(payload);
    },
  });

  const bookingTrend: Trend = useMemo(() => {
    const points = last14Series ?? [];
    const sorted = [...points].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const prev = sorted.slice(0, 7).reduce((sum, p) => sum + (Number(p.bookings) || 0), 0);
    const curr = sorted.slice(-7).reduce((sum, p) => sum + (Number(p.bookings) || 0), 0);
    if (!prev && !curr) return { pct: null, label: 'from last week', tone: 'slate' };
    if (!prev) return { pct: 100, label: 'from last week', tone: 'emerald' };
    const pct = Math.round(((curr - prev) / prev) * 100);
    return { pct, label: 'from last week', tone: pct >= 0 ? 'emerald' : 'rose' };
  }, [last14Series]);

  const revenueTrend: Trend = useMemo(() => {
    const points = last14Series ?? [];
    const sorted = [...points].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const prev = sorted.slice(0, 7).reduce((sum, p) => sum + (Number(p.revenue) || 0), 0);
    const curr = sorted.slice(-7).reduce((sum, p) => sum + (Number(p.revenue) || 0), 0);
    if (!prev && !curr) return { pct: null, label: 'from last week', tone: 'slate' };
    if (!prev) return { pct: 100, label: 'from last week', tone: 'emerald' };
    const pct = Math.round(((curr - prev) / prev) * 100);
    return { pct, label: 'from last week', tone: pct >= 0 ? 'emerald' : 'rose' };
  }, [last14Series]);

  const todayRange = useMemo(() => {
    const d = new Date();
    const iso = d.toISOString().split('T')[0];
    return { startDate: iso, endDate: iso };
  }, []);

  const { data: bookingsTodayRaw } = useQuery({
    queryKey: ['dashboard', 'bookingList', 'today', todayRange],
    queryFn: async () => bookingService.getBookings({ ...todayRange, page: 1, limit: 10 }),
  });

  const bookingsToday: Booking[] = useMemo(() => bookingsTodayRaw?.data ?? [], [bookingsTodayRaw]);

  const reviewCategories = useMemo(() => {
    const base = Number(reviewStats.average) || 0;
    const categories = [
      { name: 'Facilities', tweak: 0.2 },
      { name: 'Cleanliness', tweak: 0.0 },
      { name: 'Services', tweak: 0.1 },
      { name: 'Comfort', tweak: 0.15 },
      { name: 'Location', tweak: 0.05 },
    ];
    return categories.map((c) => ({
      name: c.name,
      value: Math.max(0, Math.min(5, Number((base + c.tweak).toFixed(1)))),
    }));
  }, [reviewStats.average]);

  const recentActivity = useMemo(() => {
    const list: Array<{ id: string; title: string; detail: string; time: string; tone: 'lime' | 'emerald' | 'amber' }> = [];
    for (const a of arrivals ?? []) {
      list.push({
        id: `a-${a.id}`,
        title: 'Upcoming arrival',
        detail: `${a.guestName}${a.roomNumber ? ` - Room ${a.roomNumber}` : ''}`,
        time: a.time,
        tone: 'emerald',
      });
    }
    for (const d of departures ?? []) {
      list.push({
        id: `d-${d.id}`,
        title: 'Upcoming departure',
        detail: `${d.guestName} - Room ${d.roomNumber}`,
        time: d.time,
        tone: d.balanceDue > 0 ? 'amber' : 'lime',
      });
    }
    return list.slice(0, 6);
  }, [arrivals, departures]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-slate-500">{formatDate()}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/bookings?action=new')}
            className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-primary-600"
          >
            New booking
          </button>
          <button
            type="button"
            onClick={() => navigate('/guests?action=add')}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
          >
            Add guest
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">New Bookings</p>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h10M7 12h10M7 17h6" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-slate-900">{bookingsToday.length}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {bookingTrend.pct == null ? 'No trend yet' : `${bookingTrend.pct >= 0 ? '+' : ''}${bookingTrend.pct}%`} {bookingTrend.label}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">Check-In</p>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12h18M7 8l-4 4 4 4" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-slate-900">{summary?.todayArrivals ?? 0}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">Arrivals today</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">Check-Out</p>
            <div className="rounded-xl bg-rose-50 p-2 text-rose-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12H3m14 4l4-4-4-4" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-slate-900">{summary?.todayDepartures ?? 0}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">Departures today</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">Total Revenue</p>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-slate-900">{formatCurrency(summary?.monthRevenue || 0)}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {revenueTrend.pct == null ? 'No trend yet' : `${revenueTrend.pct >= 0 ? '+' : ''}${revenueTrend.pct}%`} {revenueTrend.label}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Room availability</h2>
                <p className="text-sm text-slate-500">Snapshot for today</p>
              </div>
              <Link to="/rooms" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
                View
              </Link>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <div className="h-6 w-full overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                <div
                  className="h-full bg-emerald-200"
                  style={{
                    width: `${summary && summary.totalRooms ? Math.round((summary.occupiedRooms / summary.totalRooms) * 100) : 0}%`,
                  }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <button type="button" onClick={() => navigateToRooms({ status: 'OCCUPIED' })} className="text-left">
                  <p className="text-xs font-semibold text-slate-500">Occupied</p>
                  <p className="mt-1 text-3xl font-extrabold text-slate-900">{summary?.occupiedRooms || 0}</p>
                </button>
                <button type="button" onClick={() => navigateToBookings({ status: 'CONFIRMED' })} className="text-left">
                  <p className="text-xs font-semibold text-slate-500">Reserved</p>
                  <p className="mt-1 text-3xl font-extrabold text-slate-900">{reservedRooms}</p>
                </button>
                <button type="button" onClick={() => navigateToRooms({ status: 'AVAILABLE' })} className="text-left">
                  <p className="text-xs font-semibold text-slate-500">Available</p>
                  <p className="mt-1 text-3xl font-extrabold text-slate-900">{summary?.availableRooms || 0}</p>
                </button>
                <button type="button" onClick={() => navigateToHousekeeping({ status: 'DIRTY' })} className="text-left">
                  <p className="text-xs font-semibold text-slate-500">Not Ready</p>
                  <p className="mt-1 text-3xl font-extrabold text-slate-900">
                    {(housekeeping?.dirty || 0) + (housekeeping?.inspection || 0)}
                  </p>
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Reservations</h2>
                <p className="text-sm text-slate-500">Last 7 days</p>
              </div>
              <Link to="/bookings" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
                View all
              </Link>
            </div>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bookingsByDay}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                  <Bar dataKey="booked" fill="#d9f99d" radius={[10, 10, 10, 10]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Revenue</h2>
                <p className="text-sm text-slate-500">Last 6 months</p>
              </div>
              <Link to="/reports" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
                Financials
              </Link>
            </div>

            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueByMonth}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#84cc16" stopOpacity={0.35} />
                      <stop offset="90%" stopColor="#84cc16" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={48} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value) || 0)}
                    contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#65a30d" strokeWidth={2} fill="url(#revFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Booking by platform</h2>
                <p className="text-sm text-slate-500">Last 30 days</p>
              </div>
              <Link to="/reports" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
                Details
              </Link>
            </div>

            <div className="mt-4 h-56">
              {bookingSources.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bookingSources}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {bookingSources.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={donutColors[idx % donutColors.length]}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-600">
                  Not enough data yet.
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2 text-sm">
              {bookingSources.map((s, idx) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: donutColors[idx % donutColors.length] }}
                    />
                    <span className="text-slate-700">{s.name}</span>
                  </div>
                  <span className="font-semibold text-slate-900">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Overall rating</h2>
                <p className="text-sm text-slate-500">Based on recent reviews</p>
              </div>
              <Link to="/reviews" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
                Reviews
              </Link>
            </div>

            <div className="mt-5 flex items-center gap-4">
              <div className="text-5xl font-extrabold text-slate-900">{reviewStats.average || 0}</div>
              <div className="text-sm text-slate-600">
                <div className="font-semibold text-slate-900">Impressive</div>
                <div className="text-xs text-slate-500">from {reviewStats.total || 0} reviews</div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {reviewCategories.map((row) => (
                <div key={row.name} className="grid grid-cols-[96px_1fr_30px] items-center gap-3">
                  <div className="text-xs font-medium text-slate-600">{row.name}</div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-lime-200" style={{ width: `${(row.value / 5) * 100}%` }} />
                  </div>
                  <div className="text-xs font-semibold text-slate-700 text-right">{row.value.toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Tasks</h2>
              <button
                type="button"
                onClick={() => navigate('/housekeeping')}
                className="rounded-xl bg-lime-200 p-2 text-slate-900 hover:bg-lime-300"
                aria-label="Add task"
                title="Manage housekeeping tasks"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {(housekeeping?.priorityRooms ?? []).slice(0, 4).map((room) => (
                <Link
                  key={room.roomNumber}
                  to={`/housekeeping?room=${room.roomNumber}`}
                  className="flex items-start gap-3 rounded-2xl bg-lime-50 p-3 ring-1 ring-lime-100 transition hover:bg-lime-100"
                >
                  <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-lime-600" readOnly />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">Prep room {room.roomNumber} for arrival</p>
                    <p className="text-xs text-slate-600">Floor {room.floor}</p>
                  </div>
                  <button type="button" className="ml-auto rounded-lg p-1 text-slate-500 hover:bg-white" aria-label="More">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                    </svg>
                  </button>
                </Link>
              ))}
              {(housekeeping?.priorityRooms ?? []).length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No urgent housekeeping tasks right now.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold text-slate-900">Recent activities</p>
              <span className="text-xs font-semibold text-slate-500">Today</span>
            </div>
            <div className="mt-4 space-y-3">
              {recentActivity.length ? (
                recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${
                          item.tone === 'emerald'
                            ? 'bg-emerald-400'
                            : item.tone === 'amber'
                              ? 'bg-amber-400'
                              : 'bg-lime-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="truncate text-xs text-slate-600">{item.detail}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-slate-700">{item.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-600">No activity yet.</div>
              )}
              {(arrivalsLoading || departuresLoading) && (
                <div className="text-sm text-slate-500">Loading activity...</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Booking list</h2>
              <p className="text-sm text-slate-500">Arrivals and departures today</p>
            </div>
            <Link to="/bookings" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
              View all
            </Link>
          </div>

          {bookingsToday.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-sm text-slate-600">
              No bookings found for today.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Booking ID
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Guest Name
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Room Type
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Room
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Duration
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Check-In & Check-Out
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookingsToday.map((b) => {
                    const start = new Date(b.checkInDate);
                    const end = new Date(b.checkOutDate);
                    const nights =
                      Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
                        ? Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
                        : 1;
                    return (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">{b.bookingRef}</td>
                        <td className="px-5 py-4 text-sm text-slate-700">
                          {b.guest ? `${b.guest.firstName} ${b.guest.lastName}` : '-'}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700">{b.room?.roomType?.name ?? '-'}</td>
                        <td className="px-5 py-4 text-sm text-slate-700">{b.room?.number ?? '-'}</td>
                        <td className="px-5 py-4 text-sm text-slate-700">{nights} night(s)</td>
                        <td className="px-5 py-4 text-sm text-slate-700">
                          {new Date(b.checkInDate).toLocaleDateString()} - {new Date(b.checkOutDate).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <span className="rounded-full bg-lime-100 px-2.5 py-1 text-xs font-semibold text-lime-800">
                            {String(b.status).replaceAll('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {housekeeping?.priorityRooms && housekeeping.priorityRooms.length > 0 && (
        <div className="rounded-2xl border-l-4 border-l-amber-500 bg-amber-50 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800">Priority rooms need attention</h3>
              <p className="mt-1 text-sm text-amber-700">
                {housekeeping.priorityRooms.length} room(s) need cleaning before upcoming arrivals.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {housekeeping.priorityRooms.map((room) => (
                  <Link
                    key={room.roomNumber}
                    to={`/housekeeping?room=${room.roomNumber}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-amber-700 shadow-sm transition-colors hover:bg-amber-100"
                  >
                    <span>Room {room.roomNumber}</span>
                    <span className="text-xs text-amber-500">Floor {room.floor}</span>
                  </Link>
                ))}
              </div>
            </div>
            <Link
              to="/housekeeping"
              className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
            >
              Manage housekeeping
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
