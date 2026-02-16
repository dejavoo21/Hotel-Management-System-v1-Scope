import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import type { PurchaseOrder } from '@/types';
import { KPI_VALUE_CLASS } from '@/styles/typography';
import TimeRangeToggle from '@/components/ui/TimeRangeToggle';
import type { TimeRange } from '@/data/timeRange';
import { timeRangeToDateRange } from '@/data/timeRange';
import { downloadPurchaseOrderPdf, getRevenueBreakdown, getSourcesBreakdown, listPurchaseOrders } from '@/data/dataSource';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Range = { startDate: string; endDate: string };

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

function statusPillClass(status: TransactionStatus) {
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-700';
  if (status === 'Pending') return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
}

function trendPillClass(value: number, positiveStyle = true) {
  if (value === 0) return 'bg-slate-100 text-slate-700';
  const up = value > 0;
  if (positiveStyle) return up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';
  return up ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700';
}

function getRangeFactor(range: TimeRange) {
  if (range === '7d') return 0.22;
  if (range === '3m') return 0.58;
  if (range === '6m') return 0.82;
  return 1;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildMockReceiptHtml(row: TransactionRow, currency: string) {
  const amount = formatCurrency(row.amount, currency);
  const date = new Date(row.date).toLocaleDateString();
  const title = 'Expense Receipt (Demo)';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root{
        --bg:#F5F7FB;
        --card:#ffffff;
        --text:#0f172a;
        --muted:#64748b;
        --border:#e2e8f0;
        --accent:#a3e635;
        --accent2:#bbf7d0;
      }
      *{box-sizing:border-box}
      body{
        margin:0;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        color:var(--text);
        background:var(--bg);
        padding:32px 16px;
      }
      .wrap{max-width:820px;margin:0 auto}
      .card{
        background:var(--card);
        border:1px solid var(--border);
        border-radius:16px;
        box-shadow:0 10px 25px rgba(2,6,23,.06);
        overflow:hidden;
      }
      header{
        padding:20px 24px;
        border-bottom:1px solid var(--border);
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
      }
      .brand{
        display:flex;
        align-items:center;
        gap:10px;
        font-weight:800;
        letter-spacing:-.02em;
      }
      .mark{
        width:34px;height:34px;border-radius:10px;
        background:linear-gradient(135deg,var(--accent),var(--accent2));
      }
      .meta{
        text-align:right;
        font-size:12px;
        color:var(--muted);
        font-weight:600;
      }
      .body{padding:22px 24px}
      h1{margin:0;font-size:18px;font-weight:800;letter-spacing:-.02em}
      .sub{margin-top:6px;color:var(--muted);font-size:13px}
      .grid{
        margin-top:18px;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:12px;
      }
      .field{
        border:1px solid var(--border);
        border-radius:12px;
        padding:12px 14px;
        background:#fff;
      }
      .k{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em}
      .v{margin-top:6px;font-size:14px;font-weight:800}
      .pill{
        display:inline-flex;
        align-items:center;
        padding:6px 10px;
        border-radius:999px;
        background:#ecfccb;
        font-size:12px;
        font-weight:800;
      }
      footer{
        padding:16px 24px;
        border-top:1px solid var(--border);
        color:var(--muted);
        font-size:12px;
        font-weight:600;
        display:flex;
        justify-content:space-between;
        gap:12px;
        flex-wrap:wrap;
      }
      .actions{margin-top:16px;display:flex;gap:10px;flex-wrap:wrap}
      button{
        appearance:none;border:0;
        border-radius:12px;
        padding:10px 14px;
        font-weight:800;
        cursor:pointer;
      }
      .btn{background:var(--accent);}
      .btn2{background:#e2e8f0;}
      @media print{
        body{background:#fff;padding:0}
        .actions{display:none}
        .card{box-shadow:none}
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <header>
          <div class="brand"><span class="mark" aria-hidden="true"></span><span>LaFlo</span></div>
          <div class="meta">
            <div>Receipt ID: ${escapeHtml(row.id)}</div>
            <div>${escapeHtml(date)}</div>
          </div>
        </header>
        <div class="body">
          <h1>${escapeHtml(title)}</h1>
          <div class="sub">This receipt was generated from demo data for preview purposes.</div>

          <div class="grid">
            <div class="field">
              <div class="k">Expense</div>
              <div class="v">${escapeHtml(row.expense)}</div>
            </div>
            <div class="field">
              <div class="k">Category</div>
              <div class="v">${escapeHtml(row.category)}</div>
            </div>
            <div class="field">
              <div class="k">Quantity</div>
              <div class="v">${escapeHtml(String(row.quantity))}</div>
            </div>
            <div class="field">
              <div class="k">Amount</div>
              <div class="v">${escapeHtml(amount)}</div>
            </div>
            <div class="field">
              <div class="k">Status</div>
              <div class="v"><span class="pill">${escapeHtml(row.status)}</span></div>
            </div>
            <div class="field">
              <div class="k">Date</div>
              <div class="v">${escapeHtml(date)}</div>
            </div>
          </div>

          <div class="actions">
            <button class="btn" onclick="window.print()">Print</button>
            <button class="btn2" onclick="window.close()">Close</button>
          </div>
        </div>
        <footer>
          <span>LaFlo Hotel Management</span>
          <span>Demo receipt. Replace with real PDF exports when live.</span>
        </footer>
      </div>
    </div>
  </body>
</html>`;
}

function downloadMockTransaction(row: TransactionRow, currency: string) {
  return new Blob([buildMockReceiptHtml(row, currency)], { type: 'text/html;charset=utf-8' });
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function ExpensesPage() {
  const { user } = useAuthStore();
  const currency = user?.hotel?.currency || 'USD';
  const [headerRange, setHeaderRange] = useState<TimeRange>('1y');
  const [earningsRange, setEarningsRange] = useState<TimeRange>('1y');
  const [transactionsRange, setTransactionsRange] = useState<TimeRange>('1y');
  const [donutTab, setDonutTab] = useState<'income' | 'expense'>('expense');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ExpenseCategory>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransactionStatus>('ALL');
  const [selectedTx, setSelectedTx] = useState<TransactionRow | null>(null);

  const headerDateRange: Range = useMemo(() => timeRangeToDateRange(headerRange), [headerRange]);
  const transactionsDateRange: Range = useMemo(() => timeRangeToDateRange(transactionsRange), [transactionsRange]);

  const { data: revenueSeries, isLoading: isLoadingRevenue } = useQuery({
    queryKey: ['expenses', 'income', headerRange],
    queryFn: () => getRevenueBreakdown({ timeRange: headerRange }),
  });

  const { data: sourcesRaw } = useQuery({
    queryKey: ['expenses', 'incomeSources', headerRange],
    queryFn: () => getSourcesBreakdown({ timeRange: headerRange }),
  });

  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['expenses', 'purchaseOrders'],
    queryFn: listPurchaseOrders,
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
  const transactionsMock = useMemo(
    () => buildMockTransactions(transactionsDateRange.startDate, mockCount),
    [transactionsDateRange.startDate, mockCount],
  );

  const transactions = useMemo(() => [...transactionsReal, ...transactionsMock].slice(0, 40), [transactionsReal, transactionsMock]);

  const inDateRange = (iso: string, range: Range) => {
    const d = new Date(iso);
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    if (Number.isNaN(d.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return d >= start && d <= end;
  };

  const transactionsForHeader = useMemo(
    () => transactions.filter((t) => inDateRange(t.date, headerDateRange)),
    [transactions, headerDateRange],
  );

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (!inDateRange(t.date, transactionsDateRange)) return false;
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (!q) return true;
      return t.expense.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    });
  }, [transactions, transactionsDateRange, search, categoryFilter, statusFilter]);

  const mockTotalsWhenEmpty = useMemo(() => ({ balance: 15650, income: 45650, expenses: 30000 }), []);

  const totals = useMemo(() => {
    const hasReal = transactionsReal.length > 0 || (revenueSeries?.length ?? 0) > 0;
    const expenseTotal = transactionsForHeader.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const incomeTotal = (revenueSeries ?? []).reduce((sum, p) => sum + (Number(p.revenue) || 0), 0);
    if (!hasReal) return mockTotalsWhenEmpty;
    return {
      balance: incomeTotal - expenseTotal,
      income: incomeTotal,
      expenses: expenseTotal,
    };
  }, [transactionsForHeader, transactionsReal.length, revenueSeries, mockTotalsWhenEmpty]);

  const weeklyTrend = useMemo(() => {
    const end = new Date(headerDateRange.endDate);
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

    const expensePrev = transactionsForHeader.filter((t) => inWindow(t.date, prevStart, beforeMid)).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const expenseCurr = transactionsForHeader.filter((t) => inWindow(t.date, mid, end)).reduce((s, t) => s + (Number(t.amount) || 0), 0);

    return {
      income: pctChange(incomeCurr, incomePrev),
      expenses: pctChange(expenseCurr, expensePrev),
      balance: pctChange(incomeCurr - expenseCurr, incomePrev - expensePrev),
    };
  }, [headerDateRange.endDate, revenueSeries, transactionsForHeader]);

  const earningsSeries = useMemo((): EarningsPoint[] => {
    const fallbackSeries = () => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const income = [22000, 18500, 14000, 20000, 23500, 26000, 21500, 15500, 21000, 25500, 24000, 27500];
      const expense = [16500, 19000, 14000, 17500, 21000, 25500, 15600, 9000, 16500, 23000, 18500, 15500];
      return months.map((m, i) => ({ month: m, income: income[i], expense: -expense[i] }));
    };

    const hasReal = (revenueSeries?.length ?? 0) > 0 || transactionsReal.length > 0;
    if (!hasReal) {
      return fallbackSeries();
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

    if (last12.length < 6) return fallbackSeries();

    return last12.map((key) => ({
      month: monthLabelFromKey(key),
      income: Math.round(byMonthIncome.get(key) ?? 0),
      expense: -Math.round(byMonthExpense.get(key) ?? 0),
    }));
  }, [revenueSeries, transactionsReal]);

  const earningsSeriesDisplay = useMemo(() => {
    if (earningsRange === '1y') return earningsSeries;
    if (earningsRange === '6m') return earningsSeries.slice(-6);
    if (earningsRange === '3m') return earningsSeries.slice(-3);
    return earningsSeries.slice(-7);
  }, [earningsRange, earningsSeries]);

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
    for (const t of transactionsForHeader) {
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
  }, [mockTotalsWhenEmpty.expenses, totals.expenses, transactionsForHeader, transactionsReal.length]);

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

    // Fallback so the Income tab never looks broken (until we wire real income sources).
    if (!rows.length) {
      const total = Math.max(0, Math.round((totals.income || mockTotalsWhenEmpty.income) * getRangeFactor(headerRange)));
      const fallback = [
        { name: 'Direct Booking', pct: 52 },
        { name: 'Booking.com', pct: 18 },
        { name: 'Agoda', pct: 12 },
        { name: 'Airbnb', pct: 10 },
        { name: 'Hotels.com', pct: 6 },
        { name: 'Other', pct: 2 },
      ];
      return fallback.map((r) => ({ name: r.name, pct: r.pct, value: Math.round((total * r.pct) / 100) }));
    }

    const factor = getRangeFactor(headerRange);
    const scaled = rows.map((r) => ({ ...r, value: Math.max(1, Math.round(r.value * factor)) }));
    const sum = scaled.reduce((s, r) => s + r.value, 0) || 1;
    return scaled.map((r) => ({ ...r, pct: Math.round((r.value / sum) * 100) }));
  }, [sourcesRaw, totals.income, mockTotalsWhenEmpty.income, headerRange]);

  const donutRows = donutTab === 'expense' ? expenseBreakdown : incomeBreakdown;
  const donutTotal = useMemo(() => {
    if (donutTab === 'expense') return totals.expenses || mockTotalsWhenEmpty.expenses;
    return donutRows.reduce((s: number, r: any) => s + (Number(r.value) || 0), 0);
  }, [donutRows, donutTab, mockTotalsWhenEmpty.expenses, totals.expenses]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Expense</h1>
        <TimeRangeToggle
          options={[
            { label: 'Last 7 Days', value: '7d' },
            { label: 'Last 3 Months', value: '3m' },
            { label: 'Last 6 Months', value: '6m' },
            { label: 'This Year', value: '1y' },
          ]}
          value={headerRange}
          onChange={setHeaderRange}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[2.35fr_0.95fr]">
        <div className="flex h-full flex-col gap-4">
          <div className="grid items-start gap-4 md:grid-cols-3">
            <div className="rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h18M7 7v14m10-14v14" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">Total Balance</p>
                </div>
                <button type="button" className="rounded-lg p-1 text-slate-400 hover:bg-slate-50" aria-label="More">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                  </svg>
                </button>
              </div>
              <p className={`mt-4 ${KPI_VALUE_CLASS}`}>{formatCurrency(Math.round(totals.balance), currency)}</p>
              {weeklyTrend.balance != null ? (
                <div className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${trendPillClass(weeklyTrend.balance)}`}>
                  {weeklyTrend.balance >= 0 ? '▲' : '▼'} {Math.abs(weeklyTrend.balance)}%
                </div>
              ) : null}
              <p className="mt-1 text-[11px] text-slate-500">from last week</p>
            </div>

            <div className="rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m6-6H6" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">Total Income</p>
                </div>
                <button type="button" className="rounded-lg p-1 text-slate-400 hover:bg-slate-50" aria-label="More">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                  </svg>
                </button>
              </div>
              <p className={`mt-4 ${KPI_VALUE_CLASS}`}>{formatCurrency(Math.round(totals.income), currency)}</p>
              {weeklyTrend.income != null ? (
                <div className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${trendPillClass(weeklyTrend.income)}`}>
                  {weeklyTrend.income >= 0 ? '▲' : '▼'} {Math.abs(weeklyTrend.income)}%
                </div>
              ) : null}
              <p className="mt-1 text-[11px] text-slate-500">from last week</p>
            </div>

            <div className="rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M7 10h10M7 14h10M7 18h10" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">Total Expenses</p>
                </div>
                <button type="button" className="rounded-lg p-1 text-slate-400 hover:bg-slate-50" aria-label="More">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                  </svg>
                </button>
              </div>
              <p className={`mt-4 ${KPI_VALUE_CLASS}`}>{formatCurrency(Math.round(totals.expenses), currency)}</p>
              {weeklyTrend.expenses != null ? (
                <div className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${trendPillClass(weeklyTrend.expenses, true)}`}>
                  {weeklyTrend.expenses >= 0 ? '▲' : '▼'} {Math.abs(weeklyTrend.expenses)}%
                </div>
              ) : null}
              <p className="mt-1 text-[11px] text-slate-500">from last week</p>
            </div>
          </div>

          <div className="flex-1 rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Earnings</h2>
              <p className="text-sm text-slate-500">Income vs Expense</p>
            </div>
             <select
               className="min-w-[126px] rounded-full bg-lime-200 py-1.5 pl-4 pr-10 text-[11px] font-semibold text-slate-900"
               value={earningsRange}
               onChange={(e) => setEarningsRange(e.target.value as TimeRange)}
             >
               <option value="7d">Last 7 Days</option>
               <option value="3m">Last 3 Months</option>
               <option value="6m">Last 6 Months</option>
               <option value="1y">This Year</option>
             </select>
           </div>

          <div className="mt-3 flex items-center gap-5 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-lime-300" />
              Income
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-200" />
              Expense
            </span>
          </div>

          <div className="mt-4 h-72">
            {isLoading ? (
              <div className="h-full animate-shimmer rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={earningsSeriesDisplay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={6} barCategoryGap="8%">
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
                  <Bar dataKey="income" name="Income" fill="#bbf7d0" radius={[8, 8, 8, 8]} maxBarSize={36} />
                  <Bar dataKey="expense" name="Expense" fill="#d9f99d" radius={[8, 8, 8, 8]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        </div>

        <div className="flex h-full flex-col gap-4">
          <div className="rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
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

            <div className="relative mt-4 h-56">
              {isLoading ? (
                <div className="h-full animate-shimmer rounded-xl" />
              ) : (
                <>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <div className="text-sm font-semibold text-slate-900">
                      {donutTab === 'expense' ? formatCurrency(Math.round(donutTotal), currency) : `${Math.round(donutTotal)}`}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                      {donutTab === 'expense' ? 'Total Expense' : 'Total Income'}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        formatter={(value: any) =>
                          donutTab === 'expense' ? formatCurrency(Number(value) || 0, currency) : String(value)
                        }
                        contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                      />
                      <Pie data={donutRows as any[]} dataKey="value" nameKey="name" innerRadius={64} outerRadius={102} paddingAngle={2}>
                        {(donutRows as any[]).map((_, idx) => (
                          <Cell key={idx} fill={donutColors[idx % donutColors.length]} />
                        ))}
                        <Label value="" position="center" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>

            <div className="mt-3 space-y-2 text-xs">
              {(donutRows as any[]).map((row: any, idx: number) => (
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

          <div className="rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-900">Range Insight</div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-600">Active Range</span>
                <span className="font-semibold text-slate-900">{headerRange === '7d' ? '7 Days' : headerRange === '3m' ? '3 Months' : headerRange === '6m' ? '6 Months' : '1 Year'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-600">Top Category</span>
                <span className="font-semibold text-slate-900">{donutRows[0]?.name ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-600">Total ({donutTab === 'expense' ? 'Expense' : 'Income'})</span>
                <span className="font-semibold text-slate-900">
                  {donutTab === 'expense' ? formatCurrency(Math.round(donutTotal), currency) : Math.round(donutTotal).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Transactions</h2>
          <div className="flex flex-wrap items-center gap-2">
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
                className="w-56 rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm placeholder-slate-400 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="Search expense"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500"
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
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="ALL">All Status</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
            </select>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-200 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-lime-300"
              title="Date range"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
               <select
                 value={transactionsRange}
                 onChange={(e) => setTransactionsRange(e.target.value as TimeRange)}
                 className="bg-transparent pr-1 text-xs font-semibold text-slate-900 focus:outline-none"
               >
                 <option value="7d">Last 7 Days</option>
                 <option value="3m">Last 3 Months</option>
                 <option value="6m">Last 6 Months</option>
                 <option value="1y">This Year</option>
               </select>
             </button>
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
              {filteredTransactions.slice(0, 5).map((row) => (
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
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                        aria-label="View"
                        title="View"
                        onClick={() => setSelectedTx(row)}
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.8}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>

                      <button
                        type="button"
                className="inline-flex items-center gap-1 rounded-xl bg-lime-200 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-lime-300"
                onClick={async () => {
                          if (row.purchaseOrderId) {
                            const blob = await downloadPurchaseOrderPdf(row.purchaseOrderId);
                            triggerBlobDownload(blob, `laflo-purchase-order-${row.purchaseOrderId}.pdf`);
                            return;
                          }
                          const blob = downloadMockTransaction(row, currency);
                          triggerBlobDownload(blob, `laflo-expense-${row.id}.html`);
                        }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                          </svg>
                          Download
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-600">
                    No transactions match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details modal */}
      {selectedTx ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedTx(null);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transaction</div>
                <div className="mt-1 truncate text-lg font-extrabold text-slate-900">{selectedTx.expense}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{selectedTx.category}</span>
                  <span className={`rounded-full px-2.5 py-1 font-semibold ${statusPillClass(selectedTx.status)}`}>
                    {selectedTx.status}
                  </span>
                  {selectedTx.isMock ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">demo</span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">Amount</div>
                  <div className="mt-1 font-extrabold text-slate-900">{formatCurrency(selectedTx.amount, currency)}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">Date</div>
                  <div className="mt-1 font-extrabold text-slate-900">{new Date(selectedTx.date).toLocaleDateString()}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">Quantity</div>
                  <div className="mt-1 font-extrabold text-slate-900">{selectedTx.quantity}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">Reference</div>
                  <div className="mt-1 truncate font-extrabold text-slate-900">
                    {selectedTx.purchaseOrderId ? `PO-${selectedTx.purchaseOrderId}` : selectedTx.id}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
                  onClick={() => setSelectedTx(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-lime-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-lime-300"
                  onClick={async () => {
                    const row = selectedTx;
                    if (row.purchaseOrderId) {
                      const blob = await downloadPurchaseOrderPdf(row.purchaseOrderId);
                      triggerBlobDownload(blob, `laflo-purchase-order-${row.purchaseOrderId}.pdf`);
                    } else {
                      const blob = downloadMockTransaction(row, currency);
                      triggerBlobDownload(blob, `laflo-expense-${row.id}.html`);
                    }
                  }}
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
