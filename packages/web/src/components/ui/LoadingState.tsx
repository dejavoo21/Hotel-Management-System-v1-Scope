type LoadingStateProps = {
  label?: string;
  rows?: number;
  className?: string;
};

export default function LoadingState({
  label = 'Loading',
  rows = 3,
  className = '',
}: LoadingStateProps) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
        >
          <div className="flex animate-pulse gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-slate-100" />
              <div className="h-3 w-3/4 rounded bg-slate-100" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
