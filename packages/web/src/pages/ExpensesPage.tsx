import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { purchaseOrderService } from '@/services';
import type { PurchaseOrder } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Range = { startDate: string; endDate: string };

function toISODate(date: Date) {
  return date.toISOString().split('T')[0];
}

function lastNDaysRange(days: number): Range {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

function normalizeRevenueBreakdown(data: unknown): Array<{ date: string; revenue: number }> {
  if (Array.isArray(data)) {
    return (data as Array<{ date: string; revenue: number }>).map((row: any) => ({
      date: String(row.date),
      revenue: Number(row.revenue ?? row.amount) || 0,
    }));
  }
  const breakdown = (data as any)?.breakdown;
  if (Array.isArray(breakdown)) {
    return breakdown.map((row: any) => ({
      date: String(row.date),
      revenue: Number(row.revenue ?? row.amount) || 0,
    }));
  }
  return [];
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabelFromKey(key: string) {
  const [, mm] = key.split('-');
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(2000, Number(mm) - 1, 1));
}

function pctChange(current: number, prev: number) {
  if (!Number.isFinite(prev) || prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

export default function ExpensesPage() {
  const [rangeMode, setRangeMode] = useState<'year' | '6m'>('year');
  const { user } = useAuthStore();

  const range = useMemo(() => (rangeMode === '6m' ? lastNDaysRange(180) : lastNDaysRange(365)), [rangeMode]);

  const { data: revenueSeries, isLoading: isLoadingRevenue } = useQuery({
    queryKey: ['expenses', 'income', range],
    queryFn: async () => {
      const response = await api.get('/reports/revenue', { params: range });
      const payload = response.data?.data?.data ?? response.data?.data;
      return normalizeRevenueBreakdown(payload);
    },
  });

  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['expenses', 'purchaseOrders'],
    queryFn: purchaseOrderService.list,
  });

  const currency = user?.hotel?.currency || 'USD';

  const monthlyIncome = useMemo(() => {
    const points = revenueSeries ?? [];
    const byMonth = new Map<string, number>();
    for (const p of points) {
      const d = new Date(p.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = monthKey(d);
      byMonth.set(key, (byMonth.get(key) ?? 0) + (Number(p.revenue) || 0));
    }
    return byMonth;
  }, [revenueSeries]);

  const monthlyExpenses = useMemo(() => {
    const list = (orders ?? []) as PurchaseOrder[];
    const byMonth = new Map<string, number>();
    for (const o of list) {
      const d = new Date(o.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = monthKey(d);
      byMonth.set(key, (byMonth.get(key) ?? 0) + (Number(o.totalCost) || 0));
    }
    return byMonth;
  }, [orders]);

  const earningsSeries = useMemo(() => {
    const keys = new Set<string>();
    for (const k of monthlyIncome.keys()) keys.add(k);
    for (const k of monthlyExpenses.keys()) keys.add(k);
    const sorted = [...keys].sort((a, b) => a.localeCompare(b));

    // Render last 12 points max so the chart looks like the reference.
    const last = sorted.slice(Math.max(0, sorted.length - 12));
    return last.map((key) => ({
      key,
      month: monthLabelFromKey(key),
      income: Math.round(monthlyIncome.get(key) ?? 0),
      expense: Math.round(monthlyExpenses.get(key) ?? 0),
    }));
  }, [monthlyExpenses, monthlyIncome]);

  const totals = useMemo(() => {
    const incomeTotal = [...monthlyIncome.values()].reduce((sum, v) => sum + (Number(v) || 0), 0);
    const expenseTotal = [...monthlyExpenses.values()].reduce((sum, v) => sum + (Number(v) || 0), 0);
    return {
      incomeTotal,
      expenseTotal,
      balance: incomeTotal - expenseTotal,
    };
  }, [monthlyExpenses, monthlyIncome]);

  const trend = useMemo(() => {
    const lastTwo = earningsSeries.slice(-2);
    if (lastTwo.length < 2) return { income: null as number | null, expense: null as number | null };
    const [prev, curr] = lastTwo;
    return {
      income: pctChange(curr.income, prev.income),
      expense: pctChange(curr.expense, prev.expense),
    };
  }, [earningsSeries]);

  const vendorBreakdown = useMemo(() => {
    const list = (orders ?? []) as PurchaseOrder[];
    const byVendor = new Map<string, number>();
    for (const o of list) {
      const key = (o.vendorName || 'Unknown').trim() || 'Unknown';
      byVendor.set(key, (byVendor.get(key) ?? 0) + (Number(o.totalCost) || 0));
    }
    const rows = [...byVendor.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    return rows;
  }, [orders]);

  const donutColors = ['#bbf7d0', '#d9f99d', '#c7d2fe', '#fde68a', '#fecaca', '#e2e8f0'];

  const isLoading = isLoadingRevenue || isLoadingOrders;
  const hasData = (revenueSeries?.length ?? 0) > 0 || (orders?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Expense</h1>
          <p className="mt-1 text-sm text-slate-600">Track income, expenses, and operational spend over time.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRangeMode('year')}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition-colors ${
              rangeMode === 'year'
                ? 'bg-lime-200 text-slate-900 ring-lime-200'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            This Year
          </button>
          <button
            type="button"
            onClick={() => setRangeMode('6m')}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition-colors ${
              rangeMode === '6m'
                ? 'bg-lime-200 text-slate-900 ring-lime-200'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            Last 6 Months
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-slate-600">Total Balance</p>
            <div className="rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Net</div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">
            {totals.balance.toLocaleString(undefined, { style: 'currency', currency })}
          </p>
          <p className="mt-1 text-xs text-slate-500">Income minus expenses</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-slate-600">Total Income</p>
            {trend.income != null && (
              <div
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${
                  trend.income >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {trend.income >= 0 ? '+' : ''}
                {trend.income}%
              </div>
            )}
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">
            {totals.incomeTotal.toLocaleString(undefined, { style: 'currency', currency })}
          </p>
          <p className="mt-1 text-xs text-slate-500">Based on bookings revenue</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-slate-600">Total Expenses</p>
            {trend.expense != null && (
              <div
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${
                  trend.expense <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {trend.expense >= 0 ? '+' : ''}
                {trend.expense}%
              </div>
            )}
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">
            {totals.expenseTotal.toLocaleString(undefined, { style: 'currency', currency })}
          </p>
          <p className="mt-1 text-xs text-slate-500">Purchase orders total</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Earnings</h2>
              <p className="text-sm text-slate-500">Income vs expenses</p>
            </div>
          </div>

          <div className="mt-4 h-72">
            {isLoading ? (
              <div className="h-full animate-shimmer rounded-xl" />
            ) : !hasData ? (
              <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-600">
                No financial data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={earningsSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      Number(value).toLocaleString(undefined, { style: 'currency', currency }),
                      name === 'income' ? 'Income' : 'Expense',
                    ]}
                    contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#bbf7d0" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="#d9f99d" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Expense Breakdown</h2>
            <div className="rounded-xl bg-lime-200 px-3 py-1 text-xs font-semibold text-slate-900">Expense</div>
          </div>

          <div className="mt-4 h-72">
            {isLoading ? (
              <div className="h-full animate-shimmer rounded-xl" />
            ) : vendorBreakdown.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-600">
                No purchase orders yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(value: any) => Number(value).toLocaleString(undefined, { style: 'currency', currency })}
                    contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                  />
                  <Pie
                    data={vendorBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {vendorBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={donutColors[idx % donutColors.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Transactions</h2>
          <p className="text-sm font-semibold text-slate-500">{(orders ?? []).length} records</p>
        </div>

        {isLoadingOrders ? (
          <div className="p-6 text-sm text-slate-600">Loading transactions...</div>
        ) : !orders || orders.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">
            No transactions found. Create a purchase order from Inventory to see expenses here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Reference
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Vendor
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(orders as PurchaseOrder[]).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">{order.reference}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{order.vendorName}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {Number(order.totalCost || 0).toLocaleString(undefined, { style: 'currency', currency })}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-5 py-4 text-right text-sm">
                      <button
                        type="button"
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        onClick={async () => {
                          const blob = await purchaseOrderService.exportPdf(order.id);
                          const url = URL.createObjectURL(blob);
                          window.open(url, '_blank', 'noopener,noreferrer');
                          setTimeout(() => URL.revokeObjectURL(url), 30000);
                        }}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
