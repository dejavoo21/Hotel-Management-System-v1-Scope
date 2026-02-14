import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { Invoice } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import { KPI_VALUE_CLASS } from '@/styles/typography';
import type { TimeRange } from '@/data/timeRange';
import TimeRangeToggle from '@/components/ui/TimeRangeToggle';
import { downloadInvoicePdf, getInvoices, sendInvoiceEmail } from '@/data/dataSource';

const statusOptions: Array<{ label: string; value: Invoice['status'] | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Unpaid', value: 'UNPAID' },
  { label: 'Partially paid', value: 'PARTIALLY_PAID' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Voided', value: 'VOIDED' },
];

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function openPdfInNewTab(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return w;
}

export default function InvoicesPage() {
  const [status, setStatus] = useState<(typeof statusOptions)[number]['value']>('ALL');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [search, setSearch] = useState('');
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const currency = user?.hotel?.currency || 'USD';

  const [emailModal, setEmailModal] = useState<{ id: string; invoiceNo: string } | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { status, timeRange, search }],
    queryFn: async () => getInvoices({ timeRange, status, search, page: 1, limit: 50 }),
  });

  const invoices = (data as any)?.data ?? [];
  const totalCount = (data as any)?.pagination?.total ?? invoices.length;

  const totals = useMemo(() => {
    const total = invoices.reduce((sum: number, inv: any) => sum + (Number(inv.total) || 0), 0);
    const unpaid = invoices
      .filter((inv: any) => inv.status === 'UNPAID' || inv.status === 'PARTIALLY_PAID')
      .reduce((sum: number, inv: any) => sum + (Number(inv.total) || 0), 0);
    return { total, unpaid };
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Invoicing</h1>
          <p className="mt-1 text-sm text-slate-600">Manage invoices, download PDFs, print, and email guests.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TimeRangeToggle
            options={[
              { label: 'Last 30 Days', value: '30d' },
              { label: 'This Year', value: '1y' },
            ]}
            value={timeRange}
            onChange={setTimeRange}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice or guest..."
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => navigate('/bookings')}
          >
            Go to bookings
          </button>
          <label className="text-sm font-semibold text-slate-700" htmlFor="invoice-status">
            Status
          </label>
          <select
            id="invoice-status"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-lime-50 p-5 shadow-sm ring-1 ring-lime-100">
          <p className="text-sm font-semibold text-lime-900/70">Total invoiced</p>
          <p className={`mt-3 ${KPI_VALUE_CLASS} text-lime-950`}>
            {totals.total.toLocaleString(undefined, { style: 'currency', currency })}
          </p>
          <p className="mt-1 text-xs font-medium text-lime-800">{invoices.length} invoice(s)</p>
        </div>
        <div className="rounded-2xl bg-amber-50 p-5 shadow-sm ring-1 ring-amber-100">
          <p className="text-sm font-semibold text-amber-900/70">Outstanding</p>
          <p className={`mt-3 ${KPI_VALUE_CLASS} text-amber-950`}>
            {totals.unpaid.toLocaleString(undefined, { style: 'currency', currency })}
          </p>
          <p className="mt-1 text-xs font-medium text-amber-800">Unpaid / partially paid</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Invoices</h2>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs font-semibold text-slate-500 md:flex">
              <span className="text-slate-400">Actions per invoice:</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                <span aria-hidden="true">👁️</span> View
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                <span aria-hidden="true">🖨️</span> Print
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                <span aria-hidden="true">✉️</span> Email
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                <span aria-hidden="true">⬇️</span> Download
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-500">{totalCount} total</div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-slate-600">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-6">
            <p className="text-sm font-semibold text-slate-900">No invoices yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Invoices are created from a booking. Open a booking and click "Create invoice". Once created, you can
              download, print, and email it to the guest.
            </p>
            <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100 md:grid-cols-3">
              <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Download</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">PDF invoice / receipt</div>
                <div className="mt-1 text-xs text-slate-600">One-click PDF export for guests or accounting.</div>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Print</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">Browser print dialog</div>
                <div className="mt-1 text-xs text-slate-600">Print directly after opening the PDF.</div>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">Send to guest</div>
                <div className="mt-1 text-xs text-slate-600">Emails the PDF to the booking guest (override optional).</div>
              </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                onClick={() => navigate('/bookings')}
              >
                View bookings
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Guest</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Issued</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">{inv.invoiceNo}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {inv.booking?.guest ? `${inv.booking.guest.firstName} ${inv.booking.guest.lastName}` : '-'}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {Number(inv.total || 0).toLocaleString(undefined, { style: 'currency', currency })}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {String(inv.status).replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">{inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : '-'}</td>
                    <td className="px-5 py-4 text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                          title="View"
                          aria-label="View invoice"
                          onClick={async () => {
                            try {
                              const blob = await downloadInvoicePdf(inv.id);
                              await openPdfInNewTab(blob);
                            } catch {
                              toast.error('Failed to open invoice');
                            }
                          }}
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                          title="Print"
                          aria-label="Print invoice"
                          onClick={async () => {
                            try {
                              const blob = await downloadInvoicePdf(inv.id);
                              const w = await openPdfInNewTab(blob);
                              setTimeout(() => {
                                try {
                                  w?.focus();
                                  w?.print();
                                } catch {
                                  // ignore
                                }
                              }, 600);
                              toast.success('Invoice opened. Use your browser print dialog if needed.');
                            } catch {
                              toast.error('Failed to print invoice');
                            }
                          }}
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 9V3h12v6" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18h12v3H6z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 14H5a2 2 0 01-2-2v-2a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 01-2 2h-1" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                          title="Email guest"
                          aria-label="Email invoice to guest"
                          onClick={() => {
                            setRecipientEmail('');
                            setEmailModal({ id: inv.id, invoiceNo: inv.invoiceNo });
                          }}
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h16v16H4z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M22 6l-10 7L2 6" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                          onClick={async () => {
                            try {
                              const blob = await downloadInvoicePdf(inv.id);
                              const filename = `invoice-${inv.invoiceNo || inv.id}.pdf`;
                              triggerBlobDownload(blob, filename);
                            } catch {
                              toast.error('Failed to download invoice');
                            }
                          }}
                        >
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {emailModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setEmailModal(null);
            }}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email invoice</div>
                <div className="mt-1 text-lg font-extrabold text-slate-900">{emailModal.invoiceNo}</div>
                <div className="mt-1 text-sm text-slate-600">
                  We will email the invoice/receipt PDF to the guest on the booking. Optionally override the recipient.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailModal(null)}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Recipient email (optional)</label>
                <input
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="guest@example.com"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-slate-500">Leave blank to send to the guest email on the booking.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEmailModal(null)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={sendingEmail}
                  onClick={async () => {
                    setSendingEmail(true);
                    try {
                      await sendInvoiceEmail({
                        id: emailModal.id,
                        recipientEmail: recipientEmail.trim() ? recipientEmail.trim() : undefined,
                      });
                      toast.success('Invoice email sent');
                      setEmailModal(null);
                    } catch {
                      toast.error('Failed to send invoice email');
                    } finally {
                      setSendingEmail(false);
                    }
                  }}
                  className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {sendingEmail ? 'Sending...' : 'Send email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
