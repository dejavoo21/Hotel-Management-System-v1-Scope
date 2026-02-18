import { useState } from 'react';
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className={PAGE_TITLE_CLASS}>Reviews</h1>
        <TimeRangeToggle
          options={[
            { label: 'Last 7 Days', value: '7d' },
            { label: 'Last 30 Days', value: '30d' },
          ]}
          value={timeRange}
          onChange={setTimeRange}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Review Statistics</h2>
            <span className="rounded-xl border border-lime-300 bg-lime-200 px-3 py-1 text-xs font-semibold text-slate-900">Last 7 Days</span>
          </div>
          <div className="mt-2 flex items-center gap-5 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-200" />Positive</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-lime-300" />Negative</span>
          </div>
          <div className="mt-4 h-64">
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

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Overall Rating</h2>
            <span className="rounded-xl border border-lime-300 bg-lime-200 px-3 py-1 text-xs font-semibold text-slate-900">This Week</span>
          </div>
          <div className="mt-2">
            <RatingGauge value={stats?.average || 4.6} />
          </div>
          <div className="mt-2 space-y-2.5">
            {(stats?.categoryScores ?? []).map((row: any) => (
              <div key={row.name} className="grid grid-cols-[100px_1fr_30px] items-center gap-3">
                <div className="text-xs font-semibold text-slate-600">{row.name}</div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-200" style={{ width: `${(row.value / 5) * 100}%` }} />
                </div>
                <div className="text-xs font-semibold text-slate-700 text-right">{row.value.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Reviews by Country</h2>
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
            <div className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">{(stats?.total ?? 17850).toLocaleString()}</div>
            <div className="mt-4 space-y-2.5 text-sm">
              {isLoadingCountry ? (
                <div className="text-sm text-slate-600">Loading...</div>
              ) : (
                countries.map((row: any) => (
                  <div key={row.country} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div className="truncate text-slate-700">{row.country}</div>
                    <div className="font-semibold text-slate-900">{row.pct}%</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Recent Reviews</h2>
        <div className="mt-4 space-y-3">
          {isLoadingList || isLoadingStats ? (
            <div className="text-sm text-slate-600">Loading reviews...</div>
          ) : (reviewList ?? []).length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No reviews match your search.</div>
          ) : (
            (reviewList ?? []).slice(0, 8).map((r: any) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{r.guest} • {r.country}</div>
                    <div className="mt-1 text-xs text-slate-500">{new Date(r.date).toLocaleDateString()}</div>
                    <p className="mt-2 text-sm text-slate-700">{r.comment || 'No comment provided.'}</p>
                  </div>
                  <span className="rounded-full bg-lime-50 px-3 py-1 text-xs font-semibold text-slate-900 ring-1 ring-lime-200">{r.rating.toFixed(1)} / 5</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


