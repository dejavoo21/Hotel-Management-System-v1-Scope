import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Brain, Building2, CalendarDays, ChevronDown, ChevronRight, CircleDollarSign,
  ClipboardList, FileText, Filter, History, MapPin, RefreshCw, Search, ShieldAlert,
  Sparkles, UserRound, UsersRound, Wrench, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import enterpriseSearchService, { type EnterpriseSearchResult } from '@/services/enterpriseSearch';
import { useAuthStore } from '@/stores/authStore';

const categoryOptions = [
  ['GUEST', 'Guest'], ['RESERVATION', 'Reservation'], ['ROOM', 'Room'], ['MAINTENANCE', 'Maintenance'],
  ['INCIDENT', 'Incident'], ['SECURITY', 'Security'], ['CCTV', 'CCTV'], ['SMART_BUILDING', 'Smart Building'],
  ['INVENTORY', 'Inventory'], ['FINANCIAL', 'Financial'], ['MESSAGE', 'Message'], ['REVIEW', 'Review'],
  ['USER', 'User'], ['AUDIT_LOG', 'Audit Log'], ['AI_RECOMMENDATION', 'AI Recommendation'],
] as const;

const suggestions = ['rooms not ready', 'offline cameras', 'water leak', 'VIP guest', 'open incidents', 'overdue maintenance'];
const savedDefaults = ['Open incidents - high severity', 'Maintenance - this week', 'VIP guest issues', 'Smart building alerts'];

const resultIcon = (category: string) => {
  const icons: Record<string, typeof Search> = {
    GUEST: UserRound, RESERVATION: CalendarDays, ROOM: Building2, MAINTENANCE: Wrench, INCIDENT: AlertTriangle,
    SECURITY: ShieldAlert, CCTV: ShieldAlert, SMART_BUILDING: Building2, FINANCIAL: CircleDollarSign,
    MESSAGE: FileText, REVIEW: FileText, USER: UsersRound, AUDIT_LOG: History, AI_RECOMMENDATION: Sparkles,
  };
  return icons[category] || FileText;
};

const semanticTone = (value?: string | null) => {
  const normalized = value?.toUpperCase();
  if (['CRITICAL', 'URGENT', 'HIGH'].includes(normalized || '')) return 'border-rose-200 bg-rose-50 text-rose-700';
  if (['WARNING', 'MEDIUM', 'IN_PROGRESS', 'PENDING', 'DEGRADED'].includes(normalized || '')) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (['RESOLVED', 'CLOSED', 'AVAILABLE', 'CONNECTED', 'HEALTHY', 'PAID', 'ACTIVE'].includes(normalized || '')) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['OPEN', 'NEW', 'INFO'].includes(normalized || '')) return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-[var(--laflo-border)] bg-[var(--laflo-surface-muted)] text-[var(--laflo-text-muted)]';
};

const metadataOf = (result: EnterpriseSearchResult) =>
  result.metadata && typeof result.metadata === 'object' ? result.metadata as Record<string, unknown> : {};

