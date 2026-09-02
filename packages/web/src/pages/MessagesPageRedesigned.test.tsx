import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SET_LAFLO_ASSISTANT_CONTEXT_EVENT } from "@/lib/assistantEvents";
import { useAuthStore } from "@/stores/authStore";
import MessagesPageRedesigned from "./MessagesPageRedesigned";

const mocks = vi.hoisted(() => ({
  threads: vi.fn(),
  thread: vi.fn(),
  send: vi.fn(),
  agents: vi.fn(),
  assign: vi.fn(),
  assignTicket: vi.fn(),
  tickets: vi.fn(),
  resolve: vi.fn(),
  close: vi.fn(),
  escalate: vi.fn(),
  createTask: vi.fn(),
}));

vi.mock("@/services/messages", () => ({
  default: {
    listThreads: mocks.threads,
    getThread: mocks.thread,
    createMessage: mocks.send,
    listSupportAgents: mocks.agents,
    assignSupportAgent: mocks.assign,
  },
}));
vi.mock("@/services/tickets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/tickets")>();
  return {
    ...actual,
    default: {
      getTickets: mocks.tickets,
      assignTicket: mocks.assignTicket,
      resolveTicket: mocks.resolve,
      closeTicket: mocks.close,
      escalateTicket: mocks.escalate,
    },
  };
});
vi.mock("@/services/operations", () => ({
  default: { createAdvisoryTicket: mocks.createTask },
}));

