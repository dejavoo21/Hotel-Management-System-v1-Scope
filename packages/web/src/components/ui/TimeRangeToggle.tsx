import type { TimeRange } from '@/data/timeRange';

type Option = { label: string; value: TimeRange };

export default function TimeRangeToggle({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition-colors ${
              active
                ? 'bg-lime-200 text-slate-900 ring-lime-200'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

