import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Bot,
  Bookmark,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Droplets,
  ExternalLink,
  FileSearch,
  FileText,
  Filter,
  Grid2X2,
  ListFilter,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  ShieldAlert,
  SlidersHorizontal,
  SpellCheck2,
  Sparkles,
  Star,
  UserPlus,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import enterpriseSearchService, { type EnterpriseSearchResult } from '@/services/enterpriseSearch';
import { useAuthStore } from '@/stores/authStore';
import { canAccess, canAccessRoute } from '@/lib/access';
import type { PermissionId } from '@/utils/userAccess';
import { openLafloAssistant } from '@/lib/assistantEvents';

type CategoryOption = { value: string; label: string; permissions: PermissionId[] };

const categoryOptions: CategoryOption[] = [
  { value: 'GUEST', label: 'Guest', permissions: ['guests'] },
  { value: 'RESERVATION', label: 'Reservation', permissions: ['bookings'] },
  { value: 'ROOM', label: 'Room', permissions: ['rooms'] },
  { value: 'MAINTENANCE', label: 'Maintenance', permissions: ['maintenance_center'] },
  { value: 'INCIDENT', label: 'Incident', permissions: ['incident_management'] },
  { value: 'SECURITY', label: 'Security', permissions: ['security_center'] },
  { value: 'CCTV', label: 'CCTV', permissions: ['security_center'] },
  { value: 'SMART_BUILDING', label: 'Smart Building', permissions: ['smart_building'] },
  { value: 'INVENTORY', label: 'Inventory', permissions: ['inventory'] },
  { value: 'FINANCIAL', label: 'Financial', permissions: ['financials'] },
  { value: 'MESSAGE', label: 'Message', permissions: ['messages'] },
  { value: 'REVIEW', label: 'Review', permissions: ['reviews'] },
  { value: 'USER', label: 'User', permissions: ['settings'] },
  { value: 'AUDIT_LOG', label: 'Audit Log', permissions: ['settings'] },
  { value: 'AI_RECOMMENDATION', label: 'AI Recommendation', permissions: ['bookings'] },
];

const initialInvestigation = 'water leak basement sensor';
const savedSearches = [
  { label: 'Open incidents - high severity', query: 'open high severity incidents' },
  { label: 'Maintenance - this week', query: 'maintenance this week' },
  { label: 'VIP guest issues', query: 'VIP guest issues' },
  { label: 'Smart building alerts', query: 'smart building alerts' },
];

