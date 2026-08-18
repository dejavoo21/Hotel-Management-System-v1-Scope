import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import OperationsCenterPage from "./OperationsCenterPage";

const serviceMocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  getBriefing: vi.fn(),
  listRecommendations: vi.fn(),
  syncWeather: vi.fn(),
  createWeatherTask: vi.fn(),
  createAdvisoryTask: vi.fn(),
  listTimeline: vi.fn(),
}));

vi.mock("@/services", () => ({
  operationsService: {
    getOperationsContext: serviceMocks.getContext,
    createAdvisoryTicket: serviceMocks.createAdvisoryTask,
  },
  aiBriefingService: { getDailyBriefing: serviceMocks.getBriefing },
  aiRecommendationsService: { list: serviceMocks.listRecommendations },
  weatherSignalsService: { sync: serviceMocks.syncWeather },
  timelineService: { list: serviceMocks.listTimeline },
}));
vi.mock("@/services/operations", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/services/operations")>();
  return {
    ...original,
    operationsService: {
      ...original.operationsService,
      createTicketFromWeatherAction: serviceMocks.createWeatherTask,
    },
  };
});
vi.mock("@/components/collaboration/CollaborationHeader", () => ({
  default: ({ title }: { title: string }) => (
    <header>
      <h1>{title}</h1>
    </header>
  ),
}));
vi.mock("@/components/operations/advisories/OpsAdvisories", () => ({
  default: () => <div>Detailed advisories</div>,
}));
vi.mock("@/components/operations/pricing/PricingCalendarCard", () => ({
  default: () => <div>Detailed revenue guidance</div>,
}));
vi.mock("@/components/operations/pricing/MarketIntelligenceWorkspace", () => ({
  default: () => <div>Detailed market intelligence</div>,
}));
vi.mock("@/components/operations/SignalsGrid", () => ({
  default: () => <div>Detailed signals</div>,
}));
vi.mock("@/components/operations/signals/ArrivalsSignalCard", () => ({
  default: () => <div>Arrivals details</div>,
}));
vi.mock("@/components/operations/signals/DemandSignalCard", () => ({
  default: () => <div>Demand details</div>,
}));
vi.mock("@/components/operations/signals/PricingSignalCard", () => ({
  default: () => <div>Pricing details</div>,
}));
vi.mock("@/components/operations/signals/WeatherSignalCard", () => ({
  default: () => <div>Weather details</div>,
}));
vi.mock("@/components/operations/DepartmentIntelligenceCard", () => ({
  default: () => <div>Department intelligence details</div>,
}));
vi.mock("@/components/operations/AIRecommendationGovernancePanel", () => ({
  default: () => <div>Detailed governance queue</div>,
}));
vi.mock("@/components/timeline/OperationalTimeline", () => ({
  default: () => <div>Detailed activity filters</div>,
}));

