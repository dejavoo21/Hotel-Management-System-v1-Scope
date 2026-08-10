import { useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  FileChartColumn,
  FilterX,
  Lightbulb,
  Mail,
  Search,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react';

export type NotificationPreferences = Record<string, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  newBookings: true,
  checkIns: true,
  checkOuts: false,
  lateCheckOuts: false,
  noShows: true,
  housekeepingUpdates: false,
  roomReadiness: false,
  delayedCleaning: false,
  pendingInspection: false,
  maintenanceAlerts: true,
  roomBlockers: true,
  overdueTasks: false,
  inventoryLowStock: false,
  guestRequests: true,
  guestComplaints: true,
  negativeReviews: true,
  conciergeEscalations: false,
  securityAlerts: true,
  cctvOffline: true,
  deviceOffline: true,
  doorAccessAlerts: true,
  dailyReports: true,
  weeklyReports: false,
  operationsSummary: true,
  inAppChannel: true,
  emailChannel: true,
};

type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
type Category = 'Booking & Front Desk' | 'Rooms & Housekeeping' | 'Operations & Maintenance' | 'Guest Experience' | 'Security & Smart Building' | 'Reports & Summaries';
type PreferenceDefinition = { id: string; title: string; description: string; category: Category; priority: Priority };

const definitions: PreferenceDefinition[] = [
  { id: 'newBookings', title: 'New Bookings', description: 'Get notified when a new booking is made.', category: 'Booking & Front Desk', priority: 'High' },
  { id: 'checkIns', title: 'Check-ins', description: 'Get notified when guests check in.', category: 'Booking & Front Desk', priority: 'Medium' },
  { id: 'checkOuts', title: 'Check-outs', description: 'Get notified when guests check out.', category: 'Booking & Front Desk', priority: 'Low' },
  { id: 'lateCheckOuts', title: 'Late Check-outs', description: 'Get notified about late check-outs.', category: 'Booking & Front Desk', priority: 'Medium' },
  { id: 'noShows', title: 'No-shows', description: 'Get notified when reservations are marked as no-show.', category: 'Booking & Front Desk', priority: 'High' },
  { id: 'housekeepingUpdates', title: 'Housekeeping Updates', description: 'Get notified when room status changes.', category: 'Rooms & Housekeeping', priority: 'Medium' },
  { id: 'roomReadiness', title: 'Room Readiness Changes', description: 'Get notified when rooms become ready or unavailable.', category: 'Rooms & Housekeeping', priority: 'Low' },
  { id: 'delayedCleaning', title: 'Delayed Cleaning Tasks', description: 'Get notified when cleaning tasks are delayed.', category: 'Rooms & Housekeeping', priority: 'Medium' },
  { id: 'pendingInspection', title: 'Rooms Pending Inspection', description: 'Get notified when rooms await inspection.', category: 'Rooms & Housekeeping', priority: 'Low' },
  { id: 'maintenanceAlerts', title: 'Maintenance Alerts', description: 'Receive alerts for new maintenance issues.', category: 'Operations & Maintenance', priority: 'Medium' },
  { id: 'roomBlockers', title: 'Room Blockers', description: 'Receive urgent alerts for blocked rooms.', category: 'Operations & Maintenance', priority: 'High' },
  { id: 'overdueTasks', title: 'Overdue Tasks', description: 'Get notified when operational tasks become overdue.', category: 'Operations & Maintenance', priority: 'High' },
  { id: 'inventoryLowStock', title: 'Inventory Low Stock', description: 'Get notified when operational stock runs low.', category: 'Operations & Maintenance', priority: 'Medium' },
  { id: 'guestRequests', title: 'Guest Requests', description: 'Get notified about new guest service requests.', category: 'Guest Experience', priority: 'Medium' },
  { id: 'guestComplaints', title: 'Guest Complaints', description: 'Receive alerts when a complaint is recorded.', category: 'Guest Experience', priority: 'High' },
  { id: 'negativeReviews', title: 'Negative Reviews', description: 'Get notified about low guest review scores.', category: 'Guest Experience', priority: 'Medium' },
  { id: 'conciergeEscalations', title: 'Concierge Escalations', description: 'Receive escalated concierge requests.', category: 'Guest Experience', priority: 'High' },
  { id: 'securityAlerts', title: 'Security Alerts', description: 'Receive critical security and incident alerts.', category: 'Security & Smart Building', priority: 'Critical' },
  { id: 'cctvOffline', title: 'CCTV Offline', description: 'Get notified when a camera or recorder goes offline.', category: 'Security & Smart Building', priority: 'Critical' },
  { id: 'deviceOffline', title: 'Device Offline', description: 'Get notified when a smart-building device disconnects.', category: 'Security & Smart Building', priority: 'High' },
  { id: 'doorAccessAlerts', title: 'Door / Access Alerts', description: 'Receive door and access-control alerts.', category: 'Security & Smart Building', priority: 'Critical' },
  { id: 'dailyReports', title: 'Daily Reports', description: 'Receive daily operational summaries.', category: 'Reports & Summaries', priority: 'Low' },
  { id: 'weeklyReports', title: 'Weekly Reports', description: 'Receive weekly performance summaries.', category: 'Reports & Summaries', priority: 'Low' },
  { id: 'operationsSummary', title: 'Operations Summary', description: 'Receive Hotel Brain attention and operations summaries.', category: 'Reports & Summaries', priority: 'Low' },
];

