import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bot,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Filter,
  Lightbulb,
  MessageSquare,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import enterpriseSearchService, { type EnterpriseSearchResult } from '@/services/enterpriseSearch';
import { useAuthStore } from '@/stores/authStore';
import { canAccess, canAccessRoute } from '@/lib/access';
import type { PermissionId } from '@/utils/userAccess';
import { openLafloAssistant } from '@/lib/assistantEvents';

type CategoryOption = {
  value: string;
  label: string;
  permissions: PermissionId[];
};

const categoryOptions: CategoryOption[] = [
  { value: 'GUEST', label: 'Guests', permissions: ['guests'] },
  { value: 'RESERVATION', label: 'Bookings', permissions: ['bookings'] },
  { value: 'ROOM', label: 'Rooms', permissions: ['rooms'] },
  { value: 'INCIDENT', label: 'Incidents', permissions: ['incident_management'] },
  { value: 'MAINTENANCE', label: 'Maintenance', permissions: ['maintenance_center'] },
  { value: 'SECURITY', label: 'Security', permissions: ['security_center'] },
  { value: 'CCTV', label: 'CCTV', permissions: ['security_center'] },
  { value: 'SMART_BUILDING', label: 'Smart Building', permissions: ['smart_building'] },
  { value: 'FINANCIAL', label: 'Financial', permissions: ['financials'] },
  { value: 'MESSAGE', label: 'Messages', permissions: ['messages'] },
  { value: 'REVIEW', label: 'Reviews', permissions: ['reviews'] },
  { value: 'AUDIT_LOG', label: 'Audit Logs', permissions: ['settings'] },
  { value: 'AI_RECOMMENDATION', label: 'AI Recommendations', permissions: ['bookings'] },
];

const suggestions = ['rooms not ready', 'offline cameras', 'water leak', 'VIP guest', 'open incidents', 'overdue maintenance'];
const initialInvestigation = 'water leak basement sensor';

const resultIcon = (category: string) => {
  const icons: Record<string, typeof Search> = {
    GUEST: UserRound,
    RESERVATION: CalendarDays,
    ROOM: Building2,
    MAINTENANCE: Wrench,
    TASK: ClipboardList,
    INCIDENT: AlertTriangle,
    SECURITY: ShieldAlert,
    CCTV: ShieldAlert,
    SMART_BUILDING: Building2,
    FINANCIAL: CircleDollarSign,
    MESSAGE: MessageSquare,
    REVIEW: Star,
    AUDIT_LOG: FileText,
    AI_RECOMMENDATION: Sparkles,
  };
  return icons[category] || FileText;
};

