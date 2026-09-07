import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, FileCheck2, FileClock, Search, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { canAccess } from '@/lib/access';
import { REPORT_CATALOGUE } from '@/data/reportCatalogue';
import { ModuleFilterPanel, ModuleMetricGrid, ModulePageHeader } from '@/components/core/ModuleLandingUi';

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const authorisedReports = useMemo(
    () => REPORT_CATALOGUE.filter((report) => canAccess(user, report.access)),
    [user],
  );
  const categories = useMemo(
    () => Array.from(new Set(authorisedReports.map((report) => report.category))).sort(),
    [authorisedReports],
  );
  const visibleReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return authorisedReports.filter((report) => {
      const matchesCategory = category === 'all' || report.category === category;
      const matchesSearch = !query || `${report.name} ${report.description} ${report.category}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [authorisedReports, category, search]);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        eyebrow="Business intelligence"
        title="Reports"
        description="Find authorised operational, guest, asset, audit, and financial reporting views."
        action={<Link to="/calendar" className="btn-outline">Open planning calendar</Link>}
      />

      <ModuleMetricGrid
        metrics={[
          { label: 'Available reports', value: authorisedReports.length, detail: 'Based on your module permissions', icon: <FileCheck2 className="h-4 w-4" /> },
          { label: 'Live data views', value: authorisedReports.filter((item) => item.source === 'Live module data').length, detail: 'Connected to operational modules', icon: <BarChart3 className="h-4 w-4" />, tone: 'blue' },
          { label: 'Prepared views', value: authorisedReports.filter((item) => item.source === 'Prepared view').length, detail: 'Structured for export workflows', icon: <FileClock className="h-4 w-4" />, tone: 'amber' },
          { label: 'Access policy', value: 'Enforced', detail: 'Restricted categories stay hidden', icon: <ShieldCheck className="h-4 w-4" /> },
        ]}
      />

      <ModuleFilterPanel>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search reports</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-10" placeholder="Search reports by name or purpose..." />
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="input sm:w-56" aria-label="Report category">
            <option value="all">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </ModuleFilterPanel>

      {visibleReports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-900">No authorised reports match these filters</p>
          <p className="mt-1 text-sm text-slate-500">Clear the search or choose another category.</p>
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Report catalogue">
          {visibleReports.map((report) => (
            <article key={report.id} className="flex min-h-56 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{report.category}</span>
                <span className="text-xs font-medium text-slate-500">{report.source}</span>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-950">{report.name}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{report.description}</p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs text-slate-500">{report.formats.join(' · ')}</span>
                <Link to={report.route} className="btn-outline text-xs">Open report</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