const resultIcon = (category: string) => {
  const icons: Record<string, typeof Search> = {
    GUEST: UserRound, RESERVATION: CalendarDays, ROOM: Building2, MAINTENANCE: Wrench,
    TASK: ClipboardList, INCIDENT: Droplets, SECURITY: ShieldAlert, CCTV: ShieldAlert,
    SMART_BUILDING: Building2, FINANCIAL: FileText, MESSAGE: MessageSquare, REVIEW: Star,
    AUDIT_LOG: FileText, AI_RECOMMENDATION: Sparkles,
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
  if (['CRITICAL', 'URGENT'].includes(normalized || '')) return 'bg-rose-100 text-rose-600';
  if (normalized === 'HIGH') return 'bg-amber-100 text-amber-700';
  if (['WARNING', 'MEDIUM', 'IN_PROGRESS', 'PENDING', 'DEGRADED'].includes(normalized || '')) return 'bg-amber-50 text-amber-600';
  if (['RESOLVED', 'CLOSED', 'AVAILABLE', 'CONNECTED', 'HEALTHY', 'PAID', 'ACTIVE'].includes(normalized || '')) return 'bg-emerald-50 text-emerald-700';
  if (['OPEN', 'NEW', 'INFO'].includes(normalized || '')) return 'bg-blue-50 text-blue-700';
  return 'bg-border/50 text-text-muted';
};

const metadataOf = (result: EnterpriseSearchResult) =>
  result.metadata && typeof result.metadata === 'object' ? result.metadata as Record<string, unknown> : {};

const formatLabel = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function EnterpriseSearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const [sourceModule, setSourceModule] = useState('');
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [sort, setSort] = useState('relevance');
  const [page, setPage] = useState(1);
  const [collapsedFilters, setCollapsedFilters] = useState<string[]>(['Status', 'Priority', 'Severity', 'Date Range', 'Department', 'Source Type']);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [savedSearchesOpen, setSavedSearchesOpen] = useState(false);
  const [cleared, setCleared] = useState(false);

  const authorisedCategories = useMemo(
    () => categoryOptions.filter((category) => category.permissions.some((permission) => canAccess(user, permission))),
    [user],
  );
  const authorisedCategoryValues = useMemo(() => new Set(authorisedCategories.map((category) => category.value)), [authorisedCategories]);
  const canCreateTask = canAccessRoute(user, '/operations/tasks-advisories');
  const canRebuildIndex = user?.role === 'ADMIN';

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
    limit: 100,
  }), [submittedQuery, selectedCategory, sourceModule, status, priority, severity, dateFrom, dateTo, department]);

  const searchQuery = useQuery({
    queryKey: ['enterprise-search', searchParams],
    queryFn: () => enterpriseSearchService.search(searchParams),
    enabled: !cleared,
  });

  const rebuildMutation = useMutation({
    mutationFn: () => enterpriseSearchService.rebuild(),
    onSuccess: () => { toast.success('Search index rebuilt'); void queryClient.invalidateQueries({ queryKey: ['enterprise-search'] }); },
    onError: () => toast.error('Index rebuild failed'),
  });

  const submit = (value = query) => {
    setCleared(false);
    setQuery(value);
    setSubmittedQuery(value.trim());
    setPage(1);
    setSelectedResultId(null);
  };
  const askLaflo = (prompt: string) => openLafloAssistant({ mode: 'operations', prompt });
  const authorisedResults = useMemo(() => {
    if (cleared) return [];
    const auditRequested = selectedCategory === 'AUDIT_LOG' || /\baudit\b/i.test(submittedQuery);
    const unique = new Map<string, EnterpriseSearchResult>();
    (searchQuery.data?.results || []).forEach((result) => {
      const authorised = result.category === 'TASK'
        ? canAccess(user, 'maintenance_center') || canAccess(user, 'bookings')
        : authorisedCategoryValues.has(result.category);
      if (!authorised || (result.category === 'AUDIT_LOG' && !auditRequested)) return;
      const stableKey = `${result.sourceModule}:${result.entityId || result.id}:${result.category}`;
      if (!unique.has(stableKey)) unique.set(stableKey, result);
    });
    return [...unique.values()];
  }, [authorisedCategoryValues, cleared, searchQuery.data?.results, selectedCategory, submittedQuery, user]);

  const sortedResults = useMemo(() => {
    const rows = [...authorisedResults];
    if (sort === 'newest') rows.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    if (sort === 'oldest') rows.sort((a, b) => +new Date(a.updatedAt) - +new Date(b.updatedAt));
    if (sort === 'relevance') rows.sort((a, b) => Number(a.category === 'AUDIT_LOG') - Number(b.category === 'AUDIT_LOG'));
    return rows;
  }, [authorisedResults, sort]);

  const pageSize = 6;
  const pages = Math.ceil(sortedResults.length / pageSize);
  const visibleResults = sortedResults.slice((page - 1) * pageSize, page * pageSize);
  const selectedResult = sortedResults.find((result) => result.id === selectedResultId) || null;
  const count = (values: string[]) => authorisedResults.filter((result) => values.includes(result.category)).length;
  const displayTotal = authorisedResults.length;

  const appliedFilters = [
    status ? { label: `Status: ${formatLabel(status)}`, clear: () => setStatus('') } : null,
    priority ? { label: `Priority: ${formatLabel(priority)}`, clear: () => setPriority('') } : null,
    severity ? { label: `Severity: ${formatLabel(severity)}`, clear: () => setSeverity('') } : null,
    department ? { label: `Department: ${department}`, clear: () => setDepartment('') } : null,
    sourceModule ? { label: `Source: ${formatLabel(sourceModule)}`, clear: () => setSourceModule('') } : null,
    dateFrom || dateTo ? { label: 'Date range applied', clear: () => { setDateFrom(''); setDateTo(''); } } : null,
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>;

  const resetFilters = () => {
    setStatus('');
    setPriority('');
    setSeverity('');
    setDateFrom('');
    setDateTo('');
    setDepartment('');
    setSourceModule('');
  };

  const chooseSavedSearch = (value: string) => { submit(value); setSavedSearchesOpen(false); };
  const clearSearch = () => { setQuery(''); setSubmittedQuery(''); setSelectedCategory(''); setSelectedResultId(null); setPage(1); setCleared(true); resetFilters(); };
  const toggleFilter = (label: string) => setCollapsedFilters((current) => current.includes(label)
    ? current.filter((item) => item !== label)
    : [...current, label]);

  const filtersPanel = (
    <>
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-3 py-3"><h2 className="text-xs font-bold">Filters</h2><button type="button" onClick={resetFilters} className="text-[9px] font-semibold text-primary-700">Reset all</button></div>
        <FilterSection label="Status" icon={ListFilter} open={!collapsedFilters.includes('Status')} onToggle={() => toggleFilter('Status')}><Select value={status} onChange={setStatus} options={['OPEN', 'ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'PAID']} /></FilterSection>
        <FilterSection label="Priority" icon={Filter} open={!collapsedFilters.includes('Priority')} onToggle={() => toggleFilter('Priority')}><Select value={priority} onChange={setPriority} options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']} /></FilterSection>
        <FilterSection label="Severity" icon={ShieldAlert} open={!collapsedFilters.includes('Severity')} onToggle={() => toggleFilter('Severity')}><Select value={severity} onChange={setSeverity} options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']} /></FilterSection>
        <FilterSection label="Date Range" icon={CalendarDays} open={!collapsedFilters.includes('Date Range')} onToggle={() => toggleFilter('Date Range')}><div className="grid gap-1"><input aria-label="Date from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full rounded-md border border-border bg-card p-1 text-[9px]" /><input aria-label="Date to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-full rounded-md border border-border bg-card p-1 text-[9px]" /></div></FilterSection>
        <FilterSection label="Department" icon={UserRound} open={!collapsedFilters.includes('Department')} onToggle={() => toggleFilter('Department')}><Select value={department} onChange={setDepartment} options={['Front Desk', 'Housekeeping', 'Maintenance', 'Security', 'Finance']} /></FilterSection>
        <FilterSection label="Source Type" icon={Building2} open={!collapsedFilters.includes('Source Type')} onToggle={() => toggleFilter('Source Type')}><Select value={sourceModule} onChange={setSourceModule} options={authorisedCategories.map((category) => category.value)} /></FilterSection>
      </section>
      <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="text-xs font-bold">Saved Searches</h2><button type="button" onClick={() => setSavedSearchesOpen(true)} className="text-[9px] font-semibold text-primary-700">View all</button></div>
        <div className="mt-3 space-y-3">{savedSearches.map((saved) => <button key={saved.label} type="button" onClick={() => chooseSavedSearch(saved.query)} className="flex w-full items-start gap-2 text-left text-[10px] leading-4 text-text-muted hover:text-primary-700"><Bookmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />{saved.label}</button>)}</div>
      </section>
    </>
  );

  const previewContent = selectedResult
    ? <Preview result={selectedResult} canCreateTask={canCreateTask} onOpen={() => selectedResult.sourceUrl && navigate(selectedResult.sourceUrl)} onAsk={() => askLaflo(`Use this authorised Enterprise Search result as context. Title: ${selectedResult.title}. Type: ${formatLabel(selectedResult.category)}. Source: ${formatLabel(selectedResult.sourceModule)}. Summary: ${selectedResult.summary || selectedResult.snippet}`)} onAssign={() => navigate('/operations/tasks-advisories', { state: { sourceSearchResult: selectedResult, requestedAction: 'assign' } })} onCreateTask={() => navigate('/operations/tasks-advisories', { state: { sourceSearchResult: selectedResult, requestedAction: 'create' } })} />
    : <EmptyPreview />;

  return (
    <div className="-mx-3 -mt-3 min-h-[calc(100vh-5rem)] bg-bg px-3 pb-20 pt-3 text-text-main sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5">
      <div className="mx-auto max-w-[1740px]">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-5">
          <header className="flex min-h-[102px] flex-col justify-center gap-4 px-1 sm:flex-row sm:items-center sm:justify-between xl:col-span-2">
            <div><h1 className="text-[24px] font-bold leading-none tracking-tight">Enterprise Search</h1><p className="mt-2 max-w-[520px] text-xs leading-5 text-text-muted">Search across authorised hotel records and open the source record quickly.</p></div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {canRebuildIndex ? <button type="button" onClick={() => rebuildMutation.mutate()} disabled={rebuildMutation.isPending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary-950 px-5 text-xs font-semibold text-primary-contrast shadow-sm hover:bg-primary-900 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${rebuildMutation.isPending ? 'animate-spin' : ''}`} />{rebuildMutation.isPending ? 'Rebuilding...' : 'Rebuild Index'}</button> : null}
              <button type="button" onClick={() => askLaflo(`Investigate this Enterprise Search query using authorised hotel context: ${query || submittedQuery}`)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-5 text-xs font-semibold hover:bg-bg"><Bot className="h-4 w-4 text-primary-700" />Ask LaFlo</button>
              {rebuildMutation.isSuccess ? <span role="status" className="w-full text-right text-[10px] font-semibold text-success">Index updated successfully.</span> : null}
              {rebuildMutation.isError ? <span role="alert" className="w-full text-right text-[10px] font-semibold text-danger">Index rebuild failed. Try again.</span> : null}
            </div>
          </header>
          <div className="min-w-0">
            <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="rounded-xl border border-border bg-card p-1.5 shadow-sm">
              <div className="flex h-12 items-center rounded-lg border border-border bg-card px-4 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-100">
                <Search className="h-5 w-5 shrink-0 text-text-muted" />
                <input id="enterprise-search-input" aria-label="Enterprise search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent px-4 text-sm font-semibold outline-none ring-0" placeholder="Search guest, room, booking, incident, device, invoice, or keyword..." />
                {query ? <button type="button" aria-label="Clear search and results" onClick={clearSearch} className="rounded-md p-1 text-text-muted hover:bg-primary-50"><X className="h-4 w-4" /></button> : null}
                <button type="submit" className="ml-4 inline-flex h-10 w-28 items-center justify-center gap-2 rounded-lg bg-primary-950 text-xs font-semibold text-primary-contrast hover:bg-primary-900"><Search className="h-4 w-4" />Search</button>
              </div>
              <div aria-label="Search categories" className="flex flex-wrap gap-2 px-1 pb-0.5 pt-2">
                <CategoryChip active={!selectedCategory} onClick={() => setSelectedCategory('')}>All</CategoryChip>
                {authorisedCategories.map((category) => <Fragment key={category.value}>{category.value === 'REVIEW' ? <span aria-hidden="true" className="h-0 basis-full" /> : null}<CategoryChip active={selectedCategory === category.value} onClick={() => { setSelectedCategory(category.value); setPage(1); }}>{category.label}</CategoryChip></Fragment>)}
              </div>
              {appliedFilters.length ? <div aria-label="Applied filters" className="flex flex-wrap gap-2 border-t border-border px-2 py-2">{appliedFilters.map((filterChip) => <button key={filterChip.label} type="button" onClick={filterChip.clear} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[9px] font-semibold text-primary-800">{filterChip.label}<X className="h-3 w-3" /></button>)}</div> : null}
            </form>

            <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard icon={FileText} tone="emerald" label="Results" value={displayTotal} note="All sources" onClick={() => setSelectedCategory('')} />
              <MetricCard icon={Droplets} tone="rose" label="Incidents" value={count(['INCIDENT'])} note="Critical" onClick={() => setSelectedCategory('INCIDENT')} />
              <MetricCard icon={ClipboardList} tone="amber" label="Tasks" value={count(['TASK', 'MAINTENANCE'])} note="Open tasks" onClick={() => setSelectedCategory('MAINTENANCE')} />
              <MetricCard icon={UserRound} tone="blue" label="Guests" value={count(['GUEST'])} note="Matching guests" onClick={() => setSelectedCategory('GUEST')} />
              <MetricCard icon={Sparkles} tone="violet" label="AI recommendations" value={count(['AI_RECOMMENDATION'])} note="Best insights" onClick={() => setSelectedCategory('AI_RECOMMENDATION')} />
            </section>

            <div className="mt-3 flex items-center gap-2 xl:hidden">
              <button type="button" onClick={() => setMobileFiltersOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold lg:hidden"><SlidersHorizontal className="h-4 w-4" />Filters{appliedFilters.length ? ` (${appliedFilters.length})` : ''}</button>
              <button type="button" onClick={() => setMobilePreviewOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold"><FileSearch className="h-4 w-4" />Preview</button>
            </div>

            <div className="mt-3 grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
              <aside className="hidden space-y-3 lg:block">{filtersPanel}</aside>

              <main className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-[10px]"><strong>Showing {sortedResults.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, sortedResults.length)}` : '0'} of {displayTotal} results</strong><label className="flex items-center gap-1">Sort by:<select aria-label="Sort results" value={sort} onChange={(event) => setSort(event.target.value)} className="border-0 bg-transparent p-0 text-[10px] font-semibold text-text-main ring-0"><option value="relevance">Relevance</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select><ChevronDown className="h-3 w-3" /></label></div>
                {cleared ? <SearchStartState /> : searchQuery.isLoading ? <div className="space-y-2 p-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[68px] animate-pulse rounded-lg bg-primary-50" />)}</div> : searchQuery.isError ? <EmptyState mode="error" canRebuild={canRebuildIndex} onBroaden={() => submit(query.split(/\s+/).slice(0, 2).join(' '))} onAdjust={() => setMobileFiltersOpen(true)} onClear={resetFilters} onSearchAll={() => setSelectedCategory('')} onRebuild={() => rebuildMutation.mutate()} /> : !visibleResults.length ? <EmptyState mode="empty" canRebuild={canRebuildIndex} onBroaden={() => submit(query.split(/\s+/).slice(0, 2).join(' '))} onAdjust={() => setMobileFiltersOpen(true)} onClear={resetFilters} onSearchAll={() => { setSelectedCategory(''); submit(query); }} onRebuild={() => rebuildMutation.mutate()} /> : <div className="divide-y divide-border">{visibleResults.map((result) => <ResultRow key={result.id} result={result} selected={selectedResult?.id === result.id} onSelect={() => setSelectedResultId(result.id)} />)}</div>}
                {pages > 1 ? <Pagination page={page} pages={pages} onChange={setPage} /> : null}
              </main>
            </div>
          </div>

          <aside className="hidden space-y-3 xl:block">
            <div className="[&>section]:flex [&>section]:min-h-[440px] [&>section]:flex-col">
              {previewContent}
            </div>
            <section className="rounded-xl border border-primary-100 bg-primary-50/40 p-5 shadow-sm">
              <div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-xs font-bold"><Sparkles className="h-4 w-4 text-primary-700" />AI Insight</h2><p className="mt-1 text-[9px] text-text-muted">Evidence-backed insight from authorised context.</p></div><ChevronUp className="h-4 w-4 text-text-muted" /></div>
              <p className="mt-4 text-[11px] leading-5 text-text-main">{selectedResult ? 'This record matches similar authorised events. Consider reviewing the related systems and creating a preventive follow-up task.' : 'Select a result to generate an evidence-backed operational insight.'}</p>
              <p className="mt-2 text-[9px] font-semibold text-emerald-700">Powered by Hotel Brain · Permission-filtered context</p>
              <div className="mt-4 flex gap-2">{canCreateTask ? <button type="button" disabled={!selectedResult} onClick={() => selectedResult && navigate('/operations/tasks-advisories', { state: { sourceSearchResult: selectedResult, requestedAction: 'create' } })} className="rounded-lg bg-primary-700 px-4 py-2 text-[10px] font-semibold text-primary-contrast disabled:opacity-40">Create task</button> : null}<button type="button" disabled={!selectedResult} onClick={() => selectedResult && askLaflo(`Show records similar to ${selectedResult.title}`)} className="rounded-lg border border-border bg-card px-4 py-2 text-[10px] font-semibold disabled:opacity-40">Show similar records</button></div>
            </section>
          </aside>
        </div>
        <MobileDrawer open={mobileFiltersOpen} title="Search filters" onClose={() => setMobileFiltersOpen(false)}><div className="space-y-3">{filtersPanel}</div></MobileDrawer>
        <MobileDrawer open={mobilePreviewOpen} title="Result preview" onClose={() => setMobilePreviewOpen(false)}>{previewContent}</MobileDrawer>
        <MobileDrawer open={savedSearchesOpen} title="Saved searches (local)" onClose={() => setSavedSearchesOpen(false)}><div className="space-y-2">{savedSearches.map((saved) => <button key={saved.label} type="button" onClick={() => chooseSavedSearch(saved.query)} className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left text-xs font-semibold">{saved.label}<ChevronRight className="h-4 w-4" /></button>)}</div></MobileDrawer>
      </div>
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-full border px-3.5 py-1.5 text-[10px] font-semibold transition ${active ? 'border-primary-700 bg-primary-700 text-primary-contrast' : 'border-border bg-card text-text-muted hover:border-primary-600 hover:text-primary-700'}`}>{children}</button>;
}

function MetricCard({ icon: Icon, tone, label, value, note, onClick }: { icon: typeof Search; tone: string; label: string; value: number; note: string; onClick: () => void }) {
  const tones: Record<string, string> = { emerald: 'bg-emerald-50 text-emerald-700', rose: 'bg-rose-50 text-rose-600', amber: 'bg-amber-50 text-amber-600', blue: 'bg-blue-50 text-blue-600', violet: 'bg-violet-50 text-violet-600' };
  return <button type="button" onClick={onClick} className="flex h-[86px] items-center gap-3 rounded-xl border border-border bg-card px-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-6 w-6" /></span><div><p className="text-[10px] text-text-muted">{label}</p><strong className="block text-xl leading-6">{value}</strong><p className="text-[10px] text-text-muted">{note}</p></div></button>;
}

function SearchStartState() { return <div className="flex min-h-[365px] flex-col items-center justify-center px-5 text-center"><span className="grid h-20 w-20 place-items-center rounded-full bg-primary-50 text-primary-800"><Search className="h-9 w-9" /></span><h2 className="mt-4 text-base font-bold">Search across LaFlo records</h2><p className="mt-2 text-xs text-text-muted">Enter a guest, room, booking, incident, device, invoice, or keyword to begin.</p></div>; }

function FilterSection({ label, icon: Icon, open, onToggle, children }: { label: string; icon: typeof Search; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className="border-b border-border last:border-0"><button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-3 text-[10px] font-semibold"><Icon className="h-3.5 w-3.5 text-text-muted" /><span className="flex-1 text-left">{label}</span>{open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</button>{open ? <div className="px-3 pb-3">{children}</div> : null}</div>;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return <select aria-label="Filter option" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-border bg-card px-2 py-1 text-[9px] text-text-main"><option value="">All</option>{options.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}</select>;
}

function EmptyState({ mode, canRebuild, onBroaden, onAdjust, onClear, onSearchAll, onRebuild }: { mode: 'empty' | 'error'; canRebuild: boolean; onBroaden: () => void; onAdjust: () => void; onClear: () => void; onSearchAll: () => void; onRebuild: () => void }) {
  const isError = mode === 'error';
  return <div className="flex min-h-[365px] flex-col items-center justify-center px-5 py-8 text-center">
    <span className={`grid h-24 w-24 place-items-center rounded-full ${isError ? 'bg-rose-50 text-rose-600' : 'bg-primary-50 text-primary-900'}`}>{isError ? <AlertTriangle className="h-11 w-11" /> : <SearchX className="h-12 w-12" />}</span>
    <h2 className="mt-4 text-base font-bold">{isError ? 'Search could not be completed' : 'No authorised results found'}</h2>
    <p className="mt-2 max-w-lg text-xs leading-5 text-text-muted">{isError ? 'The search index is unavailable. Try again shortly or ask an administrator to rebuild the index.' : 'We could not find results for this search. Try refining your keyword, clearing filters, or searching another category.'}</p>
    <div className="mt-5 grid w-full max-w-[620px] gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <button type="button" onClick={() => document.getElementById('enterprise-search-input')?.focus()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-[10px] font-semibold hover:border-primary-400"><SpellCheck2 className="h-4 w-4 text-primary-700" />Check spelling</button>
      <button type="button" onClick={onBroaden} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-[10px] font-semibold hover:border-primary-400"><Search className="h-4 w-4 text-primary-700" />Try broader terms</button>
      <button type="button" onClick={() => { onClear(); onAdjust(); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-[10px] font-semibold hover:border-primary-400"><SlidersHorizontal className="h-4 w-4 text-primary-700" />Adjust filters</button>
      <button type="button" onClick={onSearchAll} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-[10px] font-semibold hover:border-primary-400"><Grid2X2 className="h-4 w-4 text-primary-700" />Search all categories</button>
    </div>
    {canRebuild ? <button type="button" onClick={onRebuild} className="mt-3 inline-flex items-center gap-2 text-[10px] font-semibold text-primary-700"><RefreshCw className="h-3.5 w-3.5" />Rebuild index</button> : null}
  </div>;
}

function ResultRow({ result, selected, onSelect }: { result: EnterpriseSearchResult; selected: boolean; onSelect: () => void }) {
  const Icon = resultIcon(result.category);
  const related = result.roomNumber ? `Room ${result.roomNumber}` : result.hotelArea;
  return <button type="button" onClick={onSelect} aria-pressed={selected} className={`flex min-h-[79px] w-full gap-3 px-3 py-3 text-left transition ${selected ? 'bg-primary-50/60 ring-1 ring-inset ring-primary-600' : 'hover:bg-primary-50/40'}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${resultIconTone(result.category)}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="truncate text-xs">{result.title}</strong>{result.severity ? <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${semanticTone(result.severity)}`}>{result.severity}</span> : null}</span><span className="mt-1 line-clamp-1 block text-[11px] text-text-muted">{result.summary || result.snippet}</span><span className="mt-1.5 flex flex-wrap gap-1.5 text-[9px] text-text-muted"><span className="rounded-full bg-primary-50 px-2 py-0.5">{formatLabel(result.category)}</span><span className="rounded-full bg-primary-50 px-2 py-0.5">{formatLabel(result.sourceModule)}</span>{related ? <span className="rounded-full bg-primary-50 px-2 py-0.5">{related}</span> : null}</span></span><span className="hidden w-32 shrink-0 text-[9px] text-text-muted md:block"><span className="block">{new Date(result.updatedAt).toLocaleString()}</span><span className="mt-1 block">{formatLabel(result.sourceModule)}</span>{result.status ? <span className={`mt-1 inline-block rounded-full px-2 py-0.5 font-bold ${semanticTone(result.status)}`}>{formatLabel(result.status)}</span> : null}</span></button>;
}

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  return <div className="flex items-center justify-center gap-2 border-t border-border py-4"><button type="button" aria-label="Previous results page" disabled={page === 1} onClick={() => onChange(page - 1)} className="grid h-7 w-7 place-items-center rounded-md bg-primary-50 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button>{Array.from({ length: Math.min(5, pages) }, (_, index) => index + 1).map((item) => <button key={item} type="button" onClick={() => onChange(item)} className={`h-7 w-7 rounded-md text-[10px] font-semibold ${item === page ? 'bg-primary-950 text-primary-contrast' : ''}`}>{item}</button>)}<button type="button" aria-label="Next results page" disabled={page === pages} onClick={() => onChange(page + 1)} className="grid h-7 w-7 place-items-center rounded-md bg-primary-50 disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button></div>;
}

function EmptyPreview() {
  return <section aria-label="Result preview" className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="flex items-center gap-3 border-b border-border px-4 py-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-50 text-primary-700"><FileText className="h-4 w-4" /></span><h2 className="text-xs font-bold">Result preview</h2></div><div className="flex min-h-[370px] flex-col items-center justify-center px-8 py-10 text-center"><span className="grid h-20 w-20 place-items-center rounded-full bg-primary-50 text-primary-800"><FileSearch className="h-10 w-10" /></span><h3 className="mt-5 text-sm font-bold">No result selected</h3><p className="mt-2 max-w-[260px] text-xs leading-5 text-text-muted">Select an authorised record to view its context, related records, and available actions.</p></div></section>;
}

function MobileDrawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[70]" role="presentation"><button type="button" aria-label={`Close ${title}`} onClick={onClose} className="absolute inset-0 bg-text-main/35" /><section role="dialog" aria-modal="true" aria-label={title} className="absolute bottom-0 right-0 top-0 w-[min(92vw,380px)] overflow-y-auto border-l border-border bg-bg p-4 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold">{title}</h2><button type="button" onClick={onClose} className="rounded-lg border border-border bg-card p-2" aria-label={`Close ${title}`}><X className="h-4 w-4" /></button></div>{children}</section></div>;
}

function Preview({ result, canCreateTask, onOpen, onAsk, onAssign, onCreateTask }: { result: EnterpriseSearchResult; canCreateTask: boolean; onOpen: () => void; onAsk: () => void; onAssign: () => void; onCreateTask: () => void }) {
  const Icon = resultIcon(result.category);
  const metadata = metadataOf(result);
  const related = Array.isArray(metadata.relatedRecords) ? metadata.relatedRecords as Array<{ id?: string; title?: string; status?: string }> : [];
  return <section aria-label="Result preview" className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-[10px] font-bold">Preview</h2><ChevronUp className="h-4 w-4 text-text-muted" /></div><div className="mt-4 flex items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${resultIconTone(result.category)}`}><Icon className="h-5 w-5" /></span><div className="flex flex-wrap items-center gap-2"><h3 className="max-w-[230px] text-sm font-bold leading-5">{result.title}</h3>{result.severity ? <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${semanticTone(result.severity)}`}>{result.severity}</span> : null}</div></div><h4 className="mt-4 text-[10px] font-bold">Summary</h4><p className="mt-2 text-[10px] leading-5 text-text-muted">{result.summary || result.snippet}</p><div className="mt-3 grid grid-cols-[80px_1fr] gap-y-2 text-[10px]"><strong>Source</strong><span>{formatLabel(result.sourceModule)}</span><strong>Location</strong><span>{result.hotelArea || (result.roomNumber ? `Room ${result.roomNumber}` : 'Hotel-wide')}</span><strong>Updated</strong><span>{new Date(result.updatedAt).toLocaleString()}</span>{result.severity ? <><strong>Severity</strong><span className="flex items-center gap-2"><i className="h-1.5 w-1.5 rounded-full bg-rose-500" />{formatLabel(result.severity)}</span></> : null}{result.status ? <><strong>Status</strong><span className={`w-fit rounded-full px-2 py-0.5 text-[8px] font-bold ${semanticTone(result.status)}`}>{formatLabel(result.status)}</span></> : null}<strong>Owner</strong><span>{String(metadata.ownerName || result.ownerId || 'Unassigned')}</span></div><div className="mt-4 border-t border-border pt-3"><h4 className="text-[10px] font-bold">Related Records ({related.length})</h4><div className="mt-2 space-y-2">{related.length ? related.slice(0, 3).map((record, index) => <div key={record.id || index} className="flex items-center justify-between text-[9px]"><span className="flex items-center gap-2"><FileText className="h-3 w-3" />{record.title || record.id}</span><ChevronRight className="h-3 w-3" /></div>) : <p className="text-[9px] text-text-muted">No related authorised records available.</p>}</div></div><div className="mt-4 border-t border-border pt-3"><h4 className="text-[10px] font-bold">Quick Actions</h4><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={!result.sourceUrl} onClick={onOpen} className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary-950 px-2 py-2.5 text-[9px] font-semibold text-primary-contrast disabled:opacity-40">Open record<ExternalLink className="h-3 w-3" /></button><button type="button" onClick={onAsk} className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-2 py-2.5 text-[9px] font-semibold"><Bot className="h-3 w-3" />Ask LaFlo about this result</button>{canCreateTask ? <><button type="button" onClick={onAssign} className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-2 py-2.5 text-[9px] font-semibold"><UserPlus className="h-3 w-3" />Assign</button><button type="button" onClick={onCreateTask} className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-2 py-2.5 text-[9px] font-semibold"><Plus className="h-3 w-3" />Create task</button></> : null}</div></div></section>;
}
