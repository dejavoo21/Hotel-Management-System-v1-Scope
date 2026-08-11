import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FilterX,
  Globe2,
  Import,
  MailCheck,
  MessageSquareText,
  Search,
  Star,
  TrendingUp,
  UserRoundCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import TimeRangeToggle from '@/components/ui/TimeRangeToggle';
import type { TimeRange } from '@/data/timeRange';
import { getReviewStats, getReviewsByCountry, getReviewsList } from '@/data/dataSource';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { appendAuditLog } from '@/utils/auditLog';

type ReviewRow = Awaited<ReturnType<typeof getReviewsList>>[number];
type SortOption = 'Newest' | 'Oldest' | 'Highest rating' | 'Lowest rating' | 'Needs response';
type SentimentFilter = 'all' | 'Positive' | 'Neutral' | 'Negative';
type ResponseFilter = 'all' | 'Responded' | 'Needs response';

const sentimentFor = (rating: number) => rating >= 4 ? 'Positive' : rating <= 2 ? 'Negative' : 'Neutral';
const sentimentTone = (sentiment: string) => sentiment === 'Positive' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : sentiment === 'Negative' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-100 text-slate-600';
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'G';

function RatingGauge({ value, total }: { value: number; total: number }) {
  const percent = Math.max(0, Math.min(100, (value / 5) * 100));
  return <div className="relative mx-auto grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(rgb(var(--laflo-chart-primary)) ${percent}%, rgb(var(--color-border)) ${percent}% 100%)` }}><div className="grid h-32 w-32 place-items-center rounded-full bg-card text-center"><div><p className="text-xs font-semibold text-text-muted">Overall rating</p><p className="text-4xl font-bold text-text-main">{total ? value.toFixed(1) : '—'}<span className="text-base text-text-muted">/5</span></p><p className="mt-1 text-xs text-text-muted">{total} review{total === 1 ? '' : 's'}</p></div></div></div>;
}