const context = {
  hotelId: "hotel-1",
  generatedAtUtc: "2026-08-11T12:00:00Z",
  weather: {
    isFresh: true,
    stale: false,
    staleHours: 0.3,
    syncedAtUtc: "2026-08-16T10:02:00Z",
    city: "New York",
    country: "United States",
    daysAvailable: 7,
    current: {
      temperatureC: 16,
      feelsLikeC: 16,
      summary: "clear sky",
      observedAtUtc: "2026-08-16T10:00:00Z",
    },
    next24h: { summary: "clear sky", lowC: 13.2, highC: 18.2, rainRisk: "low" },
  },
  ops: { arrivalsNext24h: 3, departuresNext24h: 2, inhouseNow: 12 },
  pricingSignal: {
    demandTrend: "down",
    marketCoveragePct: 0,
    opportunityPct: -7,
    suggestion: "Review pricing",
  },
  pricingSnapshotMeta: {
    generatedAtUtc: "2026-08-15T03:26:27Z",
    source: "INTERNAL_RULES",
    version: "Internal model v1",
  },
  pricingCalendar: [
    {
      date: "2026-08-15",
      occupancyForecast: 0,
      suggestedAdjustmentPct: -7,
      confidence: "low",
      reasons: ["Soft booking pace"],
    },
    {
      date: "2026-08-16",
      occupancyForecast: 0.05,
      suggestedAdjustmentPct: -7,
      confidence: "low",
      reasons: ["Low occupancy"],
    },
    {
      date: "2026-08-17",
      occupancyForecast: 0.08,
      suggestedAdjustmentPct: -4,
      confidence: "medium",
      reasons: ["Monitor demand"],
    },
  ],
  advisories: [
    {
      id: "a1",
      title: "Proceed with standard operations plan",
      reason: "No weather disruptions detected in the current forecast window.",
      priority: "low",
      source: "WEATHER_ACTIONS",
      department: "MAINTENANCE",
    },
  ],
};
const briefing = {
  hotelHealthScore: 78,
  executiveSummary: "Operations need attention.",
  todayPriorities: [
    {
      title: "Review arrivals",
      detail: "Prepare rooms",
      department: "FRONT_DESK",
    },
  ],
  operationalRisks: [
    { title: "Late room", detail: "Needs review", severity: "HIGH" },
  ],
  guestExperienceRisks: [],
  revenueOpportunities: [],
  weatherImpacts: [],
  maintenanceConcerns: [],
  securityConcerns: [],
  smartBuildingConcerns: [],
  staffingSuggestions: [],
  recommendedActions: [
    {
      title: "Assign owner",
      owner: "Front Desk",
      priority: "HIGH",
      rationale: "Resolve promptly",
    },
  ],
  generatedAt: "2026-08-11T12:00:00Z",
  contextVersion: "v1",
  source: "RULES",
};

