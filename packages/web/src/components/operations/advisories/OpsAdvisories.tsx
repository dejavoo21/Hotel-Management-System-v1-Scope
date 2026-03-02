import { useMemo, useState } from 'react';
import { pillTone, cardTone, type Tone } from '@/components/operations/opsPalette';
import type { OperationsContext } from '@/services/operations';

type Props = {
  context?: OperationsContext | null;
  onCreateTask?: (id: string) => void;
  onAssign?: (id: string) => void;
  onDismiss?: (id: string) => void;
};

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string;

function toPriorityTone(priority?: Priority): Tone {
  const p = String(priority ?? '').toUpperCase();
  if (p === 'URGENT') return 'bad';
  if (p === 'HIGH') return 'warn';
  if (p === 'MEDIUM') return 'info';
  if (p === 'LOW') return 'neutral';
  return 'neutral';
}

function toDeptTone(dept?: string): Tone {
  const d = (dept ?? '').toLowerCase();
  if (d.includes('house')) return 'info';
  if (d.includes('maint')) return 'warn';
  if (d.includes('front')) return 'neutral';
  if (d.includes('concierge')) return 'info';
  if (d.includes('billing')) return 'warn';
  if (d.includes('management')) return 'good';
  return 'neutral';
}

function Accent({ tone }: { tone: Tone }) {
  const klass =
    tone === 'good'
      ? 'bg-emerald-400'
      : tone === 'warn'
        ? 'bg-amber-400'
        : tone === 'bad'
          ? 'bg-rose-400'
          : tone === 'info'
            ? 'bg-sky-400'
            : 'bg-slate-300';

  return <div className={`h-full w-1.5 rounded-full ${klass}`} />;
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition',
        active
          ? 'bg-slate-900 text-white ring-slate-900'
          : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function IconPin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s6-4.35 6-10a6 6 0 0 0-12 0c0 5.65 6 10 6 10Z" />
      <path d="M12 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </svg>
  );
}

function formatUtc(iso?: string) {
  if (!iso) return 'just now';
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `adv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function OpsAdvisories({ context, onCreateTask, onAssign, onDismiss }: Props) {
  const advisoriesRaw = (context as any)?.advisories ?? [];
  const generatedAtUtc = context?.generatedAtUtc;

  const advisories = useMemo(() => {
    return (Array.isArray(advisoriesRaw) ? advisoriesRaw : []).map((a: any) => ({
      id: String(a?.id ?? makeId()),
      title: String(a?.title ?? 'Advisory'),
      reason: String(a?.reason ?? ''),
      priority: String(a?.priority ?? 'MEDIUM').toUpperCase(),
      department: String(a?.department ?? 'Front Desk'),
      source: String(a?.source ?? 'OPS'),
      created: Boolean(a?.created || a?.createdTicket),
    }));
  }, [advisoriesRaw]);

  const [dept, setDept] = useState<string>('ALL');
  const [prio, setPrio] = useState<string>('ALL');
  const [createdState, setCreatedState] = useState<'ALL' | 'CREATED' | 'NOT_CREATED'>('ALL');

  const depts = useMemo(() => {
    const set = new Set<string>();
    advisories.forEach((a) => set.add(a.department));
    return ['ALL', ...Array.from(set).sort()];
  }, [advisories]);

  const filtered = useMemo(() => {
    return advisories.filter((a) => {
      if (dept !== 'ALL' && a.department !== dept) return false;
      if (prio !== 'ALL' && a.priority !== prio) return false;
      if (createdState === 'CREATED' && !a.created) return false;
      if (createdState === 'NOT_CREATED' && a.created) return false;
      return true;
    });
  }, [advisories, dept, prio, createdState]);

  const handleCreateTask = (id: string) => {
    if (onCreateTask) onCreateTask(id);
  };

  const handleAssign = (id: string) => {
    if (onAssign) onAssign(id);
  };

  const handleDismiss = (id: string) => {
    if (onDismiss) onDismiss(id);
  };

  const updatedLabel = generatedAtUtc ? formatUtc(generatedAtUtc) : 'just now';

  return (
    <section className={`rounded-3xl border p-5 shadow-sm ${cardTone('neutral')}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Operations Advisory</div>
          <div className="mt-1 text-sm text-slate-600">
            Actionable recommendations based on current operational indicators.
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${pillTone('neutral')}`}>
              Updated {updatedLabel}
            </span>

            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${pillTone('info')}`}>
              <IconPin className="h-3.5 w-3.5" />
              {filtered.length} items
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip active={createdState === 'ALL'} label="All" onClick={() => setCreatedState('ALL')} />
          <Chip active={createdState === 'NOT_CREATED'} label="Not created" onClick={() => setCreatedState('NOT_CREATED')} />
          <Chip active={createdState === 'CREATED'} label="Created" onClick={() => setCreatedState('CREATED')} />

          <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            value={prio}
            onChange={(e) => setPrio(e.target.value)}
          >
            <option value="ALL">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          >
            {depts.map((d) => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'All departments' : d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8">
            <div className="text-sm font-semibold text-slate-900">No advisories match your filters</div>
            <div className="mt-1 text-sm text-slate-600">
              Try refreshing context or clearing filters to see recommendations.
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setDept('ALL');
                  setPrio('ALL');
                  setCreatedState('ALL');
                }}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear filters
              </button>
            </div>
          </div>
        ) : (
          filtered.map((a) => {
            const pTone = toPriorityTone(a.priority);
            const dTone = toDeptTone(a.department);

            return (
              <div
                key={a.id}
                className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300"
              >
                <div className="flex gap-4 p-5">
                  <div className="pt-1">
                    <Accent tone={pTone} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{a.title}</div>
                        {a.reason ? (
                          <div className="mt-1 line-clamp-2 text-sm text-slate-600">{a.reason}</div>
                        ) : (
                          <div className="mt-1 text-sm text-slate-500">No reason provided.</div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${pillTone(dTone)}`}>
                          {a.department}
                        </span>

                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${pillTone(pTone)}`}>
                          {a.priority.toLowerCase()}
                        </span>

                        {a.created ? (
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${pillTone('good')}`}>
                            Task created
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">
                        Source: <span className="font-semibold text-slate-700">{a.source}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCreateTask(a.id)}
                          className="inline-flex items-center rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          Create task
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAssign(a.id)}
                          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Assign
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDismiss(a.id)}
                          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          title="Dismiss"
                        >
                          x
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

