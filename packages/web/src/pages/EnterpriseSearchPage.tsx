import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  FileText,
  Filter,
  ListFilter,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
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
  return 'bg-slate-100 text-slate-600';
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

  const authorisedCategories = useMemo(
    () => categoryOptions.filter((category) => category.permissions.some((permission) => canAccess(user, permission))),
    [user],
  );
  const authorisedCategoryValues = useMemo(() => new Set(authorisedCategories.map((category) => category.value)), [authorisedCategories]);
  const canCreateTask = canAccessRoute(user, '/operations/tasks');

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
  });

  const rebuildMutation = useMutation({
    mutationFn: () => enterpriseSearchService.rebuild(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['enterprise-search'] }),
  });

  const submit = (value = query) => {
    setQuery(value);
    setSubmittedQuery(value.trim());
    setPage(1);
    setSelectedResultId(null);
  };
  const askLaflo = (prompt: string) => openLafloAssistant({ mode: 'operations', prompt });
  const authorisedResults = useMemo(
    () => (searchQuery.data?.results || []).filter((result) => result.category === 'TASK'
      ? canAccess(user, 'maintenance_center') || canAccess(user, 'bookings')
      : authorisedCategoryValues.has(result.category)),
    [authorisedCategoryValues, searchQuery.data?.results, user],
  );

  const sortedResults = useMemo(() => {
    const rows = [...authorisedResults];
    if (sort === 'newest') rows.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    if (sort === 'oldest') rows.sort((a, b) => +new Date(a.updatedAt) - +new Date(b.updatedAt));
    return rows;
  }, [authorisedResults, sort]);

  const pageSize = 6;
  const pages = Math.max(1, Math.ceil(sortedResults.length / pageSize));
  const visibleResults = sortedResults.slice((page - 1) * pageSize, page * pageSize);
  const selectedResult = sortedResults.find((result) => result.id === selectedResultId) || visibleResults[0] || null;
  const count = (values: string[]) => values.reduce((total, category) => {
    const grouped = searchQuery.data?.groups.find((group) => group.category === category)?.count;
    return total + (grouped ?? authorisedResults.filter((result) => result.category === category).length);
  }, 0);
  const displayTotal = searchQuery.data?.total || authorisedResults.length;

  const chooseSavedSearch = (value: string) => submit(value);
  const toggleFilter = (label: string) => setCollapsedFilters((current) => current.includes(label)
    ? current.filter((item) => item !== label)
    : [...current, label]);

  return (
    <div className="-mx-3 -mt-3 min-h-[calc(100vh-5rem)] bg-white px-3 pb-20 pt-3 text-slate-950 sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5">
      <div className="mx-auto max-w-[1740px]">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px] xl:gap-11">
          <div className="min-w-0">
            <header className="flex h-[102px] flex-col justify-center px-1">
              <h1 className="text-[24px] font-bold leading-none tracking-tight">Enterprise Search</h1>
              <p className="mt-2 max-w-[470px] text-xs leading-5 text-slate-600">Search across guests, reservations, incidents, devices, invoices,<br className="hidden sm:block" /> AI recommendations, and audit trails.</p>
            </header>

            <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
              <div className="flex h-12 items-center rounded-lg border border-slate-200 bg-white px-4 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
                <Search className="h-5 w-5 shrink-0 text-slate-700" />
                <input aria-label="Enterprise search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent px-4 text-sm font-semibold outline-none ring-0" placeholder="Search guest, room, booking, incident, device, invoice, or keyword..." />
                {query ? <button type="button" aria-label="Clear search text" onClick={() => setQuery('')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button> : null}
                <button type="submit" className="ml-4 inline-flex h-10 w-28 items-center justify-center gap-2 rounded-lg bg-[#061634] text-xs font-semibold text-white hover:bg-slate-800"><Search className="h-4 w-4" />Search</button>
              </div>
              <div aria-label="Search categories" className="flex flex-wrap gap-2 px-1 pb-0.5 pt-2">
                <CategoryChip active={!selectedCategory} onClick={() => setSelectedCategory('')}>All</CategoryChip>
                {authorisedCategories.map((category) => <Fragment key={category.value}>{category.value === 'REVIEW' ? <span aria-hidden="true" className="h-0 basis-full" /> : null}<CategoryChip active={selectedCategory === category.value} onClick={() => { setSelectedCategory(category.value); setPage(1); }}>{category.label}</CategoryChip></Fragment>)}
              </div>
            </form>

            <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard icon={FileText} tone="emerald" label="Results" value={displayTotal} note="All sources" />
              <MetricCard icon={Droplets} tone="rose" label="Incidents" value={count(['INCIDENT'])} note="Critical" />
              <MetricCard icon={ClipboardList} tone="amber" label="Tasks" value={count(['TASK', 'MAINTENANCE'])} note="Open tasks" />
              <MetricCard icon={UserRound} tone="blue" label="Guests" value={count(['GUEST'])} note="Matching guests" />
              <MetricCard icon={Sparkles} tone="violet" label="AI recommendations" value={count(['AI_RECOMMENDATION'])} note="Best insights" />
            </section>

            <div className="mt-3 grid gap-7 lg:grid-cols-[250px_minmax(0,1fr)]">
              <aside className="space-y-3">
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3"><h2 className="text-xs font-bold">Filters</h2><button type="button" onClick={() => { setStatus(''); setPriority(''); setSeverity(''); setDateFrom(''); setDateTo(''); setDepartment(''); setSourceModule(''); }} className="text-[9px] font-semibold text-emerald-700">Reset all</button></div>
                  <FilterSection label="Status" icon={ListFilter} open={!collapsedFilters.includes('Status')} onToggle={() => toggleFilter('Status')}><Select value={status} onChange={setStatus} options={['OPEN', 'ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'PAID']} /></FilterSection>
                  <FilterSection label="Priority" icon={Filter} open={!collapsedFilters.includes('Priority')} onToggle={() => toggleFilter('Priority')}><Select value={priority} onChange={setPriority} options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']} /></FilterSection>
                  <FilterSection label="Severity" icon={ShieldAlert} open={!collapsedFilters.includes('Severity')} onToggle={() => toggleFilter('Severity')}><Select value={severity} onChange={setSeverity} options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']} /></FilterSection>
                  <FilterSection label="Date Range" icon={CalendarDays} open={!collapsedFilters.includes('Date Range')} onToggle={() => toggleFilter('Date Range')}><div className="grid gap-1"><input aria-label="Date from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full rounded-md border border-slate-200 p-1 text-[9px]" /><input aria-label="Date to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-full rounded-md border border-slate-200 p-1 text-[9px]" /></div></FilterSection>
                  <FilterSection label="Department" icon={UserRound} open={!collapsedFilters.includes('Department')} onToggle={() => toggleFilter('Department')}><Select value={department} onChange={setDepartment} options={['Front Desk', 'Housekeeping', 'Maintenance', 'Security', 'Finance']} /></FilterSection>
                  <FilterSection label="Source Type" icon={Building2} open={!collapsedFilters.includes('Source Type')} onToggle={() => toggleFilter('Source Type')}><Select value={sourceModule} onChange={setSourceModule} options={authorisedCategories.map((category) => category.value)} /></FilterSection>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between"><h2 className="text-xs font-bold">Saved Searches</h2><button type="button" className="text-[9px] font-semibold text-emerald-700">View all</button></div>
                  <div className="mt-3 space-y-3">{savedSearches.map((saved) => <button key={saved.label} type="button" onClick={() => chooseSavedSearch(saved.query)} className="flex w-full items-start gap-2 text-left text-[10px] leading-4 text-slate-700 hover:text-emerald-700"><Bookmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />{saved.label}</button>)}</div>
                </section>
              </aside>

              <main className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 text-[10px]"><strong>Showing {sortedResults.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, sortedResults.length)}` : '0'} of {displayTotal} results</strong><label className="flex items-center gap-1">Sort by:<select aria-label="Sort results" value={sort} onChange={(event) => setSort(event.target.value)} className="border-0 bg-transparent p-0 text-[10px] font-semibold ring-0"><option value="relevance">Relevance</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select><ChevronDown className="h-3 w-3" /></label></div>
                {searchQuery.isLoading ? <div className="space-y-2 p-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[68px] animate-pulse rounded-lg bg-slate-100" />)}</div> : searchQuery.isError ? <Empty icon={AlertTriangle} title="Search could not be completed" copy="The search index is unavailable. Please try again shortly." /> : !visibleResults.length ? <Empty icon={Search} title="No authorised results found" copy="Rebuild the index or try another keyword, category, or filter." /> : <div className="divide-y divide-slate-200">{visibleResults.map((result) => <ResultRow key={result.id} result={result} selected={selectedResult?.id === result.id} onSelect={() => setSelectedResultId(result.id)} />)}</div>}
                <Pagination page={page} pages={pages} onChange={setPage} />
              </main>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="flex h-[89px] items-center gap-4">
              <button type="button" onClick={() => rebuildMutation.mutate()} disabled={rebuildMutation.isPending} className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#061634] px-6 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${rebuildMutation.isPending ? 'animate-spin' : ''}`} />{rebuildMutation.isPending ? 'Rebuilding...' : 'Rebuild Index'}
              </button>
              <button type="button" onClick={() => askLaflo(`Investigate this Enterprise Search query using authorised hotel context: ${query || submittedQuery}`)} className="inline-flex h-12 items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 text-sm font-semibold hover:bg-slate-50">
                <Bot className="h-4 w-4 text-emerald-700" />Ask LaFlo
              </button>
            </div>
            <div className="[&>section]:flex [&>section]:min-h-[600px] [&>section]:flex-col [&>section>div:last-child]:mt-auto">
              {selectedResult ? <Preview result={selectedResult} canCreateTask={canCreateTask} onOpen={() => selectedResult.sourceUrl && navigate(selectedResult.sourceUrl)} onAsk={() => askLaflo(`Use this authorised Enterprise Search result as context. Title: ${selectedResult.title}. Type: ${formatLabel(selectedResult.category)}. Source: ${formatLabel(selectedResult.sourceModule)}. Summary: ${selectedResult.summary || selectedResult.snippet}`)} onCreateTask={() => navigate('/operations/tasks', { state: { sourceSearchResult: selectedResult } })} /> : <EmptyPreview />}
            </div>
            <section className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm">
              <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-xs font-bold"><Sparkles className="h-4 w-4 text-emerald-700" />Hotel Brain Insight</h2><ChevronUp className="h-4 w-4 text-slate-500" /></div>
              <p className="mt-4 text-[11px] leading-5 text-slate-700">{selectedResult ? 'This record matches similar authorised events. Consider reviewing the related systems and creating a preventive follow-up task.' : 'Select a result to generate an evidence-backed operational insight.'}</p>
              <p className="mt-2 text-[9px] font-semibold text-emerald-700">Powered by Hotel Brain · Permission-filtered context</p>
              <div className="mt-4 flex gap-2">{canCreateTask ? <button type="button" disabled={!selectedResult} onClick={() => selectedResult && navigate('/operations/tasks', { state: { sourceSearchResult: selectedResult } })} className="rounded-lg bg-emerald-700 px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-40">Create task</button> : null}<button type="button" disabled={!selectedResult} onClick={() => selectedResult && askLaflo(`Show incidents similar to ${selectedResult.title}`)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[10px] font-semibold disabled:opacity-40">Show similar incidents</button></div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-3.5 py-1.5 text-[10px] font-semibold ${active ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-emerald-600'}`}>{children}</button>;
}

function MetricCard({ icon: Icon, tone, label, value, note }: { icon: typeof Search; tone: string; label: string; value: number; note: string }) {
  const tones: Record<string, string> = { emerald: 'bg-emerald-50 text-emerald-700', rose: 'bg-rose-50 text-rose-600', amber: 'bg-amber-50 text-amber-600', blue: 'bg-blue-50 text-blue-600', violet: 'bg-violet-50 text-violet-600' };
  return <article className="flex h-[86px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-6 w-6" /></span><div><p className="text-[10px] text-slate-500">{label}</p><strong className="block text-xl leading-6">{value}</strong><p className="text-[10px] text-slate-500">{note}</p></div></article>;
}

function FilterSection({ label, icon: Icon, open, onToggle, children }: { label: string; icon: typeof Search; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className="border-b border-slate-200 last:border-0"><button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-3 text-[10px] font-semibold"><Icon className="h-3.5 w-3.5 text-slate-600" /><span className="flex-1 text-left">{label}</span>{open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</button>{open ? <div className="px-3 pb-3">{children}</div> : null}</div>;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return <select aria-label="Filter option" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px]"><option value="">All</option>{options.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}</select>;
}

function Empty({ icon: Icon, title, copy }: { icon: typeof Search; title: string; copy: string }) {
  return <div className="flex min-h-[410px] flex-col items-center justify-center p-8 text-center"><Icon className="h-8 w-8 text-slate-500" /><h2 className="mt-3 text-sm font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{copy}</p></div>;
}

function ResultRow({ result, selected, onSelect }: { result: EnterpriseSearchResult; selected: boolean; onSelect: () => void }) {
  const Icon = resultIcon(result.category);
  const related = result.roomNumber ? `Room ${result.roomNumber}` : result.hotelArea;
  return <button type="button" onClick={onSelect} aria-pressed={selected} className={`flex min-h-[79px] w-full gap-3 px-3 py-3 text-left transition ${selected ? 'bg-emerald-50/50 ring-1 ring-inset ring-emerald-600' : 'hover:bg-slate-50'}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${resultIconTone(result.category)}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="truncate text-xs">{result.title}</strong>{result.severity ? <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${semanticTone(result.severity)}`}>{result.severity}</span> : null}</span><span className="mt-1 line-clamp-1 block text-[11px] text-slate-600">{result.summary || result.snippet}</span><span className="mt-1.5 flex flex-wrap gap-1.5 text-[9px] text-slate-600"><span className="rounded-full bg-slate-100 px-2 py-0.5">{formatLabel(result.category)}</span><span className="rounded-full bg-slate-100 px-2 py-0.5">{formatLabel(result.sourceModule)}</span>{related ? <span className="rounded-full bg-slate-100 px-2 py-0.5">{related}</span> : null}</span></span><span className="hidden w-32 shrink-0 text-[9px] text-slate-600 md:block"><span className="block">{new Date(result.updatedAt).toLocaleString()}</span><span className="mt-1 block">{formatLabel(result.sourceModule)}</span>{result.status ? <span className={`mt-1 inline-block rounded-full px-2 py-0.5 font-bold ${semanticTone(result.status)}`}>{formatLabel(result.status)}</span> : null}</span></button>;
}

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  return <div className="flex items-center justify-center gap-2 border-t border-slate-200 py-4"><button type="button" aria-label="Previous results page" disabled={page === 1} onClick={() => onChange(page - 1)} className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button>{Array.from({ length: Math.min(5, pages) }, (_, index) => index + 1).map((item) => <button key={item} type="button" onClick={() => onChange(item)} className={`h-7 w-7 rounded-md text-[10px] font-semibold ${item === page ? 'bg-[#061634] text-white' : ''}`}>{item}</button>)}<button type="button" aria-label="Next results page" disabled={page === pages} onClick={() => onChange(page + 1)} className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button></div>;
}

