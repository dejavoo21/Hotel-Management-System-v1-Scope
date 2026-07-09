import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Headphones,
  ShieldCheck,
  Building2,
  BarChart3,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import CollaborationToolbar, { type CollaborationToolbarProps } from '@/components/collaboration/CollaborationToolbar';

export type CollaborationWorkspace = 'support' | 'security' | 'maintenance' | 'incidents' | 'operations' | 'smart-building' | 'management';

const workspaceMeta: Record<CollaborationWorkspace, { label: string; icon: LucideIcon; tone: string }> = {
  support: {
    label: 'Support collaboration',
    icon: Headphones,
    tone: 'bg-sky-50 text-sky-700 ring-sky-100',
  },
  security: {
    label: 'Security collaboration',
    icon: ShieldCheck,
    tone: 'bg-rose-50 text-rose-700 ring-rose-100',
  },
  maintenance: {
    label: 'Maintenance collaboration',
    icon: Wrench,
    tone: 'bg-amber-50 text-amber-700 ring-amber-100',
  },
  'smart-building': {
    label: 'Smart Building collaboration',
    icon: Building2,
    tone: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
  },
  incidents: {
    label: 'Incident collaboration',
    icon: AlertTriangle,
    tone: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  operations: {
    label: 'Operations collaboration',
    icon: Activity,
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  management: {
    label: 'Management collaboration',
    icon: BarChart3,
    tone: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  },
};

type CollaborationHeaderProps = {
  workspace: CollaborationWorkspace;
  title: string;
  subtitle: string;
  eyebrow?: string;
  statusLabel?: string;
  statusTone?: 'live' | 'warning' | 'critical' | 'neutral';
  actions?: ReactNode;
  toolbar?: CollaborationToolbarProps | false;
};

const statusClasses = {
  live: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-700 ring-amber-100',
  critical: 'bg-rose-50 text-rose-700 ring-rose-100',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export default function CollaborationHeader({
  workspace,
  title,
  subtitle,
  eyebrow,
  statusLabel = 'Collaborative workspace',
  statusTone = 'live',
  actions,
  toolbar = {},
}: CollaborationHeaderProps) {
  const meta = workspaceMeta[workspace];
  const Icon = meta.icon;
  const showToolbar = toolbar !== false;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${meta.tone}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {eyebrow || meta.label}
              </p>
              <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${statusClasses[statusTone]}`}>
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
            {statusLabel}
          </span>
          {actions}
        </div>
      </div>

      {showToolbar ? (
        <div className="mt-5">
          <CollaborationToolbar workspace={workspace} variant="light" {...toolbar} />
        </div>
      ) : null}

      <div className="sr-only">
        <UsersRound className="h-4 w-4" aria-hidden="true" />
        This workspace supports shared hotel operations collaboration.
      </div>
    </section>
  );
}
