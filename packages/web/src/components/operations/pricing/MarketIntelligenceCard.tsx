import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2, Plus, UploadCloud } from 'lucide-react';
import { marketService } from '@/services/market';

export default function MarketIntelligenceCard() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCompetitorId, setBulkCompetitorId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rate, setRate] = useState('');

  const compsQuery = useQuery({
    queryKey: ['marketCompetitors'],
    queryFn: () => marketService.listCompetitors(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const addComp = useMutation({
    mutationFn: () => marketService.addCompetitor({ name }),
    onSuccess: async () => {
      toast.success('Competitor added');
      setName('');
      await qc.invalidateQueries({ queryKey: ['marketCompetitors'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to add competitor'),
  });

  const bulk = useMutation({
    mutationFn: () =>
      marketService.bulkRates({
        competitorHotelId: bulkCompetitorId,
        startDate,
        endDate,
        rate: Number(rate),
      }),
    onSuccess: async (d: any) => {
      toast.success(`Saved ${d.nightsWritten} nights`);
      setBulkOpen(false);
      await qc.invalidateQueries({ queryKey: ['operationsContext'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to save rates'),
  });

  const comps = compsQuery.data ?? [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Market Intelligence</div>
            <div className="mt-1 text-xs text-slate-500">
              Add competitor hotels and capture per-night rates (manual for now).
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setBulkOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <UploadCloud className="h-4 w-4" />
          Bulk apply rates
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add competitor hotel name"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200 sm:col-span-2"
        />
        <button
          type="button"
          onClick={() => addComp.mutate()}
          disabled={!name.trim() || addComp.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200">
        <div className="bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">Competitors</div>
        <div className="divide-y divide-slate-200">
          {compsQuery.isLoading ? (
            <div className="px-4 py-4 text-sm text-slate-500">Loading...</div>
          ) : comps.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-500">No competitors yet.</div>
          ) : (
            comps.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                  <div className="text-xs text-slate-500">
                    {[c.city, c.country].filter(Boolean).join(', ') || '-'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBulkCompetitorId(c.id);
                    setBulkOpen(true);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Add rates
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {bulkOpen ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Bulk apply competitor rates</div>
          <div className="mt-1 text-xs text-slate-600">Writes per-night snapshots behind the scenes.</div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select
              value={bulkCompetitorId}
              onChange={(e) => setBulkCompetitorId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select competitor</option>
              {comps.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="Rate"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setBulkOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!bulkCompetitorId || !startDate || !endDate || !rate || bulk.isPending}
              onClick={() => bulk.mutate()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Save rates
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

