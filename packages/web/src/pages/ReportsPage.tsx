import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import { reportService, bookingService, roomService } from '@/services';
import type { RevenueBreakdownItem, OccupancyBreakdownItem } from '@/types';
import { formatEnumLabel } from '@/utils';

type ReportPeriod = '7d' | '30d' | '90d' | '365d';

interface RevenueData {
  date: string;
  revenue: number;
  bookings: number;
}

interface OccupancyData {
  date: string;
  occupancy: number;
  totalRooms: number;
  occupiedRooms: number;
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('30d');
  const { user } = useAuthStore();

  const range = useMemo(() => {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const toISO = (date: Date) => date.toISOString().split('T')[0];
    return { startDate: toISO(start), endDate: toISO(end) };
  }, [period]);

  const normalizeRevenueData = (data: unknown): RevenueData[] => {
    if (Array.isArray(data)) {
      return (data as RevenueData[]).map((item) => ({
        date: item.date,
        revenue: Number(item.revenue) || 0,
        bookings: Number(item.bookings) || 0,
      }));
    }
    const breakdown = (data as { breakdown?: RevenueBreakdownItem[] })?.breakdown;
    if (breakdown && Array.isArray(breakdown)) {
      const normalized = breakdown.map((item) => ({
        date: item.date,
        revenue: Number((item as any).revenue ?? (item as any).amount) || 0,
        bookings: Number(item.bookings) || 0,
      }));
      const hasSignal = normalized.some((entry) => entry.revenue > 0 || entry.bookings > 0);
      return hasSignal ? normalized : [];
    }
    return [];
  };

