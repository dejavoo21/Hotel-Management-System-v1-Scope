import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { purchaseOrderService } from '@/services';
import { useAuthStore } from '@/stores/authStore';
import type { PurchaseOrder } from '@/types';
import {
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

type Range = { startDate: string; endDate: string };
type RangeMode = 'year' | '6m';

type ExpenseCategory =
  | 'Salaries and Wages'
  | 'Utilities'
  | 'Maintenance and Repairs'
  | 'Supplies'
  | 'Marketing and Advertising'
  | 'Miscellaneous';

type TransactionStatus = 'Completed' | 'Pending' | 'Failed';

type TransactionRow = {
  id: string;
  expense: string;
  category: ExpenseCategory;
  quantity: number;
  amount: number;
  date: string; // ISO date
  status: TransactionStatus;
  purchaseOrderId?: string;
  isMock?: boolean;
};

type EarningsPoint = { month: string; income: number; expense: number };

const donutColors = ['#bbf7d0', '#d9f99d', '#c7d2fe', '#fde68a', '#fecaca', '#e2e8f0'];

function toISODate(date: Date) {
  return date.toISOString().split('T')[0];
}

function lastNDaysRange(days: number): Range {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startDate: toISODate(start), endDate: toISODate(end) };
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

function formatCurrency(value: number, currency: string) {
  return value.toLocaleString(undefined, { style: 'currency', currency });
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

function categoryFromName(name: string): ExpenseCategory {
  const n = (name || '').toLowerCase();
  if (n.includes('salary') || n.includes('wage') || n.includes('payroll')) return 'Salaries and Wages';
  if (n.includes('electric') || n.includes('water') || n.includes('utility') || n.includes('internet') || n.includes('gas')) {
    return 'Utilities';
  }
  if (n.includes('repair') || n.includes('maintenance') || n.includes('plumb') || n.includes('hvac')) {
    return 'Maintenance and Repairs';
  }
  if (n.includes('supply') || n.includes('linen') || n.includes('housekeep') || n.includes('soap') || n.includes('towel')) {
    return 'Supplies';
  }
  if (n.includes('marketing') || n.includes('ads') || n.includes('advert')) return 'Marketing and Advertising';
  return 'Miscellaneous';
}

function statusFromOrderStatus(value: string | undefined): TransactionStatus {
  const s = String(value || '').toUpperCase();
  if (s.includes('FAIL')) return 'Failed';
  if (s.includes('PEND') || s.includes('DRAFT')) return 'Pending';
  return 'Completed';
}

function stableRand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildMockTransactions(startISO: string, count: number): TransactionRow[] {
  const start = new Date(startISO);
  const categories: ExpenseCategory[] = [
    'Salaries and Wages',
    'Utilities',
    'Maintenance and Repairs',
    'Supplies',
    'Marketing and Advertising',
    'Miscellaneous',
  ];
  const expenseNamesByCategory: Record<ExpenseCategory, string[]> = {
    'Salaries and Wages': ['Staff payroll', 'Overtime payroll'],
    Utilities: ['Electricity bill', 'Water bill', 'Internet subscription'],
    'Maintenance and Repairs': ['AC repairs', 'Maintenance callout', 'Plumbing service'],
    Supplies: ['Housekeeping supplies', 'Laundry supplies', 'Guest amenities'],
    'Marketing and Advertising': ['Google ads', 'Social media ads'],
    Miscellaneous: ['Misc operational', 'Office supplies'],
  };

  const rows: TransactionRow[] = [];
  for (let i = 0; i < count; i++) {
    const dayOffset = i % 18;
    const d = new Date(start);
    d.setDate(d.getDate() + dayOffset);
    const category = categories[i % categories.length];
    const names = expenseNamesByCategory[category];
    const expense = names[Math.floor(stableRand(i + 13) * names.length)];
    const quantity = Math.max(1, Math.round(stableRand(i + 7) * 10));
    const unit = 50 + Math.round(stableRand(i + 31) * 250);
    const amount = quantity * unit;
    rows.push({
      id: `mock-${i}`,
      expense,
      category,
      quantity,
      amount,
      date: toISODate(d),
      status: 'Completed',
      isMock: true,
    });
  }
  return rows;
}

export default function ExpensesPage() {
  const { user } = useAuthStore();
  const currency = user?.hotel?.currency || 'USD';
  const [rangeMode, setRangeMode] = useState<RangeMode>('year');
  const [donutTab, setDonutTab] = useState<'income' | 'expense'>('expense');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ExpenseCategory>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransactionStatus>('ALL');

  const range = useMemo(() => (rangeMode === '6m' ? lastNDaysRange(180) : lastNDaysRange(365)), [rangeMode]);

  const { data: revenueSeries, isLoading: isLoadingRevenue } = useQuery({
    queryKey: ['expenses', 'income', range],
    queryFn: async () => {
      const response = await api.get('/reports/revenue', { params: range });
      const payload = response.data?.data?.data ?? response.data?.data;
      return normalizeRevenueBreakdown(payload);
    },
  });

  const { data: sourcesRaw } = useQuery({
    queryKey: ['expenses', 'incomeSources', range],
    queryFn: async () => {
      const response = await api.get('/reports/sources', { params: range });
      return response.data?.data?.data ?? response.data?.data;
    },
  });

  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['expenses', 'purchaseOrders'],
    queryFn: purchaseOrderService.list,
  });

  const isLoading = isLoadingRevenue || isLoadingOrders;

  const transactionsReal = useMemo((): TransactionRow[] => {
    const list = (orders ?? []) as PurchaseOrder[];
    const rows: TransactionRow[] = [];
    for (const o of list) {
      const date = o.createdAt ? String(o.createdAt).split('T')[0] : toISODate(new Date());
      const status = statusFromOrderStatus((o as any).status);
      const items = (o.items ?? []) as any[];
      if (items.length) {
        for (const item of items) {
          const name = String(item.name ?? o.reference ?? 'Expense');
          const quantity = Number(item.quantity ?? 1) || 1;
          const amount = Number(item.totalCost ?? (Number(item.unitCost ?? 0) * quantity)) || 0;
          rows.push({
            id: `${o.id}-${item.id ?? name}`,
            expense: name,
            category: categoryFromName(name),
            quantity,
            amount,
            date,
            status,
            purchaseOrderId: o.id,
          });
        }
      } else {
        const name = o.vendorName ? `${o.vendorName} purchase` : o.reference;
        rows.push({
          id: o.id,
          expense: name,
          category: categoryFromName(name),
          quantity: 1,
          amount: Number(o.totalCost) || 0,
          date,
          status,
          purchaseOrderId: o.id,
        });
      }
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [orders]);

  const minRows = 14;
  const mockCount = Math.max(0, minRows - transactionsReal.length);
  const transactionsMock = useMemo(() => buildMockTransactions(range.startDate, mockCount), [range.startDate, mockCount]);

  const transactions = useMemo(() => [...transactionsReal, ...transactionsMock].slice(0, 40), [transactionsReal, transactionsMock]);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (!q) return true;
      return t.expense.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    });
  }, [transactions, search, categoryFilter, statusFilter]);

  const mockTotalsWhenEmpty = useMemo(() => ({ balance: 15650, income: 45650, expenses: 30000 }), []);

  const totals = useMemo(() => {
    const hasReal = transactionsReal.length > 0 || (revenueSeries?.length ?? 0) > 0;
    const expenseTotal = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const incomeTotal = (revenueSeries ?? []).reduce((sum, p) => sum + (Number(p.revenue) || 0), 0);
    if (!hasReal) return mockTotalsWhenEmpty;
    return {
      balance: incomeTotal - expenseTotal,
      income: incomeTotal,
      expenses: expenseTotal,
    };
  }, [transactions, transactionsReal.length, revenueSeries, mockTotalsWhenEmpty]);

  const weeklyTrend = useMemo(() => {
    const end = new Date(range.endDate);
    const prevStart = new Date(end);
    prevStart.setDate(prevStart.getDate() - 13);
    const mid = new Date(end);
    mid.setDate(mid.getDate() - 6);
    const beforeMid = new Date(mid);
    beforeMid.setDate(beforeMid.getDate() - 1);

    const inWindow = (iso: string, start: Date, stop: Date) => {
      const d = new Date(iso);
      return d >= start && d <= stop;
    };

    const incomePoints = revenueSeries ?? [];
    const incomePrev = incomePoints.filter((p) => inWindow(p.date, prevStart, beforeMid)).reduce((s, p) => s + (Number(p.revenue) || 0), 0);
    const incomeCurr = incomePoints.filter((p) => inWindow(p.date, mid, end)).reduce((s, p) => s + (Number(p.revenue) || 0), 0);

    const expensePrev = transactions.filter((t) => inWindow(t.date, prevStart, beforeMid)).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const expenseCurr = transactions.filter((t) => inWindow(t.date, mid, end)).reduce((s, t) => s + (Number(t.amount) || 0), 0);

    return {
      income: pctChange(incomeCurr, incomePrev),
      expenses: pctChange(expenseCurr, expensePrev),
      balance: pctChange(incomeCurr - expenseCurr, incomePrev - expensePrev),
    };
  }, [range.endDate, revenueSeries, transactions]);

  const earningsSeries = useMemo((): EarningsPoint[] => {
    const hasReal = (revenueSeries?.length ?? 0) > 0 || transactionsReal.length > 0;
    if (!hasReal) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const income = [22000, 18500, 14000, 20000, 23500, 26000, 21500, 15500, 21000, 25500, 24000, 27500];
      const expense = [16500, 19000, 14000, 17500, 21000, 25500, 15600, 9000, 16500, 23000, 18500, 15500];
      return months.map((m, i) => ({ month: m, income: income[i], expense: -expense[i] }));
    }

    const byMonthIncome = new Map<string, number>();
    for (const p of revenueSeries ?? []) {
      const d = new Date(p.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = monthKey(d);
      byMonthIncome.set(key, (byMonthIncome.get(key) ?? 0) + (Number(p.revenue) || 0));
    }

    const byMonthExpense = new Map<string, number>();
    for (const t of transactionsReal) {
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = monthKey(d);
      byMonthExpense.set(key, (byMonthExpense.get(key) ?? 0) + (Number(t.amount) || 0));
    }

    const keys = new Set<string>();
    for (const k of byMonthIncome.keys()) keys.add(k);
    for (const k of byMonthExpense.keys()) keys.add(k);
    const sorted = [...keys].sort((a, b) => a.localeCompare(b));
    const last12 = sorted.slice(Math.max(0, sorted.length - 12));

    return last12.map((key) => ({
      month: monthLabelFromKey(key),
      income: Math.round(byMonthIncome.get(key) ?? 0),
      expense: -Math.round(byMonthExpense.get(key) ?? 0),
    }));
  }, [revenueSeries, transactionsReal]);

  const expenseBreakdown = useMemo(() => {
    const categories: Array<{ name: ExpenseCategory; share: number }> = [
      { name: 'Salaries and Wages', share: 0.5 },
      { name: 'Utilities', share: 0.1667 },
      { name: 'Maintenance and Repairs', share: 0.1333 },
      { name: 'Supplies', share: 0.1 },
      { name: 'Marketing and Advertising', share: 0.0667 },
      { name: 'Miscellaneous', share: 0.0333 },
    ];

    if (transactionsReal.length === 0) {
      const base = mockTotalsWhenEmpty.expenses;
      const amounts = [15000, 5000, 4000, 3000, 2000, 1000];
      return categories.map((c, idx) => ({
        name: c.name,
        value: amounts[idx],
        pct: Math.round((amounts[idx] / base) * 100),
      }));
    }

    const byCategory = new Map<ExpenseCategory, number>();
    for (const t of transactionsReal) {
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + (Number(t.amount) || 0));
    }

    const rows = categories.map((c) => ({
      name: c.name,
      value: Math.round((byCategory.get(c.name) ?? 0) || (totals.expenses * c.share * 0.25)),
    }));
    const sum = rows.reduce((s, r) => s + r.value, 0) || 1;
    return rows
      .map((r) => ({ ...r, pct: Math.round((r.value / sum) * 100) }))
      .sort((a, b) => b.value - a.value);
  }, [mockTotalsWhenEmpty.expenses, totals.expenses, transactionsReal]);

  const incomeBreakdown = useMemo(() => {
    const breakdown = (sourcesRaw as any)?.breakdown;
    const list = Array.isArray(breakdown) ? breakdown : Array.isArray(sourcesRaw) ? sourcesRaw : [];
    const rows = (list as any[])
      .map((row) => ({
        name: String(row.source ?? row.name ?? 'Other'),
        value: Number(row.count ?? row.value ?? 0) || 0,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const sum = rows.reduce((s, r) => s + r.value, 0) || 1;
    return rows.map((r) => ({ ...r, pct: Math.round((r.value / sum) * 100) }));
  }, [sourcesRaw]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Expense</h1>
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

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr_1.2fr]">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h18M7 7v14m10-14v14" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-600">Total Balance</p>
            </div>
            {weeklyTrend.balance != null ? (
              <div className="rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {weeklyTrend.balance >= 0 ? '+' : ''}
                {weeklyTrend.balance}%
              </div>
            ) : null}
          </div>
          <p className="mt-4 text-3xl font-extrabold text-slate-900">{formatCurrency(Math.round(totals.balance), currency)}</p>
          <p className="mt-1 text-xs text-slate-500">from last week</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m6-6H6" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-600">Total Income</p>
            </div>
            {weeklyTrend.income != null ? (
              <div
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${
                  weeklyTrend.income >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {weeklyTrend.income >= 0 ? '+' : ''}
                {weeklyTrend.income}%
              </div>
            ) : null}
          </div>
          <p className="mt-4 text-3xl font-extrabold text-slate-900">{formatCurrency(Math.round(totals.income), currency)}</p>
          <p className="mt-1 text-xs text-slate-500">from last week</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M7 10h10M7 14h10M7 18h10" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-600">Total Expenses</p>
            </div>
            {weeklyTrend.expenses != null ? (
              <div
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${
                  weeklyTrend.expenses <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {weeklyTrend.expenses >= 0 ? '+' : ''}
                {weeklyTrend.expenses}%
              </div>
            ) : null}
          </div>
          <p className="mt-4 text-3xl font-extrabold text-slate-900">{formatCurrency(Math.round(totals.expenses), currency)}</p>
          <p className="mt-1 text-xs text-slate-500">from last week</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">Breakdown</p>
            <div className="flex overflow-hidden rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDonutTab('income')}
                className={`rounded-lg px-4 py-1.5 transition-colors ${
                  donutTab === 'income' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Income
              </button>
              <button
                type="button"
                onClick={() => setDonutTab('expense')}
                className={`rounded-lg px-4 py-1.5 transition-colors ${
                  donutTab === 'expense' ? 'bg-lime-200 text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Expense
              </button>
            </div>
          </div>

          <div className="mt-4 h-56">
            {isLoading ? (
              <div className="h-full animate-shimmer rounded-xl" />
            ) : donutTab === 'income' ? (
              incomeBreakdown.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                    <Pie data={incomeBreakdown} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                      {incomeBreakdown.map((_, idx) => (
                        <Cell key={idx} fill={donutColors[idx % donutColors.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-600">
                  No income sources yet.
                </div>
              )
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(value: any) => formatCurrency(Number(value) || 0, currency)}
                    contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                  />
                  <Pie data={expenseBreakdown} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                    {expenseBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={donutColors[idx % donutColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-3 space-y-2 text-xs">
            {(donutTab === 'expense' ? expenseBreakdown : incomeBreakdown).map((row: any, idx: number) => (
              <div key={row.name} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-3 w-6 rounded" style={{ background: donutColors[idx % donutColors.length] }} />
                  <span className="truncate text-slate-700">
                    {row.name} <span className="text-slate-400">({row.pct}%)</span>
                  </span>
                </div>
                <span className="shrink-0 font-semibold text-slate-900">
                  {donutTab === 'expense' ? formatCurrency(Number(row.value) || 0, currency) : String(row.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2.2fr_1fr]">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Earnings</h2>
              <p className="text-sm text-slate-500">Income vs Expense</p>
            </div>
            <div className="rounded-xl bg-lime-200 px-3 py-2 text-xs font-semibold text-slate-900">
              {rangeMode === 'year' ? 'This Year' : 'Last 6 Months'}
            </div>
          </div>

          <div className="mt-4 h-80">
            {isLoading ? (
              <div className="h-full animate-shimmer rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={earningsSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.round(Math.abs(Number(v)) / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      formatCurrency(Math.abs(Number(value) || 0), currency),
                      name === 'income' ? 'Income' : 'Expense',
                    ]}
                    contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                  />
                  <Bar dataKey="income" name="Income" fill="#bbf7d0" radius={[10, 10, 10, 10]} />
                  <Bar dataKey="expense" name="Expense" fill="#d9f99d" radius={[10, 10, 10, 10]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Transactions</h2>
            <div className="rounded-xl bg-lime-200 px-3 py-2 text-xs font-semibold text-slate-900">
              {range.startDate} - {range.endDate}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm placeholder-slate-400 focus:border-primary-500 focus:bg-white focus:ring-primary-500"
                placeholder="Search expense"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="ALL">All Category</option>
              {(
                [
                  'Salaries and Wages',
                  'Utilities',
                  'Maintenance and Repairs',
                  'Supplies',
                  'Marketing and Advertising',
                  'Miscellaneous',
                ] as ExpenseCategory[]
              ).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="ALL">All Status</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
            </select>

            <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
              Showing {filteredTransactions.length} transaction(s)
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Transactions</h2>
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            {range.startDate} - {range.endDate}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Expense</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Quantity</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(filteredTransactions.length ? filteredTransactions : transactions).slice(0, 20).map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                    {row.expense}
                    {row.isMock ? (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        demo
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700">{row.category}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{row.quantity}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">{formatCurrency(row.amount, currency)}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="px-5 py-4 text-sm">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-sm">
                    <button
                      type="button"
                      className="rounded-xl bg-lime-200 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-lime-300 disabled:opacity-50"
                      onClick={async () => {
                        if (!row.purchaseOrderId) return;
                        const blob = await purchaseOrderService.exportPdf(row.purchaseOrderId);
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank', 'noopener,noreferrer');
                        setTimeout(() => URL.revokeObjectURL(url), 30000);
                      }}
                      disabled={!row.purchaseOrderId}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
