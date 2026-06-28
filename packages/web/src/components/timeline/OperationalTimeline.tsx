import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Bed,
  Bot,
  Building2,
  CalendarCheck,
  ClipboardList,
  MessageSquare,
  Phone,
  Receipt,
  Shield,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { timelineService } from '@/services';
import type { TimelineEvent, TimelineFilters, TimelineSeverity } from '@/services/timeline';

const severityClass: Record<TimelineSeverity, string> = {
  INFO: 'bg-slate-50 text-slate-700 ring-slate-200',
  SUCCESS: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  WARNING: 'bg-amber-50 text-amber-700 ring-amber-200',
  CRITICAL: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const icons = {
  activity: Activity,
  bed: Bed,
  bot: Bot,
  'building-2': Building2,
  'calendar-check': CalendarCheck,
  'clipboard-list': ClipboardList,
  'message-square': MessageSquare,
  phone: Phone,
  receipt: Receipt,
  shield: Shield,
  sparkles: Sparkles,
  wrench: Wrench,
};

function TimelineIcon({ name }: { name: string }) {
  const Icon = icons[name as keyof typeof icons] || Activity;
  return <Icon className="h-4 w-4" />;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  return (
    <div className="flex gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200">
        <TimelineIcon name={event.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{event.module}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${severityClass[event.severity]}`}>
            {event.severity}
          </span>
          {event.department ? (
            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
              {event.department.replace(/_/g, ' ')}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-sm text-slate-700">{event.summary}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{formatTime(event.timestamp)}</span>
          {event.location ? <span>{event.location}</span> : null}
          {event.status ? <span>Status: {event.status}</span> : null}
          {event.actor?.name ? <span>By {event.actor.name}</span> : null}
          {event.linkedEntity?.id ? (
            <span>
              {event.linkedEntity.type}: {event.linkedEntity.id.slice(0, 8)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function OperationalTimeline() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TimelineFilters>({ limit: 100, time: '24h' });

  const query = useQuery({
    queryKey: ['timeline', filters],
    queryFn: () => timelineService.list(filters),
    staleTime: 10_000,
  });

  useEffect(() => {
    const onTimelineEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    };
    window.addEventListener('hotelos:timeline-event', onTimelineEvent);
    return () => window.removeEventListener('hotelos:timeline-event', onTimelineEvent);
  }, [queryClient]);

  const data = query.data;
  const modules = data?.filters.modules || [];
  const severities = data?.filters.severities || [];
  const departments = data?.filters.departments || [];

  const events = useMemo(() => data?.events || [], [data?.events]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
          <p className="text-sm text-slate-500">Last 100 operational events from the platform Event Bus.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          <select
            value={filters.module || ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, module: event.target.value || undefined }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            aria-label="Filter timeline by module"
          >
            <option value="">All modules</option>
            {modules.map((module) => (
              <option key={module} value={module}>{module}</option>
            ))}
          </select>

          <select
            value={filters.severity || ''}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, severity: (event.target.value || undefined) as TimelineSeverity | undefined }))
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            aria-label="Filter timeline by severity"
          >
            <option value="">All severities</option>
            {severities.map((severity) => (
              <option key={severity} value={severity}>{severity}</option>
            ))}
          </select>

          <select
            value={filters.department || ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, department: event.target.value || undefined }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            aria-label="Filter timeline by department"
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>{department.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <select
            value={filters.time || ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, time: (event.target.value || undefined) as TimelineFilters['time'] }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            aria-label="Filter timeline by time"
          >
            <option value="">All time</option>
            <option value="1h">Last hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>
        </div>
      </div>

      <div className="max-h-[520px] overflow-y-auto">
        {query.isLoading ? (
          <div className="px-4 py-8 text-sm text-slate-500">Loading recent activity...</div>
        ) : query.isError ? (
          <div className="px-4 py-8 text-sm text-rose-600">Unable to load recent activity.</div>
        ) : events.length ? (
          events.map((event) => <TimelineRow key={event.id} event={event} />)
        ) : (
          <div className="px-4 py-8 text-sm text-slate-500">
            No operational events have been published yet. New Event Bus activity will appear here in real time.
          </div>
        )}
      </div>
    </section>
  );
}
