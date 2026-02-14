import type { Review } from '@/types';
import api from '@/services/api';
import { reviewService, invoiceService, purchaseOrderService, housekeepingService, roomService } from '@/services';
import type { TimeRange } from '@/data/timeRange';
import { timeRangeToDateRange } from '@/data/timeRange';
import type { Invoice, PurchaseOrder, Room } from '@/types';
import { useAuthStore } from '@/stores/authStore';

const DATA_MODE: 'mock' | 'api' = (import.meta.env.VITE_DATA_MODE as 'mock' | 'api') || 'api';

// -----------------------
// MOCK DATA - replace with real data
// -----------------------
type ReviewRecord = {
  id: string;
  date: string; // ISO date
  rating: number;
  country: string;
  guest: string;
  comment: string;
  responded: boolean;
  categories: {
    facilities: number;
    cleanliness: number;
    services: number;
    comfort: number;
    location: number;
    food: number;
  };
};

const MOCK_REVIEWS: ReviewRecord[] = [
  {
    id: 'r1',
    date: '2026-02-13',
    rating: 4.8,
    country: 'United States',
    guest: 'John Doe',
    comment: 'Great stay, spotless room and friendly staff.',
    responded: true,
    categories: { facilities: 4.6, cleanliness: 4.9, services: 4.8, comfort: 4.7, location: 4.6, food: 4.5 },
  },
  {
    id: 'r2',
    date: '2026-02-12',
    rating: 2.1,
    country: 'United Kingdom',
    guest: 'Emily Stone',
    comment: 'Late check-in and noisy hallway.',
    responded: false,
    categories: { facilities: 2.6, cleanliness: 2.2, services: 2.0, comfort: 2.1, location: 3.2, food: 2.7 },
  },
  {
    id: 'r3',
    date: '2026-02-11',
    rating: 4.3,
    country: 'China',
    guest: 'Wei Zhang',
    comment: 'Nice rooms, good value.',
    responded: true,
    categories: { facilities: 4.1, cleanliness: 4.2, services: 4.4, comfort: 4.2, location: 4.6, food: 4.0 },
  },
  {
    id: 'r4',
    date: '2026-02-10',
    rating: 3.4,
    country: 'Australia',
    guest: 'Sophie Lee',
    comment: 'Good, but housekeeping missed a day.',
    responded: false,
    categories: { facilities: 3.6, cleanliness: 3.3, services: 3.2, comfort: 3.5, location: 3.9, food: 3.1 },
  },
  {
    id: 'r5',
    date: '2026-02-09',
    rating: 4.7,
    country: 'Netherlands',
    guest: 'Tom van Dijk',
    comment: 'Excellent service and comfortable bed.',
    responded: true,
    categories: { facilities: 4.5, cleanliness: 4.6, services: 4.9, comfort: 4.8, location: 4.4, food: 4.2 },
  },
  {
    id: 'r6',
    date: '2026-02-08',
    rating: 1.9,
    country: 'Saudi Arabia',
    guest: 'Ahmed Ali',
    comment: 'Room was not ready on arrival.',
    responded: true,
    categories: { facilities: 2.0, cleanliness: 1.8, services: 2.1, comfort: 1.9, location: 2.5, food: 2.0 },
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}

function inRange(iso: string, startISO: string, endISO: string) {
  return iso >= startISO && iso <= endISO;
}

function normalizeSearch(value: string) {
  return value.toLowerCase().trim();
}

function normalizeRevenueBreakdown(
  data: unknown
): Array<{ date: string; revenue: number; bookings?: number }> {
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
}

// GET /reports/revenue?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function getRevenueBreakdown({ timeRange }: { timeRange: TimeRange }) {
  const range = timeRangeToDateRange(timeRange);
  if (DATA_MODE === 'mock') {
    // Minimal mock fallback: return empty series (pages can render "not enough data").
    return [];
  }
  const response = await api.get('/reports/revenue', { params: range });
  const payload = response.data?.data?.data ?? response.data?.data;
  return normalizeRevenueBreakdown(payload);
}