export default function EnterpriseSearchPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdmin = ['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(String(user?.role || '').toUpperCase());
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [severity, setSeverity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [department, setDepartment] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [selectedResult, setSelectedResult] = useState<EnterpriseSearchResult | null>(null);
  const [sort, setSort] = useState('relevance');
  const [page, setPage] = useState(1);
  const [lastIndexed, setLastIndexed] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('laflo-enterprise-recent-searches') || '[]'); } catch { return []; }
  });

  const hasSearch = Boolean(submittedQuery.trim() || selectedCategories.length || status || priority || severity || dateFrom || dateTo || department || ownerId);
  const searchParams = useMemo(() => ({
    q: submittedQuery, categories: selectedCategories, status: status || undefined, priority: priority || undefined,
    severity: severity || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
    department: department || undefined, ownerId: ownerId || undefined, limit: 50,
  }), [submittedQuery, selectedCategories, status, priority, severity, dateFrom, dateTo, department, ownerId]);

  const searchQuery = useQuery({
    queryKey: ['enterprise-search', searchParams], queryFn: () => enterpriseSearchService.search(searchParams), enabled: hasSearch,
  });
  const rebuildMutation = useMutation({
    mutationFn: enterpriseSearchService.rebuild,
    onSuccess: async (result) => { setLastIndexed(result.indexedAt); toast.success(`Search index rebuilt: ${result.indexedRecords} records`); await searchQuery.refetch(); },
    onError: () => toast.error('Search index is unavailable. Try again or contact an administrator.'),
  });
  const brainMutation = useMutation({ mutationFn: enterpriseSearchService.askHotelBrain, onError: () => toast.error('Hotel Brain insight is not available right now.') });

  const submit = (value = query) => {
    const next = value.trim(); setSubmittedQuery(next); setPage(1); setSelectedResult(null);
    if (next) {
      const recent = [next, ...recentSearches.filter((item) => item !== next)].slice(0, 6);
      setRecentSearches(recent); localStorage.setItem('laflo-enterprise-recent-searches', JSON.stringify(recent));
    }
  };
  const clearAll = () => { setSelectedCategories([]); setStatus(''); setPriority(''); setSeverity(''); setDateFrom(''); setDateTo(''); setDepartment(''); setOwnerId(''); setPage(1); };
  const chooseCategory = (category: string) => { setSelectedCategories(category ? [category] : []); setPage(1); };
  const chooseSaved = (value: string) => { setQuery(value); submit(value); };
  const askBrain = (question?: string) => brainMutation.mutate(question || query || selectedResult?.title || 'What needs attention today?');

  const data = searchQuery.data;
  const sortedResults = useMemo(() => {
    const rows = [...(data?.results || [])];
    if (sort === 'newest') rows.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    if (sort === 'oldest') rows.sort((a, b) => +new Date(a.updatedAt) - +new Date(b.updatedAt));
    return rows;
  }, [data?.results, sort]);
  const pageSize = 6;
  const pages = Math.max(1, Math.ceil(sortedResults.length / pageSize));
  const visibleResults = sortedResults.slice((page - 1) * pageSize, page * pageSize);
  const count = (category: string) => data?.results.filter((result) => result.category === category).length || 0;
  const stats = [
    { label: 'Results', value: data?.total || 0, detail: 'All sources', icon: FileText, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Incidents', value: count('INCIDENT'), detail: 'Open & closed', icon: AlertTriangle, tone: 'text-rose-700 bg-rose-50' },
    { label: 'Tasks', value: count('TASK') + count('MAINTENANCE'), detail: 'Open tasks', icon: ClipboardList, tone: 'text-amber-700 bg-amber-50' },
    { label: 'Guests', value: count('GUEST'), detail: 'Matching guests', icon: UserRound, tone: 'text-blue-700 bg-blue-50' },
    { label: 'AI recommendations', value: count('AI_RECOMMENDATION'), detail: 'Relevant insights', icon: Sparkles, tone: 'text-violet-700 bg-violet-50' },
  ];

  return (
    <div className="space-y-3 pb-24 text-[var(--laflo-text)]">
      <section className="rounded-2xl border border-[var(--laflo-border)] bg-[var(--laflo-surface)] px-5 py-4 shadow-[var(--laflo-card-shadow)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-[11px] font-bold uppercase tracking-wide text-[var(--laflo-primary)]">Operations</p><h1 className="mt-1 text-2xl font-bold">Enterprise Search</h1><p className="mt-1 max-w-2xl text-sm text-[var(--laflo-text-muted)]">Search across guests, reservations, incidents, devices, invoices, AI recommendations, and audit trails.</p>{lastIndexed && <p className="mt-2 text-xs text-[var(--laflo-text-muted)]">Index last updated: {new Date(lastIndexed).toLocaleString()}</p>}</div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && <button type="button" onClick={() => rebuildMutation.mutate()} disabled={rebuildMutation.isPending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${rebuildMutation.isPending ? 'animate-spin' : ''}`} />{rebuildMutation.isPending ? 'Rebuilding…' : 'Rebuild index'}</button>}
            <button type="button" onClick={() => askBrain()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--laflo-border)] bg-[var(--laflo-surface)] px-4 text-sm font-semibold hover:bg-[var(--laflo-surface-muted)]"><Brain className="h-4 w-4 text-[var(--laflo-primary)]" />Ask Hotel Brain</button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--laflo-border)] bg-[var(--laflo-surface)] p-2 shadow-[var(--laflo-card-shadow)]">
        <div className="flex gap-2 rounded-xl border-2 border-[var(--laflo-primary)] bg-[var(--laflo-surface)] p-1.5">
          <Search className="ml-2 h-5 w-5 self-center text-[var(--laflo-text-muted)]" />
          <input aria-label="Enterprise search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submit()} className="min-w-0 flex-1 border-0 bg-transparent px-2 text-sm outline-none ring-0" placeholder="Search guest, room, incident, camera, device, invoice, message..." />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="rounded-lg p-2 text-[var(--laflo-text-muted)] hover:bg-[var(--laflo-surface-muted)]"><X className="h-4 w-4" /></button>}
          <button type="button" onClick={() => submit()} disabled={searchQuery.isFetching} className="inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60"><Search className="h-4 w-4" />{searchQuery.isFetching ? 'Searching…' : 'Search'}</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 px-1 pb-1">
          <button type="button" onClick={() => chooseCategory('')} className={`rounded-full border px-3 py-1 text-xs font-semibold ${selectedCategories.length === 0 ? 'border-[var(--laflo-primary)] bg-[var(--laflo-primary)] text-white' : 'border-[var(--laflo-border)]'}`}>All</button>
          {categoryOptions.map(([value, label]) => <button key={value} type="button" onClick={() => chooseCategory(value)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${selectedCategories.includes(value) ? 'border-[var(--laflo-primary)] bg-[var(--laflo-primary)] text-white' : 'border-[var(--laflo-border)] text-[var(--laflo-text-muted)] hover:bg-[var(--laflo-primary-soft)]'}`}>{label}</button>)}
        </div>
      </section>

      {data && <section className="grid grid-cols-2 gap-2 md:grid-cols-5">{stats.map(({ label, value, detail, icon: Icon, tone }) => <div key={label} className="flex items-center gap-3 rounded-xl border border-[var(--laflo-border)] bg-[var(--laflo-surface)] p-3 shadow-sm"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span><div><p className="text-xs text-[var(--laflo-text-muted)]">{label}</p><p className="text-lg font-bold">{value}</p><p className="text-[10px] text-[var(--laflo-text-muted)]">{detail}</p></div></div>)}</section>}

      {!hasSearch ? (
        <section className="rounded-2xl border border-dashed border-[var(--laflo-border)] bg-[var(--laflo-surface)] px-6 py-14 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--laflo-primary-soft)] text-[var(--laflo-primary)]"><Search className="h-7 w-7" /></span><h2 className="mt-4 text-lg font-bold">Search across LaFlo</h2><p className="mt-1 text-sm text-[var(--laflo-text-muted)]">Try one of the suggested searches below or enter a room, guest, incident, device, or invoice reference.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{suggestions.map((item) => <button key={item} type="button" onClick={() => chooseSaved(item)} className="rounded-full border border-[var(--laflo-border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--laflo-primary-soft)]">{item}</button>)}</div></section>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[190px_minmax(0,1fr)_330px]">
          <aside className="space-y-3">
            <section className="overflow-hidden rounded-xl border border-[var(--laflo-border)] bg-[var(--laflo-surface)] shadow-sm"><div className="flex items-center justify-between border-b border-[var(--laflo-border)] p-3"><h2 className="flex items-center gap-2 text-sm font-bold"><Filter className="h-4 w-4" />Filters</h2><button type="button" onClick={clearAll} className="text-[10px] font-bold text-[var(--laflo-primary)]">Reset all</button></div><div className="divide-y divide-[var(--laflo-border)]">{[
              ['Status', status, setStatus, ['','OPEN','ACTIVE','IN_PROGRESS','RESOLVED','PAID']], ['Priority', priority, setPriority, ['','LOW','MEDIUM','HIGH','CRITICAL']], ['Severity', severity, setSeverity, ['','LOW','MEDIUM','HIGH','CRITICAL']], ['Department', department, setDepartment, ['','Front Desk','Housekeeping','Maintenance','Security','Finance']], ['Owner', ownerId, setOwnerId, ['','Assigned','Unassigned']],
            ].map(([label, value, setter, options]) => <label key={label as string} className="relative block px-3 py-2"><span className="text-xs font-semibold">{label as string}</span><select aria-label={label as string} value={value as string} onChange={(e) => (setter as (v:string)=>void)(e.target.value)} className="mt-1 w-full appearance-none border-0 bg-transparent p-0 pr-5 text-xs text-[var(--laflo-text-muted)] ring-0"><option value="">All</option>{(options as string[]).slice(1).map((option) => <option key={option}>{option}</option>)}</select><ChevronDown className="pointer-events-none absolute bottom-3 right-3 h-3 w-3" /></label>)}<div className="p-3"><p className="text-xs font-semibold">Date range</p><input aria-label="Date from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-2 w-full rounded-md border border-[var(--laflo-border)] bg-transparent p-1 text-[10px]" /><input aria-label="Date to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 w-full rounded-md border border-[var(--laflo-border)] bg-transparent p-1 text-[10px]" /></div></div></section>
            <section className="rounded-xl border border-[var(--laflo-border)] bg-[var(--laflo-surface)] p-3 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">Saved Searches</h2><span className="text-[10px] text-[var(--laflo-primary)]">Local</span></div><div className="mt-2 space-y-1">{[...savedDefaults, ...recentSearches.slice(0, 2)].map((item) => <button key={item} type="button" onClick={() => chooseSaved(item)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-[11px] text-[var(--laflo-text-muted)] hover:bg-[var(--laflo-surface-muted)]"><History className="h-3 w-3 shrink-0" />{item}</button>)}</div></section>
          </aside>

          <main className="min-w-0 overflow-hidden rounded-xl border border-[var(--laflo-border)] bg-[var(--laflo-surface)] shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--laflo-border)] px-3 py-2 text-xs"><span>Showing {visibleResults.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, sortedResults.length)} of {data?.total || 0} results</span><label className="flex items-center gap-2">Sort by:<select aria-label="Sort results" value={sort} onChange={(e) => setSort(e.target.value)} className="border-0 bg-transparent p-0 text-xs font-semibold ring-0"><option value="relevance">Relevance</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label></div>
            {searchQuery.isLoading ? <div className="space-y-2 p-3">{Array.from({length:6}).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--laflo-surface-muted)]" />)}</div> : searchQuery.isError ? <div className="p-10 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-rose-500" /><h2 className="mt-3 font-bold">Search could not be completed</h2><p className="mt-1 text-sm text-[var(--laflo-text-muted)]">Search index is unavailable. Rebuild the index or contact an administrator.</p></div> : !sortedResults.length ? <div className="p-10 text-center"><Search className="mx-auto h-8 w-8 text-[var(--laflo-text-muted)]" /><h2 className="mt-3 font-bold">No results found</h2><p className="mt-1 text-sm text-[var(--laflo-text-muted)]">Try adjusting your search terms, clearing filters, or searching another module.</p><div className="mt-4 flex justify-center gap-2"><button type="button" onClick={clearAll} className="rounded-lg border border-[var(--laflo-border)] px-3 py-2 text-xs font-semibold">Clear filters</button><button type="button" onClick={() => chooseCategory('')} className="rounded-lg bg-[var(--laflo-primary)] px-3 py-2 text-xs font-semibold text-white">Search all categories</button></div></div> : <div className="divide-y divide-[var(--laflo-border)]">{visibleResults.map((result) => { const Icon = resultIcon(result.category); return <button key={result.id} type="button" onClick={() => setSelectedResult(result)} className={`flex w-full gap-3 p-3 text-left transition ${selectedResult?.id === result.id ? 'bg-[var(--laflo-primary-soft)] ring-1 ring-inset ring-[var(--laflo-primary)]' : 'hover:bg-[var(--laflo-surface-muted)]'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--laflo-primary-soft)] text-[var(--laflo-primary)]"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm">{result.title}</strong>{result.severity && <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${semanticTone(result.severity)}`}>{result.severity}</span>}{result.priority && <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${semanticTone(result.priority)}`}>{result.priority}</span>}</span><span className="mt-0.5 line-clamp-1 block text-xs text-[var(--laflo-text-muted)]">{result.summary || result.snippet}</span><span className="mt-1 flex flex-wrap gap-1">{[result.category, result.sourceModule, result.roomNumber && `Room ${result.roomNumber}`].filter(Boolean).map((tag) => <span key={String(tag)} className="rounded-full bg-[var(--laflo-surface-muted)] px-2 py-0.5 text-[9px]">{String(tag).replace(/_/g, ' ')}</span>)}</span></span><span className="w-28 shrink-0 text-right text-[10px] text-[var(--laflo-text-muted)]"><span className="block">{new Date(result.updatedAt).toLocaleString()}</span><span className="mt-2 block">{result.sourceModule.replace(/_/g, ' ')}</span>{result.status && <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 font-bold ${semanticTone(result.status)}`}>{result.status}</span>}</span></button>})}</div>}
            {sortedResults.length > pageSize && <div className="flex items-center justify-center gap-2 border-t border-[var(--laflo-border)] p-3"><button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[var(--laflo-border)] px-3 py-1 text-xs disabled:opacity-40">‹</button>{Array.from({length: pages}, (_, i) => i + 1).slice(0, 5).map((item) => <button key={item} type="button" onClick={() => setPage(item)} className={`h-7 w-7 rounded-lg text-xs ${item === page ? 'bg-slate-950 text-white' : ''}`}>{item}</button>)}<button type="button" disabled={page === pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[var(--laflo-border)] px-3 py-1 text-xs disabled:opacity-40">›</button></div>}
          </main>

          <aside className="space-y-3">
            <section className="rounded-xl border border-[var(--laflo-border)] bg-[var(--laflo-surface)] p-4 shadow-sm"><h2 className="flex items-center justify-between text-sm font-bold">Preview <ChevronDown className="h-4 w-4" /></h2>{selectedResult ? <Preview result={selectedResult} onOpen={() => selectedResult.sourceUrl && navigate(selectedResult.sourceUrl)} onAsk={() => askBrain(selectedResult.title)} /> : <div className="py-12 text-center"><Search className="mx-auto h-7 w-7 text-[var(--laflo-text-muted)]" /><p className="mt-3 text-sm text-[var(--laflo-text-muted)]">Select a result to preview its source, status, severity, and route.</p></div>}</section>
            <section className="rounded-xl border border-[var(--laflo-border)] bg-[var(--laflo-surface)] p-4 shadow-sm"><h2 className="flex items-center gap-2 text-sm font-bold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--laflo-primary-soft)] text-[var(--laflo-primary)]"><Brain className="h-4 w-4" /></span>Hotel Brain Insight</h2>{brainMutation.isPending ? <div className="mt-3 h-20 animate-pulse rounded-xl bg-[var(--laflo-surface-muted)]" /> : brainMutation.data ? <div className="mt-3"><p className="text-xs leading-5 text-[var(--laflo-text-muted)]">{brainMutation.data.answer}</p><p className="mt-2 text-[10px] text-[var(--laflo-text-muted)]">Confidence {Math.round(brainMutation.data.confidence * 100)}%</p><div className="mt-3 flex flex-wrap gap-2">{brainMutation.data.suggestedActions.slice(0,2).map((action) => <button key={action.title} type="button" className="rounded-lg border border-[var(--laflo-border)] px-3 py-2 text-[10px] font-semibold">{action.title}</button>)}</div></div> : <div className="mt-3"><p className="text-xs leading-5 text-[var(--laflo-text-muted)]">Ask Hotel Brain for related patterns, similar records, suggested next actions, and risk warnings.</p><button type="button" onClick={() => askBrain()} className="mt-3 rounded-lg bg-[var(--laflo-primary)] px-3 py-2 text-xs font-semibold text-white">Ask Hotel Brain</button></div>}</section>
          </aside>
        </div>
      )}
      {data?.restrictedCount ? <p className="text-right text-[10px] text-[var(--laflo-text-muted)]">{data.restrictedCount} restricted result{data.restrictedCount === 1 ? '' : 's'} omitted by your permissions.</p> : null}
    </div>
  );
}

