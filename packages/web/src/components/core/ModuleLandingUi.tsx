import type { ReactNode } from 'react';

type MetricTone = 'teal' | 'blue' | 'amber' | 'rose';

const toneClasses: Record<MetricTone, string> = {
  teal: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  blue: 'bg-sky-50 text-sky-700 ring-sky-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
};

export function ModulePageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function ModuleMetricGrid({
  metrics,
}: {
  metrics: Array<{
    label: string;
    value: string | number;
    detail: string;
    icon: ReactNode;
    tone?: MetricTone;
  }>;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Operational summary">
      {metrics.map((metric) => (
        <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">{metric.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{metric.value}</p>
            </div>
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${toneClasses[metric.tone || 'teal']}`}>
              {metric.icon}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">{metric.detail}</p>
        </article>
      ))}
    </section>
  );
}

export function ModuleFilterPanel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Filters">
      {children}
    </section>
  );
}