const categories = Array.from(new Set(definitions.map((item) => item.category)));
const tabs = [
  { id: 'ALL', label: 'All Notifications' },
  { id: 'PRIORITY', label: 'Critical & High Priority' },
  { id: 'Rooms & Housekeeping', label: 'Housekeeping' },
  { id: 'Reports & Summaries', label: 'Reports' },
  { id: 'Security & Smart Building', label: 'Security' },
  { id: 'Guest Experience', label: 'Guest Experience' },
] as const;

const priorityStyles: Record<Priority, string> = {
  Low: 'border-blue-200 bg-blue-50 text-blue-700',
  Medium: 'border-amber-200 bg-amber-50 text-amber-700',
  High: 'border-rose-200 bg-rose-50 text-rose-700',
  Critical: 'border-red-300 bg-red-50 text-red-700',
};

function Toggle({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 before:absolute before:-inset-2 before:content-[''] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'border-primary-600 bg-primary-600 hover:bg-primary-700'
          : 'border-slate-300 bg-slate-200 hover:bg-slate-300'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 h-[14px] w-[14px] rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function NotificationPreferencesPanel({ values, savedValues, canEdit, onChange, onSave, onReset }: { values: NotificationPreferences; savedValues: NotificationPreferences; canEdit: boolean; onChange: (next: NotificationPreferences) => void; onSave: () => void; onReset: () => void }) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [channel, setChannel] = useState('ALL');
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(savedValues);
  const enabledCount = definitions.filter((item) => values[item.id]).length;
  const criticalEnabled = definitions.some((item) => item.priority === 'Critical' && values[item.id]);
  const visible = useMemo(() => definitions.filter((item) => {
    const matchesTab = activeTab === 'ALL'
      || (activeTab === 'PRIORITY' && (item.priority === 'Critical' || item.priority === 'High'))
      || item.category === activeTab;
    const matchesChannel = channel === 'ALL'
      || (channel === 'IN_APP' && values.inAppChannel)
      || (channel === 'EMAIL' && values.emailChannel);

    return matchesTab
      && matchesChannel
      && (!search.trim() || `${item.title} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()))
      && (category === 'ALL' || item.category === category)
      && (priority === 'ALL' || item.priority === priority)
      && (!enabledOnly || values[item.id]);
  }), [activeTab, category, channel, enabledOnly, priority, search, values]);
  const grouped = categories.map((name) => ({ name, items: visible.filter((item) => item.category === name) })).filter((group) => group.items.length);
  const setValue = (id: string, checked: boolean) => onChange({ ...values, [id]: checked });
  const channels = [values.inAppChannel ? 'In-app' : null, values.emailChannel ? 'Email' : null].filter(Boolean).join(' + ') || 'None';
  const resetFilters = () => {
    setSearch('');
    setActiveTab('ALL');
    setCategory('ALL');
    setPriority('ALL');
    setChannel('ALL');
    setEnabledOnly(false);
  };

  return <div className="space-y-3 pb-1" data-notification-preferences>
    <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100"><Bell className="h-6 w-6" /></span><div><h2 className="text-2xl font-bold tracking-tight text-text-main">Notification Preferences</h2><p className="mt-1 text-sm text-text-muted">Choose which operational alerts, reminders, and reports you want to receive.</p></div></div>
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700"><CheckCircle2 className="h-4 w-4" />{enabledCount} active preferences</span>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Notification summary">
      <article className="flex min-h-24 items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 shadow-sm"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Bell className="h-5 w-5" /></span><div><p className="text-xs font-semibold text-text-muted">Active Preferences</p><p className="mt-0.5 text-lg font-bold text-text-main">{enabledCount} enabled</p><p className="text-xs text-text-muted">Out of {definitions.length} available</p></div></article>
      <article className="flex min-h-24 items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/40 p-3 shadow-sm"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600"><ShieldAlert className="h-5 w-5" /></span><div><p className="text-xs font-semibold text-text-muted">Critical Alerts</p><p className="mt-0.5 text-lg font-bold text-text-main">{criticalEnabled ? 'Enabled' : 'Disabled'}</p><p className="text-xs text-text-muted">Security and urgent alerts</p></div></article>
      <article className="flex min-h-24 items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-3 shadow-sm"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-600"><BarChart3 className="h-5 w-5" /></span><div><p className="text-xs font-semibold text-text-muted">Daily Reports</p><p className="mt-0.5 text-lg font-bold text-text-main">{values.dailyReports ? 'Enabled' : 'Disabled'}</p><p className="text-xs text-text-muted">Summary and reports</p></div></article>
      <article className="flex min-h-24 items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/40 p-3 shadow-sm"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-600"><Mail className="h-5 w-5" /></span><div><p className="text-xs font-semibold text-text-muted">Delivery Channels</p><p className="mt-0.5 text-lg font-bold text-text-main">{channels}</p><p className="text-xs text-text-muted">{[values.inAppChannel, values.emailChannel].filter(Boolean).length} active channels</p></div></article>
    </section>

    <nav aria-label="Notification categories" className="overflow-x-auto border-b border-border">
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => <button key={tab.id} type="button" aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${activeTab === tab.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-text-muted hover:border-border hover:text-text-main'}`}>{tab.label}</button>)}
      </div>
    </nav>

    <section className="grid gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-sm md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_0.9fr_auto_auto]">
      <label className="relative"><span className="sr-only">Search notifications</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-muted" /><input className="input h-10 pl-9" placeholder="Search notifications..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <select aria-label="Notification category" className="input h-10" value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select>
      <select aria-label="Notification priority" className="input h-10" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="ALL">All priorities</option>{['Low', 'Medium', 'High', 'Critical'].map((value) => <option key={value}>{value}</option>)}</select>
      <select aria-label="Notification channel" className="input h-10" value={channel} onChange={(event) => setChannel(event.target.value)}><option value="ALL">All channels</option><option value="IN_APP">In-app</option><option value="EMAIL">Email</option></select>
      <label className="flex h-10 items-center gap-2 whitespace-nowrap px-2 text-sm text-text-muted"><Toggle checked={enabledOnly} disabled={false} label="Enabled notifications only" onChange={() => setEnabledOnly((current) => !current)} />Enabled only</label>
      <button type="button" className="btn-ghost h-10 whitespace-nowrap px-3" onClick={resetFilters}><FilterX className="h-4 w-4" />Clear filters</button>
    </section>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="space-y-3">
        {grouped.map((group) => <section key={group.name} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <header className="grid items-center gap-3 border-b border-border px-4 py-2.5 lg:grid-cols-[minmax(0,1fr)_7rem_10rem_5rem]">
            <div className="flex items-center gap-3"><h3 className="font-semibold text-text-main">{group.name}</h3><span className="rounded-full bg-bg px-2.5 py-1 text-xs text-text-muted">{group.items.length} notifications</span></div>
            <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-text-muted lg:block">Priority</span><span className="hidden text-[11px] font-semibold uppercase tracking-wide text-text-muted lg:block">Channels</span><span aria-hidden="true" />
          </header>
          <div className="divide-y divide-border">{group.items.map((item) => <div key={item.id}>
            <div className="grid gap-3 px-4 py-2 lg:grid-cols-[minmax(0,1fr)_7rem_10rem_5rem] lg:items-center">
              <div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700">{item.category === 'Booking & Front Desk' ? <CalendarCheck className="h-4 w-4" /> : item.category === 'Operations & Maintenance' ? <Wrench className="h-4 w-4" /> : item.category === 'Security & Smart Building' ? <ShieldAlert className="h-4 w-4" /> : item.category === 'Reports & Summaries' ? <FileChartColumn className="h-4 w-4" /> : item.category === 'Guest Experience' ? <Sparkles className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}</span><div className="min-w-0"><p className="text-sm font-semibold text-text-main">{item.title}</p><p className="text-xs text-text-muted">{item.description}</p></div></div>
              <div><span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityStyles[item.priority]}`}>{item.priority}</span></div>
              <div className="flex items-center gap-3 text-xs text-text-muted">{values.inAppChannel ? <span className="inline-flex items-center gap-1"><Bell className="h-4 w-4 text-emerald-600" />In-app</span> : null}{values.emailChannel ? <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4 text-emerald-600" />Email</span> : null}</div>
              <div className="flex items-center justify-end gap-2"><Toggle checked={Boolean(values[item.id])} disabled={!canEdit} label={`${item.title} notifications`} onChange={() => setValue(item.id, !values[item.id])} /><button type="button" aria-label={`${expandedId === item.id ? 'Hide' : 'Show'} ${item.title} details`} aria-expanded={expandedId === item.id} onClick={() => setExpandedId((current) => current === item.id ? null : item.id)} className="rounded-lg p-1.5 text-text-muted hover:bg-bg hover:text-text-main"><ChevronDown className={`h-4 w-4 transition-transform ${expandedId === item.id ? 'rotate-180' : ''}`} /></button></div>
            </div>
            {expandedId === item.id ? <div className="border-t border-border bg-bg/60 px-16 py-3 text-xs text-text-muted">This alert uses your active delivery channels and follows the selected {item.priority.toLowerCase()} priority rules.</div> : null}
          </div>)}</div>
        </section>)}
        {!grouped.length ? <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center"><Bell className="mx-auto h-8 w-8 text-text-muted" /><p className="mt-3 font-semibold text-text-main">No notifications match your filters.</p><button type="button" className="btn-outline mt-4" onClick={resetFilters}>Clear filters</button></div> : null}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:h-fit">
        <section className="rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border p-4"><h3 className="font-semibold text-text-main">Delivery Channels</h3><p className="mt-1 text-xs text-text-muted">Choose how you receive notifications.</p></div>{[['inAppChannel', Bell, 'In-app notifications', 'Real-time alerts in LaFlo'], ['emailChannel', Mail, 'Email notifications', 'Receive notifications via email']].map(([id, Icon, title, description]) => <div key={String(id)} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3 border-b border-border p-4 last:border-0"><div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700"><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-sm font-semibold text-text-main">{String(title)}</p><p className="text-xs text-text-muted">{String(description)}</p></div></div><div className="flex justify-end"><Toggle checked={Boolean(values[String(id)])} disabled={!canEdit} label={String(title)} onChange={() => setValue(String(id), !values[String(id)])} /></div></div>)}</section>
        <div className="rounded-2xl border border-primary-200 bg-primary-50/50 p-4 text-sm text-primary-800"><div className="flex items-start gap-3"><Lightbulb className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">About notification priorities</p><p className="mt-1 text-xs">Critical and High priority alerts are always available in-app when that delivery channel is enabled.</p></div></div></div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-sm font-semibold text-text-main">Need help?</p><p className="mt-1 text-xs text-text-muted">Learn more about notifications</p><a href="https://laflogroup.com" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">View documentation <ExternalLink className="h-3.5 w-3.5" /></a></div>
        {!canEdit ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">You have read-only access. An administrator must update notification preferences.</div> : null}
      </aside>
    </div>

    <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-sm text-text-muted"><span className={`h-2 w-2 rounded-full ${dirty ? 'bg-amber-500' : 'bg-emerald-500'}`} />{dirty ? 'You have unsaved changes' : 'All preferences are saved'}</p><div className="flex gap-2"><button type="button" className="btn-outline" disabled={!dirty || !canEdit} onClick={onReset}>Reset changes</button><button type="button" className="btn-primary" disabled={!dirty || !canEdit} onClick={onSave}>Save preferences</button></div></div>
  </div>;
}
