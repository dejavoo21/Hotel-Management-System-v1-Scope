type RecentCallStatus = 'queued' | 'ringing' | 'connected' | 'failed';

type RecentCall = {
  callId?: string;
  number: string;
  at: string;
  status: RecentCallStatus;
};

type Props = {
  items: RecentCall[];
};

const statusClasses: Record<RecentCallStatus, string> = {
  queued: 'bg-warning/10 text-warning',
  ringing: 'bg-primary-100 text-primary-700',
  connected: 'bg-success/10 text-success',
  failed: 'bg-danger/10 text-danger',
};

export default function RecentCalls({ items }: Props) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-text-main">Recent Calls</h2>
        <p className="text-xs text-text-muted">Latest dial attempts from this device/session.</p>
      </div>

      <div className="space-y-2">
        {items.map((entry, index) => (
          <div key={`${entry.number}-${entry.at}-${index}`} className="rounded-xl border border-border bg-bg px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-main tabular-nums">{entry.number}</p>
                <p className="text-[11px] text-text-muted">{new Date(entry.at).toLocaleString()}</p>
                {entry.callId ? <p className="text-[10px] text-text-muted">ID: {entry.callId}</p> : null}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses[entry.status]}`}>
                {entry.status}
              </span>
            </div>
          </div>
        ))}

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-bg px-3 py-4 text-sm text-text-muted">No calls yet.</p>
        ) : null}
      </div>
    </section>
  );
}

