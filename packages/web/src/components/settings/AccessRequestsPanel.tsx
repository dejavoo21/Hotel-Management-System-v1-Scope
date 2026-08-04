import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileQuestion,
  Info,
  LoaderCircle,
  MessageSquareText,
  Search,
  ShieldAlert,
  Trash2,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import type { AccessRequest } from '@/types';
import { formatEnumLabel } from '@/utils';

export type AccessRoleOption = { value: string; label: string };

type ConfirmAction = {
  type: 'approve' | 'resend' | 'delete';
  request: AccessRequest;
  role?: string;
};

type AccessRequestsPanelProps = {
  requests?: AccessRequest[];
  isLoading: boolean;
  isError: boolean;
  currentUserEmail?: string;
  roleOptions: AccessRoleOption[];
  selectedRoles: Record<string, string>;
  onRoleChange: (requestId: string, role: string) => void;
  onRetry: () => void;
  onApprove: (request: AccessRequest, role: string) => Promise<void>;
  onResend: (request: AccessRequest, role: string) => Promise<void>;
  onReject: (request: AccessRequest) => void;
  onRequestInfo: (request: AccessRequest) => void;
  onViewResponse: (request: AccessRequest) => void;
  onDelete: (request: AccessRequest) => Promise<void>;
};

const PAGE_SIZE = 8;

const FILTER_ROLE_OPTIONS = [
  'Receptionist',
  'Front Desk Manager',
  'Hotel Manager',
  'IT Support',
  'Finance',
  'Housekeeping',
  'Maintenance',
  'Security',
  'Admin',
];

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'INFO_RECEIVED', label: 'Info Received' },
  { value: 'NEEDS_INFO', label: 'More Info Required' },
  { value: 'REJECTED', label: 'Rejected' },
];

const normalizeStatus = (status: string) =>
  status === 'INFO_REQUESTED' ? 'NEEDS_INFO' : status;

const normalizedRoleLabel = (value?: string) =>
  formatEnumLabel((value || 'RECEPTIONIST').replace('FRONT_DESK_MANAGER', 'MANAGER'));

const statusLabel = (status: string) =>
  normalizeStatus(status) === 'NEEDS_INFO'
    ? 'More Info Required'
    : formatEnumLabel(normalizeStatus(status));

function normalizeApprovalRole(value: string | undefined, options: AccessRoleOption[]) {
  const normalized = (value || '').trim().toUpperCase().replace(/[\s/-]+/g, '_');
  const aliases: Record<string, string> = {
    ADMINISTRATOR: 'ADMIN',
    GENERAL_MANAGER: 'MANAGER',
    HOTEL_MANAGER: 'MANAGER',
    FRONT_DESK_MANAGER: 'MANAGER',
    FRONT_DESK: 'RECEPTIONIST',
    RECEPTION: 'RECEPTIONIST',
    HOUSEKEEPER: 'HOUSEKEEPING',
  };
  const candidate = aliases[normalized] || normalized;
  return options.some((option) => option.value === candidate) ? candidate : 'RECEPTIONIST';
}