function Preview({ result, onOpen, onAsk }: { result: EnterpriseSearchResult; onOpen: () => void; onAsk: () => void }) {
  const Icon = resultIcon(result.category); const metadata = metadataOf(result);
  const related = Array.isArray(metadata.relatedRecords) ? metadata.relatedRecords as Array<{ id?: string; title?: string; status?: string }> : [];
  return <div className="mt-4"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--laflo-primary-soft)] text-[var(--laflo-primary)]"><Icon className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{result.title}</h3>{result.severity && <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${semanticTone(result.severity)}`}>{result.severity}</span>}</div><p className="mt-1 text-[10px] uppercase text-[var(--laflo-text-muted)]">{result.category.replace(/_/g, ' ')}</p></div></div><h4 className="mt-4 text-xs font-bold">Summary</h4><p className="mt-2 text-xs leading-5 text-[var(--laflo-text-muted)]">{result.summary || result.snippet}</p><dl className="mt-4 grid grid-cols-[76px_1fr] gap-y-2 text-[11px]"><dt className="font-semibold">Source</dt><dd>{result.sourceModule.replace(/_/g, ' ')}</dd>{(result.hotelArea || result.roomNumber) && <><dt className="font-semibold">Location</dt><dd className="flex items-center gap-1"><MapPin className="h-3 w-3" />{result.hotelArea || `Room ${result.roomNumber}`}</dd></>}<dt className="font-semibold">Updated</dt><dd>{new Date(result.updatedAt).toLocaleString()}</dd>{result.status && <><dt className="font-semibold">Status</dt><dd><span className={`rounded-full border px-2 py-0.5 font-bold ${semanticTone(result.status)}`}>{result.status}</span></dd></>}<dt className="font-semibold">Owner</dt><dd>{String(metadata.ownerName || result.ownerId || 'Unassigned')}</dd></dl>{related.length > 0 && <div className="mt-4 border-t border-[var(--laflo-border)] pt-3"><h4 className="text-xs font-bold">Related Records ({related.length})</h4>{related.slice(0,3).map((record, i) => <div key={record.id || i} className="mt-2 flex items-center justify-between text-[11px]"><span>{record.title || record.id}</span><ChevronRight className="h-3 w-3" /></div>)}</div>}<div className="mt-4 border-t border-[var(--laflo-border)] pt-3"><h4 className="text-xs font-bold">Quick Actions</h4><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" disabled={!result.sourceUrl} onClick={onOpen} className="rounded-lg bg-slate-950 px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-40">Open record</button><button type="button" onClick={onAsk} className="rounded-lg border border-[var(--laflo-border)] px-3 py-2 text-[10px] font-semibold">Ask Hotel Brain</button></div></div></div>;
}
