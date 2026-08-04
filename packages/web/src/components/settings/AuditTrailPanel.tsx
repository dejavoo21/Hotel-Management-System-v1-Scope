import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CloudUpload,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FilterX,
  History,
  KeyRound,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { format, formatDistanceToNowStrict, isSameDay } from 'date-fns';
import { Fragment, useDeferredValue, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { AuditLogEntry, AuditSettings } from '@/utils/auditLog';
import { sanitizeAuditEntry } from '@/utils/auditLog';

type AuditTrailPanelProps = {
  settings: AuditSettings;
  logs: AuditLogEntry[];
  onSettingsChange: (settings: AuditSettings) => void;
  onSave: () => void;
  onExportJson: (logs: AuditLogEntry[]) => void;
  onExportCsv: (logs: AuditLogEntry[]) => void;
  onGenerateReport: (logs: AuditLogEntry[]) => void;
};

type SelectOption = { value: string; label: string };
type EventCategory = 'Access' | 'Security' | 'Configuration' | 'User' | 'Export' | 'Report' | 'System' | 'Operations';
type EventSeverity = 'Critical' | 'High' | 'Medium' | 'Info' | 'Low';

const PAGE_SIZE = 10;
const RETENTION_OPTIONS = [30, 90, 180, 365];

const categoryStyles: Record<EventCategory, string> = {
  Access: 'bg-emerald-50 text-emerald-700',
  Security: 'bg-rose-50 text-rose-700',
  Configuration: 'bg-blue-50 text-blue-700',
  User: 'bg-violet-50 text-violet-700',
  Export: 'bg-cyan-50 text-cyan-700',
  Report: 'bg-indigo-50 text-indigo-700',
  System: 'bg-sky-50 text-sky-700',
  Operations: 'bg-slate-100 text-slate-700',
};

const severityStyles: Record<EventSeverity, string> = {
  Critical: 'bg-red-700',
  High: 'bg-rose-500',
  Medium: 'bg-amber-500',
  Info: 'bg-blue-500',
  Low: 'bg-emerald-500',
};

const normalizeAction = (action: string) => action.trim().toUpperCase().replace(/[\s-]+/g, '_');

export function getAuditEventMeta(entry: AuditLogEntry): {
  category: EventCategory;
  severity: EventSeverity;
  readableAction: string;
} {
  const action = normalizeAction(entry.action);
  let category: EventCategory = 'Operations';

  if (action.includes('ACCESS')) category = 'Access';
  else if (/(SECURITY|PASSWORD|2FA|LOGIN|AUTH|CCTV)/.test(action)) category = 'Security';
  else if (/(SETTING|CONFIG|ROLE|APPEARANCE|NOTIFICATION|INTEGRATION)/.test(action)) category = 'Configuration';
  else if (action.includes('USER')) category = 'User';
  else if (action.includes('EXPORT')) category = 'Export';
  else if (action.includes('REPORT')) category = 'Report';
  else if (/(SYSTEM|AUDIT|SESSION)/.test(action)) category = 'System';

  let severity: EventSeverity = 'Low';
  if (/(BREACH|CRITICAL|COMPROMISED)/.test(action)) severity = 'Critical';
  else if (/(DELETED|REJECTED|FAILED|DISABLED)/.test(action)) severity = 'High';
  else if (/(UPDATED|CANCELLED|RESET|CHANGED|REQUESTED)/.test(action)) severity = 'Medium';
  else if (/(EXPORT|REPORT|LOGIN|CREATED)/.test(action)) severity = 'Info';

  const readableAction = action
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return { category, severity, readableAction };
}

function SelectMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.value === value) || options[0];
  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative min-w-40">
        <ListboxButton aria-label={label} className="input flex h-10 items-center justify-between gap-2 text-left">
          <span className="truncate">{selected.label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          className="z-50 max-h-64 w-[var(--button-width)] min-w-48 overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl focus:outline-none [--anchor-gap:4px]"
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-text-main data-[focus]:bg-primary-50 data-[selected]:font-semibold data-[selected]:text-primary-700"
            >
              <span>{option.label}</span>
              {option.value === value ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

function SummaryCard({
  icon: Icon,
  value,
  label,
  supporting,
  tone,
}: {
  icon: typeof ShieldCheck;
  value: string;
  label: string;
  supporting: string;
  tone: string;
}) {
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xl font-bold text-text-main">{value}</p>
        <p className="truncate text-sm font-semibold text-text-main">{label}</p>
        <p className="truncate text-xs text-text-muted">{supporting}</p>
      </div>
    </article>
  );
}

function AuditDetails({ entry }: { entry: AuditLogEntry }) {
  const safeEntry = sanitizeAuditEntry(entry);
  const payload = JSON.stringify(safeEntry.details || {}, null, 2);
  const meta = getAuditEventMeta(entry);
  const details = safeEntry.details || {};
  const detailText = (keys: string[]) => {
    const match = keys.find((key) => typeof details[key] === 'string');
    return match ? String(details[match]) : 'Not recorded';
  };

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      toast.success('Event payload copied');
    } catch {
      toast.error('Event payload could not be copied');
    }
  };

  return (
    <div className="grid gap-5 border-t border-primary-100 bg-primary-50/30 p-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <h4 className="text-sm font-semibold text-text-main">Event details</h4>
        <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-xs">
          <dt className="text-text-muted">Event ID</dt><dd className="break-all font-medium text-text-main">{entry.id}</dd>
          <dt className="text-text-muted">Category</dt><dd className="font-medium text-text-main">{meta.category}</dd>
          <dt className="text-text-muted">Actor ID</dt><dd className="break-all font-medium text-text-main">{entry.actorId || 'Not recorded'}</dd>
          <dt className="text-text-muted">Target ID</dt><dd className="break-all font-medium text-text-main">{entry.targetId || 'Not recorded'}</dd>
          <dt className="text-text-muted">IP address</dt><dd className="break-all font-medium text-text-main">{detailText(['ipAddress', 'ip'])}</dd>
          <dt className="text-text-muted">User agent</dt><dd className="break-all font-medium text-text-main">{detailText(['userAgent', 'browser'])}</dd>
          <dt className="text-text-muted">Session ID</dt><dd className="break-all font-medium text-text-main">{detailText(['sessionId'])}</dd>
          <dt className="text-text-muted">Recorded</dt><dd className="font-medium text-text-main">{format(new Date(entry.createdAt), 'PPpp')}</dd>
        </dl>
      </div>
      <div className="min-w-0 border-border lg:border-l lg:pl-5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-text-main">Event payload</h4>
          <button type="button" className="btn-outline h-8 px-3 text-xs" onClick={copyPayload}>
            <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy JSON
          </button>
        </div>
        <pre className="mt-3 max-h-56 overflow-auto rounded-xl border border-border bg-slate-950 p-4 text-xs leading-5 text-slate-100">
          <code>{payload}</code>
        </pre>
      </div>
    </div>
  );
}

