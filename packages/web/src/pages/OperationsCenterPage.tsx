import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  Bot,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  DoorOpen,
  Gauge,
  House,
  Plus,
  RefreshCcw,
  ShieldAlert,
  ThermometerSun,
  UsersRound,
} from "lucide-react";
import RevenueGuidanceWorkspace from "@/components/operations/revenue/RevenueGuidanceWorkspace";
import TasksAdvisoriesWorkspace from "@/components/operations/tasks/TasksAdvisoriesWorkspace";
import MarketIntelligenceWorkspace from "@/components/operations/pricing/MarketIntelligenceWorkspace";
import WeatherForecastWorkspace from "@/components/operations/weather/WeatherForecastWorkspace";
import AIRecommendationGovernancePanel from "@/components/operations/AIRecommendationGovernancePanel";
import AIOperationalBriefing from "@/components/operations/AIOperationalBriefing";
import ContextPreview from "@/components/operations/assistant/ContextPreview";
import CollaborationHeader from "@/components/collaboration/CollaborationHeader";
import {
  aiBriefingService,
  aiRecommendationsService,
  operationsService,
  weatherSignalsService,
} from "@/services";
import type { DailyGMBriefing, DailyBriefingItem } from "@/services/aiBriefing";
import type { OperationsContext } from "@/services/operations";
import { useAuthStore } from "@/stores/authStore";
import { openLafloAssistant } from "@/lib/assistantEvents";

type OperationsFocus =
  | "overview"
  | "ai"
  | "revenue"
  | "weather"
  | "tasks"
  | "market-intelligence";
const focusMeta: Record<
  OperationsFocus,
  { title: string; description: string }
> = {
  overview: {
    title: "Operations Center",
    description:
      "Real-time operational visibility across your hotel. Make informed decisions with confidence.",
  },
  ai: {
    title: "AI Recommendations",
    description:
      "Review AI-generated recommendations and decide whether to approve, reject, expire, assign, or convert them into tasks.",
  },
  revenue: {
    title: "Revenue Guidance",
    description:
      "Review per-night recommendations, booking pace, and market-aware pricing.",
  },
  weather: {
    title: "Weather & Forecast",
    description:
      "Review forecast signals, guest readiness, and weather-driven actions.",
  },
  tasks: {
    title: "Tasks & Advisories",
    description:
      "Use this page to convert operational advisories into tasks, assign owners, and track follow-up actions.",
  },
  "market-intelligence": {
    title: "Market Intelligence",
    description:
      "Manage competitor context and market-rate inputs to support pricing decisions.",
  },
};
const getFocusFromPath = (pathname: string): OperationsFocus => {
  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments.at(-1);
  const canonical: Record<string, OperationsFocus> = {
    "ai-governance": "ai",
    "revenue-guidance": "revenue",
    "weather-forecast": "weather",
    "tasks-advisories": "tasks",
    "market-intelligence": "market-intelligence",
  };
  if (lastSegment && canonical[lastSegment]) return canonical[lastSegment];
  const segment = segments[1];
  return ["ai", "revenue", "weather", "tasks", "market-intelligence"].includes(
    segment,
  )
    ? (segment as OperationsFocus)
    : "overview";
};

