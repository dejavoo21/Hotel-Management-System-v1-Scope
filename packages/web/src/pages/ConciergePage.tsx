import { FormEvent, useMemo, useState } from 'react';
import {
  CalendarClock,
  CircleUserRound,
  Grid2X2,
  List,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserRoundCog,
  UsersRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { appendAuditLog } from '@/utils/auditLog';

type ConciergeStatus = 'Active' | 'Inactive' | 'On Leave' | 'Off Shift';
type ConciergePosition = 'Head Concierge' | 'Senior Concierge' | 'Concierge';
type ViewMode = 'table' | 'cards';

type ConciergeStaff = {
  id: string;
  name: string;
  staffCode: string;
  position: ConciergePosition;
  scheduleDays: string;
  shift: string;
  contact: string;
  email: string;
  status: ConciergeStatus;
  openRequests: number;
  completedToday: number;
  notes?: string;
};

const seedStaff: ConciergeStaff[] = [
  { id: 'c1', name: 'Bebe W. Cullen', staffCode: 'ELC001', position: 'Head Concierge', scheduleDays: 'Monday – Friday', shift: '8:00 AM – 4:00 PM', contact: '+1 (555) 234-5678', email: 'bebe.cullen@example.com', status: 'Active', openRequests: 4, completedToday: 12 },
  { id: 'c2', name: 'Alvar King', staffCode: 'ELC002', position: 'Senior Concierge', scheduleDays: 'Monday – Friday', shift: '12:00 PM – 8:00 PM', contact: '+1 (555) 345-6789', email: 'alvar.king@example.com', status: 'Active', openRequests: 3, completedToday: 9 },
  { id: 'c3', name: 'Sofia Reed', staffCode: 'ELC003', position: 'Concierge', scheduleDays: 'Tuesday – Saturday', shift: '9:00 AM – 5:00 PM', contact: '+1 (555) 981-2234', email: 'sofia.reed@example.com', status: 'Inactive', openRequests: 0, completedToday: 0 },
];

const statusTone: Record<ConciergeStatus, string> = {
  Active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Inactive: 'border-slate-200 bg-slate-100 text-slate-600',
  'On Leave': 'border-amber-200 bg-amber-50 text-amber-700',
  'Off Shift': 'border-slate-200 bg-slate-50 text-slate-600',
};

const initials = (name: string) => name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
const isWeekendSchedule = (value: string) => /saturday|sunday/i.test(value);
const shiftGroup = (value: string) => {
  if (/8:00 AM|9:00 AM/i.test(value)) return 'Morning';
  if (/12:00 PM/i.test(value)) return 'Afternoon';
  return 'Evening';
};

function StatusPill({ status }: { status: ConciergeStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone[status]}`}>{status}</span>;
}

function StaffAvatar({ name }: { name: string }) {
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-sm font-bold text-primary-700 ring-1 ring-primary-100">{initials(name)}</span>;
}

export default function ConciergePage() {
  const { user } = useAuthStore();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [staff, setStaff] = useState(seedStaff);
  const [positionFilter, setPositionFilter] = useState<'all' | ConciergePosition>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ConciergeStatus>('all');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'Weekday' | 'Weekend'>('all');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'Morning' | 'Afternoon' | 'Evening'>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editing, setEditing] = useState<ConciergeStaff | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staff.filter((member) => {
      if (positionFilter !== 'all' && member.position !== positionFilter) return false;
      if (statusFilter !== 'all' && member.status !== statusFilter) return false;
      if (scheduleFilter === 'Weekday' && isWeekendSchedule(member.scheduleDays)) return false;
      if (scheduleFilter === 'Weekend' && !isWeekendSchedule(member.scheduleDays)) return false;
      if (shiftFilter !== 'all' && shiftGroup(member.shift) !== shiftFilter) return false;
      return !query || [member.name, member.staffCode, member.position, member.contact, member.email].some((value) => value.toLowerCase().includes(query));
    });
  }, [positionFilter, scheduleFilter, search, shiftFilter, staff, statusFilter]);

  const activeCount = staff.filter((member) => member.status === 'Active').length;
  const onShiftCount = staff.filter((member) => member.status === 'Active' && shiftGroup(member.shift) !== 'Evening').length;
  const openRequestCount = staff.reduce((total, member) => total + member.openRequests, 0);
  const hasFilters = Boolean(search || positionFilter !== 'all' || statusFilter !== 'all' || scheduleFilter !== 'all' || shiftFilter !== 'all');
  const actorName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Authorised user';
  const summaryCards: Array<{ icon: LucideIcon; value: number | string; label: string; supporting: string }> = [
    { icon: UsersRound, value: staff.length, label: 'Total Concierge Staff', supporting: 'All concierge team members' },
    { icon: UserCheck, value: activeCount, label: 'Active Staff', supporting: 'Currently active' },
    { icon: CalendarClock, value: onShiftCount, label: 'On Shift Today', supporting: 'Scheduled coverage' },
    { icon: CircleUserRound, value: openRequestCount, label: 'Open Guest Requests', supporting: 'Sample workload' },
    { icon: ShieldCheck, value: activeCount > 0 ? 'Covered' : 'Gap', label: 'Coverage Status', supporting: activeCount > 0 ? 'Current service available' : 'Requires attention' },
  ];

  const clearFilters = () => {
    setSearch('');
    setPositionFilter('all');
    setStatusFilter('all');
    setScheduleFilter('all');
    setShiftFilter('all');
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (member: ConciergeStaff) => {
    setEditing(member);
    setActionMenu(null);
    setFormOpen(true);
  };

  const submitStaff = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;
    const form = new FormData(event.currentTarget);
    const next: ConciergeStaff = {
      id: editing?.id || `concierge-${Date.now()}`,
      name: String(form.get('name') || '').trim(),
      staffCode: String(form.get('staffCode') || '').trim(),
      position: String(form.get('position')) as ConciergePosition,
      scheduleDays: String(form.get('scheduleDays') || '').trim(),
      shift: String(form.get('shift') || '').trim(),
      contact: String(form.get('contact') || '').trim(),
      email: String(form.get('email') || '').trim(),
      status: String(form.get('status')) as ConciergeStatus,
      openRequests: editing?.openRequests || 0,
      completedToday: editing?.completedToday || 0,
      notes: String(form.get('notes') || '').trim(),
    };
    if (!next.name || !next.staffCode || !next.position || !next.scheduleDays || !next.shift) return;
    setStaff((current) => editing ? current.map((member) => member.id === editing.id ? next : member) : [next, ...current]);
    appendAuditLog({ action: editing ? 'Concierge Staff Updated' : 'Concierge Staff Added', actorId: user?.id, actorName, targetId: next.id, targetLabel: next.name, details: { employeeId: next.staffCode, position: next.position, status: next.status } });
    setFormOpen(false);
    setEditing(null);
  };

  const toggleStatus = (member: ConciergeStaff) => {
    if (!canManage) return;
    const nextStatus: ConciergeStatus = member.status === 'Inactive' ? 'Active' : 'Inactive';
    if (!window.confirm(`${nextStatus === 'Inactive' ? 'Deactivate' : 'Reactivate'} ${member.name}?`)) return;
    setStaff((current) => current.map((item) => item.id === member.id ? { ...item, status: nextStatus } : item));
    appendAuditLog({ action: nextStatus === 'Inactive' ? 'Concierge Staff Deactivated' : 'Concierge Staff Reactivated', actorId: user?.id, actorName, targetId: member.id, targetLabel: member.name, details: { employeeId: member.staffCode, status: nextStatus } });
    setActionMenu(null);
  };

  return (
    <div className="space-y-4 pb-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="theme-kpi-icon grid h-12 w-12 shrink-0 place-items-center rounded-2xl"><Sparkles className="h-6 w-6" aria-hidden="true" /></span>
          <div><h1 className="text-2xl font-bold tracking-tight text-text-main">Concierge</h1><p className="mt-1 text-sm text-text-muted">Manage concierge staff, service coverage, schedules, and guest-service availability.</p></div>
        </div>
        {canManage ? <button type="button" className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" aria-hidden="true" />Add Concierge</button> : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5" aria-label="Concierge summary">
        {summaryCards.map(({ icon: Icon, value, label, supporting }) => <article key={label} className="theme-stat-card flex min-h-28 items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><span className="theme-kpi-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><Icon className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-xl font-bold text-text-main">{value}</p><p className="text-sm font-semibold text-text-main">{label}</p><p className="text-xs text-text-muted">{supporting}</p></div></article>)}
      </section>

      <section className="rounded-2xl border border-border bg-card p-3 shadow-sm" aria-label="Concierge filters">
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(18rem,1.6fr)_1fr_1fr_1fr_1fr_auto_auto]">
          <label className="relative"><span className="sr-only">Search concierge staff</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-muted" /><input className="input h-10 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, phone, or employee ID..." /></label>
          <select aria-label="Position" className="input h-10" value={positionFilter} onChange={(event) => setPositionFilter(event.target.value as typeof positionFilter)}><option value="all">All Positions</option><option>Head Concierge</option><option>Senior Concierge</option><option>Concierge</option></select>
          <select aria-label="Status" className="input h-10" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All Statuses</option><option>Active</option><option>Inactive</option><option>On Leave</option><option>Off Shift</option></select>
          <select aria-label="Schedule" className="input h-10" value={scheduleFilter} onChange={(event) => setScheduleFilter(event.target.value as typeof scheduleFilter)}><option value="all">All Schedules</option><option>Weekday</option><option>Weekend</option></select>
          <select aria-label="Shift" className="input h-10" value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value as typeof shiftFilter)}><option value="all">Today’s Shift</option><option>Morning</option><option>Afternoon</option><option>Evening</option></select>
          <button type="button" className="btn-ghost h-10 whitespace-nowrap" onClick={clearFilters} disabled={!hasFilters}>Clear filters</button>
          <div className="flex h-10 rounded-lg border border-border bg-bg p-1" aria-label="View mode"><button type="button" aria-label="Table view" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')} className={`rounded-md px-2 ${viewMode === 'table' ? 'bg-card text-primary-700 shadow-sm' : 'text-text-muted'}`}><List className="h-4 w-4" /></button><button type="button" aria-label="Card view" aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')} className={`rounded-md px-2 ${viewMode === 'cards' ? 'bg-card text-primary-700 shadow-sm' : 'text-text-muted'}`}><Grid2X2 className="h-4 w-4" /></button></div>
        </div>
      </section>

      {filtered.length === 0 ? <section className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center"><UsersRound className="mx-auto h-10 w-10 text-text-muted" /><h2 className="mt-3 font-semibold text-text-main">{staff.length ? 'No concierge staff match your filters.' : 'No concierge staff found.'}</h2><p className="mt-1 text-sm text-text-muted">{staff.length ? 'Clear or adjust the filters to see more team members.' : 'Add a concierge team member to begin managing guest-service coverage.'}</p></section> : viewMode === 'table' ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto"><table className="min-w-[1120px] w-full"><thead className="bg-bg/70"><tr>{['Staff Member', 'Position', 'Schedule', 'Contact', 'Email', 'Workload / Requests', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{heading}</th>)}</tr></thead><tbody className="divide-y divide-border">{filtered.map((member) => <tr key={member.id} className="hover:bg-bg/60"><td className="px-4 py-3"><div className="flex items-center gap-3"><StaffAvatar name={member.name} /><div><p className="text-sm font-semibold text-text-main">{member.name}</p><p className="text-xs text-text-muted">{member.staffCode}</p></div></div></td><td className="px-4 py-3"><span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">{member.position}</span></td><td className="px-4 py-3"><p className="text-sm font-medium text-text-main">{member.scheduleDays}</p><p className="text-xs text-text-muted">{member.shift}</p></td><td className="px-4 py-3 text-sm text-text-main"><span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-text-muted" />{member.contact || '—'}</span></td><td className="px-4 py-3 text-sm text-text-main"><span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-text-muted" />{member.email || '—'}</span></td><td className="px-4 py-3"><p className="text-sm font-semibold text-text-main">{member.openRequests} open</p><p className="text-xs text-text-muted">{member.completedToday} completed today</p></td><td className="px-4 py-3"><StatusPill status={member.status} /></td><td className="relative px-4 py-3"><button type="button" aria-label={`Actions for ${member.name}`} onClick={() => setActionMenu((current) => current === member.id ? null : member.id)} className="btn-outline h-9 px-2.5"><MoreHorizontal className="h-4 w-4" /></button>{actionMenu === member.id ? <div className="absolute right-4 top-12 z-20 w-44 rounded-xl border border-border bg-card p-1.5 shadow-xl"><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-text-main hover:bg-bg" onClick={() => openEdit(member)}>View / Edit profile</button><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-text-main hover:bg-bg" onClick={() => openEdit(member)}>View schedule</button>{canManage ? <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" onClick={() => toggleStatus(member)}>{member.status === 'Inactive' ? 'Reactivate' : 'Deactivate'}</button> : null}</div> : null}</td></tr>)}</tbody></table></div>
        </section>
      ) : <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((member) => <article key={member.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><StaffAvatar name={member.name} /><div><h2 className="font-semibold text-text-main">{member.name}</h2><p className="text-xs text-text-muted">{member.staffCode} · {member.position}</p></div></div><StatusPill status={member.status} /></div><div className="mt-4 grid gap-3 rounded-xl bg-bg/70 p-3 text-sm"><p className="flex items-center gap-2 text-text-main"><CalendarClock className="h-4 w-4 text-primary-600" />{member.scheduleDays}, {member.shift}</p><p className="flex items-center gap-2 text-text-main"><Phone className="h-4 w-4 text-primary-600" />{member.contact || 'No phone added'}</p><p className="flex items-center gap-2 text-text-main"><Mail className="h-4 w-4 text-primary-600" />{member.email || 'No email added'}</p></div><div className="mt-4 flex items-center justify-between"><div><p className="text-sm font-semibold text-text-main">{member.openRequests} open requests</p><p className="text-xs text-text-muted">{member.completedToday} completed today</p></div><button type="button" className="btn-outline" onClick={() => openEdit(member)}>{canManage ? 'Edit' : 'View'}</button></div></article>)}</section>}

      {formOpen ? <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45" role="dialog" aria-modal="true" aria-labelledby="concierge-form-title"><div className="h-full w-full max-w-xl overflow-y-auto bg-card p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between"><div><h2 id="concierge-form-title" className="text-xl font-bold text-text-main">{editing ? 'Edit Concierge' : 'Add Concierge'}</h2><p className="mt-1 text-sm text-text-muted">Maintain staff details, coverage, and availability.</p></div><button type="button" aria-label="Close" className="btn-ghost h-9 px-2" onClick={() => setFormOpen(false)}><X className="h-5 w-5" /></button></div><form className="mt-6 space-y-4" onSubmit={submitStaff}><div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Full Name *</span><input name="name" required defaultValue={editing?.name} className="input" /></label><label><span className="label">Employee ID *</span><input name="staffCode" required defaultValue={editing?.staffCode} className="input" /></label></div><div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Position *</span><select name="position" required defaultValue={editing?.position || 'Concierge'} className="input"><option>Head Concierge</option><option>Senior Concierge</option><option>Concierge</option></select></label><label><span className="label">Status</span><select name="status" defaultValue={editing?.status || 'Active'} className="input"><option>Active</option><option>Inactive</option><option>On Leave</option><option>Off Shift</option></select></label></div><div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Schedule *</span><input name="scheduleDays" required defaultValue={editing?.scheduleDays || 'Monday – Friday'} className="input" /></label><label><span className="label">Shift *</span><input name="shift" required defaultValue={editing?.shift || '9:00 AM – 5:00 PM'} className="input" /></label></div><div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Phone</span><input name="contact" type="tel" pattern="[+()0-9 .-]{7,}" defaultValue={editing?.contact} className="input" /></label><label><span className="label">Email</span><input name="email" type="email" defaultValue={editing?.email} className="input" /></label></div><label><span className="label">Notes</span><textarea name="notes" rows={4} defaultValue={editing?.notes} className="input resize-none" /></label><div className="flex justify-end gap-2 border-t border-border pt-4"><button type="button" className="btn-outline" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="btn-primary"><UserRoundCog className="h-4 w-4" />{editing ? 'Save changes' : 'Add team member'}</button></div></form></div></div> : null}
    </div>
  );
}
