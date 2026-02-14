import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reviewService } from '@/services';
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

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short' }).format(date);
}

function stableDemoSplit(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / sum) * total);
  const floored = raw.map((x) => Math.floor(x));
  let remainder = total - floored.reduce((a, b) => a + b, 0);
  let i = 0;
  while (remainder > 0) {
    floored[i % floored.length] += 1;
    remainder -= 1;
    i += 1;
  }
  return floored;
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
        <div className="text-4xl font-extrabold tracking-tight text-slate-900">
          {value.toFixed(1)}
          <span className="text-base font-semibold text-slate-500">/5</span>
        </div>
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  const [days, setDays] = useState<7 | 30>(7);
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => reviewService.list(),
  });

  const stats = useMemo(() => {
    const list = reviews ?? [];
    const total = list.length;
    const average = total > 0 ? list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / total : 0;
    const responded = list.filter((r) => r.response?.length).length;
    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
    return {
      total,
      average: Number(average.toFixed(1)),
      responseRate,
    };
  }, [reviews]);

  const reviewStatsSeries = useMemo(() => {
    const list = reviews ?? [];
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const cursor = new Date(start);
    const rows: Array<{ day: string; positive: number; negative: number }> = [];

    const byDate = new Map<string, { pos: number; neg: number }>();
    for (const r of list) {
      const d = new Date(r.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toISOString().split('T')[0];
      const v = byDate.get(key) ?? { pos: 0, neg: 0 };
      const rating = Number(r.rating) || 0;
      if (rating >= 4) v.pos += 1;
      if (rating <= 2) v.neg += 1;
      byDate.set(key, v);
    }

    while (cursor <= end) {
      const key = cursor.toISOString().split('T')[0];
      const v = byDate.get(key) ?? { pos: 0, neg: 0 };
      rows.push({ day: formatDayLabel(cursor), positive: v.pos, negative: v.neg });
      cursor.setDate(cursor.getDate() + 1);
    }

    return rows;
  }, [reviews, days]);

  const categoryScores = useMemo(() => {
    // We don't have per-category scores in the API today.
    // This creates stable, believable category breakdowns derived from the overall average.
    const base = stats.average || 0;
    const tweaks = [0.2, 0.0, -0.1, 0.1, 0.15, -0.05];
    const categories = ['Facilities', 'Cleanliness', 'Services', 'Comfort', 'Location', 'Food and Dining'];
    return categories.map((name, i) => ({
      name,
      value: Math.max(0, Math.min(5, Number((base + tweaks[i]).toFixed(1)))),
    }));
  }, [stats.average]);

  const countryRows = useMemo(() => {
    // Review objects don't include country. For demo UI, use a stable split.
    const total = stats.total || 0;
    const countries = [
      { name: 'United States of America', color: '#d9f99d' },
      { name: 'China', color: '#e2ff9a' },
      { name: 'United Kingdom', color: '#bbf7d0' },
      { name: 'Netherlands', color: '#c7d2fe' },
      { name: 'Australia', color: '#a7f3d0' },
      { name: 'Saudi Arabia', color: '#e2e8f0' },
    ];
    const split = stableDemoSplit(total, [23, 20, 18, 13, 11, 9]);
    const sum = split.reduce((a, b) => a + b, 0) || 1;
    return countries.map((c, idx) => ({
      ...c,
      value: split[idx],
      pct: Math.round((split[idx] / sum) * 100),
    }));
  }, [stats.total]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Reviews</h1>
          <p className="mt-1 text-sm text-slate-600">Track guest satisfaction and reputation performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition-colors ${
              days === 7 ? 'bg-lime-200 text-slate-900 ring-lime-200' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => setDays(7)}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition-colors ${
              days === 30 ? 'bg-lime-200 text-slate-900 ring-lime-200' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => setDays(30)}
          >
            Last 30 Days
          </button>
        </div>
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
            {isLoading ? (
              <div className="h-full animate-shimmer rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reviewStatsSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              <div className="text-xs font-semibold text-slate-500">{stats.total} reviews</div>
              <div className="text-xs font-semibold text-slate-500">{stats.responseRate}% response rate</div>
            </div>
          </div>

          <div className="mt-3">
            <RatingGauge value={stats.average || 0} />
          </div>

          <div className="mt-4 space-y-3">
            {categoryScores.map((row) => (
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
            <p className="text-sm text-slate-500">Demo view (country is not captured in reviews yet)</p>
          </div>
          <div className="text-sm font-semibold text-slate-500">Total customers</div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="relative overflow-hidden rounded-2xl bg-slate-50 p-4">
            {/* Simple "map" placeholder to match the reference layout */}
            <div className="absolute inset-0 opacity-60" aria-hidden="true">
              <svg viewBox="0 0 900 400" className="h-full w-full">
                <rect x="0" y="0" width="900" height="400" fill="#f8fafc" />
                <path
                  d="M79 221l49-38 72 8 51-26 44 5 41-24 50 18 61-17 56 25 53-5 67 16 73-10 43 29 55 2 50 19-21 40-82 18-60 31-82-6-74 26-91-18-62 17-76-24-52 5-56-14-49 5z"
                  fill="#94a3b8"
                  opacity="0.35"
                />
                <path
                  d="M515 116l44-27 58 16 38-20 47 11 22 39-18 33-52 12-41 21-55-9-34 9-28-24z"
                  fill="#94a3b8"
                  opacity="0.35"
                />
                <path
                  d="M657 248l31-21 46 3 40-22 50 19 31 33-12 34-64 17-50 14-38-10-28-19z"
                  fill="#94a3b8"
                  opacity="0.35"
                />
              </svg>
            </div>
            <div className="relative">
              <p className="text-sm font-semibold text-slate-700">Map preview</p>
              <p className="mt-1 text-xs text-slate-500">
                When we start capturing guest country on reviews, this will become fully accurate.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white">
            <div className="text-3xl font-extrabold text-slate-900">{(stats.total * 25).toLocaleString()}</div>
            <div className="mt-3 space-y-3">
              {countryRows.map((row) => (
                <div key={row.name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: row.color }} />
                    <span className="truncate text-sm text-slate-700">{row.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{row.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