export default function AuditTrailPanel({
  settings,
  logs,
  onSettingsChange,
  onSave,
  onExportJson,
  onExportCsv,
  onGenerateReport,
}: AuditTrailPanelProps) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [category, setCategory] = useState('ALL');
  const [actor, setActor] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [destinationEditorOpen, setDestinationEditorOpen] = useState(false);
  const [page, setPage] = useState(1);

  const actors = useMemo(
    () => Array.from(new Set(logs.map((log) => log.actorName || 'System'))).sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => logs.filter((entry) => {
    const meta = getAuditEventMeta(entry);
    const haystack = [entry.action, meta.readableAction, entry.actorName, entry.targetLabel, entry.targetId]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const eventDate = new Date(entry.createdAt);
    const afterStart = !dateFrom || eventDate >= new Date(`${dateFrom}T00:00:00`);
    const beforeEnd = !dateTo || eventDate <= new Date(`${dateTo}T23:59:59.999`);

    return (!deferredSearch || haystack.includes(deferredSearch))
      && (category === 'ALL' || meta.category === category)
      && (actor === 'ALL' || (entry.actorName || 'System') === actor)
      && (severity === 'ALL' || meta.severity === severity)
      && afterStart
      && beforeEnd;
  }), [actor, category, dateFrom, dateTo, deferredSearch, logs, severity]);

  const summary = useMemo(() => {
    const today = new Date();
    let todayCount = 0;
    let highImpact = 0;
    let accessEvents = 0;
    let exports = 0;
    logs.forEach((entry) => {
      const meta = getAuditEventMeta(entry);
      if (isSameDay(new Date(entry.createdAt), today)) todayCount += 1;
      if (meta.severity === 'High') highImpact += 1;
      if (meta.category === 'Access') accessEvents += 1;
      if (meta.category === 'Export' || meta.category === 'Report') exports += 1;
    });
    return { todayCount, highImpact, accessEvents, exports };
  }, [logs]);

  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleLogs = filteredLogs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const firstResult = filteredLogs.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const lastResult = Math.min(safePage * PAGE_SIZE, filteredLogs.length);
  const hasFilters = Boolean(search || category !== 'ALL' || actor !== 'ALL' || severity !== 'ALL' || dateFrom || dateTo);
  const forwardingConnected = settings.forwardingEnabled && Boolean(settings.forwardingUrl?.trim());

  const updateFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('ALL');
    setActor('ALL');
    setSeverity('ALL');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <section className="space-y-5" aria-labelledby="audit-trail-title">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <History className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h2 id="audit-trail-title" className="text-2xl font-bold tracking-tight text-text-main">Audit Trail</h2>
            <p className="mt-1 text-sm text-text-muted">Track critical changes, monitor system activity, and manage audit retention.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
            <CalendarDays className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <div><p className="text-xs text-text-muted">Retention</p><p className="text-sm font-semibold text-text-main">{settings.retentionDays} days</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
            <CloudUpload className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <div><p className="text-xs text-text-muted">Log forwarding</p><p className="flex items-center gap-1.5 text-sm font-semibold text-text-main">{forwardingConnected ? 'Enabled' : settings.forwardingEnabled ? 'Not connected' : 'Disabled'}<span className={`h-1.5 w-1.5 rounded-full ${forwardingConnected ? 'bg-emerald-500' : settings.forwardingEnabled ? 'bg-amber-500' : 'bg-slate-400'}`} /></p></div>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard icon={ShieldCheck} value={logs.length.toLocaleString()} label="Total audit events" supporting="Workspace browser history" tone="bg-blue-50 text-blue-600" />
        <SummaryCard icon={Activity} value={summary.todayCount.toLocaleString()} label="Events today" supporting="Current local day" tone="bg-emerald-50 text-emerald-600" />
        <SummaryCard icon={AlertTriangle} value={summary.highImpact.toLocaleString()} label="High-impact changes" supporting="Require attention" tone="bg-orange-50 text-orange-600" />
        <SummaryCard icon={KeyRound} value={summary.accessEvents.toLocaleString()} label="Access events" supporting="User and role activity" tone="bg-violet-50 text-violet-600" />
        <SummaryCard icon={Download} value={summary.exports.toLocaleString()} label="Exports generated" supporting="Recorded exports" tone="bg-cyan-50 text-cyan-600" />
        <SummaryCard icon={CloudUpload} value={forwardingConnected ? 'Enabled' : settings.forwardingEnabled ? 'Setup needed' : 'Disabled'} label="Log forwarding" supporting="External destination" tone="bg-sky-50 text-sky-600" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="audit-configuration-title">
        <div className="grid divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="p-5">
            <h3 id="audit-configuration-title" className="font-semibold text-text-main">Retention policy</h3>
            <p className="mt-1 text-sm text-text-muted">Define how long audit records should be retained.</p>
            <label htmlFor="audit-retention" className="label mt-5">Retention (days)</label>
            <div className="relative">
              <input
                id="audit-retention"
                type="number"
                min={14}
                max={365}
                className="input pr-14"
                value={settings.retentionDays}
                onChange={(event) => onSettingsChange({ ...settings, retentionDays: Number(event.target.value || 0) })}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-text-muted">days</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Retention presets">
              {RETENTION_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, retentionDays: days })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${settings.retentionDays === days ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-border bg-card text-text-muted hover:bg-bg'}`}
                >
                  {days} days
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-muted">Recommended: 90 days for operational audit needs.</p>
          </div>

          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-text-main">External log forwarding</h3>
                <p className="mt-1 text-sm text-text-muted">Send audit copies to your connected monitoring tool.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.forwardingEnabled}
                aria-label="External log forwarding"
                onClick={() => onSettingsChange({ ...settings, forwardingEnabled: !settings.forwardingEnabled })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${settings.forwardingEnabled ? 'bg-primary-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${settings.forwardingEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="mt-5 rounded-xl border border-border bg-bg/50 p-4">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${forwardingConnected ? 'bg-emerald-100 text-emerald-700' : settings.forwardingEnabled ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>{forwardingConnected ? 'Enabled' : settings.forwardingEnabled ? 'Not connected' : 'Disabled'}</span>
              {settings.forwardingEnabled ? (
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div className="min-w-0"><p className="text-xs text-text-muted">Destination</p><p className="truncate text-sm font-semibold text-text-main">{settings.forwardingUrl || 'No destination configured'}</p></div>
                  <button type="button" className="btn-outline h-9 px-3 text-xs" onClick={() => setDestinationEditorOpen(true)}>Edit</button>
                </div>
              ) : <p className="mt-3 text-sm text-text-muted">Enable forwarding to configure an external destination.</p>}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={onSave}><ClipboardCheck className="h-4 w-4" aria-hidden="true" />Save Audit Settings</button>
            <button type="button" className="btn-outline" onClick={() => onExportJson(filteredLogs)}><FileJson className="h-4 w-4" aria-hidden="true" />Export JSON</button>
            <button type="button" className="btn-outline" onClick={() => onExportCsv(filteredLogs)}><FileSpreadsheet className="h-4 w-4" aria-hidden="true" />Export CSV</button>
          </div>
          <button type="button" className="btn-outline" onClick={() => onGenerateReport(filteredLogs)}><ShieldCheck className="h-4 w-4" aria-hidden="true" />Generate Compliance Report</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="recent-activity-title">
        <div className="border-b border-border p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 id="recent-activity-title" className="text-lg font-semibold text-text-main">Recent Activity</h3>
              <p className="mt-1 text-sm text-text-muted">Review recent system and user actions.</p>
            </div>
            <span
              className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
              title="This view currently uses records stored in this browser. Connect the production audit history API before treating it as an authoritative compliance record."
            >
              Workspace audit cache
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(15rem,1.5fr)_1fr_1fr_1fr_1fr_auto]">
            <label className="relative block">
              <span className="sr-only">Search audit events</span>
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-muted" aria-hidden="true" />
              <input value={search} onChange={(event) => updateFilter(setSearch, event.target.value)} placeholder="Search events..." className="input h-10 pl-9" />
            </label>
            <SelectMenu label="Filter by event type" value={category} onChange={(value) => updateFilter(setCategory, value)} options={[{ value: 'ALL', label: 'All event types' }, ...(['Access', 'Security', 'Configuration', 'User', 'Export', 'Report', 'System', 'Operations'] as EventCategory[]).map((value) => ({ value, label: value }))]} />
            <SelectMenu label="Filter by actor" value={actor} onChange={(value) => updateFilter(setActor, value)} options={[{ value: 'ALL', label: 'All actors' }, ...actors.map((value) => ({ value, label: value }))]} />
            <SelectMenu label="Filter by severity" value={severity} onChange={(value) => updateFilter(setSeverity, value)} options={[{ value: 'ALL', label: 'All severity' }, ...(['Critical', 'High', 'Medium', 'Info', 'Low'] as EventSeverity[]).map((value) => ({ value, label: value }))]} />
            <div className="grid grid-cols-2 gap-2">
              <label><span className="sr-only">From date</span><input type="date" aria-label="From date" className="input h-10 px-2 text-xs" value={dateFrom} onChange={(event) => updateFilter(setDateFrom, event.target.value)} /></label>
              <label><span className="sr-only">To date</span><input type="date" aria-label="To date" className="input h-10 px-2 text-xs" value={dateTo} onChange={(event) => updateFilter(setDateTo, event.target.value)} /></label>
            </div>
            <button type="button" className="btn-ghost h-10 whitespace-nowrap px-3" onClick={clearFilters} disabled={!hasFilters}><FilterX className="h-4 w-4" aria-hidden="true" />Clear filters</button>
          </div>
        </div>

        {visibleLogs.length === 0 ? (
          <div className="p-10 text-center">
            <History className="mx-auto h-9 w-9 text-text-muted" aria-hidden="true" />
            <p className="mt-3 font-semibold text-text-main">{logs.length ? 'No audit entries match your filters.' : 'No audit events found.'}</p>
            <p className="mt-1 text-sm text-text-muted">{logs.length ? 'Adjust or clear the filters to see more activity.' : 'Recorded system and user actions will appear here.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[880px] w-full text-left text-sm">
              <thead className="bg-bg/70 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <tr><th className="px-5 py-3">Event</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Date &amp; time</th><th className="px-4 py-3">Severity</th><th className="px-5 py-3 text-right">Details</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleLogs.map((entry) => {
                  const meta = getAuditEventMeta(entry);
                  const isExpanded = expandedId === entry.id;
                  return (
                    <Fragment key={entry.id}>
                      <tr className="hover:bg-bg/40">
                        <td className="px-5 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${categoryStyles[meta.category]}`}><Activity className="h-4 w-4" aria-hidden="true" /></span>
                            <div className="min-w-0"><p className="truncate font-semibold text-text-main">{meta.readableAction}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryStyles[meta.category]}`}>{meta.category}</span></div>
                          </div>
                        </td>
                        <td className="min-w-0 px-4 py-3"><p className="truncate font-medium text-text-main">{entry.actorName || 'System'}</p><p className="truncate text-xs text-text-muted">{entry.actorId || 'System actor'}</p></td>
                        <td className="min-w-0 px-4 py-3"><p className="truncate font-medium text-text-main">{entry.targetLabel || entry.targetId || 'Platform'}</p><p className="truncate text-xs text-text-muted">{entry.targetId || 'General event'}</p></td>
                        <td className="px-4 py-3"><p className="whitespace-nowrap font-medium text-text-main">{format(new Date(entry.createdAt), 'MMM d, yyyy · h:mm a')}</p><p className="text-xs text-text-muted">{formatDistanceToNowStrict(new Date(entry.createdAt), { addSuffix: true })}</p></td>
                        <td className="px-4 py-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${severityStyles[meta.severity]}`} /><span className="text-text-muted">{meta.severity}</span></div></td>
                        <td className="px-5 py-3 text-right"><button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-border/60 hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${meta.readableAction}`} aria-expanded={isExpanded} onClick={() => setExpandedId(isExpanded ? null : entry.id)}><ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} aria-hidden="true" /></button></td>
                      </tr>
                      {isExpanded ? <tr><td colSpan={6} className="p-0"><AuditDetails entry={entry} /></td></tr> : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="flex flex-col gap-3 border-t border-border px-5 py-3 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {firstResult} to {lastResult} of {filteredLogs.length} events</span>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-outline h-8 px-3 text-xs" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            <span className="min-w-14 text-center text-xs">{safePage} / {pageCount}</span>
            <button type="button" className="btn-outline h-8 px-3 text-xs" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button>
          </div>
        </footer>
      </section>

      {destinationEditorOpen ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="forwarding-editor-title">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h3 id="forwarding-editor-title" className="text-lg font-semibold text-text-main">External log destination</h3><p className="mt-1 text-sm text-text-muted">Configure the HTTPS endpoint supplied by your monitoring provider.</p></div>
              <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setDestinationEditorOpen(false)} aria-label="Close destination editor"><X className="h-4 w-4" /></button>
            </div>
            <label htmlFor="forwarding-url" className="label mt-5">Destination URL</label>
            <input id="forwarding-url" type="url" className="input" placeholder="https://logs.example.com/ingest" value={settings.forwardingUrl || ''} onChange={(event) => onSettingsChange({ ...settings, forwardingUrl: event.target.value })} />
            <p className="mt-3 text-xs text-text-muted">Credentials are not collected in this browser. Secure authentication requires the production forwarding service.</p>
            <div className="mt-5 flex justify-end"><button type="button" className="btn-primary" onClick={() => setDestinationEditorOpen(false)}>Done</button></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
