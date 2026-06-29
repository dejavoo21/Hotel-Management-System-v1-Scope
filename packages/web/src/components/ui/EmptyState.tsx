import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
};

export default function EmptyState({
  title,
  description,
  icon,
  action,
  compact = false,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center ${
        compact ? 'py-6' : 'py-10'
      } ${className}`}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-500 ring-1 ring-slate-200">
        {icon || <Inbox className="h-5 w-5" aria-hidden="true" />}
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