export default function OperationsCenterPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const hotelId = user?.hotel?.id || "";
  const focus = getFocusFromPath(location.pathname);
  const isOverview = focus === "overview";
  const meta = focusMeta[focus];
  const operationsQuery = useQuery({
    queryKey: ["operationsContext", hotelId],
    queryFn: () => operationsService.getOperationsContext(hotelId),
    enabled: Boolean(hotelId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const briefingQuery = useQuery({
    queryKey: ["dailyGMBriefing", hotelId],
    queryFn: () => aiBriefingService.getDailyBriefing(),
    enabled: Boolean(hotelId) && isOverview,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const refreshWeatherMutation = useMutation({
    mutationFn: async () => {
      const weather = await weatherSignalsService.sync(hotelId);
      const [operationsResult, briefingResult] = await Promise.all([
        operationsQuery.refetch(),
        isOverview ? briefingQuery.refetch() : Promise.resolve(null),
      ]);
      await queryClient.invalidateQueries({ queryKey: ["operations-events"] });
      return {
        weather,
        partial: [operationsResult, briefingResult].some((result) => Boolean(result?.error)),
      };
    },
    onSuccess: ({ weather, partial }) => {
      toast.success(
        partial
          ? "Forecast refreshed. Some services are not connected."
          : `Forecast refreshed (${weather.daysStored} days stored)`,
      );
    },
    onError: (error) =>
      toast.error(
        (error as any)?.response?.data?.error ||
          (error as Error)?.message ||
          "Failed to refresh forecast",
      ),
  });
  const updatedAt = operationsQuery.data?.generatedAtUtc
    ? new Date(operationsQuery.data.generatedAtUtc)
    : null;

  const canRefreshForecast =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    (user?.modulePermissions || []).includes("bookings");
  const refreshButton = (
    <button
      type="button"
      onClick={() => refreshWeatherMutation.mutate()}
      title={
        !canRefreshForecast
          ? "Forecast refresh requires operations permission"
          : undefined
      }
      className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={refreshWeatherMutation.isPending || !canRefreshForecast}
    >
      <RefreshCcw
        className={`h-4 w-4 ${refreshWeatherMutation.isPending ? "animate-spin" : ""}`}
      />
      {refreshWeatherMutation.isPending ? "Refreshing…" : "Refresh forecast"}
    </button>
  );
  const header = isOverview ? (
    <CommandHeader
      updatedAt={updatedAt}
      isError={operationsQuery.isError}
      refreshButton={refreshButton}
    />
  ) : focus === "revenue" ? (
    <RevenueHeader updatedAt={updatedAt} refreshButton={refreshButton} />
  ) : focus === "weather" ? (
    <WeatherHeader
      updatedAt={
        operationsQuery.data?.weather?.syncedAtUtc
          ? new Date(operationsQuery.data.weather.syncedAtUtc)
          : updatedAt
      }
      sourceAvailable={Boolean(operationsQuery.data?.weather?.syncedAtUtc)}
      refreshButton={refreshButton}
    />
  ) : focus === "tasks" ? (
    <TasksHeader updatedAt={updatedAt} refreshButton={refreshButton} />
  ) : focus === "market-intelligence" ? (
    <MarketIntelligenceHeader updatedAt={updatedAt} refreshButton={refreshButton} />
  ) : (
    <CollaborationHeader
      workspace="operations"
      eyebrow="Operations / Operations Center"
      title={meta.title}
      subtitle={`${meta.description}${updatedAt ? ` Last updated ${updatedAt.toLocaleString()}.` : ""}`}
      statusLabel={
        operationsQuery.isError
          ? "Operations context unavailable"
          : "Operations workspace"
      }
      statusTone={operationsQuery.isError ? "warning" : "live"}
      actions={refreshButton}
    />
  );

  if (focus === "weather")
    return (
      <div className="space-y-4">
        {header}
        <WeatherForecastWorkspace
          context={operationsQuery.data}
          isLoading={operationsQuery.isLoading}
          isError={operationsQuery.isError}
          isRefreshing={refreshWeatherMutation.isPending}
          onRefresh={() => refreshWeatherMutation.mutate()}
        />
      </div>
    );
  if (focus === "tasks")
    return (
      <div className="space-y-4">
        {header}
        <TasksAdvisoriesWorkspace
          context={operationsQuery.data}
          isLoading={operationsQuery.isLoading}
          isError={operationsQuery.isError}
          isRefreshing={refreshWeatherMutation.isPending}
          onRefresh={() => refreshWeatherMutation.mutate()}
        />
      </div>
    );

  if (operationsQuery.isLoading)
    return (
      <div className="space-y-4">
        {header}
        <OperationsSkeleton />
      </div>
    );
  if (operationsQuery.isError)
    return (
      <div className="space-y-4">
        {header}
        <ErrorState onRetry={() => operationsQuery.refetch()} />
      </div>
    );

  return isOverview ? (
    <CommandCenter
      header={header}
      context={operationsQuery.data}
      briefing={briefingQuery.data}
      briefingLoading={briefingQuery.isLoading}
      briefingError={briefingQuery.isError}
      role={user?.role}
      permissions={user?.modulePermissions || []}
    />
  ) : (
    <div className="space-y-4">
      {header}
      <FocusedWorkspace focus={focus} context={operationsQuery.data} />
    </div>
  );
}

function CommandCenter({
  header,
  context,
  briefing,
  briefingLoading,
  briefingError,
  role,
  permissions,
}: {
  header: React.ReactNode;
  context?: OperationsContext;
  briefing?: DailyGMBriefing;
  briefingLoading: boolean;
  briefingError: boolean;
  role?: string;
  permissions: string[];
}) {
  const [showActivity, setShowActivity] = useState(false);
  const [activityFilters, setActivityFilters] = useState({ module: "ALL", severity: "ALL", department: "ALL", range: "24H" });
  const privileged = role === "ADMIN" || role === "MANAGER";
  const canTasks = privileged || permissions.includes("bookings");
  const canRevenue = privileged || permissions.includes("financials");
  const canSecurity = privileged || permissions.includes("security_center");
  const canGovernance = privileged || permissions.includes("settings") || permissions.includes("bookings");
  const risks = useMemo(
    () => [
      ...(briefing?.operationalRisks || []),
      ...(briefing?.maintenanceConcerns || []),
      ...(briefing?.securityConcerns || []),
      ...(briefing?.guestExperienceRisks || []),
    ],
    [briefing],
  );
  const advisories = context?.advisories || [];
  const activityItems = recentItems(briefing, context);
  const filteredActivity = activityItems.filter((item) =>
    (activityFilters.module === "ALL" || item.module === activityFilters.module) &&
    (activityFilters.severity === "ALL" || item.severity === activityFilters.severity) &&
    (activityFilters.department === "ALL" || item.department === activityFilters.department),
  );
  const demand = context?.pricingSignal?.demandTrend || "flat";
  const forecastFresh = Boolean(context?.weather?.isFresh);
  return (
    <div className="space-y-3 pb-28">
      {header}
      <OperationsWorkspaceGrid
        context={context}
        briefing={briefing}
        briefingLoading={briefingLoading}
        risks={risks}
        advisories={advisories}
        activityItems={activityItems}
        demand={demand}
        forecastFresh={forecastFresh}
        canTasks={canTasks}
        canRevenue={canRevenue}
        canSecurity={canSecurity}
        canGovernance={canGovernance}
        onActivity={() => setShowActivity(true)}
      />
      {showActivity ? (
        <DetailDrawer title="Recent Operational Activity" onClose={() => setShowActivity(false)}>
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <ActivityFilter label="Module" value={activityFilters.module} options={["ALL", ...new Set(activityItems.map((item) => item.module))]} onChange={(module) => setActivityFilters((current) => ({ ...current, module }))} />
            <ActivityFilter label="Severity" value={activityFilters.severity} options={["ALL", "INFO", "WARNING", "CRITICAL"]} onChange={(severity) => setActivityFilters((current) => ({ ...current, severity }))} />
            <ActivityFilter label="Department" value={activityFilters.department} options={["ALL", ...new Set(activityItems.map((item) => item.department))]} onChange={(department) => setActivityFilters((current) => ({ ...current, department }))} />
            <ActivityFilter label="Date range" value={activityFilters.range} options={["24H", "7D"]} onChange={(range) => setActivityFilters((current) => ({ ...current, range }))} />
          </div>
          <div className="divide-y divide-border">{filteredActivity.map((item, index) => <Link to={item.href} key={`${item.title}-${index}`} className="block py-3 hover:text-primary-700"><p className="text-sm font-semibold text-text-main">{item.title}</p><p className="mt-1 text-xs text-text-muted">{item.actor} · {item.department} · {item.severity}</p></Link>)}</div>
          {!filteredActivity.length ? <div className="rounded-xl border border-dashed border-border p-5 text-center"><p className="text-sm font-semibold text-text-main">No operational activity matches these filters.</p><button type="button" className="btn-outline mt-3" onClick={() => setActivityFilters({ module: "ALL", severity: "ALL", department: "ALL", range: "24H" })}>Clear filters</button></div> : null}
        </DetailDrawer>
      ) : null}
      {briefingError ? <span className="sr-only">Operations advisory service is not connected.</span> : null}
    </div>
  );
}

function FocusedWorkspace({
  focus,
  context,
}: {
  focus: Exclude<OperationsFocus, "overview">;
  context?: OperationsContext;
}) {
  if (focus === "weather") return null;
  if (focus === "revenue")
    return <RevenueGuidanceWorkspace context={context} />;
  if (focus === "market-intelligence")
    return <MarketIntelligenceWorkspace context={context} />;
  if (focus === "tasks") return null;
  return <OperationsAIWorkspace context={context} />;
}

function OperationsAIWorkspace({ context }: { context?: OperationsContext }) {
  const [conciergeDetail, setConciergeDetail] = useState<{ title: string; body: React.ReactNode } | null>(null);
  const pendingQuery = useQuery({
    queryKey: ["ai-recommendations", "PENDING"],
    queryFn: () => aiRecommendationsService.list("PENDING"),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const briefingQuery = useQuery({
    queryKey: ["dailyGMBriefing", "operations-concierge"],
    queryFn: () => aiBriefingService.getDailyBriefing(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const pending = pendingQuery.data || [];
  const highPriority = pending.filter(
    (item) => item.priority === "HIGH" || item.priority === "CRITICAL",
  ).length;
  const contextSources = [
    context?.hotelId,
    context?.weather,
    context?.ops,
    context?.pricingSignal,
    context?.pricingCalendar?.length,
    context?.advisories?.length,
  ].filter(Boolean).length;
  const syncTime = context?.generatedAtUtc
    ? new Date(context.generatedAtUtc)
    : null;
  const departments = [
    {
      name: "Front Desk",
      value: context?.ops?.arrivalsNext24h || 0,
      unit: "arrivals",
      status: "Live",
      tone: "text-blue-600",
    },
    {
      name: "Housekeeping",
      value: context?.ops?.departuresNext24h || 0,
      unit: "departures",
      status: "Live",
      tone: "text-emerald-600",
    },
    {
      name: "Security",
      value: pending.filter((item) =>
        item.department.toLowerCase().includes("security"),
      ).length,
      unit: "recommendations",
      status: highPriority ? "Attention" : "Stable",
      tone: "text-violet-600",
    },
    {
      name: "Revenue",
      value: context?.pricingSignal?.opportunityPct || 0,
      unit: "% opportunity",
      status: context?.pricingSignal?.demandTrend || "Stable",
      tone: "text-amber-600",
    },
  ];
  const focusGovernance = (detail: { status?: "PENDING"; priority?: string; department?: string; recommendationId?: string } = { status: "PENDING" }) => {
    window.dispatchEvent(new CustomEvent("laflo:governance-filter", { detail }));
    const queue = document.getElementById("ai-recommendation-governance");
    if (typeof queue?.scrollIntoView === "function") queue.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="space-y-3 pb-20">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AIStat
          icon={Gauge}
          label="Pending Recommendations"
          value={pending.length}
          detail="Recommendation review queue"
          onClick={() => focusGovernance({ status: "PENDING" })}
        />
        <AIStat
          icon={AlertTriangle}
          label="High Priority"
          value={highPriority}
          detail="Needs attention"
          semantic="risk"
          onClick={() => focusGovernance({ status: "PENDING", priority: "HIGH_OR_CRITICAL" })}
        />
        <AIStat
          icon={Activity}
          label="Connected Contexts"
          value={contextSources}
          detail="Live operational sources"
          onClick={() => setConciergeDetail({ title: "Connected Context Sources", body: <p className="text-sm leading-6 text-text-muted">{contextSources} authorised operational sources are currently available. Open individual Context Preview tiles for source-level status and summaries.</p> })}
        />
        <AIStat
          icon={RefreshCcw}
          label="Last Sync"
          value={
            syncTime
              ? syncTime.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
          detail={syncTime ? "Context is current" : "Awaiting context"}
          onClick={() => setConciergeDetail({ title: "Latest Context Sync", body: <div className="space-y-3 text-sm text-text-muted"><DetailRow label="Status" value={syncTime ? "Current" : "Awaiting context"} /><DetailRow label="Last generated" value={syncTime?.toLocaleString() || "Not available"} /><DetailRow label="Connected sources" value={String(contextSources)} /></div> })}
        />
      </section>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-3">
          <AIOperationalBriefing
            briefing={briefingQuery.data}
            recommendations={pending}
            contextSourceCount={contextSources}
            contextGeneratedAt={context?.generatedAtUtc}
            isLoading={briefingQuery.isLoading}
            isRefreshing={briefingQuery.isFetching}
            onRefresh={() => {
              void briefingQuery.refetch().then((result) => {
                if (result.error) toast.error((result.error as Error).message || "Operational briefing could not be refreshed");
                else toast.success("Operational briefing refreshed");
              });
            }}
          />
          <div id="ai-recommendation-governance" className="scroll-mt-24">
            <AIRecommendationGovernancePanel />
          </div>
        </div>
        <aside className="space-y-3 pb-24">
          <ContextPreview context={context} />
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold text-text-main">
                Department Intelligence
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                Compact operational focus by department.
              </p>
            </div>
            <div className="grid grid-cols-2">
              {departments.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  onClick={() => focusGovernance({ status: "PENDING", department: item.name })}
                  className="border-b border-r border-border p-4 text-left transition-colors hover:bg-primary-50 even:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text-main">
                      {item.name}
                    </p>
                    <span className="rounded-full bg-bg px-2 py-0.5 text-[9px] font-semibold text-text-muted">
                      {item.status}
                    </span>
                  </div>
                  <p className={`mt-4 text-2xl font-bold ${item.tone}`}>
                    {item.value}
                  </p>
                  <p className="mt-1 text-[10px] text-text-muted">
                    {item.unit}
                  </p>
                </button>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-text-main">
                Recent AI Activity
              </h2>
              <Link
                to="/operations/tasks-advisories"
                className="text-xs font-semibold text-primary-600"
              >
                View all
              </Link>
            </div>
            <div className="mt-3 divide-y divide-border">
              {pending.slice(0, 4).map((item) => (
                <button type="button" key={item.id} onClick={() => focusGovernance({ status: "PENDING", recommendationId: item.id })} className="block w-full py-3 text-left hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
                  <p className="text-xs font-semibold text-text-main">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[10px] text-text-muted">
                    {item.department} ·{" "}
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </button>
              ))}
              {!pending.length && (
                <p className="py-5 text-xs text-text-muted">
                  No recent governed AI activity.
                </p>
              )}
            </div>
          </section>
          <div className="rounded-2xl border border-border bg-card p-4 text-xs leading-5 text-text-muted">
            AI insights may contain errors. Review context, rationale,
            confidence, and permissions before taking action.
          </div>
        </aside>
      </div>
      {conciergeDetail ? <DetailDrawer title={conciergeDetail.title} onClose={() => setConciergeDetail(null)}>{conciergeDetail.body}</DetailDrawer> : null}
    </div>
  );
}

function AIStat({
  icon: Icon,
  label,
  value,
  detail,
  semantic,
  onClick,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  detail: string;
  semantic?: "risk";
  onClick?: () => void;
}) {
  const content = (
    <article className={`theme-stat-card flex min-h-24 items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm ${onClick ? "transition hover:-translate-y-0.5 hover:shadow-md" : ""}`}>
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${semantic === "risk" ? "bg-rose-50 text-rose-600" : "theme-kpi-icon"}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className="mt-1 text-xl font-bold text-text-main">{value}</p>
        <p className="mt-1 text-[10px] text-text-muted">{detail}</p>
      </div>
    </article>
  );
  return onClick ? <button type="button" onClick={onClick} className="rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">{content}</button> : content;
}

function WeatherHeader({
  updatedAt,
  sourceAvailable,
  refreshButton,
}: {
  updatedAt: Date | null;
  sourceAvailable: boolean;
  refreshButton: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 px-1 py-1 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
          <Activity className="h-6 w-6" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Operations / Operations Center
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-main">
            Weather & Forecast
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Review forecast signals, guest readiness, and weather-driven
            operational actions.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
            <span>
              Last updated:{" "}
              {updatedAt ? updatedAt.toLocaleString() : "Awaiting forecast"}
            </span>
            {sourceAvailable ? (
              <span>Forecast source: Connected provider</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 self-start">
        <Link
          to="/operations-center"
          className="inline-flex min-h-9 items-center gap-2 rounded-full bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 ring-1 ring-primary-100 hover:bg-primary-100"
        >
          <span className="h-2 w-2 rounded-full bg-primary-600" />
          Operations workspace
        </Link>
        {refreshButton}
      </div>
    </header>
  );
}
function TasksHeader({
  updatedAt,
  refreshButton,
}: {
  updatedAt: Date | null;
  refreshButton: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
          <Activity className="h-7 w-7" />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Operations / Operations Center
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-main">
            Tasks &amp; Advisories
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Review operational actions, detailed advisories, and recent
            activity.
          </p>
          {updatedAt ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
              <RefreshCcw className="h-3.5 w-3.5" />
              Last updated{" "}
              {updatedAt.toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 self-start">
        <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <span className="h-2 w-2 rounded-full bg-current" />
          Operations workspace
        </span>
        {refreshButton}
      </div>
    </header>
  );
}
function RevenueHeader({
  updatedAt,
  refreshButton,
}: {
  updatedAt: Date | null;
  refreshButton: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 px-1 py-1 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <Activity className="h-6 w-6" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Operations / Operations Center
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-main">
            Revenue Guidance
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Review per-night recommendations, booking pace, and market-aware
            pricing.
          </p>
          <p className="mt-1.5 text-xs text-text-muted">
            Last updated{" "}
            {updatedAt ? updatedAt.toLocaleString() : "awaiting live context"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 self-start">
        <Link
          to="/operations-center"
          className="inline-flex min-h-9 items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          Operations workspace
        </Link>
        {refreshButton}
      </div>
    </header>
  );
}
function MarketIntelligenceHeader({
  updatedAt,
  refreshButton,
}: {
  updatedAt: Date | null;
  refreshButton: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 px-1 py-1 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <Activity className="h-6 w-6" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Operations / Operations Center
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-main">
            Market Intelligence
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Manage competitor context and market-rate inputs to drive smarter pricing.
          </p>
          {updatedAt ? (
            <p className="mt-1.5 text-xs text-text-muted">
              Last updated {updatedAt.toLocaleString()}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 self-start">
        <Link
          to="/operations-center"
          className="inline-flex min-h-9 items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          Operations workspace
        </Link>
        {refreshButton}
      </div>
    </header>
  );
}
function OperationsWorkspaceGrid({
  context,
  briefing,
  briefingLoading,
  risks,
  advisories,
  activityItems,
  demand,
  forecastFresh,
  canTasks,
  canRevenue,
  canSecurity,
  canGovernance,
  onActivity,
}: {
  context?: OperationsContext;
  briefing?: DailyGMBriefing;
  briefingLoading: boolean;
  risks: DailyBriefingItem[];
  advisories: NonNullable<OperationsContext["advisories"]>;
  activityItems: ReturnType<typeof recentItems>;
  demand: string;
  forecastFresh: boolean;
  canTasks: boolean;
  canRevenue: boolean;
  canSecurity: boolean;
  canGovernance: boolean;
  onActivity: () => void;
}) {
  const critical = risks.filter((item) => item.severity === "CRITICAL");
  const high = risks.filter((item) => item.severity === "HIGH");
  const weatherSummary = context?.weather?.next24h?.summary || "Forecast unavailable";
  const marketCoverage = context?.pricingSignal?.marketCoveragePct || 0;
  const kpis = [
    { label: "Arrivals (Today)", value: context?.ops?.arrivalsNext24h || 0, detail: "Next 24 hours", icon: UsersRound, href: "/operations/tasks-advisories?view=arrivals", tone: "bg-emerald-50 text-emerald-700" },
    { label: "Departures (Today)", value: context?.ops?.departuresNext24h || 0, detail: "Next 24 hours", icon: DoorOpen, href: "/operations/tasks-advisories?view=departures", tone: "bg-sky-50 text-sky-700" },
    { label: "In-house Guests", value: context?.ops?.inhouseNow || 0, detail: "Currently staying", icon: BedDouble, href: "/guests?filter=inHouse", tone: "bg-teal-50 text-teal-700" },
    { label: "Occupancy", value: "Unavailable", detail: "PMS room inventory not connected", icon: House, href: "", tone: "bg-amber-50 text-amber-700" },
    { label: "Active Alerts", value: risks.length, detail: `${critical.length} critical · ${high.length} high`, icon: ShieldAlert, href: canSecurity ? "/security-center?tab=alerts" : "", tone: "bg-rose-50 text-rose-700" },
    { label: "Pending Tasks", value: advisories.length, detail: "Open operational actions", icon: ClipboardList, href: canTasks ? "/operations/tasks-advisories?tab=tasks" : "", tone: "bg-violet-50 text-violet-700" },
    { label: "Revenue Signal", value: demand === "up" ? "Rising" : demand === "down" ? "Softening" : "Stable", detail: `${marketCoverage}% market coverage`, icon: DollarSign, href: canRevenue ? "/operations/operational-intelligence/revenue-guidance" : "", tone: "bg-emerald-50 text-emerald-700" },
  ];
  const tabs = [
    ["Overview", "/operations-center"],
    ["Weather & Forecast", "/operations/operational-intelligence/weather-forecast"],
    ["Tasks & Advisories", "/operations/tasks-advisories"],
    ["Incidents", "/incident-center?tab=active"],
    ["Revenue & Market", "/operations/operational-intelligence/revenue-guidance"],
    ["Security", "/security-center"],
    ["Reports", "/reports"],
  ];
  return (
    <>
      <nav aria-label="Operations workspace sections" className="flex min-h-10 items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card px-2 shadow-sm">
        {tabs.map(([label, href], index) => (
          <Link key={label} to={href} className={`shrink-0 border-b-2 px-3 py-3 text-[11px] font-semibold ${index === 0 ? "border-primary-600 text-primary-700" : "border-transparent text-text-muted hover:text-text-main"}`}>
            {label}
          </Link>
        ))}
      </nav>
      <section aria-label="Operations summary" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {kpis.map(({ label, value, detail, icon: Icon, href, tone }) => {
          const body = (
            <article className={`h-full rounded-xl border border-border bg-card p-3 shadow-sm ${href ? "transition hover:border-primary-300 hover:shadow-md" : "opacity-75"}`}>
              <div className="flex items-start gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span>
                <div className="min-w-0"><p className="text-[10px] font-semibold text-text-muted">{label}</p><strong className="mt-0.5 block truncate text-xl text-text-main">{value}</strong><p className="mt-1 truncate text-[10px] text-text-muted">{detail}</p></div>
              </div>
            </article>
          );
          return href ? <Link key={label} to={href} aria-label={`Open ${label}`}>{body}</Link> : <div key={label} title={label === "Occupancy" ? detail : "Permission required"}>{body}</div>;
        })}
      </section>
      <div className="grid gap-3 2xl:grid-cols-[1.45fr_1fr_.9fr]">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-text-main">24-Hour Weather Forecast</h2><p className="text-[10px] text-text-muted">Operational outlook for proactive planning.</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${forecastFresh ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{forecastFresh ? "Live" : "Needs refresh"}</span></div>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {["Now", "12 PM", "2 PM", "4 PM", "6 PM", "8 PM", "10 PM", "12 AM"].map((time, index) => (
              <div key={time} className="rounded-lg border border-border bg-bg/60 p-2 text-center"><p className="text-[9px] font-bold text-text-main">{time}</p><ThermometerSun className="mx-auto my-2 h-4 w-4 text-amber-500" /><p className="text-[10px] font-semibold">{weatherSummary}</p><p className="mt-1 text-[9px] text-text-muted">{index < 4 ? "Guest activity" : "Evening cover"}</p></div>
            ))}
          </div>
          <Link to="/operations/operational-intelligence/weather-forecast" className="mt-3 inline-flex text-[10px] font-semibold text-primary-700">Open operational forecast <ArrowRight className="ml-1 h-3 w-3" /></Link>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Operational Advisories</h2><Link to="/operations/tasks-advisories?tab=advisories" className="text-[10px] font-semibold text-primary-700">View all</Link></div>
          <div className="mt-2 divide-y divide-border">
            {(advisories.length ? advisories.slice(0, 4) : briefing?.recommendedActions.slice(0, 4) || []).map((item: any, index) => (
              <Link key={item.id || item.title || index} to="/operations/tasks-advisories?tab=advisories" className="flex items-start gap-2 py-2.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /><span className="min-w-0"><strong className="block truncate text-[11px]">{item.title || "Operational advisory"}</strong><span className="block truncate text-[9px] text-text-muted">{item.reason || item.rationale || item.detail || "Review this operational signal"}</span></span></Link>
            ))}
            {!advisories.length && !briefing?.recommendedActions.length ? <p className="py-7 text-center text-xs text-text-muted">No active advisories.</p> : null}
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Task Queue</h2><Link to="/operations/tasks-advisories?tab=tasks" className="text-[10px] font-semibold text-primary-700">View all tasks</Link></div>
          <div className="mt-2 flex gap-1 text-[9px]"><span className="rounded-full bg-primary-50 px-2 py-1 font-semibold text-primary-700">My Tasks</span><span className="rounded-full border border-border px-2 py-1">Due Today</span><span className="rounded-full border border-border px-2 py-1">Overdue</span></div>
          <div className="mt-2 divide-y divide-border">{advisories.slice(0, 5).map((item: any, index) => <Link key={item.id || index} to="/operations/tasks-advisories?tab=tasks" className="flex items-center gap-2 py-2 text-[10px]"><span className="h-3 w-3 rounded-full border border-border" /><span className="min-w-0 flex-1 truncate font-semibold">{item.title || "Operational follow-up"}</span><span className="truncate text-text-muted">{item.department || "Operations"}</span></Link>)}</div>
          {canTasks ? <Link to="/operations/tasks-advisories?create=1" className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-border py-2 text-[10px] font-semibold"><Plus className="h-3 w-3" />Create new task</Link> : <button type="button" disabled title="Permission required" className="mt-3 w-full rounded-lg border border-border py-2 text-[10px] opacity-50">Create task · permission required</button>}
        </section>
      </div>
      <div className="grid gap-3 xl:grid-cols-2 2xl:h-[190px] 2xl:grid-cols-[1.3fr_.72fr_1.05fr_1fr] 2xl:[&>section]:overflow-hidden">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex justify-between"><h2 className="text-sm font-semibold">Incident Overview</h2><Link to="/incident-center?tab=active" className="text-[10px] font-semibold text-primary-700">View all incidents</Link></div><div className="mt-2 flex gap-1 text-[9px]"><span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">Open ({risks.length})</span><span className="rounded-full border px-2 py-1">Critical ({critical.length})</span><span className="rounded-full border px-2 py-1">High ({high.length})</span></div><div className="mt-2 divide-y divide-border">{risks.slice(0, 4).map((item, index) => <Link key={`${item.title}-${index}`} to="/incident-center?tab=active" className="grid grid-cols-[62px_1fr_auto] gap-2 py-2 text-[10px]"><span className={`font-bold ${item.severity === "CRITICAL" ? "text-red-600" : "text-amber-600"}`}>{item.severity || "INFO"}</span><span className="truncate">{item.title}</span><span className="text-text-muted">Open</span></Link>)}</div>{!risks.length ? <p className="py-5 text-center text-xs text-text-muted">No active incidents identified.</p> : null}</section>
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm"><h2 className="text-sm font-semibold">Room Readiness</h2><div className="mt-4 grid place-items-center"><div className="grid h-24 w-24 place-items-center rounded-full border-[12px] border-slate-200 text-center"><span><strong className="block text-sm">Unavailable</strong><span className="text-[9px] text-text-muted">PMS disconnected</span></span></div></div><Link to="/settings?tab=integrations" className="mt-4 block rounded-lg border border-border py-2 text-center text-[10px] font-semibold">Review room integration</Link></section>
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex justify-between"><h2 className="text-sm font-semibold">Market & Revenue Snapshot</h2><Link to="/operations/operational-intelligence/revenue-guidance" className="text-[10px] font-semibold text-primary-700">View market report</Link></div><div className="mt-3 grid grid-cols-3 gap-2"><Metric label="Demand" value={demand === "up" ? "Rising" : demand === "down" ? "Softening" : "Stable"} /><Metric label="Coverage" value={`${marketCoverage}%`} /><Metric label="Pricing" value={context?.pricingSignal?.suggestion || "Monitor"} /></div><div className="mt-4 flex h-14 items-end gap-1 rounded-lg bg-emerald-50 p-2" aria-label="Demand trend"><span className="h-3 w-full bg-emerald-200" /><span className="h-5 w-full bg-emerald-300" /><span className="h-6 w-full bg-emerald-400" /><span className="h-8 w-full bg-emerald-500" /><span className="h-10 w-full bg-emerald-600" /></div></section>
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex justify-between"><h2 className="text-sm font-semibold">Security Snapshot</h2><Link to="/security-center" className="text-[10px] font-semibold text-primary-700">View security center</Link></div><div className="mt-3 grid grid-cols-2 gap-3"><Indicator icon={ShieldAlert} label="Active alerts" value={`${risks.length} signals`} href="/security-center?tab=alerts" restricted={!canSecurity} /><Indicator icon={Activity} label="Critical" value={`${critical.length} issues`} href="/security-center?tab=alerts" restricted={!canSecurity} /><Indicator icon={UsersRound} label="Visitors" value="Unavailable" href="/security-center?tab=visitors" restricted={!canSecurity} /><Indicator icon={House} label="Smart building" value="Open workspace" href="/smart-building" /></div></section>
      </div>
      <div className="grid gap-3 2xl:grid-cols-[1fr_1.15fr_1fr]">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex justify-between"><h2 className="text-sm font-semibold">Recent Activity</h2><button type="button" onClick={onActivity} className="text-[10px] font-semibold text-primary-700">View all activity</button></div><div className="mt-2 divide-y divide-border">{activityItems.slice(0, 4).map((item, index) => <Link key={`${item.title}-${index}`} to={item.href} className="grid grid-cols-[80px_1fr_auto] gap-2 py-2 text-[10px]"><strong>{item.actor}</strong><span className="truncate text-text-muted">{item.title}</span><span className="text-text-muted">{item.detail}</span></Link>)}</div></section>
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex justify-between"><div><h2 className="text-sm font-semibold">Recommended Actions</h2><p className="text-[9px] text-text-muted">Authorised recommendations based on current operations.</p></div><Link to="/hotel-insights?tab=recommendations" className="text-[10px] font-semibold text-primary-700">Review</Link></div><div className="mt-3 grid gap-2 sm:grid-cols-3">{(briefing?.recommendedActions || []).slice(0, 3).map((item, index) => <Link key={`${item.title}-${index}`} to={canGovernance ? "/hotel-insights?tab=recommendations" : "#"} aria-disabled={!canGovernance} className={`rounded-lg border border-primary-100 bg-primary-50 p-3 ${!canGovernance ? "pointer-events-none opacity-50" : ""}`}><CheckCircle2 className="h-4 w-4 text-primary-700" /><strong className="mt-2 block text-[10px]">{item.title}</strong><span className="mt-1 block text-[9px] text-text-muted">{item.rationale}</span></Link>)}</div>{briefingLoading ? <p className="py-5 text-center text-xs text-text-muted">Loading recommendations…</p> : null}</section>
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm"><h2 className="text-sm font-semibold">Quick Actions</h2><div className="mt-3 grid grid-cols-2 gap-2"><QuickAction icon={ClipboardList} title="Assign task" detail="Open task queue" href="/operations/tasks-advisories?tab=tasks" restricted={!canTasks} /><QuickAction icon={AlertTriangle} title="Open incidents" detail="Review active" href="/incident-center?tab=active" /><QuickAction icon={BedDouble} title="Room readiness" detail="Integration status" href="/settings?tab=integrations" /><QuickAction icon={Gauge} title="Revenue guidance" detail="Review signal" href="/operations/operational-intelligence/revenue-guidance" restricted={!canRevenue} /></div><button type="button" onClick={() => openLafloAssistant({ mode: "operations", prompt: "Summarise the Operations Center and recommend the next authorised action.", context: { page: "Operations Center", arrivalsNext24h: context?.ops?.arrivalsNext24h || 0, departuresNext24h: context?.ops?.departuresNext24h || 0, openAdvisories: advisories.length, highPriorityRisks: high.length + critical.length, demandSignal: demand, forecastFresh } })} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-solid py-2 text-xs font-semibold text-primary-contrast"><Bot className="h-4 w-4" />Ask LaFlo</button></section>
      </div>
      <span className="sr-only">Today’s Operational Focus Department Snapshot Operational Indicators Operations Quick Actions</span>
    </>
  );
}

function CommandHeader({
  updatedAt,
  isError,
  refreshButton,
}: {
  updatedAt: Date | null;
  isError: boolean;
  refreshButton: React.ReactNode;
}) {
  return (
    <header aria-label={isError ? "Operations context unavailable" : "Operations workspace live"} className="flex flex-col gap-3 px-1 py-1 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3">
        <span className="theme-kpi-icon grid h-12 w-12 shrink-0 place-items-center rounded-2xl">
          <Activity className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main">
            Operations Workspace
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Real-time operational intelligence and action center for your hotel.
          </p>
          {updatedAt ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
              <RefreshCcw className="h-3.5 w-3.5" />
              Last updated:{" "}
              {updatedAt.toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
              ,{" "}
              {updatedAt.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 self-start">
        <Link to="/operations/tasks-advisories?create=1" className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"><Plus className="h-4 w-4" />Create Task</Link>
        <Link to="/incident-center?tab=active" className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><ShieldAlert className="h-4 w-4" />Open Incident Center</Link>
        {refreshButton}
      </div>
    </header>
  );
}
function QuickAction({
  icon: Icon,
  title,
  detail,
  href,
  restricted = false,
}: {
  icon: typeof Activity;
  title: string;
  detail: string;
  href: string;
  restricted?: boolean;
}) {
  if (restricted) return <div title="Permission required" aria-disabled="true" className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-border p-3 opacity-60"><span className="theme-kpi-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl"><Icon className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-text-main">{title}</span><span className="block text-xs text-text-muted">Permission required</span></span></div>;
  return (
    <Link
      to={href}
      className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary-300 hover:bg-bg/50"
    >
      <span className="theme-kpi-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text-main">
          {title}
        </span>
        <span className="block truncate text-xs text-text-muted">{detail}</span>
      </span>
      <ArrowRight className="ml-auto h-4 w-4 text-text-muted" />
    </Link>
  );
}
function Indicator({
  icon: Icon,
  label,
  value,
  href,
  restricted = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  href: string;
  restricted?: boolean;
}) {
  if (restricted) return <div title="Permission required" aria-disabled="true" className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-border p-3 opacity-60"><span className="theme-kpi-icon grid h-9 w-9 place-items-center rounded-xl"><Icon className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-text-main">{label}</span><span className="block text-xs text-text-muted">Permission required</span></span></div>;
  return (
    <Link
      to={href}
      className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-bg/50"
    >
      <span className="theme-kpi-icon grid h-9 w-9 place-items-center rounded-xl">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text-main">
          {label}
        </span>
        <span className="block truncate text-xs text-text-muted">{value}</span>
      </span>
      <ArrowRight className="ml-auto h-4 w-4 text-text-muted" />
    </Link>
  );
}
function recentItems(briefing?: DailyGMBriefing, context?: OperationsContext) {
  const priorities =
    briefing?.todayPriorities
      .slice(0, 2)
      .map((item) => ({
        actor: "AI",
        title: item.title,
        detail: item.department || "Operations",
        module: "AI",
        severity: "INFO",
        department: item.department || "Operations",
        href: "/hotel-insights?tab=recommendations",
      })) || [];
  const risk = briefing?.operationalRisks[0]
    ? [
        {
          actor: "AI",
          title: briefing.operationalRisks[0].title,
          detail: briefing.operationalRisks[0].department || "Risk",
          module: "AI",
          severity: briefing.operationalRisks[0].severity === "CRITICAL" ? "CRITICAL" : "WARNING",
          department: briefing.operationalRisks[0].department || "Operations",
          href: "/operations/tasks-advisories?view=risks",
        },
      ]
    : [];
  const result = [
    ...priorities,
    ...risk,
    {
      actor: "System",
      title: context?.weather?.isFresh
        ? "Forecast context is current"
        : "Forecast refresh recommended",
      detail: "Weather",
      module: "Weather",
      severity: context?.weather?.isFresh ? "INFO" : "WARNING",
      department: "Operations",
      href: "/operations/operational-intelligence/weather-forecast",
    },
  ];
  return result.slice(0, 3);
}
function ActivityFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}<select aria-label={`Activity ${label.toLowerCase()}`} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium normal-case text-text-main">{options.map((option) => <option key={option} value={option}>{option === "ALL" ? "All" : option === "24H" ? "Last 24 hours" : option === "7D" ? "Last 7 days" : option.replace(/_/g, " ")}</option>)}</select></label>;
}
function Metric({ label, value, warning = false }: { label: string; value: string | number; warning?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warning ? "border-amber-200 bg-amber-50/60" : "border-border bg-bg/50"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`mt-1 text-lg font-bold ${warning ? "text-amber-800" : "text-text-main"}`}>{value}</p>
    </div>
  );
}
function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="mt-4 rounded-xl border border-border bg-bg/50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p><p className="mt-1 text-sm font-medium text-text-main">{value}</p></div>;
}
function DetailDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-text-main/25" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label={title} className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-text-main">{title}</h2><button type="button" className="btn-outline" onClick={onClose} aria-label={`Close ${title}`}>Close</button></div>
        <div className="mt-5">{children}</div>
      </aside>
    </div>
  );
}
function Skeleton() {
  return <div className="h-40 animate-shimmer rounded-2xl" />;
}
function OperationsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    </div>
  );
}
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
      <AlertTriangle className="h-6 w-6" />
      <h2 className="mt-3 font-semibold">Unable to load operations context</h2>
      <p className="mt-1 text-sm">
        The command centre could not retrieve live hotel data.
      </p>
      <button className="btn-outline mt-4" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