  const normalizeOccupancyData = (data: unknown): OccupancyData[] => {
    if (Array.isArray(data)) {
      return (data as OccupancyData[]).map((item) => ({
        date: item.date,
        occupancy: Number(item.occupancy) || 0,
        totalRooms: Number(item.totalRooms) || 0,
        occupiedRooms: Number(item.occupiedRooms) || 0,
      }));
    }
    const breakdown = (data as { breakdown?: OccupancyBreakdownItem[] })?.breakdown;
    if (breakdown && Array.isArray(breakdown)) {
      const normalized = breakdown.map((item) => ({
        date: item.date,
        occupancy: Number(item.rate) || 0,
        totalRooms: Number(item.total) || 0,
        occupiedRooms: Number(item.occupied) || 0,
      }));
      const hasSignal = normalized.some((entry) => entry.occupancy > 0 || entry.occupiedRooms > 0);
      return hasSignal ? normalized : [];
    }
    return [];
  };

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['reports', 'revenue', period],
    queryFn: async () => {
      const response = await api.get('/reports/revenue', { params: range });
      return normalizeRevenueData(response.data.data);
    },
  });

  const { data: occupancyData, isLoading: occupancyLoading } = useQuery({
    queryKey: ['reports', 'occupancy', period],
    queryFn: async () => {
      const response = await api.get('/reports/occupancy', { params: range });
      return normalizeOccupancyData(response.data.data);
    },
  });

  const { data: fallbackBookings } = useQuery({
    queryKey: ['reports', 'bookings-fallback', period],
    queryFn: async () => {
      const response = await bookingService.getBookings({
        startDate: range.startDate,
        endDate: range.endDate,
        limit: 500,
      });
      return response.data ?? [];
    },
    enabled:
      !revenueLoading &&
      !occupancyLoading &&
      ((revenueData?.length ?? 0) === 0 || (occupancyData?.length ?? 0) === 0),
  });

  const { data: roomsSummary } = useQuery({
    queryKey: ['reports', 'rooms-count'],
    queryFn: async () => roomService.getRooms({ limit: 1 }),
    enabled: !occupancyLoading && (occupancyData?.length ?? 0) === 0,
  });

  const dateSeries = useMemo(() => {
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [range.endDate, range.startDate]);

  const revenueSeries = useMemo<RevenueData[]>(() => {
    if (revenueData && revenueData.length > 0) return revenueData;

    const revenueByDate = new Map<string, RevenueData>();
    dateSeries.forEach((date) => {
      revenueByDate.set(date, { date, revenue: 0, bookings: 0 });
    });

    if (fallbackBookings && fallbackBookings.length > 0) {
      fallbackBookings.forEach((booking) => {
        const dateKey = new Date(booking.checkInDate).toISOString().split('T')[0];
        const current = revenueByDate.get(dateKey);
        if (!current) return;
        current.revenue += Number(booking.totalAmount) || 0;
        current.bookings += 1;
      });
    }

    return Array.from(revenueByDate.values());
  }, [dateSeries, fallbackBookings, revenueData]);

  const occupancySeries = useMemo<OccupancyData[]>(() => {
    if (occupancyData && occupancyData.length > 0) return occupancyData;

    const totalRooms = Number(roomsSummary?.pagination?.total) || 0;
    const occupancyByDate = new Map<string, OccupancyData>();
    dateSeries.forEach((date) => {
      occupancyByDate.set(date, {
        date,
        occupancy: 0,
        totalRooms,
        occupiedRooms: 0,
      });
    });

    if (fallbackBookings && fallbackBookings.length > 0) {
      fallbackBookings.forEach((booking) => {
        const dateKey = new Date(booking.checkInDate).toISOString().split('T')[0];
        const current = occupancyByDate.get(dateKey);
        if (!current) return;
        current.occupiedRooms += 1;
        current.occupancy = totalRooms > 0 ? (current.occupiedRooms / totalRooms) * 100 : 0;
      });
    }

    return Array.from(occupancyByDate.values());
  }, [dateSeries, fallbackBookings, occupancyData, roomsSummary?.pagination?.total]);

  const { data: sourcesData } = useQuery({
    queryKey: ['reports', 'sources', period],
    queryFn: async () => {
      const response = await api.get('/reports/sources', { params: range });
      return response.data.data as { source: string; count: number; revenue: number }[];
    },
  });

  const { data: roomTypeData } = useQuery({
    queryKey: ['reports', 'room-types', period],
    queryFn: async () => {
      const response = await api.get('/reports/room-types', { params: range });
      return response.data.data as { name: string; roomCount: number; bookings: number; baseRate: number }[];
    },
  });

  const { data: guestData } = useQuery({
    queryKey: ['reports', 'guests', period],
    queryFn: async () => {
      const response = await api.get('/reports/guests', { params: range });
      return response.data.data as { totalGuests: number; newGuests: number; topGuests: { firstName: string; lastName: string; totalSpent: number; totalStays: number }[] };
    },
  });

  const handleExport = async (format: 'csv' | 'pdf') => {
    const blob = await reportService.exportReport('summary', range, format);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `laflo-summary.${format}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleEmailReport = async () => {
    const recipientEmail = window.prompt('Recipient email');
    if (!recipientEmail) return;
    await reportService.emailReport({
      type: 'summary',
      recipientEmail,
      startDate: range.startDate,
      endDate: range.endDate,
      format: 'pdf',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.hotel?.currency || 'USD',
    }).format(amount);
  };

  const totalRevenue = revenueSeries.reduce((sum, d) => sum + d.revenue, 0);
  const totalBookings = revenueSeries.reduce((sum, d) => sum + d.bookings, 0);
  const avgOccupancy =
    occupancySeries.length > 0
      ? occupancySeries.reduce((sum, d) => sum + d.occupancy, 0) / occupancySeries.length
      : 0;
  const avgRevenue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

  const periodLabels: Record<ReportPeriod, string> = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    '365d': 'Last Year',
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financials</h1>
          <p className="mt-1 text-sm text-slate-500">
            Revenue and occupancy performance
          </p>
        </div>

        {/* Period selector */}
        <div className="flex rounded-lg border border-slate-200 p-1">
          {(['7d', '30d', '90d', '365d'] as ReportPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm font-medium text-slate-500">Total Revenue</p>
          {revenueLoading ? (
            <div className="mt-2 h-8 w-32 animate-shimmer rounded" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
          )}
          <p className="mt-1 text-sm text-slate-500">{periodLabels[period]}</p>
        </div>

        <div className="card">
          <p className="text-sm font-medium text-slate-500">Total Bookings</p>
          {revenueLoading ? (
            <div className="mt-2 h-8 w-20 animate-shimmer rounded" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-slate-900">{totalBookings}</p>
          )}
          <p className="mt-1 text-sm text-slate-500">{periodLabels[period]}</p>
        </div>

        <div className="card">
          <p className="text-sm font-medium text-slate-500">Avg. Occupancy</p>
          {occupancyLoading ? (
            <div className="mt-2 h-8 w-20 animate-shimmer rounded" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-slate-900">{avgOccupancy.toFixed(1)}%</p>
          )}
          <p className="mt-1 text-sm text-slate-500">{periodLabels[period]}</p>
        </div>

        <div className="card">
          <p className="text-sm font-medium text-slate-500">Avg. Revenue/Booking</p>
          {revenueLoading ? (
            <div className="mt-2 h-8 w-24 animate-shimmer rounded" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(avgRevenue)}</p>
          )}
          <p className="mt-1 text-sm text-slate-500">{periodLabels[period]}</p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Revenue Overview</h2>
        <p className="text-sm text-slate-500">Daily revenue for {periodLabels[period].toLowerCase()}</p>

        <div className="mt-6">
          {revenueLoading ? (
            <div className="h-64 animate-shimmer rounded" />
          ) : revenueSeries.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={revenueSeries.slice(-30).map((d) => ({
                    ...d,
                    displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  }))}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#84cc16" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#84cc16" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value) => [formatCurrency(Number(value) || 0), 'Revenue']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#84cc16"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-slate-500">
              No revenue data available
            </div>
          )}
        </div>
      </div>

      {/* Occupancy Chart */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Occupancy Rate</h2>
        <p className="text-sm text-slate-500">Daily occupancy for {periodLabels[period].toLowerCase()}</p>

        <div className="mt-6">
          {occupancyLoading ? (
            <div className="h-64 animate-shimmer rounded" />
          ) : occupancySeries.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={occupancySeries.slice(-30).map((d) => ({
                    ...d,
                    displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  }))}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value) => [`${(Number(value) || 0).toFixed(1)}%`, 'Occupancy']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend />
                  <Bar
                    dataKey="occupancy"
                    name="Occupancy %"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-slate-500">
              No occupancy data available
            </div>
          )}
        </div>
      </div>

      {/* Data Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Day */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900">Revenue by Day</h2>
          <div className="mt-4 max-h-80 overflow-y-auto">
            {revenueLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 animate-shimmer rounded" />
                ))}
              </div>
            ) : revenueSeries.length > 0 ? (
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                    <th className="pb-2">Date</th>
                    <th className="pb-2 text-right">Bookings</th>
                    <th className="pb-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...revenueSeries].reverse().slice(0, 30).map((data, index) => (
                    <tr key={index}>
                      <td className="py-2 text-sm">
                        {new Date(data.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-2 text-right text-sm">{data.bookings}</td>
                      <td className="py-2 text-right text-sm font-medium">
                        {formatCurrency(data.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500">No data available</p>
            )}
          </div>
        </div>

        {/* Occupancy by Day */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900">Occupancy by Day</h2>
          <div className="mt-4 max-h-80 overflow-y-auto">
            {occupancyLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 animate-shimmer rounded" />
                ))}
              </div>
            ) : occupancySeries.length > 0 ? (
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase text-slate-500">
                    <th className="pb-2">Date</th>
                    <th className="pb-2 text-right">Rooms</th>
                    <th className="pb-2 text-right">Occupancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...occupancySeries].reverse().slice(0, 30).map((data, index) => (
                    <tr key={index}>
                      <td className="py-2 text-sm">
                        {new Date(data.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-2 text-right text-sm">
                        {data.occupiedRooms}/{data.totalRooms}
                      </td>
                      <td className="py-2 text-right text-sm font-medium">
                        {data.occupancy.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Export Reports</h2>
        <p className="text-sm text-slate-500">Download reports in various formats</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-outline" onClick={() => handleExport('csv')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export CSV
          </button>
          <button className="btn-outline" onClick={() => handleExport('pdf')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export PDF
          </button>
          <button className="btn-outline" onClick={handleEmailReport}>
            Email Report
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900">Booking Sources</h2>
          <p className="text-sm text-slate-500">Revenue by channel</p>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {sourcesData?.map((source) => (
              <div key={source.source} className="flex items-center justify-between">
                <span>{formatEnumLabel(source.source)}</span>
                <span className="font-semibold text-slate-900">
                  {source.count} • {formatCurrency(source.revenue)}
                </span>
              </div>
            )) || <p className="text-sm text-slate-500">No source data.</p>}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900">Room Type Performance</h2>
          <p className="text-sm text-slate-500">Bookings by room category</p>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {roomTypeData?.map((roomType) => (
              <div key={roomType.name} className="flex items-center justify-between">
                <span>{roomType.name}</span>
                <span className="font-semibold text-slate-900">
                  {roomType.bookings} bookings
                </span>
              </div>
            )) || <p className="text-sm text-slate-500">No room type data.</p>}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Guest analytics</h2>
        <p className="text-sm text-slate-500">Top guests and new arrivals</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-xs uppercase text-slate-500">Total Guests</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{guestData?.totalGuests ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-xs uppercase text-slate-500">New Guests</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{guestData?.newGuests ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-xs uppercase text-slate-500">Top Guest</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {guestData?.topGuests?.[0]
                ? `${guestData.topGuests[0].firstName} ${guestData.topGuests[0].lastName}`
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


