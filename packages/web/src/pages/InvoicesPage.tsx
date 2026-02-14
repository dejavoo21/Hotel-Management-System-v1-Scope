import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoiceService } from '@/services';
import type { Invoice } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';

const statusOptions: Array<{ label: string; value: Invoice['status'] | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Unpaid', value: 'UNPAID' },
  { label: 'Partially paid', value: 'PARTIALLY_PAID' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Voided', value: 'VOIDED' },
];

export default function InvoicesPage() {
  const [status, setStatus] = useState<(typeof statusOptions)[number]['value']>('ALL');
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const currency = user?.hotel?.currency || 'USD';

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { status }],
    queryFn: async () => {
      return invoiceService.list({
        status: status === 'ALL' ? undefined : status,
        page: 1,
        limit: 50,
      });
    },
  });

  const invoices = data?.data ?? [];
  const totals = useMemo(() => {
    const total = invoices.reduce((sum, inv: any) => sum + (Number(inv.total) || 0), 0);
    const unpaid = invoices
      .filter((inv: any) => inv.status === 'UNPAID' || inv.status === 'PARTIALLY_PAID')
      .reduce((sum, inv: any) => sum + (Number(inv.total) || 0), 0);
    return { total, unpaid };
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Invoicing</h1>
          <p className="mt-1 text-sm text-slate-600">Manage invoices, download PDFs, and email guests.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <p className="mt-3 text-2xl font-extrabold text-lime-950">
            {totals.total.toLocaleString(undefined, { style: 'currency', currency })}
          </p>
          <p className="mt-1 text-xs font-medium text-lime-800">{invoices.length} invoice(s)</p>
        </div>
        <div className="rounded-2xl bg-amber-50 p-5 shadow-sm ring-1 ring-amber-100">
          <p className="text-sm font-semibold text-amber-900/70">Outstanding</p>
          <p className="mt-3 text-2xl font-extrabold text-amber-950">
            {totals.unpaid.toLocaleString(undefined, { style: 'currency', currency })}
          </p>
          <p className="mt-1 text-xs font-medium text-amber-800">Unpaid / partially paid</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Invoices</h2>
          <div className="text-sm font-semibold text-slate-500">{data?.pagination?.total ?? invoices.length} total</div>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-slate-600">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-6">
            <p className="text-sm font-semibold text-slate-900">No invoices yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Invoices are created from a booking. Open a booking and click "Create invoice".
            </p>
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
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Invoice
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Guest
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Issued
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">{inv.invoiceNo}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {inv.booking?.guest
                        ? `${inv.booking.guest.firstName} ${inv.booking.guest.lastName}`
                        : '-'}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {Number(inv.total || 0).toLocaleString(undefined, { style: 'currency', currency })}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {String(inv.status).replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-5 py-4 text-right text-sm">
                      <button
                        type="button"
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        onClick={async () => {
                          const blob = await invoiceService.downloadPdf(inv.id);
                          const url = URL.createObjectURL(blob);
                          window.open(url, '_blank', 'noopener,noreferrer');
                          setTimeout(() => URL.revokeObjectURL(url), 30000);
                        }}
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
