import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import TimeRangeToggle from '@/components/ui/TimeRangeToggle';
import type { TimeRange } from '@/data/timeRange';
import { getReviewStats, getReviewsByCountry, getReviewsList } from '@/data/dataSource';
import { useUiStore } from '@/stores/uiStore';
import { KPI_VALUE_CLASS_SM } from '@/styles/typography';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
        <path d={bg} stroke="#e2e8f0" strokeWidth={stroke} fill="none" strokeLinecap="round" />
        <path d={d} stroke="#d9f99d" strokeWidth={stroke} fill="none" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
        <div className="text-xs font-semibold text-slate-500">Rating</div>
        <div className={`${KPI_VALUE_CLASS_SM} tracking-tight`}>
          {value.toFixed(1)}
          <span className="text-base font-semibold text-slate-500">/5</span>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Reviews</h1>
          <p className="mt-1 text-sm text-slate-600">Track guest satisfaction and reputation performance.</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Tip: use the top search bar to filter review guest names and comments on this page.
          </p>
        </div>
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
            <div>
              <h2 className="text-lg font-bold text-slate-900">Review Statistics</h2>
              <p className="text-sm text-slate-500">Positive vs negative reviews</p>
            </div>
          </div>

          <div className="mt-4 h-64">
            {isLoadingStats ? (
              <div className="h-full animate-shimmer rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.series ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                  <Bar dataKey="positive" name="Positive" fill="#bbf7d0" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="negative" name="Negative" fill="#d9f99d" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Overall Rating</h2>
              <p className="text-sm text-slate-500">Based on recent reviews</p>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-500">{stats?.total ?? 0} reviews</div>
              <div className="text-xs font-semibold text-slate-500">{stats?.responseRate ?? 0}% response rate</div>
            </div>
          </div>

          <div className="mt-3">
            <RatingGauge value={stats?.average || 0} />
          </div>

          <div className="mt-4 space-y-3">
            {(stats?.categoryScores ?? []).map((row) => (
              <div key={row.name} className="grid grid-cols-[110px_1fr_34px] items-center gap-3">
                <div className="text-xs font-medium text-slate-600">{row.name}</div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-lime-200" style={{ width: `${(row.value / 5) * 100}%` }} />
                </div>
                <div className="text-xs font-semibold text-slate-700 text-right">{row.value.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Reviews by Country</h2>
            <p className="text-sm text-slate-500">Where your feedback is coming from</p>
          </div>
          <div className="text-sm font-semibold text-slate-500">{stats?.total ?? 0} reviews</div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Top countries</p>
              <p className="text-xs font-semibold text-slate-500">{timeRange === '7d' ? '7d' : '30d'}</p>
            </div>
            <div className="mt-4 space-y-3">
              {isLoadingCountry ? (
                <div className="text-sm text-slate-600">Loading…</div>
              ) : (byCountry ?? []).length === 0 ? (
                <div className="text-sm text-slate-600">No country data for this range.</div>
              ) : (
                (byCountry ?? []).slice(0, 8).map((row) => (
                  <div key={row.country} className="grid grid-cols-[1fr_70px] items-center gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-semibold text-slate-800">{row.country}</div>
                        <div className="shrink-0 text-xs font-semibold text-slate-500">{row.count} reviews</div>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                        <div className="h-full rounded-full bg-lime-200" style={{ width: `${row.pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold text-slate-900">{row.pct}%</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-700">Average rating</p>
            <p className={`mt-2 ${KPI_VALUE_CLASS_SM}`}>{(stats?.average ?? 0).toFixed(1)}<span className="text-sm font-semibold text-slate-500">/5</span></p>
            <div className="mt-3 text-sm text-slate-600">
              <div><span className="font-semibold text-slate-900">{stats?.total ?? 0}</span> reviews</div>
              <div><span className="font-semibold text-slate-900">{stats?.responseRate ?? 0}%</span> response rate</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent reviews</h2>
            <p className="text-sm text-slate-500">Showing {timeRange === '7d' ? 'last 7 days' : 'last 30 days'}</p>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            {globalSearch.trim() ? `Filtered by: "${globalSearch.trim()}"` : 'No search filter'}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {isLoadingList || isLoadingStats ? (
            <div className="text-sm text-slate-600">Loading reviews…</div>
          ) : (reviewList ?? []).length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              No reviews match your search.
            </div>
          ) : (
            (reviewList ?? []).slice(0, 12).map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{r.guest}</p>
                      <span className="text-xs font-semibold text-slate-500">• {r.country}</span>
                      <span className="text-xs font-semibold text-slate-500">• {new Date(r.date).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{r.comment || 'No comment provided.'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="inline-flex items-center gap-2 rounded-full bg-lime-50 px-3 py-1.5 text-xs font-semibold text-slate-900 ring-1 ring-lime-200">
                      {r.rating.toFixed(1)} / 5
                    </div>
                    <div className="mt-2 text-xs font-semibold text-slate-500">
                      {r.responded ? 'Responded' : 'No response'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
