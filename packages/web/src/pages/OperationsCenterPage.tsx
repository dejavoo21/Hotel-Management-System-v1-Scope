import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, Brain, RefreshCcw, Sparkles } from 'lucide-react';
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
import DepartmentIntelligenceCard from '@/components/operations/DepartmentIntelligenceCard';
import AIRecommendationGovernancePanel from '@/components/operations/AIRecommendationGovernancePanel';
import OperationalTimeline from '@/components/timeline/OperationalTimeline';
import { aiBriefingService, operationsService, weatherSignalsService } from '@/services';
import type { DailyGMBriefing } from '@/services/aiBriefing';
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

const operationsDepartments = [
  'front-desk',
  'housekeeping',
  'maintenance',
  'security',
  'revenue',
  'guest-experience',
] as const;

const severityClass = (severity?: string) => {
  if (severity === 'CRITICAL') return 'border-red-200 bg-red-50 text-red-700';
  if (severity === 'HIGH') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (severity === 'MEDIUM') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

function DailyBriefingPanel({
  briefing,
  isLoading,
  isError,
  isFetching,
  onRefresh,
}: {
  briefing?: DailyGMBriefing;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const risks = [
    ...(briefing?.operationalRisks || []),
    ...(briefing?.guestExperienceRisks || []),
    ...(briefing?.maintenanceConcerns || []),
    ...(briefing?.securityConcerns || []),
    ...(briefing?.smartBuildingConcerns || []),
  ].slice(0, 4);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
          <div className="h-20 w-full animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5" />
          <div>
            <p className="font-semibold">Daily briefing unavailable</p>
            <p className="mt-1">The GM briefing could not be generated from hotel context.</p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-3 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Daily GM Briefing will appear when hotel context is available.
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Daily GM Briefing</h2>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {briefing.source === 'AI' ? 'AI generated' : 'Rules fallback'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{briefing.executiveSummary}</p>
            <p className="mt-2 text-xs text-slate-400">
              Generated {new Date(briefing.generatedAt).toLocaleString()} · {briefing.contextVersion}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Health score</div>
            <div className="text-3xl font-semibold text-slate-900">{briefing.hotelHealthScore}</div>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Regenerate Briefing
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top priorities</h3>
          <div className="mt-3 space-y-2">
            {briefing.todayPriorities.slice(0, 3).map((item, index) => (
              <div key={`${item.title}-${index}`} className="text-sm">
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top risks</h3>
          <div className="mt-3 space-y-2">
            {risks.length ? risks.slice(0, 3).map((item, index) => (
              <div key={`${item.title}-${index}`} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityClass(item.severity)}`}>
                  {item.severity || 'LOW'}
                </span>
              </div>
            )) : (
              <p className="text-sm text-slate-500">No major risks detected.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended actions</h3>
          <div className="mt-3 space-y-2">
            {briefing.recommendedActions.slice(0, 3).map((item, index) => (
              <div key={`${item.title}-${index}`} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityClass(item.priority)}`}>
                    {item.priority}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{item.owner} · {item.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

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

  const briefingQuery = useQuery({
    queryKey: ['dailyGMBriefing', hotelId],
    queryFn: () => aiBriefingService.getDailyBriefing(),
    enabled: Boolean(hotelId) && isOverview,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
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
          <DepartmentIntelligenceCard department="revenue" />
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
      return (
        <div className="max-w-5xl space-y-6">
          <AIRecommendationGovernancePanel />
          {aiPanel}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <DailyBriefingPanel
            briefing={briefingQuery.data}
            isLoading={briefingQuery.isLoading}
            isError={briefingQuery.isError}
            isFetching={briefingQuery.isFetching}
            onRefresh={() => briefingQuery.refetch()}
          />
          <AIRecommendationGovernancePanel compact />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {operationsDepartments.map((department) => (
              <DepartmentIntelligenceCard key={department} department={department} compact />
            ))}
          </div>
          {weatherPanel}
          {revenuePanel}
          {tasksPanel}
          <OperationalTimeline />
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
    briefingQuery.data,
    briefingQuery.isError,
    briefingQuery.isFetching,
    briefingQuery.isLoading,
    briefingQuery.refetch,
    refreshWeatherMutation.isPending,
  ]);

  return (
    <div className="space-y-6">
      {header}
      {body}
    </div>
  );
}
