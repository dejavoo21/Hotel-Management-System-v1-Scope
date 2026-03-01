import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { RefreshCcw, Sparkles } from 'lucide-react';
import OpsAdvisories from '@/components/operations/advisories/OpsAdvisories';
import AssistantDock from '@/components/operations/assistant/AssistantDock';
import PricingCalendarCard from '@/components/operations/pricing/PricingCalendarCard';
import MarketIntelligenceCard from '@/components/operations/pricing/MarketIntelligenceCard';
import OpsKpiStrip from '@/components/operations/premium/OpsKpiStrip';
import { operationsService, weatherSignalsService } from '@/services';
import { useAuthStore } from '@/stores/authStore';

export default function OperationsCenterPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const hotelId = user?.hotel?.id || '';

  const operationsQuery = useQuery({
    queryKey: ['operationsContext', hotelId],
    queryFn: () => operationsService.getOperationsContext(hotelId),
    enabled: Boolean(hotelId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const refreshWeatherMutation = useMutation({
    mutationFn: () => weatherSignalsService.sync(hotelId),
    onSuccess: async (data) => {
      toast.success(`Forecast refreshed (${data.daysStored} days stored)`);
      await queryClient.invalidateQueries({ queryKey: ['operationsContext', hotelId] });
      await queryClient.invalidateQueries({ queryKey: ['weatherSignalsStatus', hotelId] });
      await queryClient.invalidateQueries({ queryKey: ['weatherOpsActions', hotelId] });
    },
    onError: (error) => {
      const message =
        (error as any)?.response?.data?.error ||
        (error as Error | null)?.message ||
        'Failed to refresh forecast';
      toast.error(message);
    },
  });

  const header = useMemo(() => {
    const ctx = operationsQuery.data;
    const updatedAt = ctx?.generatedAtUtc ? new Date(ctx.generatedAtUtc) : null;

    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900">Operations Center</div>
                <div className="mt-1 text-sm text-slate-600">
                  Real-time visibility across weather signals, demand guidance, and task execution.
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              {updatedAt
                ? `Updated ${updatedAt.toLocaleString()}`
                : 'Updated time will appear after first load'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void operationsQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              <RefreshCcw className={`h-4 w-4 ${operationsQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => refreshWeatherMutation.mutate()}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              disabled={refreshWeatherMutation.isPending}
            >
              <RefreshCcw className={`h-4 w-4 ${refreshWeatherMutation.isPending ? 'animate-spin' : ''}`} />
              Refresh forecast
            </button>
          </div>
        </div>

        <div className="mt-6">
          <OpsKpiStrip context={operationsQuery.data} isLoading={operationsQuery.isLoading} />
        </div>
      </div>
    );
  }, [operationsQuery.data, operationsQuery.isLoading, operationsQuery.isFetching, refreshWeatherMutation.isPending]);

  const body = useMemo(() => {
    if (operationsQuery.isLoading) {
      return (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading operations context...
        </div>
      );
    }

    if (operationsQuery.isError) {
      return (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          Unable to load operations context.
        </div>
      );
    }

    const context = operationsQuery.data;
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <PricingCalendarCard
            pricingCalendar={context?.pricingCalendar}
            pricingSummary={context?.pricingSignal}
            snapshotMeta={context?.pricingSnapshotMeta}
            title="Revenue Guidance (14 nights)"
            subtitle="Per-night suggestions based on booking pace, weather signals, and market rates when available."
          />

          <OpsAdvisories context={context} />
        </div>

        <div className="space-y-6 xl:col-span-4">
          <MarketIntelligenceCard />
          <AssistantDock context={context} />
        </div>
      </div>
    );
  }, [operationsQuery.isLoading, operationsQuery.isError, operationsQuery.data]);

  return (
    <div className="space-y-6">
      {header}
      {body}
    </div>
  );
}