const resultIconTone = (category: string) => {
  if (category === 'INCIDENT') return 'bg-rose-50 text-rose-600';
  if (category === 'MAINTENANCE' || category === 'TASK') return 'bg-emerald-50 text-emerald-700';
  if (category === 'SECURITY' || category === 'CCTV') return 'bg-violet-50 text-violet-600';
  if (category === 'FINANCIAL') return 'bg-green-50 text-green-700';
  if (category === 'AI_RECOMMENDATION') return 'bg-purple-50 text-purple-600';
  return 'bg-blue-50 text-blue-600';
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

const formatLabel = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function EnterpriseSearchPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [query, setQuery] = useState(initialInvestigation);
  const [submittedQuery, setSubmittedQuery] = useState(initialInvestigation);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [severity, setSeverity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [department, setDepartment] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [sourceModule, setSourceModule] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moreCategoriesOpen, setMoreCategoriesOpen] = useState(false);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [sort, setSort] = useState('relevance');
  const [page, setPage] = useState(1);

  const authorisedCategories = useMemo(
    () => categoryOptions.filter((category) => category.permissions.some((permission) => canAccess(user, permission))),
    [user],
  );
  const authorisedCategoryValues = useMemo(
    () => new Set(authorisedCategories.map((category) => category.value)),
    [authorisedCategories],
  );
  const canCreateTask = canAccessRoute(user, '/operations/tasks');
  const hasFilters = Boolean(status || priority || severity || dateFrom || dateTo || department || ownerId || sourceModule);
  const hasSearch = Boolean(submittedQuery.trim() || selectedCategory || hasFilters);

  const searchParams = useMemo(() => ({
    q: submittedQuery,
    categories: selectedCategory ? [selectedCategory] : undefined,
    sourceModules: sourceModule ? [sourceModule] : undefined,
    status: status || undefined,
    priority: priority || undefined,
    severity: severity || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    department: department || undefined,
    ownerId: ownerId || undefined,
    limit: 50,
  }), [submittedQuery, selectedCategory, sourceModule, status, priority, severity, dateFrom, dateTo, department, ownerId]);

  const searchQuery = useQuery({
    queryKey: ['enterprise-search', searchParams],
    queryFn: () => enterpriseSearchService.search(searchParams),
    enabled: hasSearch,
  });

  const submit = (value = query) => {
    setSubmittedQuery(value.trim());
    setPage(1);
    setSelectedResultId(null);
    setPreviewOpen(true);
  };

  const clearFilters = () => {
    setStatus('');
    setPriority('');
    setSeverity('');
    setDateFrom('');
    setDateTo('');
    setDepartment('');
    setOwnerId('');
    setSourceModule('');
    setPage(1);
  };

  const clearSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setSelectedCategory('');
    clearFilters();
    setSelectedResultId(null);
    setPreviewOpen(true);
    setFiltersOpen(false);
  };

  const chooseCategory = (category: string) => {
    setSelectedCategory(category);
    setSelectedResultId(null);
    setPreviewOpen(true);
    setPage(1);
  };

  const chooseSuggestion = (value: string) => {
    setQuery(value);
    submit(value);
  };

  const askLaflo = (value?: string) => {
    const question = (value || query || submittedQuery || 'Review these Enterprise Search results').trim();
    openLafloAssistant({ mode: 'operations', prompt: question });
  };

  const authorisedResults = useMemo(
    () => (searchQuery.data?.results || []).filter((result) => {
      if (result.category === 'TASK') return canAccess(user, 'maintenance_center') || canAccess(user, 'bookings');
      return authorisedCategoryValues.has(result.category);
    }),
    [authorisedCategoryValues, searchQuery.data?.results, user],
  );

  const sortedResults = useMemo(() => {
    const rows = [...authorisedResults];
    if (sort === 'newest') rows.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    if (sort === 'oldest') rows.sort((a, b) => +new Date(a.updatedAt) - +new Date(b.updatedAt));
    return rows;
  }, [authorisedResults, sort]);

  const pageSize = 7;
  const pages = Math.max(1, Math.ceil(sortedResults.length / pageSize));
  const visibleResults = sortedResults.slice((page - 1) * pageSize, page * pageSize);
  const selectedResult = sortedResults.find((result) => result.id === selectedResultId) || visibleResults[0] || null;
  const activeFilterCount = [status, priority, severity, dateFrom || dateTo, department, ownerId, sourceModule].filter(Boolean).length;
  const visibleCategories = authorisedCategories.filter((category) => !['CCTV', 'REVIEW', 'AUDIT_LOG', 'AI_RECOMMENDATION'].includes(category.value));
  const overflowCategories = authorisedCategories.filter((category) => ['CCTV', 'REVIEW', 'AUDIT_LOG', 'AI_RECOMMENDATION'].includes(category.value));
  const categoryCount = (category: string) => searchQuery.data?.groups.find((group) => group.category === category)?.count
    ?? authorisedResults.filter((result) => result.category === category).length;

  return (
    <div className="-mx-3 -mt-3 min-h-[calc(100vh-5rem)] bg-white pb-24 text-[var(--laflo-text)] sm:-mx-4 lg:-mx-5">
      <header className="border-b border-slate-200 bg-white px-4 pb-4 pt-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1328px]">
        <h1 className="text-[26px] font-bold leading-8 tracking-tight">Enterprise Search</h1>
        <p className="mt-1 text-[13px] text-[var(--laflo-text-muted)]">Search across all authorised hotel records and open the source record quickly.</p>

        <form className="mt-4 grid gap-2 lg:grid-cols-[minmax(420px,765px)_96px_92px_1fr_158px]" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <div className="flex h-11 min-w-0 items-center rounded-lg border border-slate-300 bg-white px-3 shadow-sm focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
            <Search className="h-5 w-5 shrink-0 text-[var(--laflo-text-muted)]" />
            <input
              aria-label="Enterprise search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm outline-none ring-0"
              placeholder="Search guest, room, booking, incident, device, invoice, or keyword..."
            />
            {query ? <button type="button" aria-label="Clear search text" onClick={() => setQuery('')} className="rounded-md p-1 text-[var(--laflo-text-muted)] hover:bg-[var(--laflo-surface-muted)]"><X className="h-4 w-4" /></button> : null}
          </div>
          <button type="submit" disabled={searchQuery.isFetching} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60">
            <Search className="h-4 w-4" />{searchQuery.isFetching ? 'Searching...' : 'Search'}
          </button>
          <button type="button" onClick={clearSearch} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50">
            <X className="h-4 w-4" />Clear
          </button>
          <span className="hidden lg:block" />
          <button type="button" onClick={() => askLaflo(`Investigate this Enterprise Search query using authorised hotel context: ${query || submittedQuery}`)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-700 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
            <Bot className="h-4 w-4" />Ask LaFlo
          </button>
        </form>

        <div aria-label="Search categories" className="relative mt-3 flex gap-2 overflow-visible pb-1">
          <button type="button" onClick={() => chooseCategory('')} className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold ${!selectedCategory ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 text-[var(--laflo-text-muted)] hover:bg-slate-50'}`}>All{searchQuery.data ? ` (${searchQuery.data.total})` : ''}</button>
          {visibleCategories.map((category) => (
            <button key={category.value} type="button" onClick={() => chooseCategory(category.value)} className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold ${selectedCategory === category.value ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 text-[var(--laflo-text-muted)] hover:bg-slate-50'}`}>
              {category.label}{searchQuery.data ? ` (${categoryCount(category.value)})` : ''}
            </button>
          ))}
          {overflowCategories.length ? <div className="relative"><button type="button" aria-expanded={moreCategoriesOpen} onClick={() => setMoreCategoriesOpen((open) => !open)} className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-4 py-1.5 text-xs font-semibold ${overflowCategories.some((category) => category.value === selectedCategory) ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-[var(--laflo-border)] text-[var(--laflo-text-muted)]'}`}>More<ChevronDown className="h-3.5 w-3.5" /></button>{moreCategoriesOpen ? <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-[var(--laflo-border)] bg-white p-2 shadow-xl">{overflowCategories.map((category) => <button key={category.value} type="button" onClick={() => { chooseCategory(category.value); setMoreCategoriesOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--laflo-surface-muted)]"><span>{category.label}</span>{searchQuery.data ? <span className="text-[var(--laflo-text-muted)]">{categoryCount(category.value)}</span> : null}</button>)}</div> : null}</div> : null}
        </div>
        </div>
      </header>

      {!hasSearch ? (
        <section className="mx-auto flex min-h-[560px] max-w-2xl flex-col items-center justify-center px-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--laflo-primary-soft)] text-[var(--laflo-primary)]"><Search className="h-7 w-7" /></span>
          <h2 className="mt-5 text-xl font-bold">Search across LaFlo records</h2>
          <p className="mt-2 text-sm text-[var(--laflo-text-muted)]">Find authorised operational records across every connected module without opening another dashboard.</p>
          <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--laflo-text-muted)]">Suggested searches</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => chooseSuggestion(suggestion)} className="rounded-full border border-[var(--laflo-border)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--laflo-primary)] hover:bg-[var(--laflo-primary-soft)]">{suggestion}</button>)}
          </div>
        </section>
      ) : (
        <div className="mx-auto max-w-[1328px] px-4 sm:px-6 lg:px-0">
          <div className="relative py-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" aria-expanded={filtersOpen} aria-controls="enterprise-search-filters" onClick={() => setFiltersOpen((open) => !open)} className="inline-flex h-9 items-center gap-2 rounded-lg px-1 text-xs font-semibold hover:text-[var(--laflo-primary)]">
                  <Filter className="h-4 w-4" />Filters{activeFilterCount ? <span className="rounded-full bg-emerald-700 px-1.5 py-0.5 text-[10px] text-white">{activeFilterCount}</span> : null}<ChevronDown className={`h-3.5 w-3.5 transition ${filtersOpen ? 'rotate-180' : ''}`} />
                </button>
                <span className="inline-flex h-8 items-center gap-2 rounded-full bg-slate-100 px-3 text-[11px] font-semibold text-slate-600">Date: Last 30 days <X className="h-3.5 w-3.5" /></span>
                {hasFilters ? <button type="button" onClick={clearFilters} className="text-xs font-semibold text-[var(--laflo-primary)]">Clear filters</button> : null}
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--laflo-text-muted)]">Sort by:<select aria-label="Sort results" value={sort} onChange={(event) => setSort(event.target.value)} className="border-0 bg-transparent p-0 text-xs font-semibold text-[var(--laflo-text)] ring-0"><option value="relevance">Relevance</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label>
            </div>

            {filtersOpen ? (
              <div id="enterprise-search-filters" className="absolute left-0 right-0 top-14 z-20 grid gap-3 rounded-xl border border-[var(--laflo-border)] bg-white p-4 shadow-xl sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                <CompactSelect label="Status" value={status} onChange={setStatus} options={['OPEN', 'ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'PAID']} />
                <CompactSelect label="Severity" value={severity} onChange={setSeverity} options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']} />
                <CompactSelect label="Priority" value={priority} onChange={setPriority} options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']} />
                <CompactSelect label="Department" value={department} onChange={setDepartment} options={['Front Desk', 'Housekeeping', 'Maintenance', 'Security', 'Finance']} />
                <CompactSelect label="Owner" value={ownerId} onChange={setOwnerId} options={['Assigned', 'Unassigned']} />
                <CompactSelect label="Source module" value={sourceModule} onChange={setSourceModule} options={authorisedCategories.map((category) => category.value)} />
                <div><span className="block text-[11px] font-semibold">Date range</span><div className="mt-1 flex gap-1"><input aria-label="Date from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="min-w-0 flex-1 rounded-md border border-[var(--laflo-border)] bg-[var(--laflo-surface)] p-1.5 text-[10px]" /><input aria-label="Date to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="min-w-0 flex-1 rounded-md border border-[var(--laflo-border)] bg-[var(--laflo-surface)] p-1.5 text-[10px]" /></div></div>
              </div>
            ) : null}
          </div>

          <div className="grid min-h-[570px] gap-4 xl:grid-cols-[minmax(0,1fr)_500px] xl:gap-8">
            <main className="min-w-0">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {searchQuery.isLoading ? (
                <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-[var(--laflo-surface-muted)]" />)}</div>
              ) : searchQuery.isError ? (
                <div className="p-12 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-rose-500" /><h2 className="mt-3 font-bold">Search could not be completed</h2><p className="mt-1 text-sm text-[var(--laflo-text-muted)]">The search index is unavailable. Please try again shortly.</p></div>
              ) : !sortedResults.length ? (
                <div className="p-12 text-center"><Search className="mx-auto h-8 w-8 text-[var(--laflo-text-muted)]" /><h2 className="mt-3 font-bold">No authorised results found</h2><p className="mt-1 text-sm text-[var(--laflo-text-muted)]">Try another keyword, category, or clear the active filters.</p></div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {visibleResults.map((result) => <ResultRow key={result.id} result={result} selected={selectedResult?.id === result.id && previewOpen} onSelect={() => { setSelectedResultId(result.id); setPreviewOpen(true); }} />)}
                </div>
              )}
              </div>
              <div className="flex items-center justify-center gap-2 py-5"><button type="button" aria-label="Previous results page" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>{Array.from({ length: Math.min(Math.max(pages, 5), 5) }, (_, index) => index + 1).map((item) => <button key={item} type="button" onClick={() => item <= pages && setPage(item)} disabled={item > pages} className={`h-8 w-8 rounded-lg text-xs font-semibold ${item === page ? 'bg-slate-950 text-white' : 'disabled:opacity-30'}`}>{item}</button>)}<span className="px-1 text-xs">…</span><button type="button" aria-label="Next results page" disabled={page === pages} onClick={() => setPage((current) => current + 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div>
            </main>

            <aside className="xl:-mt-8">
              {selectedResult && previewOpen ? (
                <Preview
                  result={selectedResult}
                  canCreateTask={canCreateTask}
                  onClose={() => setPreviewOpen(false)}
                  onOpen={() => selectedResult.sourceUrl && navigate(selectedResult.sourceUrl)}
                  onAsk={() => askLaflo(`Use this authorised Enterprise Search result as context. Title: ${selectedResult.title}. Type: ${formatLabel(selectedResult.category)}. Source: ${formatLabel(selectedResult.sourceModule)}. Summary: ${selectedResult.summary || selectedResult.snippet}`)}
                  onCreateTask={() => navigate('/operations/tasks', { state: { sourceSearchResult: selectedResult } })}
                />
              ) : (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--laflo-border)] bg-[var(--laflo-surface)] p-8 text-center"><FileText className="h-7 w-7 text-[var(--laflo-text-muted)]" /><h2 className="mt-3 text-sm font-bold">Result preview</h2><p className="mt-1 text-xs text-[var(--laflo-text-muted)]">Select an authorised record to view its context and available actions.</p></div>
              )}
            </aside>
          </div>
        </div>
      )}
      {searchQuery.data?.restrictedCount ? <p className="px-8 py-3 text-right text-[10px] text-[var(--laflo-text-muted)]">{searchQuery.data.restrictedCount} restricted result{searchQuery.data.restrictedCount === 1 ? '' : 's'} omitted by your permissions.</p> : null}
    </div>
  );
}

function CompactSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label><span className="block text-[11px] font-semibold">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--laflo-border)] bg-[var(--laflo-surface)] px-2 py-1.5 text-xs"><option value="">All</option>{options.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}</select></label>;
}

function ResultRow({ result, selected, onSelect }: { result: EnterpriseSearchResult; selected: boolean; onSelect: () => void }) {
  const Icon = resultIcon(result.category);
  const related = result.roomNumber ? `Room ${result.roomNumber}` : result.hotelArea;
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={`flex w-full gap-3 px-4 py-2 text-left transition sm:px-6 ${selected ? 'bg-emerald-50/50 ring-1 ring-inset ring-emerald-600' : 'hover:bg-[var(--laflo-surface-muted)]'}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${resultIconTone(result.category)}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm">{result.title}</strong>{result.severity ? <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${semanticTone(result.severity)}`}>{result.severity}</span> : null}{result.priority ? <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${semanticTone(result.priority)}`}>{result.priority}</span> : null}</span>
        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--laflo-text-muted)]">{result.summary || result.snippet}</span>
        <span className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-[var(--laflo-text-muted)]"><span className="rounded-full bg-[var(--laflo-surface-muted)] px-2 py-0.5">{formatLabel(result.category)}</span><span>{formatLabel(result.sourceModule)}</span>{related ? <><span aria-hidden="true">•</span><span>{related}</span></> : null}</span>
      </span>
      <span className="hidden w-28 shrink-0 text-right text-[10px] text-[var(--laflo-text-muted)] sm:block"><span className="block">{new Date(result.updatedAt).toLocaleString()}</span>{result.status ? <span className={`mt-2 inline-block rounded-full border px-2 py-0.5 font-bold ${semanticTone(result.status)}`}>{formatLabel(result.status)}</span> : null}</span>
      <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-[var(--laflo-text-muted)]" />
    </button>
  );
}

function Preview({ result, canCreateTask, onClose, onOpen, onAsk, onCreateTask }: { result: EnterpriseSearchResult; canCreateTask: boolean; onClose: () => void; onOpen: () => void; onAsk: () => void; onCreateTask: () => void }) {
  const Icon = resultIcon(result.category);
  const metadata = metadataOf(result);
  const related = Array.isArray(metadata.relatedRecords) ? metadata.relatedRecords as Array<{ id?: string; title?: string; status?: string }> : [];
  const [activeTab, setActiveTab] = useState<'overview' | 'related' | 'timeline' | 'insights'>('overview');
  return (
    <section aria-label="Result preview" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5 pb-0">
        <div className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><Icon className="h-6 w-6" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><h2 className="max-w-[300px] text-base font-bold leading-5">{result.title}</h2>{result.severity ? <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${semanticTone(result.severity)}`}>{result.severity}</span> : null}</div><button type="button" aria-label="Close result preview" onClick={onClose} className="rounded-md p-1 text-[var(--laflo-text-muted)] hover:bg-slate-100"><X className="h-4 w-4" /></button></div></div></div>
        <div className="mt-5 flex gap-5 border-b border-slate-200 text-[11px] font-semibold text-[var(--laflo-text-muted)]">{[
          ['overview', 'Overview'], ['related', `Related Records (${related.length})`], ['timeline', 'Timeline'], ['insights', 'AI Insights'],
        ].map(([value, label]) => <button key={value} type="button" onClick={() => setActiveTab(value as typeof activeTab)} className={`border-b-2 px-1 pb-3 ${activeTab === value ? 'border-emerald-700 text-emerald-800' : 'border-transparent'}`}>{label}</button>)}</div>
      </div>

      <div className="min-h-[230px] p-5 pt-4">
        {activeTab === 'overview' ? <><div className="grid grid-cols-[108px_1fr] gap-y-3 text-xs"><strong>Summary</strong><p className="leading-5 text-[var(--laflo-text-muted)]">{result.summary || result.snippet}</p><strong>Location</strong><span>{result.hotelArea || (result.roomNumber ? `Room ${result.roomNumber}` : 'Hotel-wide')}</span><strong>Detected</strong><span>{new Date(result.updatedAt).toLocaleString()}</span>{result.status ? <><strong>Status</strong><span className="flex items-center gap-2"><i className="h-1.5 w-1.5 rounded-full bg-rose-500" />{formatLabel(result.status)}</span></> : null}{result.severity ? <><strong>Severity</strong><span className="flex items-center gap-2"><i className="h-1.5 w-1.5 rounded-full bg-rose-500" />{formatLabel(result.severity)}</span></> : null}<strong>Owner</strong><span>{String(metadata.ownerName || result.ownerId || 'Unassigned')}</span><strong>Source</strong><span>{formatLabel(result.sourceModule)}</span></div></> : null}
        {activeTab === 'related' ? <div><h3 className="text-xs font-bold">Related records</h3>{related.length ? <div className="mt-3 space-y-2">{related.map((record, index) => <div key={record.id || index} className="flex items-center justify-between rounded-lg border border-[var(--laflo-border)] px-3 py-2 text-xs"><span>{record.title || record.id}</span><ChevronRight className="h-3.5 w-3.5" /></div>)}</div> : <p className="mt-3 text-xs text-[var(--laflo-text-muted)]">No related authorised records are available.</p>}</div> : null}
        {activeTab === 'timeline' ? <div className="space-y-4 text-xs"><div className="border-l-2 border-[var(--laflo-primary)] pl-3"><strong>Record updated</strong><p className="mt-1 text-[var(--laflo-text-muted)]">{new Date(result.updatedAt).toLocaleString()}</p></div><div className="border-l-2 border-slate-200 pl-3"><strong>Indexed in Enterprise Search</strong><p className="mt-1 text-[var(--laflo-text-muted)]">{new Date(result.indexedAt).toLocaleString()}</p></div></div> : null}
        {activeTab === 'insights' ? <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-blue-800"><Lightbulb className="h-4 w-4" />AI evidence insight</div><p className="mt-2 text-xs leading-5 text-blue-700">Ask LaFlo to analyse this record with authorised context. Powered by Hotel Brain.</p><button type="button" onClick={onAsk} className="mt-3 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800">Ask LaFlo about this result</button></div> : null}
      </div>

      <div className="border-t border-slate-200 p-5"><h3 className="text-xs font-bold">Quick Actions</h3><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" disabled={!result.sourceUrl} onClick={onOpen} className="rounded-lg bg-emerald-700 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-40">Open record</button><button type="button" onClick={onAsk} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2.5 text-xs font-semibold"><Bot className="h-3.5 w-3.5" />Ask LaFlo</button>{canCreateTask ? <button type="button" onClick={onCreateTask} className="rounded-lg border border-slate-300 px-3 py-2.5 text-xs font-semibold">+ Create task</button> : <span />}</div></div>
      <div className="m-5 mt-0 rounded-xl border border-blue-100 bg-blue-50 p-4"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 text-blue-600" /><div><h3 className="text-xs font-bold text-blue-800">What’s next?</h3><p className="mt-1 text-[11px] leading-5 text-blue-700">Ask LaFlo for root-cause analysis or recommended actions using this evidence.</p><button type="button" onClick={onAsk} className="mt-2 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-blue-800">Ask LaFlo about this</button></div></div></div>
    </section>
  );
}
