import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import OperationsHeader from '@/components/operations/OperationsHeader';
import OpsStatusBar from '@/components/operations/OpsStatusBar';
import SignalsGrid from '@/components/operations/SignalsGrid';
import OpsAdvisories from '@/components/operations/advisories/OpsAdvisories';
import AssistantDock from '@/components/operations/assistant/AssistantDock';
import PricingSignalCard from '@/components/operations/PricingSignalCard';
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
      toast.success(`Weather synced (${data.daysStored} days stored)`);
      await queryClient.invalidateQueries({ queryKey: ['operationsContext', hotelId] });
      await queryClient.invalidateQueries({ queryKey: ['weatherSignalsStatus', hotelId] });
      await queryClient.invalidateQueries({ queryKey: ['weatherOpsActions', hotelId] });
    },
    onError: (error) => {
      const message =
        (error as any)?.response?.data?.error ||
        (error as Error | null)?.message ||
        'Failed to refresh weather context';
      toast.error(message);
    },
  });

  const content = useMemo(() => {
    if (operationsQuery.isLoading) {
      return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading operations context...</div>;
    }

    if (operationsQuery.isError) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          Unable to load operations context.
        </div>
      );
    }

    const context = operationsQuery.data;
    return (
      <>
        <OpsStatusBar context={context} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <PricingSignalCard pricing={context?.pricingSignal ?? context?.pricing ?? null} />
            <SignalsGrid
              context={context}
              onRefreshWeather={() => refreshWeatherMutation.mutate()}
              isRefreshingWeather={refreshWeatherMutation.isPending}
            />
            <OpsAdvisories context={context} />
          </div>
          <div className="lg:col-span-1">
            <AssistantDock context={context} />
          </div>
        </div>
      </>
    );
  }, [
    operationsQuery.isLoading,
    operationsQuery.isError,
    operationsQuery.data,
    refreshWeatherMutation.isPending,
  ]);

  return (
    <div className="space-y-6">
      <OperationsHeader
        isRefreshing={operationsQuery.isFetching}
        onRefresh={() => {
          void operationsQuery.refetch();
        }}
      />
      {content}
    </div>
  );
}
