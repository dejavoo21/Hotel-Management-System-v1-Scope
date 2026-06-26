import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { RefreshCcw, Sparkles } from 'lucide-react';
import OpsAdvisories from '@/components/operations/advisories/OpsAdvisories';
import AssistantDock from '@/components/operations/assistant/AssistantDock';
import PricingCalendarCard from '@/components/operations/pricing/PricingCalendarCard';
import MarketIntelligenceCard from '@/components/operations/pricing/MarketIntelligenceCard';
import OpsKpiStrip from '@/components/operations/premium/OpsKpiStrip';
import SignalsGrid from '@/components/operations/SignalsGrid';
import ArrivalsSignalCard from '@/components/operations/signals/ArrivalsSignalCard';
import DemandSignalCard from '@/components/operations/signals/DemandSignalCard';
import PricingSignalCard from '@/components/operations/signals/PricingSignalCard';
import WeatherSignalCard from '@/components/operations/signals/WeatherSignalCard';
import { operationsService, weatherSignalsService } from '@/services';
import { useAuthStore } from '@/stores/authStore';

type OperationsFocus = 'overview' | 'ai' | 'revenue' | 'weather' | 'tasks' | 'market-intelligence';

const focusMeta: Record<OperationsFocus, { title: string; description: string }> = {
  overview: {
    title: 'Operations Center',
    description: 'Real-time visibility across weather signals, demand guidance, and task execution.',
  },
  ai: {
    title: 'Operations Concierge',
    description: 'Ask the AI panel about operations, pricing, weather, and task execution.',
  },
  revenue: {
    title: 'Revenue Guidance',
    description: 'Per-night recommendations based on booking pace, weather signals, and market rates when available.',
  },
  weather: {
    title: 'Weather',
    description: 'Forecast signals used for staffing, guest readiness, advisories, and service planning.',
  },
  tasks: {
    title: 'Tasks',
    description: 'Actionable operations advisories and task recommendations.',
  },
  'market-intelligence': {
    title: 'Market Intelligence',
    description: 'Competitor hotels and rate inputs used to strengthen revenue guidance.',
  },
};

const getFocusFromPath = (pathname: string): OperationsFocus => {
  const segment = pathname.split('/').filter(Boolean)[1];
  if (
    segment === 'ai' ||
    segment === 'revenue' ||
    segment === 'weather' ||
    segment === 'tasks' ||
    segment === 'market-intelligence'
  ) {
    return segment;
  }
  return 'overview';
};

export default function OperationsCenterPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { user } = useAuthStore();
  const hotelId = user?.hotel?.id || '';
  const focus = getFocusFromPath(location.pathname);
  const isOverview = focus === 'overview';
  const meta = focusMeta[focus];

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
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-6 shadow-sm">
        <div className="pointer-events-none absolute -top-24 right-[-120px] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-[-120px] h-72 w-72 rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-sm ring-1 ring-white/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900">{meta.title}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {meta.description}
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
              onClick={() => refreshWeatherMutation.mutate()}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              disabled={refreshWeatherMutation.isPending}
            >
              <RefreshCcw className={`h-4 w-4 ${refreshWeatherMutation.isPending ? 'animate-spin' : ''}`} />
              Refresh forecast
            </button>
          </div>
        </div>

        {isOverview ? (
          <div className="relative z-10 mt-6">
            <OpsKpiStrip context={operationsQuery.data} isLoading={operationsQuery.isLoading} />
          </div>
        ) : null}
      </div>
    );
  }, [isOverview, meta.description, meta.title, operationsQuery.data, operationsQuery.isLoading, refreshWeatherMutation.isPending]);

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
    const refreshWeather = () => refreshWeatherMutation.mutate();
    const revenuePanel = (
      <PricingCalendarCard
        pricingCalendar={context?.pricingCalendar}
        pricingSummary={context?.pricingSignal}
        snapshotMeta={context?.pricingSnapshotMeta}
        title="Revenue Guidance (14 nights)"
        subtitle="Per-night suggestions based on booking pace, weather signals, and market rates when available."
      />
    );
    const weatherPanel = (
      <SignalsGrid
        context={context}
        onRefreshWeather={refreshWeather}
        isRefreshingWeather={refreshWeatherMutation.isPending}
      />
    );
    const weatherOnlyPanel = (
      <div className="max-w-3xl">
        <WeatherSignalCard
          context={context}
          onRefresh={refreshWeather}
          isRefreshing={refreshWeatherMutation.isPending}
        />
      </div>
    );
    const revenueSignalsPanel = (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DemandSignalCard context={context} />
        <PricingSignalCard context={context} />
      </div>
    );
    const arrivalsPanel = <ArrivalsSignalCard context={context} />;
    const tasksPanel = <OpsAdvisories context={context} />;
    const marketPanel = <MarketIntelligenceCard />;
    const aiPanel = <AssistantDock context={context} />;

    if (focus === 'weather') {
      return weatherOnlyPanel;
    }

    if (focus === 'revenue') {
      return (
        <div className="space-y-6">
          {revenueSignalsPanel}
          {revenuePanel}
        </div>
      );
    }

    if (focus === 'market-intelligence') {
      return <div className="max-w-4xl">{marketPanel}</div>;
    }

    if (focus === 'tasks') {
      return (
        <div className="space-y-6">
          <div className="max-w-3xl">{arrivalsPanel}</div>
          {tasksPanel}
        </div>
      );
    }

    if (focus === 'ai') {
      return <div className="max-w-5xl">{aiPanel}</div>;
    }

    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          {weatherPanel}
          {revenuePanel}
          {tasksPanel}
        </div>

        <div className="space-y-6 xl:col-span-4">
          {marketPanel}
          {aiPanel}
        </div>
      </div>
    );
  }, [
    focus,
    operationsQuery.isLoading,
    operationsQuery.isError,
    operationsQuery.data,
    refreshWeatherMutation.isPending,
  ]);

  return (
    <div className="space-y-6">
      {header}
      {body}
    </div>
  );
}
