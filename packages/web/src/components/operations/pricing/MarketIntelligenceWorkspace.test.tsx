import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperationsContext } from "@/services/operations";
import MarketIntelligenceWorkspace from "./MarketIntelligenceWorkspace";

const serviceMocks = vi.hoisted(() => ({
  listCompetitors: vi.fn(),
  addCompetitor: vi.fn(),
  bulkRates: vi.fn(),
  createPricingTask: vi.fn(),
}));

vi.mock("@/services/market", () => ({
  marketService: {
    listCompetitors: serviceMocks.listCompetitors,
    addCompetitor: serviceMocks.addCompetitor,
    bulkRates: serviceMocks.bulkRates,
  },
}));

vi.mock("@/services/operations", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/services/operations")>();
  return {
    ...original,
    operationsService: {
      ...original.operationsService,
      createTicketFromPricingAction: serviceMocks.createPricingTask,
    },
  };
});

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: any) => unknown) =>
    selector({ user: { role: "ADMIN", modulePermissions: ["financials"] } }),
}));

const context: OperationsContext = {
  hotelId: "hotel-1",
  generatedAtUtc: "2026-08-16T12:23:00Z",
  pricingSignal: {
    demandTrend: "down",
    opportunityPct: -7,
    confidence: "low",
    marketCoveragePct: 68,
  },
  pricingSnapshotMeta: {
    generatedAtUtc: "2026-08-16T12:23:00Z",
    source: "INTERNAL_RULES",
    version: "Internal model v1",
  },
  pricingCalendar: [
    {
      date: "2026-08-16",
      occupancyForecast: 0.21,
      suggestedAdjustmentPct: -7,
      confidence: "low",
      reasons: ["Soft booking pace and below-market pickup."],
      marketSamples: 3,
    },
    {
      date: "2026-08-17",
      occupancyForecast: 0.24,
      suggestedAdjustmentPct: -7,
      confidence: "low",
      reasons: ["No current competitor evidence."],
      marketSamples: 0,
    },
  ],
};

const renderWorkspace = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MarketIntelligenceWorkspace context={context} />
    </QueryClientProvider>,
  );
};

describe("MarketIntelligenceWorkspace", () => {
  beforeEach(() => {
    serviceMocks.listCompetitors.mockResolvedValue([
      {
        id: "competitor-1",
        name: "Metro Suites",
        city: "New York",
        country: "USA",
        isActive: true,
        updatedAt: "2026-08-16T12:23:00Z",
      },
      {
        id: "competitor-2",
        name: "Parklane Inn",
        city: "New York",
        country: "USA",
        isActive: true,
        updatedAt: "2026-08-16T12:23:00Z",
      },
    ]);
    serviceMocks.addCompetitor.mockResolvedValue({ id: "competitor-3" });
    serviceMocks.bulkRates.mockResolvedValue({ nightsWritten: 2 });
    serviceMocks.createPricingTask.mockResolvedValue({
      ticketId: "task-1",
      status: "OPEN",
      department: "MANAGEMENT",
      priority: "HIGH",
      conversationId: "conversation-1",
    });
  });

  it("shows the target decision hierarchy and live pricing evidence", async () => {
    renderWorkspace();

    expect(await screen.findByText("Metro Suites")).toBeInTheDocument();
    expect(screen.getByText("Revenue Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Demand Forecast")).toBeInTheDocument();
    expect(screen.getByText("Pricing Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Market Signal Health")).toBeInTheDocument();
    expect(screen.getByText("Revenue Guidance (14 nights)")).toBeInTheDocument();
    expect(screen.getByText("Promote low-demand nights")).toBeInTheDocument();
    expect(screen.getByText("Review collections before arrivals")).toBeInTheDocument();
    expect(screen.getAllByText("68%").length).toBeGreaterThan(0);
    expect(screen.getByText("3 samples")).toBeInTheDocument();
    expect(screen.getByText("No market data")).toBeInTheDocument();
  });

  it("opens summary details and filters competitor status", async () => {
    renderWorkspace();
    await screen.findByText("Metro Suites");

    fireEvent.click(screen.getAllByRole("button", { name: /Market coverage/i })[0]);
    expect(screen.getByRole("dialog", { name: "Market Coverage" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));

    fireEvent.change(screen.getByLabelText("Competitor status"), {
      target: { value: "inactive" },
    });
    expect(screen.getByText("No competitors match this filter")).toBeInTheDocument();
  });

  it("adds a competitor with parsed location data", async () => {
    renderWorkspace();

    fireEvent.change(screen.getByLabelText("Competitor hotel name"), {
      target: { value: "Central Park Lodge" },
    });
    fireEvent.change(screen.getByLabelText("Competitor location"), {
      target: { value: "New York, USA" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(serviceMocks.addCompetitor).toHaveBeenCalledWith({
        name: "Central Park Lodge",
        city: "New York",
        country: "USA",
      }),
    );
  });

  it("bulk applies rates and creates a governed pricing task", async () => {
    renderWorkspace();
    await screen.findByText("Metro Suites");

    fireEvent.click(screen.getAllByRole("button", { name: "Add rates" })[0]);
    fireEvent.change(screen.getByLabelText("Nightly rate"), {
      target: { value: "249" },
    });
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-08-16" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-08-17" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save rates" }));

    await waitFor(() =>
      expect(serviceMocks.bulkRates).toHaveBeenCalledWith({
        competitorHotelId: "competitor-1",
        startDate: "2026-08-16",
        endDate: "2026-08-17",
        rate: 249,
      }),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Create task" })[0]);
    const taskDialog = screen.getByRole("dialog", { name: "Create pricing task" });
    expect(taskDialog).toHaveTextContent("2026-08-16");
    expect(taskDialog).toHaveTextContent("Management");
    fireEvent.click(within(taskDialog).getByRole("button", { name: "Create task" }));
    await waitFor(() =>
      expect(serviceMocks.createPricingTask).toHaveBeenCalledWith(
        expect.objectContaining({
          nightDate: "2026-08-16",
          confidence: "low",
          priority: "HIGH",
        }),
      ),
    );
  });
});
