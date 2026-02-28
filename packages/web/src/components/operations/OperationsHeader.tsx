type Props = {
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

export default function OperationsHeader({ onRefresh, isRefreshing = false }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Operations Center</h1>
          <p className="mt-1 text-sm text-slate-600">
            Central intelligence layer for forecast, demand, pricing, and operational execution.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh Context'}
        </button>
      </div>
    </div>
  );
}
