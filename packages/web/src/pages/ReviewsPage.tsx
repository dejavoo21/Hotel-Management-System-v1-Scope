import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import TimeRangeToggle from '@/components/ui/TimeRangeToggle';
import type { TimeRange } from '@/data/timeRange';
import { getReviewStats, getReviewsByCountry, getReviewsList } from '@/data/dataSource';
import { useUiStore } from '@/stores/uiStore';
import { PAGE_TITLE_CLASS } from '@/styles/typography';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function initialsFromName(name: string) {
  const parts = String(name || 'Guest').trim().split(/\s+/);
  return `${parts[0]?.[0] || 'G'}${parts[1]?.[0] || ''}`.toUpperCase();
}

function colorByIndex(index: number) {
  const colors = [
    'bg-lime-100 text-lime-800',
    'bg-emerald-100 text-emerald-800',
    'bg-cyan-100 text-cyan-800',
    'bg-amber-100 text-amber-800',
    'bg-rose-100 text-rose-800',
    'bg-indigo-100 text-indigo-800',
  ];
  return colors[index % colors.length];
}

function RatingGauge({ value }: { value: number }) {
  const pct = clamp01(value / 5);
  const size = 220;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2 + 18;
  const start = Math.PI;
  const end = 0;
  const angle = start + (end - start) * pct;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(angle);
  const y2 = cy + r * Math.sin(angle);
  const largeArc = pct > 0.5 ? 1 : 0;

  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  const bg = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`;

  return (
    <div className="relative mx-auto w-full max-w-[260px]">
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <path d={bg} stroke="#d1d5db" strokeWidth={stroke} fill="none" strokeLinecap="round" />
        <path d={d} stroke="#b7e4d0" strokeWidth={stroke} fill="none" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
        <div className="text-xs font-semibold text-slate-500">Rating</div>
        <div className="text-4xl font-semibold tracking-tight text-slate-900">
          {value.toFixed(1)}<span className="text-base font-semibold text-slate-500">/5</span>
        </div>
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  const globalSearch = useUiStore((s) => s.globalSearch);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [sortBy, setSortBy] = useState<'Newest' | 'Highest Rating'>('Newest');

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['reviews', 'stats', timeRange],
    queryFn: () => getReviewStats({ timeRange }),
  });

  const { data: byCountry, isLoading: isLoadingCountry } = useQuery({
    queryKey: ['reviews', 'byCountry', timeRange],
    queryFn: () => getReviewsByCountry({ timeRange }),
  });

  const { data: reviewList, isLoading: isLoadingList } = useQuery({
    queryKey: ['reviews', 'list', timeRange, globalSearch],
    queryFn: () => getReviewsList({ timeRange, search: globalSearch }),
  });

  const series = (stats?.series ?? []).map((row: any) => ({
    day: row.day,
    positive: Number(row.positive) || 0,
    negative: -Math.abs(Number(row.negative) || 0),
  }));

  const countries =
    (byCountry ?? []).length > 0
      ? (byCountry ?? []).slice(0, 8)
      : [
          { country: 'United States of America', pct: 23, count: 4104 },
          { country: 'China', pct: 20, count: 3570 },
          { country: 'United Kingdom', pct: 18, count: 3213 },
          { country: 'Netherlands', pct: 13, count: 2320 },
          { country: 'Australia', pct: 11, count: 1963 },
          { country: 'Saudi Arabia', pct: 9, count: 1606 },
          { country: 'UAE', pct: 8, count: 1427 },
          { country: 'Indonesia', pct: 4, count: 714 },
        ];

  const categoryScores = (stats?.categoryScores ?? [
    { name: 'Facilities', value: 4.4 },
    { name: 'Cleanliness', value: 4.4 },
    { name: 'Services', value: 4.6 },
    { name: 'Comfort', value: 4.8 },
    { name: 'Food and Dining', value: 4.5 },
  ]) as Array<{ name: string; value: number }>;

  const customerReviews = useMemo(() => {
    const list = [...(reviewList ?? [])];
    if (sortBy === 'Highest Rating') {
      return list.sort((a: any, b: any) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    }
    return list.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [reviewList, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className={PAGE_TITLE_CLASS}>Reviews</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="min-h-[288px] rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Review Statistics</h2>
            <TimeRangeToggle
              options={[
                { label: 'Last 7 Days', value: '7d' },
                { label: 'Last 30 Days', value: '30d' },
              ]}
              value={timeRange}
              onChange={setTimeRange}
            />
          </div>
          <div className="mt-2 flex items-center gap-5 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-200" />Positive</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-lime-300" />Negative</span>
          </div>
          <div className="mt-4 h-[210px]">
            {isLoadingStats ? (
              <div className="h-full animate-shimmer rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                  <Bar dataKey="positive" fill="#bbf7d0" radius={[8, 8, 8, 8]} />
                  <Bar dataKey="negative" fill="#d9f99d" radius={[8, 8, 8, 8]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="min-h-[288px] rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Overall Rating</h2>
            <span className="rounded-xl border border-lime-300 bg-lime-200 px-3 py-1 text-xs font-semibold text-slate-900">This Week</span>
          </div>
          <div className="mt-2 grid gap-4 lg:grid-cols-[220px_1fr]">
            <div>
              <RatingGauge value={stats?.average || 4.6} />
              <div className="mx-auto -mt-3 w-full max-w-[260px] rounded-xl bg-lime-200 py-2 text-center">
                <div className="text-3xl font-bold text-slate-900">Impressive</div>
                <div className="text-xs font-semibold text-slate-600">
                  from {(stats?.total ?? 2546).toLocaleString()} reviews
                </div>
              </div>
            </div>
            <div className="mt-1 space-y-2.5">
              {categoryScores.map((row) => (
                <div key={row.name} className="grid grid-cols-[120px_1fr_30px] items-center gap-3">
                  <div className="text-sm font-semibold text-slate-600">{row.name}</div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-200" style={{ width: `${(row.value / 5) * 100}%` }} />
                  </div>
                  <div className="text-right text-sm font-semibold text-slate-700">{row.value.toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Reviews by Country</h2>
          <button type="button" className="rounded-lg p-1 text-slate-400 hover:bg-slate-50" aria-label="More">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
            </svg>
          </button>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[2.1fr_1fr]">
          <div className="rounded-2xl bg-slate-50 p-4">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg"
              alt="World map"
              className="h-[320px] w-full rounded-xl bg-slate-100 object-contain"
            />
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Customers</div>
            <div className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">
              {(stats?.total ?? 17850).toLocaleString()}
            </div>
            <div className="mt-4 space-y-2.5 border-t border-slate-200 pt-4 text-sm">
              {isLoadingCountry ? (
                <div className="text-sm text-slate-600">Loading...</div>
              ) : (
                countries.map((row: any, index: number) => (
                  <div key={row.country} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-3.5 w-3.5 rounded ${colorByIndex(index)}`} />
                      <span className="truncate text-slate-700">{row.country}</span>
                    </div>
                    <div className="font-semibold text-slate-900">{row.pct}%</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Customer Reviews</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'Newest' | 'Highest Rating')}
              className="rounded-xl border border-lime-300 bg-lime-200 px-3 py-1 text-xs font-semibold text-slate-900"
            >
              <option>Newest</option>
              <option>Highest Rating</option>
            </select>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isLoadingList || isLoadingStats ? (
            <div className="text-sm text-slate-600">Loading reviews...</div>
          ) : customerReviews.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No reviews match your search.</div>
          ) : (
            customerReviews.slice(0, 8).map((r: any, index: number) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${colorByIndex(index)}`}>
                    {initialsFromName(r.guest)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{r.guest}</div>
                    <div className="text-xs text-slate-500">{new Date(r.date).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="mt-2 text-yellow-500">
                  {'★'.repeat(Math.max(1, Math.round(Number(r.rating) || 0)))}
                  {'☆'.repeat(Math.max(0, 5 - Math.round(Number(r.rating) || 0)))}
                </div>
                <p className="mt-2 min-h-[76px] text-sm text-slate-700">{r.comment || 'No comment provided.'}</p>
                <div className="mt-2 text-xs font-semibold text-slate-500">{r.country}</div>
                <div className="mt-3 text-right">
                  <span className="rounded-full bg-lime-50 px-3 py-1 text-xs font-semibold text-slate-900 ring-1 ring-lime-200">
                    {(Number(r.rating) || 0).toFixed(1)} / 5
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