function EmptyPreview() {
  return <section className="flex min-h-[510px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><FileText className="h-8 w-8 text-slate-500" /><h2 className="mt-3 text-sm font-bold">Result preview</h2><p className="mt-1 text-xs text-slate-500">Select an authorised record to view its context and available actions.</p></section>;
}

function Preview({ result, canCreateTask, onOpen, onAsk, onCreateTask }: { result: EnterpriseSearchResult; canCreateTask: boolean; onOpen: () => void; onAsk: () => void; onCreateTask: () => void }) {
  const Icon = resultIcon(result.category);
  const metadata = metadataOf(result);
  const related = Array.isArray(metadata.relatedRecords) ? metadata.relatedRecords as Array<{ id?: string; title?: string; status?: string }> : [];
  return <section aria-label="Result preview" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-[10px] font-bold">Preview</h2><ChevronUp className="h-4 w-4 text-slate-500" /></div><div className="mt-4 flex items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${resultIconTone(result.category)}`}><Icon className="h-5 w-5" /></span><div className="flex flex-wrap items-center gap-2"><h3 className="max-w-[230px] text-sm font-bold leading-5">{result.title}</h3>{result.severity ? <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${semanticTone(result.severity)}`}>{result.severity}</span> : null}</div></div><h4 className="mt-4 text-[10px] font-bold">Summary</h4><p className="mt-2 text-[10px] leading-5 text-slate-700">{result.summary || result.snippet}</p><div className="mt-3 grid grid-cols-[80px_1fr] gap-y-2 text-[10px]"><strong>Source</strong><span>{formatLabel(result.sourceModule)}</span><strong>Location</strong><span>{result.hotelArea || (result.roomNumber ? `Room ${result.roomNumber}` : 'Hotel-wide')}</span><strong>Detected</strong><span>{new Date(result.updatedAt).toLocaleString()}</span>{result.severity ? <><strong>Severity</strong><span className="flex items-center gap-2"><i className="h-1.5 w-1.5 rounded-full bg-rose-500" />{formatLabel(result.severity)}</span></> : null}{result.status ? <><strong>Status</strong><span className={`w-fit rounded-full px-2 py-0.5 text-[8px] font-bold ${semanticTone(result.status)}`}>{formatLabel(result.status)}</span></> : null}<strong>Owner</strong><span>{String(metadata.ownerName || result.ownerId || 'Unassigned')}</span></div><div className="mt-4 border-t border-slate-200 pt-3"><h4 className="text-[10px] font-bold">Related Records ({related.length})</h4><div className="mt-2 space-y-2">{related.length ? related.slice(0, 3).map((record, index) => <div key={record.id || index} className="flex items-center justify-between text-[9px]"><span className="flex items-center gap-2"><FileText className="h-3 w-3" />{record.title || record.id}</span><ChevronRight className="h-3 w-3" /></div>) : <p className="text-[9px] text-slate-500">No related authorised records available.</p>}</div></div><div className="mt-4 border-t border-slate-200 pt-3"><h4 className="text-[10px] font-bold">Quick Actions</h4><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" disabled={!result.sourceUrl} onClick={onOpen} className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#061634] px-2 py-2.5 text-[9px] font-semibold text-white disabled:opacity-40">Open record<ExternalLink className="h-3 w-3" /></button><button type="button" onClick={onAsk} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 py-2.5 text-[9px] font-semibold"><Bot className="h-3 w-3" />Ask LaFlo</button>{canCreateTask ? <button type="button" onClick={onCreateTask} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 py-2.5 text-[9px] font-semibold"><Plus className="h-3 w-3" />Create task</button> : <button type="button" disabled className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2.5 text-[9px] text-slate-400"><UserPlus className="h-3 w-3" />Assign</button>}</div></div></section>;
}
