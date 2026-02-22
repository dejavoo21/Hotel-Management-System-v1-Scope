type Props = {
  value: string;
  onChange: (value: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
};

export default function DialerNumberDisplay({ value, onChange, onBackspace, disabled }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <label htmlFor="dialer-number" className="sr-only">
        Dialer number input
      </label>
      <div className="flex items-center gap-2">
        <input
          id="dialer-number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="+1 555 123 4567"
          inputMode="tel"
          autoComplete="off"
          aria-label="Phone number to call"
          className="h-14 w-full rounded-xl border border-border bg-bg px-4 text-center text-[30px] font-semibold tracking-tight text-text-main tabular-nums placeholder:text-text-muted focus:border-primary-300 focus:ring-2 focus:ring-primary-200"
        />
        <button
          type="button"
          onClick={onBackspace}
          disabled={disabled}
          aria-label="Delete last digit"
          className="inline-flex h-14 min-w-14 items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-semibold text-text-main shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Del
        </button>
      </div>
    </div>
  );
}

