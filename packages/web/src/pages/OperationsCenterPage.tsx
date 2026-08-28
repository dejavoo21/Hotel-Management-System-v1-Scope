import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  CloudRain,
  Gauge,
  House,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UsersRound,
  Wrench,
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
    title: "AI Governance",
    description:
      "Review, approve, reject, expire, or convert AI recommendations into governed tasks.",
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
  const governanceQuery = useQuery({
    queryKey: ["ai-recommendations", "PENDING"],
    queryFn: () => aiRecommendationsService.list("PENDING"),
    enabled: Boolean(hotelId) && isOverview,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const refreshWeatherMutation = useMutation({
    mutationFn: async () => {
      const weather = await weatherSignalsService.sync(hotelId);
      const results = await Promise.allSettled([
        operationsQuery.refetch(),
        isOverview ? briefingQuery.refetch() : Promise.resolve(),
        isOverview ? governanceQuery.refetch() : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ["operations-events"] }),
      ]);
      return { weather, partial: results.some((result) => result.status === "rejected") };
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
      pendingGovernance={governanceQuery.data?.length || 0}
      governanceItems={governanceQuery.data || []}
      briefingError={briefingQuery.isError}
      governanceError={governanceQuery.isError}
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
  pendingGovernance,
  governanceItems,
  briefingError,
  governanceError,
  role,
  permissions,
}: {
  header: React.ReactNode;
  context?: OperationsContext;
  briefing?: DailyGMBriefing;
  briefingLoading: boolean;
  pendingGovernance: number;
  governanceItems: Array<{ priority?: string; createdAt?: string }>;
  briefingError: boolean;
  governanceError: boolean;
  role?: string;
  permissions: string[];
}) {
  const [departmentDetail, setDepartmentDetail] = useState<string | null>(null);
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
  const criticalRisks = risks.filter(
    (item) => item.severity === "CRITICAL" || item.severity === "HIGH",
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
  const operationalFocus: Array<{
    title: string;
    tone: "good" | "risk" | "warn";
    icon: typeof Activity;
    count: number;
    items: DailyBriefingItem[];
    href: string;
    link: string;
  }> = [
    {
      title: "Top Priorities",
      tone: "good",
      icon: CheckCircle2,
      count: briefing?.todayPriorities.length || 0,
      items: briefing?.todayPriorities || [],
      href: "/operations/tasks-advisories?view=priorities",
      link: "View all priorities",
    },
    {
      title: "Active Risks",
      tone: "risk",
      icon: AlertTriangle,
      count: risks.length,
      items: risks,
      href: canSecurity ? "/security-center/alerts?status=active&severity=high" : "",
      link: "View all risks",
    },
    {
      title: "Recommended Actions",
      tone: "warn",
      icon: Activity,
      count: briefing?.recommendedActions.length || 0,
      items: (briefing?.recommendedActions || []).map((item) => ({
        title: item.title,
        detail: `${item.owner} · ${item.rationale}`,
      })),
      href: "/operations/tasks-advisories?view=recommended",
      link: "View all actions",
    },
  ];
  const departments = [
    {
      name: "Front Desk",
      icon: UsersRound,
      status: context?.ops?.arrivalsNext24h ? "Active" : "Ready",
      metrics: [
        ["Arrivals", context?.ops?.arrivalsNext24h || 0],
        ["Departures", context?.ops?.departuresNext24h || 0],
        ["In house", context?.ops?.inhouseNow || 0],
      ],
      href: "/operations/tasks-advisories?department=FRONT_DESK",
    },
    {
      name: "Housekeeping",
      icon: House,
      status: briefing?.maintenanceConcerns.length ? "At risk" : "Stable",
      metrics: [
        [
          "Priorities",
          briefing?.todayPriorities.filter((x) =>
            x.department?.includes("HOUSE"),
          ).length || 0,
        ],
        ["Risks", briefing?.operationalRisks.length || 0],
        [
          "Actions",
          advisories.filter((x) => x.department === "HOUSEKEEPING").length,
        ],
      ],
      href: "/operations/tasks-advisories?department=HOUSEKEEPING",
    },
    {
      name: "Maintenance",
      icon: Wrench,
      status: briefing?.maintenanceConcerns.length ? "Attention" : "Stable",
      metrics: [
        ["Concerns", briefing?.maintenanceConcerns.length || 0],
        [
          "Urgent",
          briefing?.maintenanceConcerns.filter((x) => x.severity === "CRITICAL")
            .length || 0,
        ],
        [
          "Advisories",
          advisories.filter((x) => x.department === "MAINTENANCE").length,
        ],
      ],
      href: "/operations/tasks-advisories?department=MAINTENANCE",
    },
    {
      name: "Security",
      icon: ShieldAlert,
      status: briefing?.securityConcerns.length ? "Attention" : "Stable",
      metrics: [
        ["Alerts", briefing?.securityConcerns.length || 0],
        [
          "Critical",
          briefing?.securityConcerns.filter((x) => x.severity === "CRITICAL")
            .length || 0,
        ],
        ["Risks", criticalRisks.length],
      ],
      href: "/security-center/alerts?department=SECURITY",
    },
  ];

  return (
    <div className="grid gap-4 pb-28 xl:grid-cols-[minmax(0,1fr)_420px]">
      <main className="min-w-0 space-y-4">
        {header}
        <section
          aria-label="Operations summary"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatusCard
            icon={CloudRain}
            label="Forecast Status"
            value={forecastFresh ? "Fresh" : "Needs refresh"}
            sub={
              context?.weather?.syncedAtUtc
                ? `Updated ${new Date(context.weather.syncedAtUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Forecast not synced"
            }
            tone={forecastFresh ? "good" : "warn"}
            href="/operations/operational-intelligence/weather-forecast"
          />
          <StatusCard
            icon={demand === "down" ? TrendingDown : TrendingUp}
            label="Demand Signal"
            value={
              demand === "up"
                ? "Rising"
                : demand === "down"
                  ? "Softening"
                  : "Stable"
            }
            sub={
              context?.pricingSignal?.suggestion ||
              context?.pricingSignal?.note ||
              "Monitor booking pace"
            }
            tone={demand === "down" ? "warn" : "info"}
            href={canRevenue ? "/operations/operational-intelligence/revenue-guidance" : ""}
            restricted={!canRevenue}
          />
          <StatusCard
            icon={ShieldAlert}
            label="Active Alerts"
            value={String(criticalRisks.length)}
            sub={`${risks.filter((x) => x.severity === "CRITICAL").length} critical · ${risks.filter((x) => x.severity === "HIGH").length} high`}
            tone={criticalRisks.length ? "risk" : "good"}
            href={canSecurity ? "/security-center/alerts?status=active&severity=high" : ""}
            restricted={!canSecurity}
          />
          <StatusCard
            icon={ClipboardList}
            label="Open Tasks"
            value={String(advisories.length)}
            sub={`Across ${new Set(advisories.map((x) => x.department).filter(Boolean)).size || 0} departments`}
            tone="info"
            href={canTasks ? "/operations/tasks-advisories?status=open" : ""}
            restricted={!canTasks}
          />
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="font-semibold text-text-main">
            Today’s Operational Focus
          </h2>
          {briefingLoading ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          ) : (
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {operationalFocus.map((item) => (
                <FocusCard key={item.title} {...item} restricted={!canTasks || (item.title === "Active Risks" && !canSecurity)} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-text-main">
              Department Snapshot
            </h2>
            <Link
              className="text-sm font-semibold text-primary-600 hover:text-primary-700"
              to="/operations/ai-governance"
            >
              Open department intelligence
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {departments.map((department) => (
              <DepartmentSnapshot
                key={department.name}
                {...department}
                restricted={(department.name === "Security" && !canSecurity) || (!canTasks && department.name !== "Security")}
                onOpen={() => setDepartmentDetail(department.name)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="font-semibold text-text-main">Recent Activity</h2>
              <p className="text-xs text-text-muted">
                Latest operational signals and recommendations
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600"
              onClick={() => setShowActivity(true)}
            >
              View all activity <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="divide-y divide-border">
            {recentItems(briefing, context).map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[90px_1fr_auto] sm:items-center"
              >
                <span className="font-semibold text-text-main">
                  {item.actor}
                </span>
                <span className="text-text-muted">{item.title}</span>
                <span className="text-xs text-text-muted">{item.detail}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="theme-kpi-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-text-main">
                Operations Quick Actions
              </h2>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                Open the live operational workspace you need. Use Ask LaFlo for
                AI questions.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <QuickAction
              icon={ClipboardList}
              title="Review tasks and advisories"
              detail={`${advisories.length} open tasks`}
              href="/operations/tasks-advisories?status=open"
              restricted={!canTasks}
            />
            <QuickAction
              icon={AlertTriangle}
              title="Review active risks"
              detail={`${criticalRisks.length} high-priority alerts`}
              href="/security-center/alerts?status=active&severity=high"
              restricted={!canSecurity}
            />
            <QuickAction
              icon={Gauge}
              title="Open revenue guidance"
              detail={`${context?.pricingSignal?.marketCoveragePct || 0}% market coverage`}
              href="/operations/operational-intelligence/revenue-guidance"
              restricted={!canRevenue}
            />
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="font-semibold text-text-main">
            Operational Indicators
          </h2>
          <div className="mt-3 space-y-2">
            <Indicator
              icon={CloudRain}
              label="Weather Outlook"
              value={context?.weather?.next24h?.summary || "No forecast"}
              href="/operations/operational-intelligence/weather-forecast"
            />
            <Indicator
              icon={UsersRound}
              label="Arrival Forecast"
              value={`${context?.ops?.arrivalsNext24h || 0} arrivals`}
              href="/operations/operational-intelligence/weather-forecast"
            />
            <Indicator
              icon={Gauge}
              label="Revenue Guidance"
              value={`${context?.pricingSignal?.marketCoveragePct || 0}% coverage`}
              href="/operations/operational-intelligence/revenue-guidance"
              restricted={!canRevenue}
            />
          </div>
          <Link
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-600"
            to="/operations/operational-intelligence/weather-forecast"
          >
            View all indicators <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
        <SummaryPanel
          icon={ShieldCheck}
          title="AI Recommendation Governance"
          description="Keep AI recommendations accurate and aligned with operational goals."
          action="Review queue"
          href="/operations/ai-governance#ai-recommendation-governance"
          restricted={!canGovernance}
          darkIcon
        >
          {governanceError ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">AI governance queue is unavailable.</p>
          ) : canGovernance ? (
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Pending reviews" value={pendingGovernance} warning={pendingGovernance >= 25} />
              <Metric label="High priority" value={governanceItems.filter((item) => item.priority === "HIGH" || item.priority === "CRITICAL").length} warning />
              <Metric label="Tasks created" value={advisories.filter((item) => item.createdTicket).length} />
              <Metric label="Last updated" value={context?.generatedAtUtc ? new Date(context.generatedAtUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Awaiting data"} />
            </div>
          ) : (
            <p className="rounded-xl bg-bg p-3 text-xs text-text-muted">Permission required to view AI governance.</p>
          )}
        </SummaryPanel>
      </aside>
      {departmentDetail ? (
        <DetailDrawer title={`${departmentDetail} Intelligence`} onClose={() => setDepartmentDetail(null)}>
          <p className="text-sm text-text-muted">Live department context from authorised operational records.</p>
          <DetailRow label="Top priority" value={briefing?.todayPriorities.find((item) => item.department?.includes(departmentDetail.toUpperCase().replace(" ", "_")))?.title || "No active priorities."} />
          <DetailRow label="Top risk" value={risks.find((item) => item.department?.includes(departmentDetail.toUpperCase().replace(" ", "_")))?.title || "No active risks."} />
          <DetailRow label="Recommended action" value={briefing?.recommendedActions[0]?.title || "No recommended actions."} />
          <Link className="btn-primary mt-4 inline-flex" to="/operations/tasks-advisories">Open related tasks</Link>
          {canGovernance ? <Link className="btn-outline ml-2 mt-4 inline-flex" to={`/operations/ai-governance?department=${encodeURIComponent(departmentDetail)}#ai-recommendation-governance`}>AI Governance</Link> : null}
        </DetailDrawer>
      ) : null}
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
          detail="Governance review queue"
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
              void briefingQuery.refetch();
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

const toneClass = {
  good: "border-emerald-200 bg-emerald-50/40 text-emerald-700",
  warn: "border-amber-200 bg-amber-50/40 text-amber-700",
  risk: "border-rose-200 bg-rose-50/40 text-rose-700",
  info: "border-sky-200 bg-sky-50/40 text-sky-700",
};
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
    <header className="flex flex-col gap-3 px-1 py-1 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3">
        <span className="theme-kpi-icon grid h-12 w-12 shrink-0 place-items-center rounded-2xl">
          <Activity className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main">
            Operations Center
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Real-time operational visibility across your hotel. Make informed
            decisions with confidence.
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
        <span
          className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${isError ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          {isError ? "Context unavailable" : "Operations workspace"}
        </span>
        {refreshButton}
      </div>
    </header>
  );
}
function StatusCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  href,
  restricted = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub: string;
  tone: keyof typeof toneClass;
  href: string;
  restricted?: boolean;
}) {
  const content = (
    <article className={`min-h-[116px] rounded-2xl border p-4 shadow-sm transition-transform ${restricted ? "cursor-not-allowed opacity-65" : "hover:-translate-y-0.5 hover:shadow-md"} ${toneClass[tone]}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card/80">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className="mt-1 text-lg font-bold text-text-main">{value}</p>
          <p className="mt-1 truncate text-xs text-text-muted">{sub}</p>
        </div>
      </div>
      {restricted ? <span className="mt-2 block text-[10px] font-semibold">Permission required</span> : null}
    </article>
  );
  return restricted ? <div title="Permission required">{content}</div> : <Link to={href} aria-label={`Open ${label} details`}>{content}</Link>;
}
function FocusCard({
  title,
  tone,
  icon: Icon,
  count,
  items,
  href,
  link,
  restricted = false,
}: {
  title: string;
  tone: "good" | "risk" | "warn";
  icon: typeof Activity;
  count: number;
  items: DailyBriefingItem[];
  href: string;
  link: string;
  restricted?: boolean;
}) {
  return (
    <article
      className={`flex min-h-40 flex-col rounded-2xl border p-3.5 ${toneClass[tone]}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <h3 className="text-sm font-semibold text-text-main">{title}</h3>
        <span className="ml-auto rounded-full bg-card/80 px-2 py-0.5 text-xs font-bold">
          {count}
        </span>
      </div>
      <div className="mt-3 flex-1 space-y-1.5">
        {items.slice(0, 3).map((item, index) => (
          <Link
            key={`${item.title}-${index}`}
            to={restricted ? "#" : href}
            onClick={(event) => restricted && event.preventDefault()}
            className="flex gap-2 rounded-md text-xs text-text-muted hover:text-text-main"
          >
            <span aria-hidden>•</span>
            <span className="line-clamp-1">{item.title}</span>
          </Link>
        ))}
        {!items.length ? (
          <p className="text-xs text-text-muted">No {title.toLowerCase()}.</p>
        ) : null}
      </div>
      {restricted ? <span title="Permission required" className="mt-2 inline-flex cursor-not-allowed items-center gap-1 text-xs font-semibold text-text-muted">Permission required</span> : <Link
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-700"
        to={href}
      >
        {link} <ArrowRight className="h-3.5 w-3.5" />
      </Link>}
    </article>
  );
}
function DepartmentSnapshot({
  name,
  icon: Icon,
  status,
  metrics,
  restricted = false,
  onOpen,
}: {
  name: string;
  icon: typeof Activity;
  status: string;
  metrics: (string | number)[][];
  restricted?: boolean;
  onOpen: () => void;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="theme-kpi-icon grid h-8 w-8 place-items-center rounded-xl">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-semibold text-text-main">{name}</h3>
        <span className="ml-auto rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold text-text-muted">
          {status}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 divide-x divide-border">
        {metrics.map(([label, value]) => (
          <div key={label} className="px-1.5 text-center first:pl-0 last:pr-0">
            <p className="text-base font-bold text-text-main">{value}</p>
            <p className="truncate text-[9px] text-text-muted">{label}</p>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 flex items-center justify-center gap-1 border-t border-border pt-2.5 text-xs font-semibold text-primary-600"
        onClick={onOpen}
        disabled={restricted}
        title={restricted ? "Permission required" : `View ${name} details`}
        aria-label={restricted ? `${name}: Permission required` : `View ${name} details`}
      >
        {restricted ? "Permission required" : "View details"} <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </article>
  );
}
function SummaryPanel({
  icon: Icon,
  title,
  description,
  action,
  href,
  badge,
  darkIcon = false,
  restricted = false,
  children,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
  action: string;
  href: string;
  badge?: string;
  darkIcon?: boolean;
  restricted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${darkIcon ? "bg-primary-solid text-primary-contrast" : "theme-kpi-icon"}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-semibold text-text-main">{title}</h2>
            {badge ? (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-text-muted">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
      {restricted ? <span title="Permission required" className="mt-3 inline-flex cursor-not-allowed text-xs font-semibold text-text-muted">Permission required</span> : <Link
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600"
        to={href}
      >
        {action} <ArrowRight className="h-3.5 w-3.5" />
      </Link>}
    </section>
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
        href: "/operations/ai-governance",
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
