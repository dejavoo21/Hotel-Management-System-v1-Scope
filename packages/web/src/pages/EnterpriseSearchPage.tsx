import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Brain, Filter, RefreshCw, Save, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import enterpriseSearchService, { type EnterpriseSearchResult } from '@/services/enterpriseSearch';
import EnterpriseSearchResultCard from '@/components/search/EnterpriseSearchResultCard';

const categories = [
  'GUEST',
  'RESERVATION',
  'ROOM',
  'MAINTENANCE',
  'INCIDENT',
  'SECURITY',
  'CCTV',
  'SMART_BUILDING',
  'INVENTORY',
  'FINANCIAL',
  'MESSAGE',
  'REVIEW',
  'USER',
  'AUDIT_LOG',
  'AI_RECOMMENDATION',
];

const suggestedSearches = [
  'rooms not ready',
  'offline cameras',
  'water leak',
  'VIP guest',
  'open incidents',
  'overdue maintenance',
];

export default function EnterpriseSearchPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [severity, setSeverity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedResult, setSelectedResult] = useState<EnterpriseSearchResult | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('laflo-enterprise-recent-searches') || '[]');
    } catch {
      return [];
    }
  });

  const searchParams = useMemo(
    () => ({
      q: submittedQuery,
      categories: selectedCategories,
      status: status || undefined,
      priority: priority || undefined,
      severity: severity || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      limit: 50,
    }),
    [dateFrom, dateTo, priority, selectedCategories, severity, status, submittedQuery]
  );

  const searchQuery = useQuery({
    queryKey: ['enterprise-search', searchParams],
    queryFn: () => enterpriseSearchService.search(searchParams),
    enabled: submittedQuery.trim().length > 0 || selectedCategories.length > 0 || Boolean(status || priority || severity || dateFrom || dateTo),
  });

  const rebuildMutation = useMutation({
    mutationFn: enterpriseSearchService.rebuild,
    onSuccess: async (result) => {
      toast.success(`Search index rebuilt: ${result.indexedRecords} records`);
      await searchQuery.refetch();
    },
    onError: () => toast.error('Search index rebuild failed'),
  });

  const brainMutation = useMutation({
    mutationFn: enterpriseSearchService.askHotelBrain,
  });

  const submit = (value = query) => {
    const next = value.trim();
    setSubmittedQuery(next);
    if (next) {
      const nextRecent = [next, ...recentSearches.filter((item) => item !== next)].slice(0, 6);
      setRecentSearches(nextRecent);
      localStorage.setItem('laflo-enterprise-recent-searches', JSON.stringify(nextRecent));
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) => (prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]));
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setStatus('');
    setPriority('');
    setSeverity('');
    setDateFrom('');
    setDateTo('');
  };

  const data = searchQuery.data;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operations</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Enterprise Search</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Search authorised hotel records across operations, guests, reservations, incidents, integrations, tasks, AI recommendations, and audit trails.
            </p>
          </div>
          <button
            type="button"
            onClick={() => rebuildMutation.mutate()}
            disabled={rebuildMutation.isPending}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Rebuild index
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr_360px]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Filter className="h-4 w-4" />
              Filters
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Status
                <input value={status} onChange={(event) => setStatus(event.target.value.toUpperCase())} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="OPEN, ACTIVE, PAID" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Priority
                <input value={priority} onChange={(event) => setPriority(event.target.value.toUpperCase())} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="LOW, MEDIUM, HIGH" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Severity
                <input value={severity} onChange={(event) => setSeverity(event.target.value.toUpperCase())} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="HIGH, CRITICAL" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Date from
                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Date to
                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <button type="button" onClick={clearFilters} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Clear filters
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Save className="h-4 w-4" />
              Recent and saved
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {recentSearches.length ? recentSearches.map((item) => (
                <button key={item} type="button" onClick={() => { setQuery(item); submit(item); }} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  {item}
                </button>
              )) : <p className="text-sm text-slate-500">Recent searches appear here after you search.</p>}
            </div>
            <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              Saved searches are stored locally for now; shared saved searches can use the SearchIndex governance model later.
            </p>
          </div>
        </aside>

        <main className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submit();
                  }}
                  className="min-h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm"
                  placeholder="Search guest, room, incident, camera, device, invoice, message..."
                />
              </div>
              <button type="button" onClick={() => submit()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
                <Search className="h-4 w-4" />
                Search
              </button>
              <button type="button" onClick={() => brainMutation.mutate(query || submittedQuery || 'What needs attention today?')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Brain className="h-4 w-4" />
                Ask Hotel Brain
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${selectedCategories.includes(category) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {category.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {!submittedQuery && !selectedCategories.length && !status && !priority && !severity ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <Search className="mx-auto h-8 w-8 text-slate-400" />
              <h2 className="mt-3 text-sm font-semibold text-slate-900">Search across LaFlo</h2>
              <p className="mt-1 text-sm text-slate-500">Try one of the suggested searches below or enter a room, guest, incident, device, or invoice reference.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {suggestedSearches.map((item) => (
                  <button key={item} type="button" onClick={() => { setQuery(item); submit(item); }} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : searchQuery.isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Searching authorised records...</div>
          ) : searchQuery.isError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">Search failed. Rebuild the index or try again.</div>
          ) : data && data.results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h2 className="text-sm font-semibold text-slate-900">No authorised results</h2>
              <p className="mt-1 text-sm text-slate-500">
                No records matched your search, or matching records are outside your permissions.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                <span>{data?.total || 0} authorised result{data?.total === 1 ? '' : 's'}</span>
                {data?.restrictedCount ? <span>{data.restrictedCount} restricted result{data.restrictedCount === 1 ? '' : 's'} omitted</span> : null}
              </div>
              {data?.groups.map((group) => (
                <section key={group.category} className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.category.replace(/_/g, ' ')} ({group.count})</h2>
                  {group.results.map((result) => (
                    <button key={result.id} type="button" onClick={() => setSelectedResult(result)} className="block w-full text-left">
                      <EnterpriseSearchResultCard result={result} />
                    </button>
                  ))}
                </section>
              ))}
            </div>
          )}
        </main>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Brain className="h-4 w-4" />
              Hotel Brain
            </div>
            {brainMutation.isPending ? (
              <p className="mt-3 text-sm text-slate-500">Generating answer from authorised indexed records...</p>
            ) : brainMutation.data ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-700">{brainMutation.data.answer}</p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                  Confidence {Math.round(brainMutation.data.confidence * 100)}% / Sources: {brainMutation.data.citedContextSections.join(', ') || 'index'}
                </div>
                {brainMutation.data.suggestedActions.map((action) => (
                  <div key={action.title} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{action.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Ask a natural language question from the search box to generate an evidence-backed answer.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Preview</h2>
            {selectedResult ? (
              <div className="mt-3">
                <EnterpriseSearchResultCard result={selectedResult} compact />
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Select a result to preview its source, status, severity, and route.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