const thread = {
  id: "thread-1",
  subject: "Late room readiness",
  status: "OPEN",
  guest: {
    firstName: "Amina",
    lastName: "Patel",
    email: "amina@example.test",
    phone: "+44123456789",
  },
  booking: {
    bookingRef: "BK-1001",
    checkInDate: "2026-09-01",
    checkOutDate: "2026-09-03",
  },
  lastMessageAt: "2026-09-01T08:00:00Z",
  lastMessage: {
    id: "message-1",
    body: "My room is not ready.",
    senderType: "GUEST",
    createdAt: "2026-09-01T08:00:00Z",
  },
};
const ticket = {
  id: "ticket-1",
  hotelId: "hotel-1",
  conversationId: "thread-1",
  type: "BOOKING_RELATED",
  category: "HOUSEKEEPING",
  department: "HOUSEKEEPING",
  priority: "HIGH",
  status: "OPEN",
  responseDueAtUtc: "2099-09-01T09:00:00Z",
  escalatedLevel: 1,
  createdAtUtc: "2026-09-01T08:01:00Z",
  updatedAtUtc: "2026-09-01T08:05:00Z",
  conversation: {
    id: "thread-1",
    subject: "Late room readiness",
    guest: { firstName: "Amina", lastName: "Patel" },
  },
};

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function renderPage(entry = "/messages?tab=overview") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter initialEntries={[entry]}>
        <MessagesPageRedesigned />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Guest Experience Center", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem("laflo.guest-experience.list-width");
    window.localStorage.removeItem("laflo.guest-experience.context-width");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    useAuthStore.setState({
      user: {
        id: "admin-1",
        firstName: "Onboarding",
        lastName: "User",
        email: "admin@laflo.test",
        role: "ADMIN",
        hotelId: "hotel-1",
        hotel: { id: "hotel-1", name: "LaFlo Hotel" },
        modulePermissions: ["messages", "bookings", "guests"],
        isActive: true,
      } as never,
    });
    mocks.threads.mockResolvedValue([thread]);
    mocks.thread.mockResolvedValue({
      ...thread,
      messages: [thread.lastMessage],
    });
    mocks.agents.mockResolvedValue([
      {
        id: "agent-1",
        firstName: "Maya",
        lastName: "Singh",
        role: "MANAGER",
        online: true,
      },
    ]);
    mocks.tickets.mockResolvedValue({
      tickets: [ticket],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    mocks.send.mockResolvedValue({
      id: "message-2",
      body: "We are checking now.",
      senderType: "STAFF",
      createdAt: "2026-09-01T08:10:00Z",
    });
    mocks.assign.mockResolvedValue(thread);
    mocks.assignTicket.mockResolvedValue({ ...ticket, assignedToId: "agent-1" });
    mocks.resolve.mockResolvedValue({ ...ticket, status: "RESOLVED" });
    mocks.close.mockResolvedValue({ ...ticket, status: "CLOSED" });
    mocks.escalate.mockResolvedValue({
      ...ticket,
      priority: "URGENT",
      status: "IN_PROGRESS",
    });
    mocks.createTask.mockResolvedValue({
      ticketId: "task-12345678",
      status: "OPEN",
      department: "HOUSEKEEPING",
      conversationId: "thread-1",
    });
  });

  it("resizes desktop workspace panes with keyboard controls and resets them", async () => {
    renderPage("/messages?tab=conversations");
    await screen.findByText("Amina Patel");

    const listSeparator = screen.getByRole("separator", {
      name: "Resize conversation list",
    });
    const contextSeparator = screen.getByRole("separator", {
      name: "Resize guest context panel",
    });

    expect(listSeparator).toHaveAttribute("aria-valuenow", "272");
    expect(contextSeparator).toHaveAttribute("aria-valuenow", "580");

    fireEvent.keyDown(listSeparator, { key: "ArrowRight" });
    expect(listSeparator).toHaveAttribute("aria-valuenow", "288");

    fireEvent.keyDown(contextSeparator, { key: "ArrowLeft" });
    expect(contextSeparator).toHaveAttribute("aria-valuenow", "596");

    fireEvent.doubleClick(listSeparator);
    expect(listSeparator).toHaveAttribute("aria-valuenow", "272");

    expect(
      document
        .querySelector<HTMLElement>(".guest-experience-desktop-grid")
        ?.style.getPropertyValue("--guest-context-width"),
    ).toBe("596px");
  });

  it("uses the LaFlo-native page title, consistent live metrics, and functional route tabs", async () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: "Guest Experience Center" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
    expect(screen.queryByText("Files")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Open Conversations/ }),
      ).toHaveTextContent("1"),
    );
    expect(
      screen.getByRole("button", { name: /Open Tickets/ }),
    ).toHaveTextContent("1");
    expect(
      screen.getByRole("button", { name: /Escalated Issues/ }),
    ).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("tab", { name: "Call History" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/messages?tab=call-history",
    );
    expect(
      screen.getByText(
        "Call history is unavailable because call integration is not connected.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps operational and assistant-generated threads out of the guest conversation workspace", async () => {
    mocks.threads.mockResolvedValue([
      thread,
      {
        ...thread,
        id: "operations-thread",
        subject: "Review active alerts and access anomalies",
        guest: undefined,
        booking: undefined,
        lastMessage: {
          ...thread.lastMessage,
          id: "operations-message",
          body: "Prioritize forced door events and camera coverage gaps.",
          senderType: "SYSTEM",
        },
      },
    ]);

    renderPage("/messages?tab=conversations");

    expect(await screen.findByText("Amina Patel")).toBeInTheDocument();
    expect(
      screen.queryByText("Review active alerts and access anomalies"),
    ).not.toBeInTheDocument();
  });

  it("shows each staff member's profile avatar and a connected issue timeline", async () => {
    mocks.thread.mockResolvedValue({
      ...thread,
      messages: [
        {
          id: "message-admin",
          body: "I am reviewing this now.",
          senderType: "STAFF",
          senderUser: {
            id: "admin-1",
            firstName: "Onboarding",
            lastName: "User",
            role: "ADMIN",
            avatarUrl: "data:image/png;base64,onboarding-photo",
          },
          createdAt: "2026-09-01T08:05:00Z",
        },
        {
          id: "message-agent",
          body: "I will follow up with housekeeping.",
          senderType: "STAFF",
          senderUser: {
            id: "agent-1",
            firstName: "Maya",
            lastName: "Singh",
            role: "MANAGER",
            avatarUrl: "data:image/png;base64,maya-photo",
          },
          createdAt: "2026-09-01T08:06:00Z",
        },
      ],
    });

    renderPage("/messages?tab=conversations");

    expect(await screen.findByText("I am reviewing this now.")).toBeInTheDocument();
    expect(screen.getByTitle("Onboarding User")).toHaveAttribute(
      "data-avatar-user-id",
      "admin-1",
    );
    expect(
      await screen.findByRole("img", { name: "Onboarding User profile" }),
    ).toHaveAttribute("data-avatar-user-id", "admin-1");
    expect(
      screen.getByRole("img", { name: "Onboarding User profile" }).querySelector("img"),
    ).toHaveAttribute("src", "data:image/png;base64,onboarding-photo");
    expect(screen.getByRole("img", { name: "Maya Singh profile" })).toHaveAttribute(
      "data-avatar-user-id",
      "agent-1",
    );
    expect(
      screen.getByRole("img", { name: "Maya Singh profile" }).querySelector("img"),
    ).toHaveAttribute("src", "data:image/png;base64,maya-photo");
    expect(
      screen.getByRole("article", { name: "Onboarding User message" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "Maya Singh message" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Issue timeline" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(3);
  });

  it("filters and selects conversations, sends a real reply, and assigns an owner", async () => {
    renderPage("/messages?tab=conversations");
    expect(
      await screen.findByText("My room is not ready."),
    ).toBeInTheDocument();
    expect(screen.getByText("Guest Experience Center")).toBeInTheDocument();
    expect(screen.getByText(/1 active conversation/)).toBeInTheDocument();
    expect(screen.getByLabelText("Assign conversation owner")).toHaveClass(
      "guest-experience-action-control",
      "guest-experience-assign-control",
    );
    fireEvent.change(screen.getByPlaceholderText("Search conversations"), {
      target: { value: "missing" },
    });
    expect(
      screen.getByText("No conversations match the current search and filter."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Search conversations"), {
      target: { value: "Amina" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Amina Patel/ }));
    const composer = screen.getByPlaceholderText("Type a guest reply");
    fireEvent.change(composer, { target: { value: "We are checking now." } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith(
        "thread-1",
        "We are checking now.",
      ),
    );
    fireEvent.change(screen.getByLabelText("Assign conversation owner"), {
      target: { value: "agent-1" },
    });
    await waitFor(() =>
      expect(mocks.assign).toHaveBeenCalledWith("thread-1", "agent-1"),
    );
    expect(mocks.assignTicket).toHaveBeenCalledWith("ticket-1", "agent-1");
  });

  it("creates a linked task, confirms ticket outcomes, and supplies structured context to the single global Ask LaFlo assistant", async () => {
    const listener = vi.fn();
    window.addEventListener(SET_LAFLO_ASSISTANT_CONTEXT_EVENT, listener);
    renderPage("/messages?tab=tickets");
    expect(await screen.findByText("Late room readiness")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter conversation priority"), {
      target: { value: "LOW" },
    });
    expect(
      screen.getByText("No conversations match the current search and filter."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter conversation priority"), {
      target: { value: "high" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    const dialog = screen.getByRole("dialog", {
      name: "Create task from guest issue",
    });
    expect(dialog).toHaveTextContent("Guest follow-up: Late room readiness");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create task" }),
    );
    await waitFor(() =>
      expect(mocks.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          advisoryId: "guest-experience:ticket-1",
          department: "HOUSEKEEPING",
        }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledWith("ticket-1"));
    await waitFor(() =>
      expect(
        (listener.mock.calls.at(-1)?.[0] as CustomEvent).detail,
      ).toMatchObject({
        page: "Guest Experience Center",
        activeTab: "tickets",
        selectedConversationId: "thread-1",
        selectedTicketId: "ticket-1",
      }),
    );
    expect(screen.queryByRole("button", { name: "Ask LaFlo" })).not.toBeInTheDocument();
    window.removeEventListener(SET_LAFLO_ASSISTANT_CONTEXT_EVENT, listener);
  });

  it("keeps ticket handling inside the linked three-column conversation workspace", async () => {
    renderPage("/messages?tab=tickets");
    await screen.findByText("Late room readiness");
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/messages?tab=tickets",
    );
    expect(
      await screen.findByPlaceholderText("Type a guest reply"),
    ).toBeInTheDocument();
    expect(screen.getByText("Guest Details")).toBeInTheDocument();
  });

  it("keeps every approved command-center region mounted for compact desktop layouts", async () => {
    renderPage("/messages?tab=conversations");
    await screen.findByText("Late room readiness");

    expect(
      screen.getByRole("navigation", {
        name: "Guest Experience Center workspace",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Guest conversations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Active guest conversation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", {
        name: "Guest and ticket context",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Guest Experience Intelligence" }),
    ).toBeInTheDocument();
  });

  it("shows a real refresh state and applies the resolved KPI filter", async () => {
    let resolveRefresh!: (value: Array<typeof thread>) => void;
    const refreshPromise = new Promise<Array<typeof thread>>((resolve) => {
      resolveRefresh = resolve;
    });
    renderPage("/messages?tab=conversations");
    await screen.findByText("Late room readiness");

    const refresh = await screen.findByRole("button", { name: /Updated/ });
    mocks.threads.mockImplementationOnce(() => refreshPromise);
    fireEvent.click(refresh);
    expect(
      await screen.findByRole("button", { name: "Refreshing" }),
    ).toBeDisabled();
    resolveRefresh([thread]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Updated/ })).toBeEnabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Resolved today/ }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/messages?tab=conversations",
    );
    expect(
      screen.getByText("No conversations match the current search and filter."),
    ).toBeInTheDocument();
  });

  it("filters by priority, prepares the recommended response, and opens Guest Calls with guest context", async () => {
    renderPage("/messages?tab=conversations");
    await screen.findByText("My room is not ready.");

    fireEvent.change(screen.getByLabelText("Filter conversation priority"), {
      target: { value: "low" },
    });
    expect(
      screen.getByText("No conversations match the current search and filter."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter conversation priority"), {
      target: { value: "high" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Use this response" }));
    expect(screen.getByPlaceholderText("Type a guest reply")).toHaveValue(
      "I’m sorry for the inconvenience. We’re reviewing this now and will update you as soon as the next step is confirmed.",
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Call guest/ })[0]);
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/calls?number=%2B44123456789&source=guest-experience&thread=thread-1",
    );
  });

  it("disables management and guest-detail actions when the user lacks permission", async () => {
    useAuthStore.setState({
      user: {
        id: "staff-1",
        email: "staff@laflo.test",
        role: "RECEPTIONIST",
        hotelId: "hotel-1",
        hotel: { id: "hotel-1", name: "LaFlo Hotel" },
        modulePermissions: ["messages"],
        isActive: true,
      } as never,
    });
    renderPage("/messages?tab=tickets");
    await screen.findByText("Late room readiness");
    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Escalate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create task" })).toBeDisabled();
  });
});