// GET /reports/sources?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function getSourcesBreakdown({ timeRange }: { timeRange: TimeRange }) {
  const range = timeRangeToDateRange(timeRange);
  if (DATA_MODE === 'mock') {
    return { breakdown: [] as Array<{ source: string; count: number }> };
  }
  const response = await api.get('/reports/sources', { params: range });
  return response.data?.data?.data ?? response.data?.data;
}

// GET /purchase-orders
export async function listPurchaseOrders() {
  if (DATA_MODE === 'mock') return [];
  return purchaseOrderService.list();
}

// GET /purchase-orders/:id/pdf
export async function downloadPurchaseOrderPdf(id: string) {
  return purchaseOrderService.exportPdf(id);
}

// -----------------------
// Reviews
// -----------------------
// GET /reviews?range=7d
export async function getReviewsList({
  timeRange,
  search,
}: {
  timeRange: TimeRange;
  search: string;
}): Promise<
  Array<{ id: string; guest: string; country: string; rating: number; date: string; comment: string; responded: boolean }>
> {
  const { startDate, endDate } = timeRangeToDateRange(timeRange);
  const q = normalizeSearch(search);

  if (DATA_MODE === 'mock') {
    return MOCK_REVIEWS.filter((r) => inRange(r.date, startDate, endDate))
      .filter((r) => {
        if (!q) return true;
        return `${r.guest} ${r.comment} ${r.country}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => ({ id: r.id, guest: r.guest, country: r.country, rating: r.rating, date: r.date, comment: r.comment, responded: r.responded }));
  }

  const list = (await reviewService.list()) as Review[];
  return list
    .map((r) => {
      const guest = r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : 'Guest';
      const date = String(r.createdAt || '').split('T')[0] || toISODate(new Date());
      return {
        id: r.id,
        guest,
        country: 'Unknown',
        rating: Number(r.rating) || 0,
        date,
        comment: r.comment || '',
        responded: Boolean(r.response?.length),
      };
    })
    .filter((r) => inRange(r.date, startDate, endDate))
    .filter((r) => {
      if (!q) return true;
      return `${r.guest} ${r.comment}`.toLowerCase().includes(q);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

// GET /reviews/stats?range=7d
export async function getReviewStats({ timeRange }: { timeRange: TimeRange }) {
  const { startDate, endDate } = timeRangeToDateRange(timeRange);
  const list =
    DATA_MODE === 'mock'
      ? MOCK_REVIEWS
      : (await reviewService.list()).map((r) => {
          const date = String((r as any).createdAt || '').split('T')[0] || toISODate(new Date());
          const rating = Number((r as any).rating) || 0;
          // Derive stable category breakdowns from rating if the API doesn't include categories.
          const base = clamp(rating, 0, 5);
          return {
            id: String((r as any).id),
            date,
            rating,
            country: 'Unknown',
            guest: (r as any).guest ? `${(r as any).guest.firstName} ${(r as any).guest.lastName}` : 'Guest',
            comment: String((r as any).comment || ''),
            responded: Boolean((r as any).response?.length),
            categories: {
              facilities: clamp(base + 0.2, 0, 5),
              cleanliness: clamp(base + 0.0, 0, 5),
              services: clamp(base + 0.1, 0, 5),
              comfort: clamp(base + 0.15, 0, 5),
              location: clamp(base + 0.05, 0, 5),
              food: clamp(base - 0.05, 0, 5),
            },
          } satisfies ReviewRecord;
        });

  const filtered = list.filter((r) => inRange(r.date, startDate, endDate));

  const total = filtered.length;
  const avg = total ? filtered.reduce((sum, r) => sum + r.rating, 0) / total : 0;
  const responded = filtered.filter((r) => r.responded).length;
  const responseRate = total ? Math.round((responded / total) * 100) : 0;

  // Positive / negative series.
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '6m' ? 180 : 365;
  const end = new Date(endDate + 'T00:00:00');
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const cursor = new Date(start);
  const byDate = new Map<string, { pos: number; neg: number }>();
  for (const r of filtered) {
    const v = byDate.get(r.date) ?? { pos: 0, neg: 0 };
    if (r.rating >= 4) v.pos += 1;
    if (r.rating <= 2) v.neg += 1;
    byDate.set(r.date, v);
  }
  const series: Array<{ day: string; positive: number; negative: number }> = [];
  while (cursor <= end) {
    const iso = toISODate(cursor);
    const label = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short' }).format(cursor);
    const v = byDate.get(iso) ?? { pos: 0, neg: 0 };
    series.push({ day: label, positive: v.pos, negative: v.neg });
    cursor.setDate(cursor.getDate() + 1);
  }

  const avgCat = (key: keyof ReviewRecord['categories']) =>
    total ? filtered.reduce((sum, r) => sum + Number(r.categories[key] || 0), 0) / total : 0;

  const categoryScores = [
    { name: 'Facilities', value: avgCat('facilities') },
    { name: 'Cleanliness', value: avgCat('cleanliness') },
    { name: 'Services', value: avgCat('services') },
    { name: 'Comfort', value: avgCat('comfort') },
    { name: 'Location', value: avgCat('location') },
    { name: 'Food and Dining', value: avgCat('food') },
  ].map((c) => ({ ...c, value: Number(c.value.toFixed(1)) }));

  return {
    total,
    average: Number(avg.toFixed(1)),
    responseRate,
    series,
    categoryScores,
  };
}

// GET /reviews/by-country?range=7d
export async function getReviewsByCountry({ timeRange }: { timeRange: TimeRange }) {
  const { startDate, endDate } = timeRangeToDateRange(timeRange);

  const list =
    DATA_MODE === 'mock'
      ? MOCK_REVIEWS
      : (await reviewService.list()).map((r) => {
          const date = String((r as any).createdAt || '').split('T')[0] || toISODate(new Date());
          return { id: String((r as any).id), date, rating: Number((r as any).rating) || 0, country: 'Unknown' } as any;
        });

  const filtered = list.filter((r: any) => inRange(r.date, startDate, endDate));
  const by = new Map<string, number>();
  for (const r of filtered) by.set(r.country || 'Unknown', (by.get(r.country || 'Unknown') ?? 0) + 1);
  const rows = [...by.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
  const total = rows.reduce((sum, r) => sum + r.count, 0) || 1;
  return rows.map((r) => ({ ...r, pct: Math.round((r.count / total) * 100) }));
}

// -----------------------
// Expenses
// -----------------------
// GET /expenses/summary?range=1y
export async function getExpensesSummary({ timeRange }: { timeRange: TimeRange }) {
  const range = timeRangeToDateRange(timeRange);

  if (DATA_MODE === 'mock') {
    // Minimal "mock mode" for now: use revenue endpoint-like mock behavior.
    const totalIncome = 45650;
    const totalExpenses = 30000;
    return {
      totalIncome,
      totalExpenses,
      totalBalance: totalIncome - totalExpenses,
      balanceChangePct: 3.56,
      incomeChangePct: -1.25,
      expenseChangePct: 4.79,
      currency: useAuthStore.getState().user?.hotel?.currency || 'USD',
      range,
    };
  }

  // Uses current backend endpoints; pages call this function only.
  const revenueResp = await api.get('/reports/revenue', { params: range });
  const payload = revenueResp.data?.data?.data ?? revenueResp.data?.data;
  const breakdown = Array.isArray(payload?.breakdown) ? payload.breakdown : Array.isArray(payload) ? payload : [];
  const totalIncome = breakdown.reduce((sum: number, r: any) => sum + (Number(r.revenue ?? r.amount) || 0), 0);

  const orders = (await purchaseOrderService.list()) as PurchaseOrder[];
  const totalExpenses = orders.reduce((sum: number, o: any) => sum + (Number(o.totalCost) || 0), 0);
  const currency = useAuthStore.getState().user?.hotel?.currency || 'USD';

  return {
    totalIncome,
    totalExpenses,
    totalBalance: totalIncome - totalExpenses,
    // We don't have "previous period totals" consistently yet, keep nulls and let UI render appropriately.
    balanceChangePct: null as number | null,
    incomeChangePct: null as number | null,
    expenseChangePct: null as number | null,
    currency,
    range,
  };
}

// GET /expenses/transactions?range=1y&category=Utilities&status=Completed&search=...
export async function getExpenseTransactions({
  timeRange,
  category,
  status,
  search,
}: {
  timeRange: TimeRange;
  category: string | 'ALL';
  status: string | 'ALL';
  search: string;
}) {
  // For now, reuse existing Purchase Orders as expense source in API mode.
  const range = timeRangeToDateRange(timeRange);
  const q = normalizeSearch(search);
  if (DATA_MODE === 'mock') {
    return { rows: [], currency: useAuthStore.getState().user?.hotel?.currency || 'USD', range };
  }

  const orders = (await purchaseOrderService.list()) as PurchaseOrder[];
  const rows = orders
    .map((o: any) => ({
      id: o.id,
      expense: o.vendorName ? `${o.vendorName} purchase` : o.reference,
      category: 'Miscellaneous',
      quantity: 1,
      amount: Number(o.totalCost) || 0,
      date: o.createdAt ? String(o.createdAt).split('T')[0] : toISODate(new Date()),
      status: String(o.status || 'Completed'),
    }))
    .filter((r) => inRange(r.date, range.startDate, range.endDate))
    .filter((r) => (category === 'ALL' ? true : r.category === category))
    .filter((r) => (status === 'ALL' ? true : normalizeSearch(r.status) === normalizeSearch(status)))
    .filter((r) => (!q ? true : `${r.expense} ${r.category}`.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date));

  return { rows, currency: useAuthStore.getState().user?.hotel?.currency || 'USD', range };
}

// -----------------------
// Invoices
// -----------------------
// GET /invoices?range=30d&status=UNPAID&search=...
export async function getInvoices({
  timeRange,
  status,
  search,
  page,
  limit,
}: {
  timeRange: TimeRange;
  status: Invoice['status'] | 'ALL';
  search: string;
  page: number;
  limit: number;
}) {
  const range = timeRangeToDateRange(timeRange);
  const q = normalizeSearch(search);
  if (DATA_MODE === 'mock') {
    return { data: [], pagination: { total: 0 } };
  }
  const res = await invoiceService.list({ status: status === 'ALL' ? undefined : status, page, limit });
  const data = (res as any)?.data ?? [];
  const filtered = data
    .filter((inv: any) => {
      const issued = String(inv.issuedAt || '').split('T')[0];
      return issued ? inRange(issued, range.startDate, range.endDate) : true;
    })
    .filter((inv: any) => {
      if (!q) return true;
      const hay = `${inv.invoiceNo ?? ''} ${inv.booking?.guest?.firstName ?? ''} ${inv.booking?.guest?.lastName ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  return { ...(res as any), data: filtered, pagination: (res as any)?.pagination ?? { total: filtered.length } };
}

export async function downloadInvoicePdf(id: string) {
  return invoiceService.downloadPdf(id);
}

// -----------------------
// Housekeeping
// -----------------------
// GET /housekeeping/rooms?search=...&status=...&floor=...
export async function getHousekeepingRooms({
  search,
  status,
  floor,
}: {
  search: string;
  status?: Room['housekeepingStatus'];
  floor?: number;
}) {
  if (DATA_MODE === 'mock') {
    return [];
  }
  const rooms = await housekeepingService.getRooms({ status, floor });
  const q = normalizeSearch(search);
  if (!q) return rooms;
  return (rooms as Room[]).filter((r) => `${r.number} ${r.roomType?.name ?? ''} ${r.notes ?? ''}`.toLowerCase().includes(q));
}

export async function getHousekeepingFloors() {
  if (DATA_MODE === 'mock') return [];
  return roomService.getFloors();
}
