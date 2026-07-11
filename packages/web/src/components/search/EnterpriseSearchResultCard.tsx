import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ShieldAlert } from 'lucide-react';
import type { EnterpriseSearchResult } from '@/services/enterpriseSearch';

const toneClass = (value?: string | null) => {
  if (!value) return 'border-slate-200 bg-slate-50 text-slate-600';
  if (['CRITICAL', 'URGENT', 'HIGH', 'ACTIVE', 'OPEN', 'LOW_STOCK', 'TEST_FAILED'].includes(value)) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (['WARNING', 'MEDIUM', 'IN_PROGRESS', 'PENDING', 'DEGRADED'].includes(value)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (['RESOLVED', 'CLOSED', 'AVAILABLE', 'CONNECTED', 'HEALTHY', 'PAID'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

export default function EnterpriseSearchResultCard({ result, compact = false }: { result: EnterpriseSearchResult; compact?: boolean }) {
  const navigate = useNavigate();
  const open = () => {
    if (result.sourceUrl) navigate(result.sourceUrl);
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {result.category.replace(/_/g, ' ')}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {result.sourceModule.replace(/_/g, ' ')}
            </span>
            {result.status ? <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass(result.status)}`}>{result.status}</span> : null}
            {result.priority ? <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass(result.priority)}`}>{result.priority}</span> : null}
            {result.severity ? <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass(result.severity)}`}>{result.severity}</span> : null}
          </div>
          <h3 className="mt-2 truncate text-sm font-semibold text-slate-950">{result.title}</h3>
          <p className={`mt-1 text-sm text-slate-600 ${compact ? 'line-clamp-2' : ''}`}>{result.summary || result.snippet}</p>
          {!compact ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              {result.roomNumber ? <span>Room {result.roomNumber}</span> : null}
              {result.hotelArea ? <span>{result.hotelArea}</span> : null}
              <span>Updated {new Date(result.updatedAt).toLocaleString()}</span>
            </div>
          ) : null}
        </div>
        {result.sourceUrl ? (
          <button
            type="button"
            onClick={open}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowUpRight className="h-4 w-4" />
            Open
          </button>
        ) : (
          <div className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400">
            <ShieldAlert className="h-4 w-4" />
            No route
          </div>
        )}
      </div>
    </article>
  );
}
