import { memo, useMemo } from 'react';
import type { Ticket } from '@/services/tickets';
import { getTimeRemaining, getEscalationBadge } from '@/services/tickets';

type TicketMetaBarProps = {
  ticket: Ticket | null | undefined;
  assignedTo?: string;
  onAssign?: () => void;
  onChangePriority?: () => void;
  onMarkResolved?: () => void;
  onEscalate?: () => void;
  onViewDetails?: () => void;
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  LOW: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Low' },
  MEDIUM: { bg: 'bg-sky-100', text: 'text-sky-700', label: 'Medium' },
  HIGH: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'High' },
  CRITICAL: { bg: 'bg-red-100', text: 'text-red-700', label: 'Critical' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  OPEN: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  IN_PROGRESS: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  WAITING: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  RESOLVED: { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' },
  BREACHED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

export const TicketMetaBar = memo(function TicketMetaBar({
  ticket,
  assignedTo,
  onAssign,
  onChangePriority,
  onMarkResolved,
  onEscalate,
  onViewDetails,
}: TicketMetaBarProps) {
  const slaInfo = useMemo(() => {
    if (!ticket) return null;
    return getTimeRemaining(ticket);
  }, [ticket]);

  const escalationInfo = useMemo(() => {
    if (!ticket) return null;
    return getEscalationBadge(ticket);
  }, [ticket]);

  const priorityStyle = PRIORITY_STYLES[ticket?.priority || 'MEDIUM'] || PRIORITY_STYLES.MEDIUM;
  const statusStyle = STATUS_STYLES[ticket?.status || 'OPEN'] || STATUS_STYLES.OPEN;

  if (!ticket) {
    return (
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">No ticket data available</span>
        </div>
        {onViewDetails && (
          <button
            type="button"
            onClick={onViewDetails}
            className="text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            View Details →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200">
      {/* Left: Ticket Info */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Ticket ID */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Ticket</span>
          <span className="text-sm font-mono font-semibold text-slate-700">
            #{ticket.id.slice(0, 8)}
          </span>
        </div>

        {/* Status */}
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusStyle.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
          <span className={`text-xs font-medium ${statusStyle.text}`}>
            {ticket.status.replace('_', ' ')}
          </span>
        </div>

        {/* Priority */}
        <div className={`inline-flex items-center px-2.5 py-1 rounded-full ${priorityStyle.bg}`}>
          <span className={`text-xs font-medium ${priorityStyle.text}`}>
            {priorityStyle.label}
          </span>
        </div>

        {/* Department */}
        {ticket.department && (
          <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-purple-50">
            <span className="text-xs font-medium text-purple-700">
              {ticket.department}
            </span>
          </div>
        )}

        {/* SLA Timer */}
        {slaInfo && (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
            slaInfo.isOverdue ? 'bg-red-100' : slaInfo.minutes < 30 ? 'bg-amber-100' : 'bg-slate-100'
          }`}>
            <svg className={`h-3.5 w-3.5 ${
              slaInfo.isOverdue ? 'text-red-600' : slaInfo.minutes < 30 ? 'text-amber-600' : 'text-slate-500'
            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`text-xs font-medium ${
              slaInfo.isOverdue ? 'text-red-700' : slaInfo.minutes < 30 ? 'text-amber-700' : 'text-slate-600'
            }`}>
              {slaInfo.isOverdue ? 'Overdue' : slaInfo.display}
            </span>
          </div>
        )}

        {/* Escalation Badge */}
        {escalationInfo && (
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100">
            <svg className="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-xs font-medium text-orange-700">{escalationInfo.label}</span>
          </div>
        )}

        {/* Assigned To */}
        {assignedTo && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Assigned:</span>
            <span className="text-xs font-medium text-slate-700">{assignedTo}</span>
          </div>
        )}
      </div>

      {/* Right: Quick Actions */}
      <div className="flex items-center gap-2">
        {onAssign && (
          <button
            type="button"
            onClick={onAssign}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Assign
          </button>
        )}

        {onChangePriority && (
          <button
            type="button"
            onClick={onChangePriority}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            Priority
          </button>
        )}

        {onEscalate && (
          <button
            type="button"
            onClick={onEscalate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Escalate
          </button>
        )}

        {onMarkResolved && ticket.status !== 'RESOLVED' && (
          <button
            type="button"
            onClick={onMarkResolved}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Resolve
          </button>
        )}

        {onViewDetails && (
          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Guest Details
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});