function Stars({ rating }: { rating: number }) {
  return <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`h-4 w-4 ${index < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}</span>;
}

export default function ReviewsPage() {
  const globalSearch = useUiStore((state) => state.globalSearch);
  const { user } = useAuthStore();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [sentiment, setSentiment] = useState<SentimentFilter>('all');
  const [rating, setRating] = useState('all');
  const [response, setResponse] = useState<ResponseFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('Newest');
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  const statsQuery = useQuery({ queryKey: ['reviews', 'stats', timeRange], queryFn: () => getReviewStats({ timeRange }) });
  const countryQuery = useQuery({ queryKey: ['reviews', 'byCountry', timeRange], queryFn: () => getReviewsByCountry({ timeRange }) });
  const reviewsQuery = useQuery({ queryKey: ['reviews', 'list', timeRange, globalSearch], queryFn: () => getReviewsList({ timeRange, search: globalSearch }) });
  const stats = statsQuery.data;
  const reviews = reviewsQuery.data ?? [];
  const countries = countryQuery.data ?? [];
  const total = stats?.total ?? reviews.length;
  const average = stats?.average ?? (reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0);
  const positiveCount = reviews.filter((review) => review.rating >= 4).length;
  const negativeCount = reviews.filter((review) => review.rating <= 2).length;
  const unresolvedCount = reviews.filter((review) => !review.responded).length;
  const series = (stats?.series ?? []).map((row) => ({ ...row, negative: -Math.abs(Number(row.negative) || 0) }));
  const hasTrendData = series.some((row) => row.positive > 0 || row.negative < 0);
  const actorName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Authorised user';

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = reviews.filter((review) => {
      const reviewSentiment = sentimentFor(review.rating);
      if (source !== 'all' && source !== 'Direct') return false;
      if (sentiment !== 'all' && reviewSentiment !== sentiment) return false;
      if (rating !== 'all' && Math.round(review.rating) !== Number(rating)) return false;
      if (response === 'Responded' && !review.responded) return false;
      if (response === 'Needs response' && review.responded) return false;
      return !query || `${review.guest} ${review.comment} ${review.country}`.toLowerCase().includes(query);
    });
    return result.sort((a, b) => {
      if (sortBy === 'Oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'Highest rating') return b.rating - a.rating;
      if (sortBy === 'Lowest rating') return a.rating - b.rating;
      if (sortBy === 'Needs response') return Number(a.responded) - Number(b.responded);
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [rating, response, reviews, search, sentiment, sortBy, source]);

  const hasFilters = Boolean(search || source !== 'all' || sentiment !== 'all' || rating !== 'all' || response !== 'all');
  const clearFilters = () => { setSearch(''); setSource('all'); setSentiment('all'); setRating('all'); setResponse('all'); };
  const exportReport = () => {
    if (!canManage) return;
    const rows = [['Guest', 'Rating', 'Sentiment', 'Date', 'Country', 'Responded', 'Comment'], ...filteredReviews.map((review) => [review.guest, review.rating, sentimentFor(review.rating), review.date, review.country, review.responded ? 'Yes' : 'No', review.comment])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `laflo-reviews-${timeRange}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    appendAuditLog({ action: 'Review Report Exported', actorId: user?.id, actorName, targetLabel: 'Reviews', details: { period: timeRange, reviewCount: filteredReviews.length, format: 'CSV' } });
  };

  const anyError = statsQuery.isError || countryQuery.isError || reviewsQuery.isError;
  const anyLoading = statsQuery.isLoading || countryQuery.isLoading || reviewsQuery.isLoading;
  const summaryCards: Array<{ icon: LucideIcon; value: number | string; label: string; supporting: string }> = [
    { icon: Star, value: total ? `${average.toFixed(1)} / 5` : '—', label: 'Overall Rating', supporting: total ? 'Based on available reviews' : 'No reviews available' },
    { icon: MessageSquareText, value: total, label: 'Total Reviews', supporting: 'Current selected period' },
    { icon: CheckCircle2, value: positiveCount, label: 'Positive Reviews', supporting: 'Positive sentiment' },
    { icon: AlertTriangle, value: negativeCount, label: 'Negative Reviews', supporting: 'Needs follow-up' },
    { icon: MailCheck, value: unresolvedCount, label: 'Unresolved Follow-ups', supporting: 'Reviews requiring action' },
  ];
  if (anyError) return <div className="rounded-2xl border border-rose-200 bg-card p-10 text-center"><AlertTriangle className="mx-auto h-9 w-9 text-rose-500" /><h1 className="mt-3 text-lg font-semibold text-text-main">Reviews could not be loaded.</h1><p className="mt-1 text-sm text-text-muted">Please try again.</p><button type="button" className="btn-primary mt-4" onClick={() => { void statsQuery.refetch(); void countryQuery.refetch(); void reviewsQuery.refetch(); }}>Try again</button></div>;

  return <div className="space-y-4 pb-6">
    <header className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="flex items-center gap-4"><span className="theme-kpi-icon grid h-12 w-12 shrink-0 place-items-center rounded-2xl"><MessageSquareText className="h-6 w-6" /></span><div><h1 className="text-2xl font-bold tracking-tight text-text-main">Reviews</h1><p className="mt-1 text-sm text-text-muted">Monitor guest feedback, review trends, sentiment, and follow-up actions.</p></div></div><div className="flex flex-wrap items-center gap-2"><TimeRangeToggle options={[{ label: 'Last 7 Days', value: '7d' }, { label: 'Last 30 Days', value: '30d' }]} value={timeRange} onChange={setTimeRange} /><button type="button" className="btn-outline" disabled title="Connect a review provider to import reviews"><Import className="h-4 w-4" />Import reviews</button>{canManage ? <button type="button" className="btn-primary" onClick={exportReport}><Download className="h-4 w-4" />Export report</button> : null}</div></header>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5" aria-label="Review summary">{summaryCards.map(({ icon: Icon, value, label, supporting }) => <article key={label} className="theme-stat-card flex min-h-24 items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><span className="theme-kpi-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><Icon className="h-5 w-5" /></span><div><p className="text-xl font-bold text-text-main">{value}</p><p className="text-sm font-semibold text-text-main">{label}</p><p className="text-xs text-text-muted">{supporting}</p></div></article>)}</section>

    {anyLoading ? <section className="grid gap-4 xl:grid-cols-2"><div className="h-80 animate-shimmer rounded-2xl" /><div className="h-80 animate-shimmer rounded-2xl" /></section> : <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-text-main">Review Trends</h2><p className="mt-1 text-sm text-text-muted">Positive and negative review movement over time.</p></div><TrendingUp className="h-5 w-5 text-primary-600" /></div><div className="mt-4 h-64">{hasTrendData ? <ResponsiveContainer width="100%" height="100%"><BarChart data={series}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--color-border))" /><XAxis dataKey="day" tick={{ fontSize: 11, fill: 'rgb(var(--color-text-muted))' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: 'rgb(var(--color-text-muted))' }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 12, background: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-main))' }} /><Bar dataKey="positive" name="Positive" fill="#10b981" radius={[6, 6, 0, 0]} /><Bar dataKey="negative" name="Negative" fill="#f43f5e" radius={[0, 0, 6, 6]} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center rounded-xl border border-dashed border-border bg-bg/60 text-center"><div><BarChart3 className="mx-auto h-8 w-8 text-text-muted" /><p className="mt-3 font-semibold text-text-main">No review trend data available for this period.</p><p className="mt-1 text-xs text-text-muted">Trend movement will appear as new reviews arrive.</p></div></div>}</div></article>
      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-text-main">Overall Rating</h2><p className="mt-1 text-sm text-text-muted">Guest sentiment and category performance.</p></div>{total > 0 && average >= 4.5 ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Impressive</span> : null}</div><div className="mt-4 grid gap-5 md:grid-cols-[190px_1fr] md:items-center"><RatingGauge value={average} total={total} /><div>{total === 0 ? <div className="rounded-xl border border-dashed border-border bg-bg/60 p-5 text-sm text-text-muted">Category scores will appear when enough reviews are available.</div> : <div className="space-y-2.5">{(stats?.categoryScores ?? []).map((category) => <div key={category.name} className="grid grid-cols-[110px_1fr_32px] items-center gap-2"><span className="text-xs font-medium text-text-muted">{category.name}</span><span className="h-2 overflow-hidden rounded-full bg-border/50"><span className="block h-full rounded-full bg-primary-500" style={{ width: `${(category.value / 5) * 100}%` }} /></span><span className="text-right text-xs font-semibold text-text-main">{category.value.toFixed(1)}</span></div>)}</div>}{total > 0 && total < 10 ? <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">Limited sample: treat this score as directional until more reviews arrive.</p> : null}</div></div></article>
    </section>}

    <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]"><article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div><h2 className="text-lg font-semibold text-text-main">Reviews by Country</h2><p className="mt-1 text-sm text-text-muted">See where guest feedback is coming from.</p></div><div className="relative mt-4 min-h-64 overflow-hidden rounded-2xl border border-border bg-primary-50/40 p-4"><img src="https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg" alt="World map showing review origins" className="absolute inset-0 h-full w-full object-contain opacity-15" /><div className="relative z-10 grid h-full place-items-center text-center"><div className="rounded-2xl border border-border bg-card/90 px-6 py-4 shadow-sm backdrop-blur"><Globe2 className="mx-auto h-7 w-7 text-primary-600" /><p className="mt-2 text-2xl font-bold text-text-main">{total}</p><p className="text-xs text-text-muted">reviews in selected period</p></div></div></div></article><article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h3 className="font-semibold text-text-main">Country distribution</h3><p className="mt-1 text-xs text-text-muted">Based only on available review records.</p>{countries.length ? <div className="mt-4 space-y-4">{countries.slice(0, 7).map((country) => <div key={country.country}><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-text-main">{country.country}</span><span className="font-semibold text-text-main">{country.pct}% <span className="font-normal text-text-muted">({country.count})</span></span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border/50"><div className="h-full rounded-full bg-primary-500" style={{ width: `${country.pct}%` }} /></div></div>)}</div> : <div className="mt-5 rounded-xl border border-dashed border-border bg-bg/60 p-6 text-center text-sm text-text-muted">Country distribution will appear when reviews include location data.</div>}</article></section>

    <section className="rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-text-main">Customer Reviews</h2><p className="mt-1 text-sm text-text-muted">Review feedback and response follow-up.</p></div>{unresolvedCount ? <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"><AlertTriangle className="h-3.5 w-3.5" />{unresolvedCount} need response</span> : <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />No follow-ups require attention</span>}</div><div className="mt-4 grid gap-2.5 md:grid-cols-2 2xl:grid-cols-[minmax(16rem,1.5fr)_1fr_1fr_1fr_1fr_1fr_auto]"><label className="relative"><span className="sr-only">Search reviews</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-muted" /><input className="input h-10 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reviews..." /></label><select aria-label="Review source" className="input h-10" value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option>{['Direct', 'Booking.com', 'Agoda', 'Airbnb', 'Hotels.com', 'Google', 'TripAdvisor', 'Other'].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Sentiment" className="input h-10" value={sentiment} onChange={(event) => setSentiment(event.target.value as SentimentFilter)}><option value="all">All sentiment</option><option>Positive</option><option>Neutral</option><option>Negative</option></select><select aria-label="Rating" className="input h-10" value={rating} onChange={(event) => setRating(event.target.value)}><option value="all">All ratings</option>{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} stars</option>)}</select><select aria-label="Response status" className="input h-10" value={response} onChange={(event) => setResponse(event.target.value as ResponseFilter)}><option value="all">All responses</option><option>Responded</option><option>Needs response</option></select><select aria-label="Sort reviews" className="input h-10" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>{['Newest','Oldest','Highest rating','Lowest rating','Needs response'].map((value) => <option key={value}>{value}</option>)}</select><button type="button" className="btn-ghost h-10 whitespace-nowrap" onClick={clearFilters} disabled={!hasFilters}><FilterX className="h-4 w-4" />Clear</button></div></div>
      <div className="p-4">{reviewsQuery.isLoading ? <div className="grid gap-3 md:grid-cols-2"><div className="h-44 animate-shimmer rounded-xl" /><div className="h-44 animate-shimmer rounded-xl" /></div> : filteredReviews.length ? <div className="grid gap-3 lg:grid-cols-2">{filteredReviews.map((review) => <ReviewCard key={review.id} review={review} expanded={expandedReview === review.id} canManage={canManage} onToggle={() => setExpandedReview((current) => current === review.id ? null : review.id)} />)}</div> : <div className="rounded-2xl border border-dashed border-border bg-bg/50 px-6 py-12 text-center"><MessageSquareText className="mx-auto h-9 w-9 text-text-muted" /><h3 className="mt-3 font-semibold text-text-main">{reviews.length && hasFilters ? 'No reviews match your filters.' : 'No customer reviews found.'}</h3><p className="mt-1 text-sm text-text-muted">{reviews.length && hasFilters ? 'Try clearing filters or changing the selected period.' : 'When guests leave feedback, reviews will appear here for follow-up and response tracking.'}</p>{hasFilters ? <button type="button" className="btn-outline mt-4" onClick={clearFilters}>Clear filters</button> : null}</div>}</div>
    </section>
  </div>;
}

function ReviewCard({ review, expanded, canManage, onToggle }: { review: ReviewRow; expanded: boolean; canManage: boolean; onToggle: () => void }) {
  const sentiment = sentimentFor(review.rating);
  return <article className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-sm font-bold text-primary-700">{initials(review.guest)}</span><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-text-main">{review.guest || 'Anonymous Guest'}</h3><p className="text-xs text-text-muted">Direct · {new Date(review.date).toLocaleDateString()}</p></div></div><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${sentimentTone(sentiment)}`}>{sentiment}</span></div><div className="mt-3 flex items-center justify-between"><Stars rating={review.rating} /><span className="text-sm font-bold text-text-main">{review.rating.toFixed(1)} / 5</span></div><p className={`mt-3 text-sm leading-6 text-text-muted ${expanded ? '' : 'line-clamp-3'}`}>{review.comment || 'No written comment provided.'}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${review.responded ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{review.responded ? 'Responded' : 'Needs response'}</span><div className="flex gap-2"><button type="button" className="btn-ghost h-8 px-3 text-xs" onClick={onToggle}>{expanded ? 'Hide details' : 'View review'}</button>{canManage && !review.responded ? <button type="button" className="btn-outline h-8 px-3 text-xs" disabled title="Response workflow requires the review response API"><UserRoundCheck className="h-3.5 w-3.5" />Assign response</button> : null}</div></div>{expanded ? <div className="mt-3 rounded-xl bg-bg/70 p-3 text-xs text-text-muted"><p><span className="font-semibold text-text-main">Country:</span> {review.country || 'Unknown'}</p><p className="mt-1"><span className="font-semibold text-text-main">Source:</span> Direct</p><p className="mt-1"><span className="font-semibold text-text-main">Linked guest or booking:</span> Not available</p></div> : null}</article>;
}
