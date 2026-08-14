import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Brain,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Filter,
  MapPin,
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
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
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
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
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
    setFiltersOpen(false);
  };

  const chooseCategory = (category: string) => {
    setSelectedCategory(category);
    setSelectedResultId(null);
    setPage(1);
  };

  const chooseSuggestion = (value: string) => {
    setQuery(value);
    submit(value);
  };

  const askHotelBrain = (value?: string) => {
    const question = (value || submittedQuery || query || 'Review these Enterprise Search results').trim();
    navigate(`/ai/hotel-brain?question=${encodeURIComponent(question)}`);
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

  return (
    <div className="-mx-3 -mt-3 min-h-[calc(100vh-5rem)] bg-[var(--laflo-surface)] pb-24 text-[var(--laflo-text)] sm:-mx-4 lg:-mx-5">
      <header className="border-b border-[var(--laflo-border)] px-4 pb-4 pt-5 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight">Enterprise Search</h1>
        <p className="mt-1 text-sm text-[var(--laflo-text-muted)]">Search all authorised hotel records and open the source record quickly.</p>

        <form className="mt-4 flex flex-col gap-2 lg:flex-row" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <div className="flex h-11 min-w-0 flex-1 items-center rounded-lg border border-[var(--laflo-border)] bg-[var(--laflo-surface)] px-3 shadow-sm focus-within:border-[var(--laflo-primary)] focus-within:ring-2 focus-within:ring-[var(--laflo-primary-soft)]">
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
          <button type="submit" disabled={searchQuery.isFetching} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--laflo-primary)] px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-60">
            <Search className="h-4 w-4" />{searchQuery.isFetching ? 'Searching...' : 'Search'}
          </button>
          <button type="button" onClick={clearSearch} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--laflo-border)] px-4 text-sm font-semibold hover:bg-[var(--laflo-surface-muted)]">
            <X className="h-4 w-4" />Clear
          </button>
          <button type="button" onClick={() => askHotelBrain()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--laflo-primary)] px-4 text-sm font-semibold text-[var(--laflo-primary)] hover:bg-[var(--laflo-primary-soft)] lg:ml-auto">
            <Brain className="h-4 w-4" />Ask Hotel Brain
          </button>
        </form>

        <div aria-label="Search categories" className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => chooseCategory('')} className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold ${!selectedCategory ? 'border-[var(--laflo-primary)] bg-[var(--laflo-primary)] text-white' : 'border-[var(--laflo-border)] text-[var(--laflo-text-muted)] hover:bg-[var(--laflo-surface-muted)]'}`}>All</button>
          {authorisedCategories.map((category) => (
            <button key={category.value} type="button" onClick={() => chooseCategory(category.value)} className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold ${selectedCategory === category.value ? 'border-[var(--laflo-primary)] bg-[var(--laflo-primary)] text-white' : 'border-[var(--laflo-border)] text-[var(--laflo-text-muted)] hover:bg-[var(--laflo-surface-muted)]'}`}>
              {category.label}
            </button>
          ))}
        </div>
      </header>

      {!hasSearch ? (
        <section className="mx-auto flex min-h-[460px] max-w-2xl flex-col items-center justify-center px-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--laflo-primary-soft)] text-[var(--laflo-primary)]"><Search className="h-7 w-7" /></span>
          <h2 className="mt-5 text-xl font-bold">Search across LaFlo records</h2>
          <p className="mt-2 text-sm text-[var(--laflo-text-muted)]">Find authorised operational records across every connected module without opening another dashboard.</p>
          <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--laflo-text-muted)]">Suggested searches</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => chooseSuggestion(suggestion)} className="rounded-full border border-[var(--laflo-border)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--laflo-primary)] hover:bg-[var(--laflo-primary-soft)]">{suggestion}</button>)}
          </div>
        </section>
      ) : (
        <>
          <div className="relative border-b border-[var(--laflo-border)] px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" aria-expanded={filtersOpen} aria-controls="enterprise-search-filters" onClick={() => setFiltersOpen((open) => !open)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--laflo-border)] px-3 text-xs font-semibold hover:bg-[var(--laflo-surface-muted)]">
                  <Filter className="h-4 w-4" />Filters{activeFilterCount ? <span className="rounded-full bg-[var(--laflo-primary)] px-1.5 py-0.5 text-[10px] text-white">{activeFilterCount}</span> : null}<ChevronDown className={`h-3.5 w-3.5 transition ${filtersOpen ? 'rotate-180' : ''}`} />
                </button>
                {hasFilters ? <button type="button" onClick={clearFilters} className="text-xs font-semibold text-[var(--laflo-primary)]">Clear filters</button> : null}
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--laflo-text-muted)]">Sort by:<select aria-label="Sort results" value={sort} onChange={(event) => setSort(event.target.value)} className="border-0 bg-transparent p-0 text-xs font-semibold text-[var(--laflo-text)] ring-0"><option value="relevance">Relevance</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label>
            </div>

            {filtersOpen ? (
              <div id="enterprise-search-filters" className="mt-3 grid gap-3 rounded-xl border border-[var(--laflo-border)] bg-[var(--laflo-surface-muted)] p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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

          <div className="grid min-h-[540px] xl:grid-cols-[minmax(0,1fr)_400px]">
            <main className="min-w-0 border-b border-[var(--laflo-border)] xl:border-b-0 xl:border-r">
              <div className="flex items-center justify-between border-b border-[var(--laflo-border)] px-4 py-3 text-xs text-[var(--laflo-text-muted)] sm:px-6">
                <span>{searchQuery.isFetching ? 'Searching authorised records...' : `${sortedResults.length} authorised result${sortedResults.length === 1 ? '' : 's'}`}</span>
                {searchQuery.data?.generatedAt ? <span>Updated {new Date(searchQuery.data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : null}
              </div>
              {searchQuery.isLoading ? (
                <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-[var(--laflo-surface-muted)]" />)}</div>
              ) : searchQuery.isError ? (
                <div className="p-12 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-rose-500" /><h2 className="mt-3 font-bold">Search could not be completed</h2><p className="mt-1 text-sm text-[var(--laflo-text-muted)]">The search index is unavailable. Please try again shortly.</p></div>
              ) : !sortedResults.length ? (
                <div className="p-12 text-center"><Search className="mx-auto h-8 w-8 text-[var(--laflo-text-muted)]" /><h2 className="mt-3 font-bold">No authorised results found</h2><p className="mt-1 text-sm text-[var(--laflo-text-muted)]">Try another keyword, category, or clear the active filters.</p></div>
              ) : (
                <div className="divide-y divide-[var(--laflo-border)]">
                  {visibleResults.map((result) => <ResultRow key={result.id} result={result} selected={selectedResult?.id === result.id} onSelect={() => setSelectedResultId(result.id)} />)}
                </div>
              )}
              {pages > 1 ? <div className="flex items-center justify-center gap-3 border-t border-[var(--laflo-border)] p-3"><button type="button" aria-label="Previous results page" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[var(--laflo-border)] p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="text-xs font-semibold">Page {page} of {pages}</span><button type="button" aria-label="Next results page" disabled={page === pages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[var(--laflo-border)] p-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div> : null}
            </main>

            <aside className="bg-[var(--laflo-surface-muted)] p-4 sm:p-5">
              {selectedResult ? (
                <Preview
                  result={selectedResult}
                  canCreateTask={canCreateTask}
                  onOpen={() => selectedResult.sourceUrl && navigate(selectedResult.sourceUrl)}
                  onAsk={() => askHotelBrain(`Tell me more about ${selectedResult.title}`)}
                  onCreateTask={() => navigate('/operations/tasks', { state: { sourceSearchResult: selectedResult } })}
                />
              ) : (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--laflo-border)] bg-[var(--laflo-surface)] p-8 text-center"><FileText className="h-7 w-7 text-[var(--laflo-text-muted)]" /><h2 className="mt-3 text-sm font-bold">Result preview</h2><p className="mt-1 text-xs text-[var(--laflo-text-muted)]">Select an authorised record to view its context and available actions.</p></div>
              )}
            </aside>
          </div>
        </>
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
    <button type="button" onClick={onSelect} aria-pressed={selected} className={`flex w-full gap-3 px-4 py-3 text-left transition sm:px-6 ${selected ? 'bg-[var(--laflo-primary-soft)] ring-1 ring-inset ring-[var(--laflo-primary)]' : 'hover:bg-[var(--laflo-surface-muted)]'}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--laflo-primary-soft)] text-[var(--laflo-primary)]"><Icon className="h-5 w-5" /></span>
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

function Preview({ result, canCreateTask, onOpen, onAsk, onCreateTask }: { result: EnterpriseSearchResult; canCreateTask: boolean; onOpen: () => void; onAsk: () => void; onCreateTask: () => void }) {
  const Icon = resultIcon(result.category);
  const metadata = metadataOf(result);
  const related = Array.isArray(metadata.relatedRecords) ? metadata.relatedRecords as Array<{ id?: string; title?: string; status?: string }> : [];
  return (
    <section aria-label="Result preview" className="rounded-xl border border-[var(--laflo-border)] bg-[var(--laflo-surface)] shadow-sm">
      <div className="p-5">
        <div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--laflo-primary-soft)] text-[var(--laflo-primary)]"><Icon className="h-5 w-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-bold leading-5">{result.title}</h2>{result.severity ? <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${semanticTone(result.severity)}`}>{result.severity}</span> : null}</div><p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--laflo-text-muted)]">{formatLabel(result.category)}</p></div></div>
        <div className="mt-5 border-t border-[var(--laflo-border)] pt-4"><h3 className="text-xs font-bold">Summary</h3><p className="mt-2 text-xs leading-5 text-[var(--laflo-text-muted)]">{result.summary || result.snippet}</p></div>
        <dl className="mt-5 grid grid-cols-[92px_1fr] gap-y-3 text-xs"><dt className="font-semibold">Source module</dt><dd>{formatLabel(result.sourceModule)}</dd>{(result.hotelArea || result.roomNumber) ? <><dt className="font-semibold">Related location</dt><dd className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{result.hotelArea || `Room ${result.roomNumber}`}</dd></> : null}<dt className="font-semibold">Updated</dt><dd>{new Date(result.updatedAt).toLocaleString()}</dd>{result.status ? <><dt className="font-semibold">Status</dt><dd><span className={`rounded-full border px-2 py-0.5 font-bold ${semanticTone(result.status)}`}>{formatLabel(result.status)}</span></dd></> : null}{result.severity ? <><dt className="font-semibold">Severity</dt><dd>{formatLabel(result.severity)}</dd></> : null}<dt className="font-semibold">Owner</dt><dd>{String(metadata.ownerName || result.ownerId || 'Unassigned')}</dd></dl>
        {related.length ? <div className="mt-5 border-t border-[var(--laflo-border)] pt-4"><h3 className="text-xs font-bold">Related records ({related.length})</h3><div className="mt-2 space-y-2">{related.slice(0, 3).map((record, index) => <div key={record.id || index} className="flex items-center justify-between rounded-lg bg-[var(--laflo-surface-muted)] px-3 py-2 text-xs"><span>{record.title || record.id}</span>{record.status ? <span className="text-[10px] text-[var(--laflo-text-muted)]">{formatLabel(record.status)}</span> : null}</div>)}</div></div> : null}
      </div>
      <div className="border-t border-[var(--laflo-border)] p-4"><h3 className="text-xs font-bold">Quick actions</h3><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!result.sourceUrl} onClick={onOpen} className="rounded-lg bg-[var(--laflo-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Open record</button><button type="button" onClick={onAsk} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--laflo-border)] px-3 py-2 text-xs font-semibold"><Brain className="h-3.5 w-3.5" />Ask Hotel Brain</button>{canCreateTask ? <button type="button" onClick={onCreateTask} className="rounded-lg border border-[var(--laflo-border)] px-3 py-2 text-xs font-semibold">Create task</button> : null}</div></div>
    </section>
  );
}
