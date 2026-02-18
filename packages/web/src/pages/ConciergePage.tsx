import { useMemo, useState } from 'react';
import { PAGE_TITLE_CLASS } from '@/styles/typography';

type ConciergeStatus = 'Active' | 'Inactive';

type ConciergeStaff = {
  id: string;
  name: string;
  staffCode: string;
  position: string;
  schedule: string;
  contact: string;
  email: string;
  status: ConciergeStatus;
};

const seedStaff: ConciergeStaff[] = [
  {
    id: 'c1',
    name: 'Bebe W. Cullen',
    staffCode: 'ELC001',
    position: 'Head Concierge',
    schedule: 'Monday - Friday 8 AM - 4 PM',
    contact: '+1 (555) 234-5678',
    email: 'bebe.cullen@example.com',
    status: 'Active',
  },
  {
    id: 'c2',
    name: 'Alvar King',
    staffCode: 'ELC002',
    position: 'Concierge',
    schedule: 'Monday - Friday 12 PM - 8 PM',
    contact: '+1 (555) 345-6789',
    email: 'alvar.king@example.com',
    status: 'Active',
  },
  {
    id: 'c3',
    name: 'Sofia Reed',
    staffCode: 'ELC003',
    position: 'Concierge',
    schedule: 'Tuesday - Saturday 9 AM - 5 PM',
    contact: '+1 (555) 981-2234',
    email: 'sofia.reed@example.com',
    status: 'Inactive',
  },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ConciergePage() {
  const [staff, setStaff] = useState<ConciergeStaff[]>(seedStaff);
  const [positionFilter, setPositionFilter] = useState<'all' | 'Head Concierge' | 'Concierge'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ConciergeStatus>('all');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'Weekday' | 'Weekend'>('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((row) => {
      if (positionFilter !== 'all' && row.position !== positionFilter) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (scheduleFilter === 'Weekday' && !row.schedule.toLowerCase().includes('monday')) return false;
      if (scheduleFilter === 'Weekend' && !row.schedule.toLowerCase().includes('saturday')) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.position.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.contact.toLowerCase().includes(q)
      );
    });
  }, [staff, positionFilter, statusFilter, scheduleFilter, search]);

  return (
    <div className="space-y-4">
      <h1 className={PAGE_TITLE_CLASS}>Concierge</h1>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value as typeof positionFilter)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <option value="all">All Position</option>
              <option value="Head Concierge">Head Concierge</option>
              <option value="Concierge">Concierge</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select
              value={scheduleFilter}
              onChange={(e) => setScheduleFilter(e.target.value as typeof scheduleFilter)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <option value="all">All Schedule</option>
              <option value="Weekday">Weekday</option>
              <option value="Weekend">Weekend</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full min-w-[260px] max-w-[320px]">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search placeholder"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700"
              />
            </div>
            <button type="button" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M3 12h18M3 20h18" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="rounded-lg border border-lime-300 bg-lime-200 px-3 py-2 text-sm font-semibold text-slate-800"
            >
              Add Concierge
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-emerald-50/40">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Position</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Schedule</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lime-200 text-xs font-bold text-slate-800">
                        {initials(row.name)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{row.name}</div>
                        <div className="text-xs text-slate-500">{row.staffCode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-700">{row.position}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{row.schedule}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{row.contact}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{row.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${row.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                    No concierge staff match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Add Concierge</h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const newStaff: ConciergeStaff = {
                  id: `local-${Date.now()}`,
                  name: String(form.get('name') || '').trim(),
                  staffCode: String(form.get('staffCode') || '').trim() || `ELC${String(staff.length + 1).padStart(3, '0')}`,
                  position: String(form.get('position') || 'Concierge'),
                  schedule: String(form.get('schedule') || '').trim() || 'Monday - Friday 9 AM - 5 PM',
                  contact: String(form.get('contact') || '').trim(),
                  email: String(form.get('email') || '').trim(),
                  status: (String(form.get('status') || 'Active') as ConciergeStatus),
                };
                if (!newStaff.name || !newStaff.email) return;
                setStaff((prev) => [newStaff, ...prev]);
                setShowAdd(false);
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="name" required placeholder="Full name" className="input" />
                <input name="staffCode" placeholder="Staff code" className="input" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select name="position" className="input">
                  <option>Concierge</option>
                  <option>Head Concierge</option>
                </select>
                <select name="status" className="input">
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
              <input name="schedule" placeholder="Schedule" className="input" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="contact" placeholder="Phone" className="input" />
                <input name="email" type="email" required placeholder="Email" className="input" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-outline flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Save</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
