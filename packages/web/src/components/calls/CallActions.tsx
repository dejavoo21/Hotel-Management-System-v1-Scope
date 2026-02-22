type Props = {
  disabled?: boolean;
  dialing?: boolean;
  onCall: () => void;
  status?: 'queued' | 'ringing' | 'connected' | 'failed' | null;
  statusLabel?: string;
};

export default function CallActions({ disabled, dialing, onCall, status, statusLabel }: Props) {
  const statusTone =
    status === 'failed'
      ? 'bg-danger/10 text-danger border-danger/20'
      : status === 'connected'
        ? 'bg-success/10 text-success border-success/20'
        : status === 'ringing'
          ? 'bg-primary-100 text-primary-700 border-primary-200'
          : 'bg-warning/10 text-warning border-warning/20';

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onCall}
        disabled={disabled || dialing}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary-solid px-4 text-sm font-semibold text-primary-contrast shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-hover active:translate-y-0 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {dialing ? 'Dialing…' : 'Call'}
      </button>

      {statusLabel ? (
        <div className={`rounded-xl border px-3 py-2 text-sm font-medium ${statusTone}`}>
          {statusLabel}
        </div>
      ) : null}
    </div>
  );
}