const renderPage = (route = "/operations-center") => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <OperationsCenterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("OperationsCenterPage", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: "admin-1", role: "ADMIN", hotel: { id: "hotel-1" } } as never,
    });
    serviceMocks.getContext.mockResolvedValue(context);
    serviceMocks.getBriefing.mockResolvedValue(briefing);
    serviceMocks.listRecommendations.mockResolvedValue([
      {
        id: "rec-1",
        title: "Assign overdue tasks",
        description: "Assign owners to overdue operational work.",
        department: "Security",
        priority: "HIGH",
        confidence: 0.91,
        createdAt: "2026-08-11T12:00:00Z",
      },
      {
        id: "rec-2",
        title: "Review arrivals",
        description: "Confirm arrival readiness.",
        department: "Front Desk",
        priority: "MEDIUM",
        confidence: 0.83,
        createdAt: "2026-08-11T12:05:00Z",
      },
    ]);
    serviceMocks.syncWeather.mockResolvedValue({ daysStored: 7 });
    serviceMocks.createWeatherTask.mockResolvedValue({
      ticketId: "task-1",
      status: "OPEN",
      department: "MAINTENANCE",
      priority: "LOW",
      conversationId: "conversation-1",
    });
    serviceMocks.createAdvisoryTask.mockResolvedValue({
      ticketId: "task-advisory-1",
      status: "OPEN",
      department: "MAINTENANCE",
      conversationId: "conversation-2",
      assignedTo: { id: "user-2", firstName: "Sam", lastName: "Lee" },
    });
    serviceMocks.listTimeline.mockResolvedValue({
      events: [
        {
          id: "event-1",
          timestamp: "2026-08-16T10:04:00Z",
          hotelId: "hotel-1",
          module: "AI",
          eventType: "RECOMMENDATION",
          severity: "SUCCESS",
          department: "FRONT_DESK",
          summary: "Run front desk pre-shift huddle",
          icon: "sparkles",
          sourceEventId: "source-1",
          correlationId: "correlation-1",
        },
      ],
      filters: {
        modules: ["AI"],
        severities: ["SUCCESS"],
        departments: ["FRONT_DESK"],
      },
    });
  });

  it("renders a summary-first command centre without mounting dense details", async () => {
    renderPage();
    expect(
      await screen.findByText("Today’s Operational Focus"),
    ).toBeInTheDocument();
    expect(screen.getByText("Department Snapshot")).toBeInTheDocument();
    expect(screen.getByText("Operational Indicators")).toBeInTheDocument();
    expect(screen.getByText("Operations Quick Actions")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Review tasks and advisories/ }),
    ).toHaveAttribute("href", "/operations/tasks-advisories?status=open");
    expect(screen.getByRole("link", { name: "Open Forecast Status details" })).toHaveAttribute("href", "/operations/operational-intelligence/weather-forecast");
    expect(screen.getByRole("link", { name: "Open Demand Signal details" })).toHaveAttribute("href", "/operations/operational-intelligence/revenue-guidance");
    expect(screen.getByRole("link", { name: "Open Active Alerts details" })).toHaveAttribute("href", "/security-center/alerts?status=active&severity=high");
    expect(screen.getByRole("link", { name: "Open Open Tasks details" })).toHaveAttribute("href", "/operations/tasks-advisories?status=open");
    expect(
      screen.queryByPlaceholderText("Ask an operational question..."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("AI Recommendation Governance"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review queue/ })).toHaveAttribute(
      "href",
      "/operations/ai-governance#ai-recommendation-governance",
    );
    expect(
      screen.queryByText("Detailed governance queue"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Detailed market intelligence"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "View Front Desk details" })[0]);
    expect(screen.getByRole("dialog", { name: "Front Desk Intelligence" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close Front Desk Intelligence" }));
    fireEvent.click(screen.getByRole("button", { name: "View all activity" }));
    const activityDrawer = screen.getByRole("dialog", { name: "Recent Operational Activity" });
    expect(activityDrawer).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Activity module"), { target: { value: "Weather" } });
    expect(within(activityDrawer).getByText("Forecast context is current")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Activity severity"), { target: { value: "CRITICAL" } });
    expect(screen.getByText("No operational activity matches these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByLabelText("Activity module")).toHaveValue("ALL");
  });

  it("replaces duplicate chat with an operational briefing while preserving governance and intelligence", async () => {
    const openAssistant = vi.fn();
    const governanceFilter = vi.fn();
    window.addEventListener("laflo:open-assistant", openAssistant);
    window.addEventListener("laflo:governance-filter", governanceFilter);
    renderPage("/operations-center/ai");
    expect(await screen.findByRole("heading", { name: "AI Governance" })).toBeInTheDocument();
    expect(
      await screen.findByText("AI Operational Briefing"),
    ).toBeInTheDocument();
    expect(screen.getByText("Today’s key AI insight")).toBeInTheDocument();
    expect(screen.getByText("Top operational risk")).toBeInTheDocument();
    expect(screen.getByText("Recommended next action")).toBeInTheDocument();
    expect(screen.getByText("87%")).toBeInTheDocument();
    expect(screen.queryByText("AI Assistant")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Ask an operational question..."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Context Preview")).toBeInTheDocument();
    expect(screen.getByText("Department Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Detailed governance queue")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Weather Live/i }));
    expect(screen.getByRole("dialog", { name: "Weather" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close Weather" }));

    fireEvent.click(screen.getByRole("button", { name: /Front Desk Live/i }));
    expect(governanceFilter).toHaveBeenCalledTimes(1);
    expect((governanceFilter.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ status: "PENDING", department: "Front Desk" });

    fireEvent.click(
      screen.getByRole("button", { name: "Ask LaFlo for details" }),
    );
    expect(openAssistant).toHaveBeenCalledTimes(1);
    expect(
      (openAssistant.mock.calls[0][0] as CustomEvent).detail,
    ).toMatchObject({ mode: "operations" });

    fireEvent.click(screen.getByRole("button", { name: "Refresh briefing" }));
    await waitFor(() =>
      expect(serviceMocks.getBriefing).toHaveBeenCalledTimes(2),
    );
    window.removeEventListener("laflo:open-assistant", openAssistant);
    window.removeEventListener("laflo:governance-filter", governanceFilter);
  });

  it("renders the executive revenue guidance workspace with a compact filterable night preview", async () => {
    renderPage("/operations-center/revenue");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Revenue Guidance",
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Revenue Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Actionable Focus")).toBeInTheDocument();
    expect(screen.getByText("Demand Forecast")).toBeInTheDocument();
    expect(screen.getByText("Pricing Intelligence")).toBeInTheDocument();
    expect(
      screen.getByText("Revenue Guidance (14 nights)"),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "All nights" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByText("Ask Hotel Brain")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/ask.*question/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Weekend focus" }));
    expect(screen.getByRole("tab", { name: "Weekend focus" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Sat, Aug 15")).toBeInTheDocument();
    expect(screen.getByText("Sun, Aug 16")).toBeInTheDocument();
    expect(screen.queryByText("Mon, Aug 17")).not.toBeInTheDocument();
  });

  it("renders Market Intelligence as a dedicated pricing decision workspace", async () => {
    renderPage("/operations-center/market-intelligence");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Market Intelligence",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Detailed market intelligence"),
    ).toBeInTheDocument();
  });

  it("renders actionable weather intelligence with unit, filter, refresh, and task workflows", async () => {
    renderPage("/operations-center/weather");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Weather & Forecast",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("24-Hour Operational Forecast"),
    ).toBeInTheDocument();
    expect(screen.getByText("Readiness & Impact Overview")).toBeInTheDocument();
    expect(screen.getByText("Operations Advisory")).toBeInTheDocument();
    expect(
      screen.getByText("Forecast source: Connected provider"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "°C" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "°F" }));
    expect(screen.getByRole("button", { name: "°F" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Not created" }));
    expect(
      screen.getByText("Proceed with standard operations plan"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    const weatherTaskDialog = screen.getByRole("dialog", {
      name: "Create weather-driven task",
    });
    expect(weatherTaskDialog).toHaveTextContent(
      "Proceed with standard operations plan",
    );
    fireEvent.click(
      within(weatherTaskDialog).getByRole("button", { name: "Create task" }),
    );
    await waitFor(() =>
      expect(serviceMocks.createWeatherTask).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          title: "Proceed with standard operations plan",
        }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Created" }));
    expect(
      await screen.findByRole("button", { name: "Task created" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Current Weather/i }));
    expect(screen.getByRole("dialog", { name: "Weather Outlook" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close Weather Outlook" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Now forecast details" }));
    expect(screen.getByRole("dialog", { name: "Now Forecast" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close Now Forecast" }));
    fireEvent.click(screen.getByRole("button", { name: /Guest Readiness/i }));
    expect(screen.getByRole("dialog", { name: "Guest Readiness" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close Guest Readiness" }));

    fireEvent.click(screen.getByRole("button", { name: "Refresh forecast" }));
    await waitFor(() =>
      expect(serviceMocks.syncWeather).toHaveBeenCalledWith("hotel-1"),
    );
  });

  it("shows the weather no-data state without blank forecast regions", async () => {
    serviceMocks.getContext.mockResolvedValueOnce({
      ...context,
      weather: {
        isFresh: false,
        stale: true,
        syncedAtUtc: null,
        current: null,
        next24h: null,
      },
    });
    renderPage("/operations-center/weather");
    expect(
      await screen.findByText("No forecast data available"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Refresh forecast/i }),
    ).toHaveLength(2);
  });

  it("shows the weather error state with a retry action", async () => {
    serviceMocks.getContext.mockRejectedValueOnce(
      new Error("Forecast unavailable"),
    );
    renderPage("/operations-center/weather");
    expect(
      await screen.findByText("Weather forecast could not be loaded"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(serviceMocks.syncWeather).toHaveBeenCalled());
  });

  it("renders the tasks action centre and completes advisory workflows", async () => {
    const openAssistant = vi.fn();
    window.addEventListener("laflo:open-assistant", openAssistant);
    renderPage("/operations-center/tasks");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Tasks & Advisories",
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Open Advisories")).toBeInTheDocument();
    expect(screen.getByText("Pending Assignment")).toBeInTheDocument();
    expect(screen.getByText("Critical Items")).toBeInTheDocument();
    expect(screen.getByText("Operations Advisory")).toBeInTheDocument();
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    expect(screen.getByText("Front Desk Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Housekeeping Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Security Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Arrival Forecast")).toBeInTheDocument();
    expect(screen.queryByText("AI Recommendation Governance")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Critical Items/i }));
    expect(screen.getByLabelText("Advisory priority")).toHaveValue("high");
    fireEvent.click(screen.getByRole("button", { name: /Open Advisories/i }));
    expect(screen.getByLabelText("Advisory priority")).toHaveValue("ALL");

    fireEvent.click(screen.getByRole("button", { name: /^Arrival Forecast Operational/i }));
    expect(screen.getByRole("dialog", { name: "Arrival forecast details" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close arrival forecast" }));

    fireEvent.click(screen.getByRole("button", { name: /Front Desk Intelligence/i }));
    expect(screen.getByRole("dialog", { name: "Front Desk Intelligence details" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close Front Desk Intelligence" }));

    fireEvent.click(screen.getByRole("button", { name: /Run front desk pre-shift huddle/i }));
    expect(screen.getByRole("dialog", { name: "Activity details" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close activity details" }));

    fireEvent.click(screen.getByRole("button", { name: "Ask LaFlo about tasks" }));
    expect(openAssistant).toHaveBeenCalledTimes(1);
    expect((openAssistant.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ mode: "tasks-advisories" });

    fireEvent.click(screen.getByRole("button", { name: "Not created" }));
    expect(
      screen.getByText("Proceed with standard operations plan"),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Advisory priority"), {
      target: { value: "high" },
    });
    expect(
      screen.getByText("No advisories match the selected filters."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Advisory priority"), {
      target: { value: "low" },
    });
    fireEvent.change(screen.getByLabelText("Advisory department"), {
      target: { value: "MAINTENANCE" },
    });
    expect(
      screen.getByText("Proceed with standard operations plan"),
    ).toBeInTheDocument();

    await screen.findByRole("option", { name: "AI" });
    fireEvent.change(screen.getByLabelText("Activity module"), {
      target: { value: "AI" },
    });
    await waitFor(() =>
      expect(serviceMocks.listTimeline).toHaveBeenLastCalledWith(
        expect.objectContaining({ module: "AI" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "View all activity" }));
    await waitFor(() =>
      expect(serviceMocks.listTimeline).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 100 }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    expect(
      screen.getByRole("dialog", { name: "Create task from advisory" }),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Proceed with standard operations plan"),
    ).toBeInTheDocument();
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Create task from advisory" }),
      ).getByRole("button", { name: "Create task" }),
    );
    await waitFor(() =>
      expect(serviceMocks.createAdvisoryTask).toHaveBeenCalledWith(
        expect.objectContaining({
          advisoryId: "a1",
          department: "MAINTENANCE",
        }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Created" }));
    expect(await screen.findByText(/Task task-adv/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect(
      screen.getByRole("dialog", { name: "Assign operational work" }),
    ).toHaveTextContent("Sam Lee");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Dismiss Proceed with standard operations plan/,
      }),
    );
    expect(
      screen.getByRole("alertdialog", { name: "Dismiss this advisory?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss advisory" }));
    expect(
      screen.queryByText("Proceed with standard operations plan"),
    ).not.toBeInTheDocument();
    window.removeEventListener("laflo:open-assistant", openAssistant);
  });

  it("shows an honest blocked state when the task service is unavailable", async () => {
    serviceMocks.createAdvisoryTask.mockRejectedValueOnce({
      response: {
        status: 503,
        data: { error: "Task service is not connected" },
      },
    });
    renderPage("/operations-center/tasks");
    await screen.findByText("Open Advisories");
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    const dialog = screen.getByRole("dialog", {
      name: "Create task from advisory",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create task" }),
    );
    expect(
      await screen.findByText("Task service is not connected."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Integration Manager" }),
    ).toHaveAttribute("href", "/settings?tab=integrations");
  });

  it("offers recovery actions when recent activity is empty", async () => {
    serviceMocks.listTimeline.mockResolvedValue({
      events: [],
      filters: { modules: [], severities: [], departments: [] },
    });
    renderPage("/operations-center/tasks");
    expect(
      await screen.findByText("No recent activity matches these filters"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Clear filters" })).not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Refresh activity" }));
    await waitFor(() => expect(serviceMocks.listTimeline).toHaveBeenCalledTimes(2));
    fireEvent.click(
      screen.getByRole("button", { name: "View system / technical activity" }),
    );
    expect(screen.getByLabelText("Activity module")).toHaveValue(
      "SYSTEM_TECHNICAL",
    );
  });
});