function formatRequestedAt(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

function statusClasses(status: string) {
  switch (normalizeStatus(status)) {
    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-700';
    case 'REJECTED':
      return 'bg-rose-100 text-rose-700';
    case 'INFO_RECEIVED':
      return 'bg-indigo-100 text-indigo-700';
    case 'NEEDS_INFO':
      return 'bg-slate-100 text-amber-700 ring-1 ring-amber-200';
    default:
      return 'bg-amber-100 text-amber-700';
  }
}

function rowClasses(status: string) {
  if (normalizeStatus(status) === 'PENDING') return 'bg-amber-50/55';
  if (normalizeStatus(status) === 'INFO_RECEIVED') return 'bg-indigo-50/35';
  return 'bg-card';
}

function SelectMenu({
  value,
  options,
  onChange,
  label,
  compact = false,
}: {
  value: string;
  options: AccessRoleOption[];
  onChange: (value: string) => void;
  label: string;
  compact?: boolean;
}) {
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <ListboxButton
          className={`flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card text-left text-sm text-text-main shadow-sm transition hover:border-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 ${compact ? 'h-9 min-w-40 px-3' : 'h-10 px-3'}`}
          aria-label={label}
        >
          <span className="truncate">{selected?.label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
        </ListboxButton>
        <ListboxOptions anchor="bottom start" className="z-50 max-h-64 w-[var(--button-width)] min-w-48 overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl focus:outline-none [--anchor-gap:4px]">
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-text-main data-[focus]:bg-primary-50 data-[selected]:font-semibold data-[selected]:text-primary-700"
            >
              <span>{option.label}</span>
              <Check className="hidden h-4 w-4 group-data-[selected]:block" aria-hidden="true" />
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
  detail,
  tone,
}: {
  icon: typeof Clock3;
  value: string | number;
  label: string;
  detail: string;
  tone: 'amber' | 'emerald' | 'indigo' | 'rose' | 'sky';
}) {
  const tones = {
    amber: 'bg-amber-100 text-amber-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    rose: 'bg-rose-100 text-rose-600',
    sky: 'bg-sky-100 text-sky-600',
  };
  return (
    <article className="flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold text-text-main">{value}</p>
        <p className="truncate text-sm font-medium text-text-main">{label}</p>
        <p className="mt-0.5 truncate text-xs text-text-muted">{detail}</p>
      </div>
    </article>
  );
}

export default function AccessRequestsPanel({
  requests = [],
  isLoading,
  isError,
  currentUserEmail,
  roleOptions,
  selectedRoles,
  onRoleChange,
  onRetry,
  onApprove,
  onResend,
  onReject,
  onRequestInfo,
  onViewResponse,
  onDelete,
}: AccessRequestsPanelProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [processing, setProcessing] = useState(false);

  const companies = useMemo(() => {
    const values = new Set(['Laflo', 'Grand Palace Hotel']);
    requests.forEach((request) => request.company?.trim() && values.add(request.company.trim()));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [requests]);

  const roleFilters = useMemo(() => {
    const values = new Set(FILTER_ROLE_OPTIONS);
    requests.forEach((request) => request.role && values.add(normalizedRoleLabel(request.role)));
    return [{ value: 'ALL', label: 'All Roles' }, ...Array.from(values).sort().map((label) => ({ value: label, label }))];
  }, [requests]);

  const companyFilters = useMemo(
    () => [{ value: 'ALL', label: 'All Companies' }, ...companies.map((company) => ({ value: company, label: company }))],
    [companies]
  );

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesSearch = !query || [request.fullName, request.email, request.company]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'ALL' || normalizeStatus(request.status) === statusFilter;
      const matchesRole = roleFilter === 'ALL' || normalizedRoleLabel(request.role) === roleFilter;
      const matchesCompany = companyFilter === 'ALL' || (request.company || '-') === companyFilter;
      return matchesSearch && matchesStatus && matchesRole && matchesCompany;
    });
  }, [companyFilter, requests, roleFilter, search, statusFilter]);

  useEffect(() => setPage(1), [search, statusFilter, roleFilter, companyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRequests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const summary = useMemo(() => {
    const now = new Date();
    const completed = requests.filter((request) => ['APPROVED', 'REJECTED'].includes(normalizeStatus(request.status)));
    const averageHours = completed.length
      ? completed.reduce((sum, request) => {
          const end = new Date(request.updatedAt || request.createdAt).getTime();
          return sum + Math.max(0, end - new Date(request.createdAt).getTime()) / 3_600_000;
        }, 0) / completed.length
      : 0;
    return {
      pending: requests.filter((request) => normalizeStatus(request.status) === 'PENDING').length,
      approved: requests.filter((request) => {
        if (normalizeStatus(request.status) !== 'APPROVED') return false;
        const date = new Date(request.updatedAt || request.createdAt);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length,
      needsInfo: requests.filter((request) => normalizeStatus(request.status) === 'NEEDS_INFO').length,
      rejected: requests.filter((request) => normalizeStatus(request.status) === 'REJECTED').length,
      average: `${averageHours.toFixed(averageHours >= 10 ? 0 : 1)} hrs`,
    };
  }, [requests]);

  const exportVisible = () => {
    const headers = ['Requester name', 'Email', 'Company', 'Requested role', 'Status', 'Requested date', 'Review date'];
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = filteredRequests.map((request) => [
      request.fullName,
      request.email,
      request.company || '',
      normalizedRoleLabel(request.role),
      statusLabel(request.status),
      request.createdAt,
      request.updatedAt || '',
    ]);
    const blob = new Blob([[headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laflo-access-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    try {
      if (confirmAction.type === 'approve') await onApprove(confirmAction.request, confirmAction.role || 'RECEPTIONIST');
      if (confirmAction.type === 'resend') await onResend(confirmAction.request, confirmAction.role || 'RECEPTIONIST');
      if (confirmAction.type === 'delete') await onDelete(confirmAction.request);
      setConfirmAction(null);
    } finally {
      setProcessing(false);
    }
  };

  const confirmCopy = confirmAction?.type === 'approve'
    ? {
        title: 'Approve access request',
        body: `Approving ${confirmAction.request.fullName} will create or activate their user account and send a password setup invite.`,
        action: 'Approve and send invite',
      }
    : confirmAction?.type === 'resend'
      ? {
          title: 'Resend password setup',
          body: `A new password setup link will be sent to ${confirmAction.request.email}. Any previous setup link may no longer be valid.`,
          action: 'Resend setup',
        }
      : {
          title: 'Delete access request',
          body: `Delete ${confirmAction?.request.fullName || 'this request'} permanently? This action cannot be undone.`,
          action: 'Delete request',
        };

  return (
    <section aria-labelledby="access-requests-title" className="space-y-5">
      <header>
        <h2 id="access-requests-title" className="text-2xl font-bold tracking-tight text-text-main">Access Requests</h2>
        <p className="mt-1 text-sm text-text-muted">Review, approve, and manage new workspace access requests.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={Clock3} value={summary.pending} label="Pending Requests" detail="Awaiting administrator review" tone="amber" />
        <SummaryCard icon={UserRoundCheck} value={summary.approved} label="Approved This Month" detail="Password setup invitations sent" tone="emerald" />
        <SummaryCard icon={Info} value={summary.needsInfo} label="More Info Required" detail="Waiting for requester details" tone="indigo" />
        <SummaryCard icon={XCircle} value={summary.rejected} label="Rejected" detail="Not approved for workspace access" tone="rose" />
        <SummaryCard icon={Clock3} value={summary.average} label="Average Review Time" detail="Based on completed reviews" tone="sky" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(240px,1.5fr)_minmax(150px,.75fr)_minmax(150px,.75fr)_minmax(170px,.8fr)_auto] lg:items-end">
          <label className="relative block">
            <span className="sr-only">Search requests by name or email</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="input h-10 pl-9" placeholder="Search requests by name or email..." />
          </label>
          <div>
            <span className="mb-1 block text-xs font-medium text-text-muted">Status</span>
            <SelectMenu value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} label="Filter by status" />
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-text-muted">Role</span>
            <SelectMenu value={roleFilter} onChange={setRoleFilter} options={roleFilters} label="Filter by role" />
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-text-muted">Company</span>
            <SelectMenu value={companyFilter} onChange={setCompanyFilter} options={companyFilters} label="Filter by company" />
          </div>
          <button type="button" onClick={exportVisible} disabled={!filteredRequests.length} className="btn-secondary h-10 gap-2 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" aria-hidden="true" /> Export
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4" aria-label="Loading access requests">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-shimmer rounded-xl" />)}
          </div>
        ) : isError ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <ShieldAlert className="h-9 w-9 text-rose-500" aria-hidden="true" />
            <p className="mt-3 font-semibold text-text-main">Access requests could not be loaded.</p>
            <p className="mt-1 text-sm text-text-muted">Try again to reconnect to the access review service.</p>
            <button type="button" onClick={onRetry} className="btn-secondary mt-4">Try again</button>
          </div>
        ) : !requests.length ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <FileQuestion className="h-9 w-9 text-text-muted" aria-hidden="true" />
            <p className="mt-3 font-semibold text-text-main">No access requests yet.</p>
            <p className="mt-1 text-sm text-text-muted">New workspace access requests will appear here.</p>
          </div>
        ) : !filteredRequests.length ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <Search className="h-9 w-9 text-text-muted" aria-hidden="true" />
            <p className="mt-3 font-semibold text-text-main">No access requests match your filters.</p>
            <button type="button" onClick={() => { setSearch(''); setStatusFilter('ALL'); setRoleFilter('ALL'); setCompanyFilter('ALL'); }} className="btn-secondary mt-4">Clear filters</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full text-sm">
              <thead className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-5 py-3">Requester</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Requested Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRequests.map((request, index) => {
                  const status = normalizeStatus(request.status);
                  const canReview = ['PENDING', 'NEEDS_INFO', 'INFO_RECEIVED'].includes(status);
                  const selectedRole = selectedRoles[request.id] || normalizeApprovalRole(request.role, roleOptions);
                  const requested = formatRequestedAt(request.createdAt);
                  const isSelf = currentUserEmail?.toLowerCase() === request.email.toLowerCase();
                  const avatarTones = ['bg-orange-100 text-orange-700', 'bg-emerald-100 text-emerald-700', 'bg-indigo-100 text-indigo-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700'];
                  return (
                    <Fragment key={request.id}>
                      <tr className={rowClasses(status)}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-semibold ${avatarTones[index % avatarTones.length]}`}>{initials(request.fullName)}</span>
                            <div className="min-w-0">
                              <p className="font-semibold text-text-main">{request.fullName}</p>
                              <p className="truncate text-xs text-text-muted">{request.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-muted">{request.company || '—'}</td>
                        <td className="px-4 py-3">
                          {canReview ? (
                            <SelectMenu value={selectedRole} onChange={(role) => onRoleChange(request.id, role)} options={roleOptions} label={`Role for ${request.fullName}`} compact />
                          ) : (
                            <span className="font-medium text-text-main">{normalizedRoleLabel(request.role)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(status)}`}>{statusLabel(status)}</span></td>
                        <td className="px-4 py-3 text-text-muted"><span className="block text-text-main">{requested.date}</span><span className="text-xs">{requested.time}</span></td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            {(status === 'INFO_RECEIVED' || (status === 'REJECTED' && Boolean(request.lastReplyAt))) && <button type="button" onClick={() => onViewResponse(request)} className="btn-secondary h-9 px-3 text-xs">View response</button>}
                            {canReview && <button type="button" onClick={() => onRequestInfo(request)} className="btn-secondary h-9 px-3 text-xs">Request info</button>}
                            {canReview && <button type="button" onClick={() => onReject(request)} className="inline-flex h-9 items-center rounded-lg border border-rose-300 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50">Reject</button>}
                            {canReview && <button type="button" disabled={isSelf} title={isSelf ? 'You cannot approve your own elevated access request.' : undefined} onClick={() => setConfirmAction({ type: 'approve', request, role: selectedRole })} className="btn-primary h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50">Approve</button>}
                            {status === 'APPROVED' && <button type="button" onClick={() => setConfirmAction({ type: 'resend', request, role: selectedRole })} className="btn-secondary h-9 px-3 text-xs">Resend setup</button>}
                            {(request.adminNotes || request.message) && <button type="button" onClick={() => setExpandedNotes((current) => ({ ...current, [request.id]: !current[request.id] }))} className="btn-secondary h-9 px-2 text-xs" aria-expanded={Boolean(expandedNotes[request.id])} aria-label={`Toggle notes for ${request.fullName}`}><MessageSquareText className="h-4 w-4" /></button>}
                            <button type="button" onClick={() => setConfirmAction({ type: 'delete', request })} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-300 text-rose-600 transition hover:bg-rose-50" aria-label={`Delete request from ${request.fullName}`}><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                      {expandedNotes[request.id] && (request.adminNotes || request.message) && (
                        <tr className={rowClasses(status)}>
                          <td colSpan={6} className="px-5 pb-3 pt-0">
                            <div className="flex items-start gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs text-text-muted">
                              <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                              <span><strong className="text-text-main">Notes:</strong> {request.adminNotes || request.message}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !isError && filteredRequests.length > 0 && (
          <footer className="flex flex-col gap-3 border-t border-border px-5 py-3 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filteredRequests.length)} of {filteredRequests.length} requests</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="btn-secondary h-9 px-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
              <span className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-primary-500 bg-primary-50 px-2 font-semibold text-primary-700">{currentPage} / {totalPages}</span>
              <button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="btn-secondary h-9 px-2 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </footer>
        )}
      </div>

      <Dialog open={Boolean(confirmAction)} onClose={() => !processing && setConfirmAction(null)} className="relative z-50">
        <div className="fixed inset-0 bg-slate-950/45" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${confirmAction?.type === 'delete' ? 'bg-rose-100 text-rose-600' : 'bg-primary-50 text-primary-700'}`}>
              {confirmAction?.type === 'delete' ? <Trash2 className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </span>
            <DialogTitle className="mt-4 text-lg font-semibold text-text-main">{confirmCopy.title}</DialogTitle>
            <p className="mt-2 text-sm leading-6 text-text-muted">{confirmCopy.body}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={processing} onClick={() => setConfirmAction(null)} className="btn-secondary">Cancel</button>
              <button type="button" disabled={processing} onClick={runConfirmedAction} className={confirmAction?.type === 'delete' ? 'inline-flex min-h-10 items-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50' : 'btn-primary'}>
                {processing && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {confirmCopy.action}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </section>
  );
}
