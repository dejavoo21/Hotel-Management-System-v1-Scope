import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Activity,
  AlertTriangle,
  Bot,
  CalendarDays,
  FileText,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Inbox,
  Loader2,
  MessageSquareText,
  Phone,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  Sparkles,
  TicketCheck,
  UserRoundCheck,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import messageService from "@/services/messages";
import ticketService from "@/services/tickets";
import operationsService from "@/services/operations";
import { canAccess } from "@/lib/access";
import {
  openLafloAssistant,
  setLafloAssistantContext,
} from "@/lib/assistantEvents";
import { useAuthStore } from "@/stores/authStore";
import {
  getTimeRemaining,
  isEscalated,
  isOverdue,
  type Ticket,
} from "@/services/tickets";
import type {
  ConversationMessage,
  MessageThreadDetail,
  MessageThreadSummary,
  SupportAgent,
  User,
} from "@/types";

type WorkspaceTab =
  | "overview"
  | "conversations"
  | "tickets"
  | "escalations"
  | "guest-requests"
  | "call-history";
type ConversationFilter =
  | "all"
  | "open"
  | "unassigned"
  | "assigned"
  | "escalated"
  | "resolved";
type PriorityFilter = "all" | "urgent" | "high" | "medium" | "low";
type TicketAction = "escalate" | "resolve" | "close";
type TaskDraft = {
  title: string;
  reason: string;
  department: Ticket["department"];
  priority: "low" | "medium" | "high";
  sourceId: string;
};

const DEFAULT_GUEST_LIST_WIDTH = 272;
const DEFAULT_GUEST_CONTEXT_WIDTH = 580;
const MIN_GUEST_LIST_WIDTH = 220;
const MAX_GUEST_LIST_WIDTH = 420;
const MIN_GUEST_CONTEXT_WIDTH = 360;
const MAX_GUEST_CONTEXT_WIDTH = 720;
const GUEST_LIST_WIDTH_KEY = "laflo.guest-experience.list-width";
const GUEST_CONTEXT_WIDTH_KEY = "laflo.guest-experience.context-width";

const clampPaneWidth = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const storedPaneWidth = (
  key: string,
  fallback: number,
  min: number,
  max: number,
) => {
  if (typeof window === "undefined") return fallback;
  try {
    const storedValue = window.localStorage.getItem(key);
    if (storedValue === null) return fallback;
    const value = Number(storedValue);
    return Number.isFinite(value) ? clampPaneWidth(value, min, max) : fallback;
  } catch {
    return fallback;
  }
};

const storedUserAvatar = (userId?: string | null) => {
  if (!userId || typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem(`laflo-user-avatar:${userId}`) ||
      window.localStorage.getItem(`laflo-profile-avatar:${userId}`)
    );
  } catch {
    return null;
  }
};

const messageSenderName = (message: ConversationMessage) => {
  if (message.senderType === "SYSTEM") return "System note";
  if (message.senderType === "GUEST") return "Guest";
  return message.senderUser
    ? `${message.senderUser.firstName} ${message.senderUser.lastName}`.trim()
    : "Staff";
};

const TABS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "conversations", label: "Conversations" },
  { id: "tickets", label: "Tickets" },
  { id: "escalations", label: "Escalations" },
  { id: "guest-requests", label: "Guest Requests" },
  { id: "call-history", label: "Call History" },
];
const REQUEST_CATEGORIES = new Set([
  "HOUSEKEEPING",
  "MAINTENANCE",
  "CONCIERGE",
  "ROOM_SERVICE",
  "BILLING",
  "COMPLAINT",
]);
const isGuestExperienceThread = (
  thread: MessageThreadSummary,
  ticket?: Ticket,
) =>
  Boolean(
    thread.guest ||
      thread.booking ||
      /^Live Support\b/i.test(thread.subject) ||
      (ticket && REQUEST_CATEGORIES.has(ticket.category)),
  );
const VIP_PATTERN = /\bvip\b/i;
const terminalTicket = (ticket: Ticket) =>
  ticket.status === "RESOLVED" || ticket.status === "CLOSED";
const guestName = (thread?: MessageThreadSummary | null) =>
  thread?.guest
    ? `${thread.guest.firstName} ${thread.guest.lastName}`
    : thread?.subject || "Guest";
const initials = (value: string) =>
  value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const labelize = (value?: string | null) =>
  value
    ? value
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "—";
const timestamp = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—";
const errorMessage = (error: unknown, fallback: string) => {
  const candidate = error as {
    response?: { data?: { error?: string; message?: string } };
    message?: string;
  };
  return (
    candidate.response?.data?.error ||
    candidate.response?.data?.message ||
    candidate.message ||
    fallback
  );
};

export default function MessagesPageRedesigned() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab") as WorkspaceTab | null;
  const activeTab = TABS.some((tab) => tab.id === requestedTab)
    ? requestedTab!
    : "overview";
  const [search, setSearch] = useState("");
  const [conversationFilter, setConversationFilter] =
    useState<ConversationFilter>("all");
  const [priorityFilter, setPriorityFilter] =
    useState<PriorityFilter>("all");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    params.get("thread"),
  );
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    params.get("ticket"),
  );
  const [draft, setDraft] = useState("");
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [guestListWidth, setGuestListWidth] = useState(() =>
    storedPaneWidth(
      GUEST_LIST_WIDTH_KEY,
      DEFAULT_GUEST_LIST_WIDTH,
      MIN_GUEST_LIST_WIDTH,
      MAX_GUEST_LIST_WIDTH,
    ),
  );
  const [guestContextWidth, setGuestContextWidth] = useState(() =>
    storedPaneWidth(
      GUEST_CONTEXT_WIDTH_KEY,
      DEFAULT_GUEST_CONTEXT_WIDTH,
      MIN_GUEST_CONTEXT_WIDTH,
      MAX_GUEST_CONTEXT_WIDTH,
    ),
  );
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(GUEST_LIST_WIDTH_KEY, String(guestListWidth));
    } catch {
      // Resizing remains functional when browser storage is unavailable.
    }
  }, [guestListWidth]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        GUEST_CONTEXT_WIDTH_KEY,
        String(guestContextWidth),
      );
    } catch {
      // Resizing remains functional when browser storage is unavailable.
    }
  }, [guestContextWidth]);

  const canMessage = canAccess(user, "messages");
  const canManage =
    canMessage && (user?.role === "ADMIN" || user?.role === "MANAGER");
  const canCreateTask = canAccess(user, "bookings");
  const canViewGuest = canAccess(user, "guests");

  const threadsQuery = useQuery({
    queryKey: ["guest-experience", "threads"],
    queryFn: () => messageService.listThreads(),
    refetchInterval: 15_000,
  });
  const ticketsQuery = useQuery({
    queryKey: ["guest-experience", "tickets"],
    queryFn: () => ticketService.getTickets({ limit: 100 }),
    refetchInterval: 20_000,
  });
  const agentsQuery = useQuery<SupportAgent[]>({
    queryKey: ["guest-experience", "agents"],
    queryFn: messageService.listSupportAgents,
    retry: false,
  });
  const allThreads = useMemo(
    () => threadsQuery.data || [],
    [threadsQuery.data],
  );
  const tickets = useMemo(
    () => ticketsQuery.data?.tickets || [],
    [ticketsQuery.data],
  );
  const ticketsByConversation = useMemo(
    () => new Map(tickets.map((ticket) => [ticket.conversationId, ticket])),
    [tickets],
  );
  const threads = useMemo(
    () =>
      allThreads.filter((thread) =>
        isGuestExperienceThread(
          thread,
          ticketsByConversation.get(thread.id),
        ),
      ),
    [allThreads, ticketsByConversation],
  );
  const ticketThreads = useMemo(
    () => threads.filter((thread) => ticketsByConversation.has(thread.id)),
    [threads, ticketsByConversation],
  );

  useEffect(() => {
    const candidates = activeTab === "tickets" ? ticketThreads : threads;
    if (!candidates.length) {
      if (selectedThreadId) setSelectedThreadId(null);
      if (selectedTicketId) setSelectedTicketId(null);
      return;
    }
    if (
      !selectedThreadId ||
      !candidates.some((thread) => thread.id === selectedThreadId)
    ) {
      setSelectedThreadId(candidates[0].id);
      setSelectedTicketId(
        activeTab === "tickets"
          ? ticketsByConversation.get(candidates[0].id)?.id || null
          : null,
      );
    }
  }, [
    activeTab,
    selectedThreadId,
    selectedTicketId,
    threads,
    ticketThreads,
    ticketsByConversation,
  ]);

  const selectedThreadSummary =
    threads.find((thread) => thread.id === selectedThreadId) || null;
  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ||
    (selectedThreadId
      ? ticketsByConversation.get(selectedThreadId)
      : undefined) ||
    null;
  useEffect(() => {
    setLafloAssistantContext({
      page: "Guest Experience Center",
      activeTab,
      selectedConversationId: selectedThreadSummary?.id,
      selectedConversation: selectedThreadSummary?.subject,
      selectedGuest: selectedThreadSummary
        ? guestName(selectedThreadSummary)
        : undefined,
      selectedTicketId: selectedTicket?.id,
      availableActions: [
        "reply to guest",
        "assign owner",
        "create task",
        "call guest",
        "escalate issue",
      ],
    });
    return () => setLafloAssistantContext(null);
  }, [
    activeTab,
    selectedThreadSummary?.id,
    selectedThreadSummary?.subject,
    selectedThreadSummary?.guest?.firstName,
    selectedThreadSummary?.guest?.lastName,
    selectedTicket?.id,
  ]);
  const threadQuery = useQuery<MessageThreadDetail>({
    queryKey: ["guest-experience", "thread", selectedThreadId],
    queryFn: () => messageService.getThread(selectedThreadId!),
    enabled: Boolean(selectedThreadId),
    refetchInterval: 8_000,
  });
  useEffect(() => {
    const messageViewport = messageEndRef.current?.parentElement;
    if (messageViewport && typeof messageViewport.scrollTo === "function")
      messageViewport.scrollTo({
        top: messageViewport.scrollHeight,
        behavior: "smooth",
      });
  }, [threadQuery.data?.messages.length]);

  const filteredThreads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return threads.filter((thread) => {
      const ticket = ticketsByConversation.get(thread.id);
      const matchesSearch =
        !needle ||
        guestName(thread).toLowerCase().includes(needle) ||
        thread.subject.toLowerCase().includes(needle) ||
        thread.lastMessage?.body.toLowerCase().includes(needle);
      if (!matchesSearch) return false;
      if (
        priorityFilter !== "all" &&
        ticket?.priority.toLowerCase() !== priorityFilter
      )
        return false;
      if (conversationFilter === "open")
        return thread.status === "OPEN" && (!ticket || !terminalTicket(ticket));
      if (conversationFilter === "assigned")
        return (
          ticket?.assignedToId === user?.id ||
          thread.assignedSupport?.userId === user?.id
        );
      if (conversationFilter === "unassigned")
        return !ticket?.assignedToId && !thread.assignedSupport?.userId;
      if (conversationFilter === "escalated")
        return Boolean(ticket && (isEscalated(ticket) || isOverdue(ticket)));
      if (conversationFilter === "resolved")
        return (
          thread.status === "RESOLVED" ||
          Boolean(ticket && terminalTicket(ticket))
        );
      return true;
    });
  }, [
    conversationFilter,
    priorityFilter,
    search,
    threads,
    ticketsByConversation,
    user?.id,
  ]);

  const escalations = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          !terminalTicket(ticket) &&
          (isEscalated(ticket) ||
            isOverdue(ticket) ||
            ticket.priority === "URGENT"),
      ),
    [tickets],
  );
  const guestRequests = useMemo(
    () => tickets.filter((ticket) => REQUEST_CATEGORIES.has(ticket.category)),
    [tickets],
  );
  const openTickets = tickets.filter((ticket) => !terminalTicket(ticket));
  const slaBreaches = openTickets.filter(
    (ticket) => ticket.status === "BREACHED" || isOverdue(ticket),
  );
  const vipFollowUps = threads.filter(
    (thread) =>
      VIP_PATTERN.test(`${thread.subject} ${thread.lastMessage?.body || ""}`) &&
      thread.status === "OPEN",
  );

  const refreshAll = async () => {
    const results = await Promise.allSettled([
      threadsQuery.refetch(),
      ticketsQuery.refetch(),
      agentsQuery.refetch(),
      selectedThreadId ? threadQuery.refetch() : Promise.resolve(),
    ]);
    const failed = results.some(
      (result) =>
        result.status === "rejected" ||
        (result.status === "fulfilled" &&
          typeof result.value === "object" &&
          result.value !== null &&
          "isError" in result.value &&
          Boolean(result.value.isError)),
    );
    if (failed)
      toast.error("Some guest experience information could not be refreshed.");
    else {
      setLastUpdated(new Date());
      toast.success("Guest experience information refreshed.");
    }
  };
  const selectTab = (tab: WorkspaceTab, extra: Record<string, string> = {}) =>
    setParams({ tab, ...extra });
  const selectThread = (id: string) => {
    setSelectedThreadId(id);
    setSelectedTicketId(null);
    setParams({ tab: activeTab === "tickets" ? "tickets" : "conversations", thread: id });
  };
  const selectTicket = (ticket: Ticket) => {
    setSelectedTicketId(ticket.id);
    setSelectedThreadId(ticket.conversationId);
    setParams({
      tab: "tickets",
      thread: ticket.conversationId,
      ticket: ticket.id,
    });
  };

  const askLaflo = (prompt: string, extra: Record<string, unknown> = {}) =>
    openLafloAssistant({
      mode: "operations",
      prompt,
      context: {
        page: "Guest Experience Center",
        activeTab,
        selectedConversation: selectedThreadSummary
          ? {
              id: selectedThreadSummary.id,
              subject: selectedThreadSummary.subject,
              status: selectedThreadSummary.status,
            }
          : null,
        selectedGuest: selectedThreadSummary?.guest
          ? {
              name: guestName(selectedThreadSummary),
              bookingRef: selectedThreadSummary.booking?.bookingRef,
            }
          : null,
        selectedTicket: selectedTicket
          ? {
              id: selectedTicket.id,
              category: selectedTicket.category,
              priority: selectedTicket.priority,
              status: selectedTicket.status,
            }
          : null,
        currentFilters: { search, conversationFilter },
        openIssues: openTickets.length,
        slaStatus: selectedTicket ? getTimeRemaining(selectedTicket) : null,
        relatedTasks: canCreateTask
          ? "Operational task queue available"
          : "Task details restricted",
        recommendedActions: selectedTicket
          ? ["assign owner", "create linked task", "call guest", "resolve"]
          : ["review conversation", "call guest", "create follow-up task"],
        availableActions: [
          canMessage && "reply",
          canManage && "assign",
          canManage && "escalate",
          canCreateTask && "create-task",
          canManage && "resolve",
          canManage && "close",
        ].filter(Boolean),
        restrictedActions: [
          !canMessage && "reply",
          !canManage && "assign/escalate/resolve/close",
          !canCreateTask && "create-task",
          !canViewGuest && "sensitive-guest-details",
        ].filter(Boolean),
        ...extra,
      },
    });

  const sendMutation = useMutation({
    mutationFn: () =>
      messageService.createMessage(selectedThreadId!, draft.trim()),
    onSuccess: async () => {
      setDraft("");
      await Promise.all([threadQuery.refetch(), threadsQuery.refetch()]);
      toast.success("Reply sent.");
    },
    onError: (error) =>
      toast.error(
        errorMessage(
          error,
          "Messaging is unavailable. Your reply was not sent.",
        ),
      ),
  });
  const assignMutation = useMutation({
    mutationFn: async ({
      threadId,
      userId,
      ticketId,
    }: {
      threadId: string;
      userId: string;
      ticketId?: string;
    }) => {
      const [thread] = await Promise.all([
        messageService.assignSupportAgent(threadId, userId),
        ticketId
          ? ticketService.assignTicket(ticketId, userId)
          : Promise.resolve(null),
      ]);
      return thread;
    },
    onSuccess: async () => {
      await Promise.all([
        threadsQuery.refetch(),
        threadQuery.refetch(),
        ticketsQuery.refetch(),
      ]);
      toast.success("Owner assignment saved.");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Assignment service is unavailable.")),
  });
  const ticketMutation = useMutation({
    mutationFn: ({
      ticket,
      action,
    }: {
      ticket: Ticket;
      action: TicketAction;
    }) =>
      action === "escalate"
        ? ticketService.escalateTicket(ticket.id)
        : action === "resolve"
          ? ticketService.resolveTicket(ticket.id)
          : ticketService.closeTicket(ticket.id),
    onSuccess: async (_, variables) => {
      await Promise.all([
        ticketsQuery.refetch(),
        threadsQuery.refetch(),
        threadQuery.refetch(),
      ]);
      toast.success(
        `Ticket ${variables.action === "close" ? "closed" : `${variables.action}d`}.`,
      );
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Ticket update is unavailable.")),
  });
  const taskMutation = useMutation({
    mutationFn: (item: TaskDraft) =>
      operationsService.createAdvisoryTicket({
        advisoryId: `guest-experience:${item.sourceId}`,
        title: item.title,
        reason: item.reason,
        priority: item.priority,
        department: item.department,
        source: "ENTERPRISE_SEARCH",
        meta: { departmentIntelligence: "Guest Experience Center" },
      }),
    onSuccess: async (result) => {
      setTaskDraft(null);
      await queryClient.invalidateQueries({
        queryKey: ["guest-experience", "tickets"],
      });
      toast.success(`Task created: ${result.ticketId.slice(0, 8)}`);
    },
    onError: (error) =>
      toast.error(
        errorMessage(
          error,
          "Task service is unavailable. No task was created.",
        ),
      ),
  });

  const makeTaskDraft = (ticket?: Ticket | null) => {
    if (!canCreateTask) {
      toast.error("Permission required to create operational tasks.");
      return;
    }
    const subject =
      ticket?.conversation?.subject ||
      selectedThreadSummary?.subject ||
      "Guest follow-up";
    setTaskDraft({
      title: `Guest follow-up: ${subject}`,
      reason: `Follow up from Guest Experience Center${ticket ? ` ticket ${ticket.id}` : selectedThreadId ? ` conversation ${selectedThreadId}` : ""}.`,
      department: ticket?.department || "FRONT_DESK",
      priority:
        ticket?.priority === "URGENT" || ticket?.priority === "HIGH"
          ? "high"
          : ticket?.priority === "LOW"
            ? "low"
            : "medium",
      sourceId: ticket?.id || selectedThreadId || "overview",
    });
  };
  const runTicketAction = (ticket: Ticket | null, action: TicketAction) => {
    if (!ticket) {
      toast.error(
        "This conversation has no linked ticket. The action is unavailable.",
      );
      return;
    }
    if (!canManage) {
      toast.error("Permission required. A manager must complete this action.");
      return;
    }
    if (!window.confirm(`Confirm you want to ${action} this ticket?`)) return;
    ticketMutation.mutate({ ticket, action });
  };

  const kpis = [
    {
      label: "Open Conversations",
      value: threads.filter((item) => item.status === "OPEN").length,
      detail: "Active guest threads",
      icon: MessageSquareText,
      onClick: () => {
        setConversationFilter("open");
        selectTab("conversations");
      },
    },
    {
      label: "Open Tickets",
      value: openTickets.length,
      detail: "Require follow-up",
      icon: TicketCheck,
      onClick: () => selectTab("tickets"),
    },
    {
      label: "Escalated Issues",
      value: escalations.length,
      detail: "Management attention",
      icon: ShieldAlert,
      onClick: () => selectTab("escalations"),
    },
    {
      label: "SLA Breaches",
      value: slaBreaches.length,
      detail: "Overdue response or resolution",
      icon: Clock3,
      onClick: () => selectTab("escalations"),
    },
    {
      label: "VIP Follow-ups",
      value: vipFollowUps.length,
      detail: "Based on available conversation data",
      icon: UsersRound,
      onClick: () => {
        setSearch("VIP");
        selectTab("conversations");
      },
    },
    {
      label: "Average Response Time",
      value: "Unavailable",
      detail: "Response analytics not connected",
      icon: RefreshCcw,
      onClick: () => toast("Response-time analytics is not connected."),
    },
  ];
  const pageError = threadsQuery.isError && ticketsQuery.isError;
  const workspaceMode =
    activeTab === "conversations" || activeTab === "tickets";

  return (
    <div
      className={
        workspaceMode
          ? "guest-experience-page min-w-0 p-4 sm:p-6 xl:p-0"
          : "min-w-0 space-y-5 p-4 sm:p-6 lg:p-8"
      }
    >
      {!workspaceMode ? <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">
            Guest experience
          </p>
          <h1 className="mt-1 text-2xl font-bold text-text-main">
            Guest Experience Center
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-text-muted">
            Manage guest conversations, service requests, escalations, and
            follow-up tasks in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => askLaflo("Which guest issues need attention today?")}
            className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700"
          >
            <Bot className="mr-2 inline h-4 w-4" />
            Ask LaFlo
          </button>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={threadsQuery.isFetching || ticketsQuery.isFetching}
            className="rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast disabled:opacity-60"
          >
            <RefreshCcw
              className={`mr-2 inline h-4 w-4 ${threadsQuery.isFetching || ticketsQuery.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </header> : null}
      {!workspaceMode ? <nav
        role="tablist"
        aria-label="Guest Experience Center sections"
        className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1.5 shadow-sm"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            onClick={() => selectTab(tab.id)}
            aria-selected={activeTab === tab.id}
            className={`min-h-10 shrink-0 rounded-xl px-4 text-sm font-semibold ${activeTab === tab.id ? "bg-primary-solid text-primary-contrast shadow-sm" : "text-text-muted hover:bg-bg hover:text-text-main"}`}
          >
            {tab.label}
          </button>
        ))}
      </nav> : null}
      {pageError ? (
        <StateCard
          icon={AlertTriangle}
          title="Guest experience data is disconnected"
          detail="Conversation and ticket services could not be reached. Refresh to try again."
          action={
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast"
            >
              Retry
            </button>
          }
        />
      ) : null}
      {!pageError && activeTab === "overview" ? (
        <Overview
          kpis={kpis}
          threads={threads}
          tickets={tickets}
          escalations={escalations}
          lastUpdated={lastUpdated}
          onRefresh={refreshAll}
          onOpenThread={selectThread}
          onOpenTicket={selectTicket}
          onAsk={askLaflo}
        />
      ) : null}
      {!pageError && (activeTab === "conversations" || activeTab === "tickets") ? (
        <div className="guest-experience-shell xl:grid xl:grid-cols-[172px_minmax(0,1fr)] xl:gap-4">
          <GuestExperienceRail
            openCount={threads.filter((item) => item.status === "OPEN").length}
            ticketCount={openTickets.length}
            escalationCount={escalations.length}
            vipCount={vipFollowUps.length}
            onOverview={() => selectTab("overview")}
            onConversations={() => selectTab("conversations")}
            onCalls={() => navigate("/calls")}
            onTickets={() => selectTab("tickets")}
            onUnavailable={(message) => toast(message)}
            onFilter={(filter) => {
              setSearch("");
              setConversationFilter(filter);
            }}
            onSearch={(value) => {
              setConversationFilter("all");
              setSearch(value);
            }}
            onPriority={(value) => {
              setSearch("");
              setPriorityFilter(value);
            }}
            onSettings={() => navigate("/settings?tab=integrations")}
            activeWorkspace={activeTab}
          />
          <div
            className="guest-experience-desktop-grid min-w-0 space-y-3"
            style={
              {
                "--guest-list-width": `${guestListWidth}px`,
                "--guest-context-width": `${guestContextWidth}px`,
              } as CSSProperties
            }
          >
            <SupportIntelligenceStrip
              activeConversations={threads.filter((item) => item.status === "OPEN").length}
              openTickets={openTickets.length}
              assigned={tickets.filter((ticket) => ticket.assignedToId).length}
              slaBreaches={slaBreaches.length}
              resolvedToday={tickets.filter(
                (ticket) =>
                  terminalTicket(ticket) &&
                  new Date(ticket.updatedAtUtc).toDateString() ===
                    new Date().toDateString(),
              ).length}
              priority={
                escalations[0]?.conversation?.subject ||
                openTickets[0]?.conversation?.subject ||
                "No urgent guest issue identified"
              }
              updatedAt={lastUpdated}
              refreshing={
                threadsQuery.isFetching ||
                ticketsQuery.isFetching ||
                agentsQuery.isFetching ||
                threadQuery.isFetching
              }
              onRefresh={refreshAll}
              onOpenTickets={() => selectTab("tickets")}
              onOpenAssigned={() => {
                setConversationFilter("assigned");
                selectTab("conversations");
              }}
              onOpenEscalations={() => selectTab("escalations")}
              onOpenResolved={() => {
                setConversationFilter("resolved");
                selectTab("conversations");
              }}
            />
            <ConversationWorkspace
            listPaneWidth={guestListWidth}
            contextPaneWidth={guestContextWidth}
            onListPaneWidth={setGuestListWidth}
            onContextPaneWidth={setGuestContextWidth}
            threads={activeTab === "tickets" ? filteredThreads.filter((thread) => ticketsByConversation.has(thread.id)) : filteredThreads}
            workspaceTab={activeTab}
            conversationCount={threads.length}
            ticketCount={ticketThreads.length}
            ticketsByConversation={ticketsByConversation}
            selectedThreadId={selectedThreadId}
            selectedThread={selectedThreadSummary}
            detail={threadQuery.data}
            detailLoading={threadQuery.isLoading}
            search={search}
            filter={conversationFilter}
            priorityFilter={priorityFilter}
            draft={draft}
            agents={agentsQuery.data || []}
            currentUser={user}
            canMessage={canMessage}
            canManage={canManage}
            canCreateTask={canCreateTask}
            canViewGuest={canViewGuest}
            sending={sendMutation.isPending}
            onSearch={setSearch}
            onFilter={setConversationFilter}
            onPriorityFilter={setPriorityFilter}
            onWorkspaceTab={selectTab}
            onSelect={selectThread}
            onDraft={setDraft}
            onSend={() => {
              if (!draft.trim()) {
                toast.error("Enter a reply before sending.");
                return;
              }
              sendMutation.mutate();
            }}
            onUnavailable={(message) => toast(message)}
            onAssign={(userId) =>
              selectedThreadId &&
              assignMutation.mutate({
                threadId: selectedThreadId,
                userId,
                ticketId: selectedTicket?.id,
              })
            }
            onTicketAction={(action) => runTicketAction(selectedTicket, action)}
            onCreateTask={() => makeTaskDraft(selectedTicket)}
            onOpenTasks={() => navigate("/operations/tasks-advisories?tab=tasks")}
            onCall={() => {
              const phone = selectedThreadSummary?.guest?.phone;
              if (!phone) {
                toast("No guest phone number is available for this conversation.");
                return;
              }
              navigate(`/calls?number=${encodeURIComponent(phone)}&source=guest-experience&thread=${encodeURIComponent(selectedThreadId || "")}`);
            }}
            onGuest={() =>
              canViewGuest
                ? navigate(
                    `/guests${selectedThreadSummary?.guest?.email ? `?search=${encodeURIComponent(selectedThreadSummary.guest.email)}` : ""}`,
                  )
                : toast.error("Permission required to view guest details.")
            }
            messageEndRef={messageEndRef}
            />
          </div>
        </div>
      ) : null}
      {!pageError && activeTab === "escalations" ? (
        <TicketTable
          title="Escalations"
          detail="Escalated, urgent, and SLA-risk issues requiring management attention."
          tickets={escalations}
          canManage={canManage}
          canCreateTask={canCreateTask}
          empty="No active escalations or SLA risks."
          onOpen={selectTicket}
          onAssign={(ticket) => {
            if (!canManage || !user?.id)
              return toast.error("Permission required to assign escalations.");
            assignMutation.mutate({
              threadId: ticket.conversationId,
              userId: user.id,
              ticketId: ticket.id,
            });
          }}
          onAction={runTicketAction}
          onCreateTask={makeTaskDraft}
          onAsk={(ticket) =>
            askLaflo("Ask LaFlo for the recommended next step.", {
              selectedTicket: ticket,
            })
          }
        />
      ) : null}
      {!pageError && activeTab === "guest-requests" ? (
        <TicketTable
          title="Guest Requests"
          detail="Operational service requests linked to guest conversations."
          tickets={guestRequests}
          canManage={canManage}
          canCreateTask={canCreateTask}
          empty="No guest service requests are available."
          onOpen={selectTicket}
          onAssign={(ticket) => {
            if (!canManage || !user?.id)
              return toast.error(
                "Permission required to assign guest requests.",
              );
            assignMutation.mutate({
              threadId: ticket.conversationId,
              userId: user.id,
              ticketId: ticket.id,
            });
          }}
          onAction={runTicketAction}
          onCreateTask={makeTaskDraft}
          onAsk={(ticket) =>
            askLaflo("Ask LaFlo about this guest request.", {
              selectedRequest: ticket,
            })
          }
        />
      ) : null}
      {!pageError && activeTab === "call-history" ? (
        <StateCard
          icon={Inbox}
          title="Call history is unavailable"
          detail="Call history is unavailable because call integration is not connected."
          action={
            <button
              type="button"
              onClick={() => navigate("/settings?tab=integrations")}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-main"
            >
              Review integrations
            </button>
          }
        />
      ) : null}
      {taskDraft ? (
        <TaskDialog
          task={taskDraft}
          pending={taskMutation.isPending}
          onClose={() => setTaskDraft(null)}
          onConfirm={() => taskMutation.mutate(taskDraft)}
        />
      ) : null}
    </div>
  );
}

function SupportIntelligenceStrip({
  activeConversations,
  openTickets,
  assigned,
  slaBreaches,
  resolvedToday,
  priority,
  updatedAt,
  refreshing,
  onRefresh,
  onOpenTickets,
  onOpenAssigned,
  onOpenEscalations,
  onOpenResolved,
}: {
  activeConversations: number;
  openTickets: number;
  assigned: number;
  slaBreaches: number;
  resolvedToday: number;
  priority: string;
  updatedAt: Date;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onOpenTickets: () => void;
  onOpenAssigned: () => void;
  onOpenEscalations: () => void;
  onOpenResolved: () => void;
}) {
  const items = [
    {
      label: "Open tickets",
      value: openTickets,
      detail: "Require follow-up",
      icon: TicketCheck,
      action: onOpenTickets,
    },
    {
      label: "Assigned",
      value: assigned,
      detail: "With an owner",
      icon: UserRoundCheck,
      action: onOpenAssigned,
    },
    {
      label: "SLA breach",
      value: slaBreaches,
      detail: "At risk or overdue",
      icon: Clock3,
      action: onOpenEscalations,
    },
    {
      label: "Resolved today",
      value: resolvedToday,
      detail: "Completed follow-ups",
      icon: CheckCircle2,
      action: onOpenResolved,
    },
  ];
  return (
    <section className="guest-experience-intelligence rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-950 text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-text-main">
                Guest Experience Intelligence
              </h2>
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-700">
                Live
              </span>
            </div>
            <p className="guest-intelligence-summary mt-1 max-w-3xl truncate text-xs text-text-muted">
              {activeConversations} active {activeConversations === 1 ? "conversation" : "conversations"}, {openTickets} open {openTickets === 1 ? "ticket" : "tickets"}, {assigned} assigned, and {slaBreaches} at risk of SLA breach. Priority: {priority}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={refreshing}
          aria-busy={refreshing}
          className="guest-intelligence-refresh inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-main disabled:opacity-60"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing
            ? "Refreshing"
            : `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(({ label, value, detail, icon: Icon, action }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className="guest-intelligence-card group rounded-xl border border-border bg-bg/70 p-3 text-left transition"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-bold text-text-main">{value}</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-card text-primary-700 shadow-sm">
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">{detail}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function GuestExperienceRail({
  openCount,
  ticketCount,
  escalationCount,
  vipCount,
  onOverview,
  onConversations,
  onCalls,
  onTickets,
  onUnavailable,
  onFilter,
  onSearch,
  onPriority,
  onSettings,
  activeWorkspace,
}: {
  openCount: number;
  ticketCount: number;
  escalationCount: number;
  vipCount: number;
  onOverview: () => void;
  onConversations: () => void;
  onCalls: () => void;
  onTickets: () => void;
  onUnavailable: (message: string) => void;
  onFilter: (filter: ConversationFilter) => void;
  onSearch: (value: string) => void;
  onPriority: (value: PriorityFilter) => void;
  onSettings: () => void;
  activeWorkspace: "conversations" | "tickets";
}) {
  const primary = [
    { label: "Activity", icon: Activity, action: onOverview },
    { label: "Chat", icon: MessageSquareText, action: onConversations, active: activeWorkspace === "conversations" },
    { label: "Calls", icon: Phone, action: onCalls },
    { label: "Tickets", icon: TicketCheck, action: onTickets, active: activeWorkspace === "tickets" },
    {
      label: "Files",
      icon: FileText,
      action: () =>
        onUnavailable(
          "Files are unavailable because guest file storage is not connected.",
        ),
    },
  ];
  const views = [
    { label: "My Open", count: openCount, action: () => onFilter("open") },
    { label: "Unassigned", action: () => onFilter("unassigned") },
    { label: "SLA Breach", count: escalationCount, action: () => onFilter("escalated") },
    { label: "VIP Guests", count: vipCount, action: () => onSearch("VIP") },
    { label: "All Tickets", count: ticketCount, action: onTickets },
    { label: "Resolved", action: () => onFilter("resolved") },
  ];
  const smartViews = [
    { label: "High Priority", action: () => onPriority("high") },
    { label: "Billing Issues", action: () => onSearch("billing") },
    { label: "Maintenance", action: () => onSearch("maintenance") },
    { label: "Late Check-out", action: () => onSearch("late check-out") },
  ];
  return (
    <aside className="guest-experience-rail hidden min-h-[calc(100vh-64px)] bg-slate-950 px-3 py-4 text-slate-200 xl:flex xl:flex-col">
      <button
        type="button"
        onClick={onOverview}
        className="guest-experience-rail-brand mb-5 flex items-center gap-2 rounded-xl px-1 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-blue-950/40">
          L
        </span>
        <span className="guest-experience-rail-brand-label text-[10px] font-semibold uppercase tracking-wide text-white">
          Guest Experience Center
        </span>
      </button>
      <nav aria-label="Guest Experience Center workspace" className="space-y-1">
        {primary.map(({ label, icon: Icon, action, active }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            aria-current={active ? "page" : undefined}
            title={label}
            className={`guest-experience-rail-action flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition ${active ? "is-active bg-slate-800 text-white shadow-inner" : "text-slate-300 hover:bg-slate-900 hover:text-white"}`}
          >
            <Icon className="h-4 w-4" />
            <span className="guest-experience-rail-action-label">{label}</span>
          </button>
        ))}
      </nav>
      <div className="guest-experience-rail-divider my-4 border-t border-slate-800" />
      <p className="guest-experience-rail-section-label px-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Views</p>
      <div className="guest-experience-rail-views mt-2 space-y-0.5">
        {views.map(({ label, count, action }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[11px] text-slate-300 hover:bg-slate-900 hover:text-white"
          >
            <span>{label}</span>
            {typeof count === "number" ? (
              <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] text-white">{count}</span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="guest-experience-rail-divider guest-experience-rail-smart-divider my-4 border-t border-slate-800" />
      <p className="guest-experience-rail-section-label guest-experience-rail-smart-label px-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Smart views</p>
      <div className="guest-experience-rail-smart-views mt-2 space-y-0.5">
        {smartViews.map(({ label, action }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className="w-full rounded-lg px-2 py-2 text-left text-[11px] text-slate-300 hover:bg-slate-900 hover:text-white"
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onSettings}
        title="Settings"
        className="guest-experience-rail-settings mt-auto flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-slate-900 hover:text-white"
      >
        <Settings2 className="h-4 w-4" /> <span>Settings</span>
      </button>
    </aside>
  );
}

function Overview({
  kpis,
  threads,
  tickets,
  escalations,
  lastUpdated,
  onRefresh,
  onOpenThread,
  onOpenTicket,
  onAsk,
}: {
  kpis: Array<{
    label: string;
    value: number | string;
    detail: string;
    icon: typeof MessageSquareText;
    onClick: () => void;
  }>;
  threads: MessageThreadSummary[];
  tickets: Ticket[];
  escalations: Ticket[];
  lastUpdated: Date;
  onRefresh: () => Promise<void>;
  onOpenThread: (id: string) => void;
  onOpenTicket: (ticket: Ticket) => void;
  onAsk: (prompt: string, extra?: Record<string, unknown>) => void;
}) {
  const priority =
    escalations[0] || tickets.find((ticket) => !terminalTicket(ticket));
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-main">
              Guest Experience Intelligence
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Based on available hotel information · Updated{" "}
              {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-main"
          >
            Refresh summary
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Insight
            label="Top priority"
            value={
              priority?.conversation?.subject ||
              (threads[0]?.subject ?? "No priority issue identified")
            }
          />
          <Insight
            label="Top risk"
            value={
              escalations.length
                ? `${escalations.length} issue${escalations.length === 1 ? "" : "s"} need management attention`
                : "No active escalation risk"
            }
          />
          <button
            type="button"
            onClick={() =>
              priority
                ? onOpenTicket(priority)
                : onAsk("Which guest issues need attention today?")
            }
            className="rounded-xl border border-primary-200 bg-primary-50 p-4 text-left"
          >
            <p className="text-xs font-semibold uppercase text-primary-700">
              Recommended action
            </p>
            <p className="mt-2 text-sm font-semibold text-text-main">
              {priority
                ? "Review the highest-priority guest issue"
                : "Ask LaFlo to review today’s guest issues"}
            </p>
            <p className="mt-2 text-xs text-primary-700">
              Open action <ChevronRight className="inline h-3.5 w-3.5" />
            </p>
          </button>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map(({ icon: Icon, ...item }) => (
          <button
            type="button"
            key={item.label}
            onClick={item.onClick}
            className="theme-stat-card rounded-2xl border border-border bg-card p-4 text-left shadow-sm hover:border-primary-300"
          >
            <span className="theme-kpi-icon grid h-10 w-10 place-items-center rounded-xl">
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-text-main">
              {item.value}
            </p>
            <p className="text-sm font-semibold text-text-main">{item.label}</p>
            <p className="mt-1 text-xs text-text-muted">{item.detail}</p>
          </button>
        ))}
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-semibold text-text-main">
            Recent guest activity
          </h2>
          <div className="mt-3 divide-y divide-border">
            {threads.slice(0, 6).map((thread) => (
              <button
                type="button"
                key={thread.id}
                onClick={() => onOpenThread(thread.id)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-main">
                    {guestName(thread)}
                  </p>
                  <p className="truncate text-xs text-text-muted">
                    {thread.lastMessage?.body || thread.subject}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-text-muted">
                  {timestamp(thread.lastMessageAt)}
                </span>
              </button>
            ))}
            {!threads.length ? (
              <p className="py-8 text-center text-sm text-text-muted">
                No guest conversations are available.
              </p>
            ) : null}
          </div>
        </section>
        <section className="rounded-2xl border border-primary-200 bg-primary-50 p-5">
          <Bot className="h-6 w-6 text-primary-700" />
          <h2 className="mt-3 font-semibold text-text-main">
            Ask LaFlo for guest experience help
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Summarise issues, identify SLA risks, or recommend the next
            authorised action using this page’s current context.
          </p>
          <div className="mt-4 space-y-2">
            {[
              "Which guest issues need attention today?",
              "Which tickets are at risk of SLA breach?",
              "Show unresolved VIP issues.",
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onAsk(prompt)}
                className="block w-full rounded-xl border border-primary-200 bg-card px-3 py-2 text-left text-xs font-semibold text-primary-700"
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <p className="text-xs font-semibold uppercase text-text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-text-main">{value}</p>
    </div>
  );
}

type ConversationWorkspaceProps = {
  listPaneWidth: number;
  contextPaneWidth: number;
  onListPaneWidth: (width: number) => void;
  onContextPaneWidth: (width: number) => void;
  threads: MessageThreadSummary[];
  workspaceTab: "conversations" | "tickets";
  conversationCount: number;
  ticketCount: number;
  ticketsByConversation: Map<string, Ticket>;
  selectedThreadId: string | null;
  selectedThread: MessageThreadSummary | null;
  detail?: MessageThreadDetail;
  detailLoading: boolean;
  search: string;
  filter: ConversationFilter;
  priorityFilter: PriorityFilter;
  draft: string;
  agents: SupportAgent[];
  currentUser: User | null;
  canMessage: boolean;
  canManage: boolean;
  canCreateTask: boolean;
  canViewGuest: boolean;
  sending: boolean;
  onSearch: (value: string) => void;
  onFilter: (value: ConversationFilter) => void;
  onPriorityFilter: (value: PriorityFilter) => void;
  onWorkspaceTab: (tab: WorkspaceTab) => void;
  onSelect: (id: string) => void;
  onDraft: (value: string) => void;
  onSend: () => void;
  onUnavailable: (message: string) => void;
  onAssign: (userId: string) => void;
  onTicketAction: (action: TicketAction) => void;
  onCreateTask: () => void;
  onOpenTasks: () => void;
  onCall: () => void;
  onGuest: () => void;
  messageEndRef: React.Ref<HTMLDivElement>;
};

function ConversationWorkspace(props: ConversationWorkspaceProps) {
  const [contextTab, setContextTab] = useState<"guest" | "ticket">("guest");
  const [activeResizePane, setActiveResizePane] = useState<
    "list" | "context" | null
  >(null);
  const resizeDragRef = useRef<{
    pane: "list" | "context";
    startX: number;
    startWidth: number;
  } | null>(null);
  const ticket = props.selectedThreadId
    ? props.ticketsByConversation.get(props.selectedThreadId)
    : null;

  const updatePaneWidth = (pane: "list" | "context", width: number) => {
    if (pane === "list") {
      props.onListPaneWidth(
        clampPaneWidth(width, MIN_GUEST_LIST_WIDTH, MAX_GUEST_LIST_WIDTH),
      );
      return;
    }
    props.onContextPaneWidth(
      clampPaneWidth(
        width,
        MIN_GUEST_CONTEXT_WIDTH,
        MAX_GUEST_CONTEXT_WIDTH,
      ),
    );
  };

  const startPaneResize = (
    pane: "list" | "context",
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeDragRef.current = {
      pane,
      startX: event.clientX,
      startWidth:
        pane === "list" ? props.listPaneWidth : props.contextPaneWidth,
    };
    setActiveResizePane(pane);
  };

  const movePaneResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = resizeDragRef.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    updatePaneWidth(
      drag.pane,
      drag.startWidth + (drag.pane === "list" ? delta : -delta),
    );
  };

  const endPaneResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeDragRef.current = null;
    setActiveResizePane(null);
  };

  const resizePaneWithKeyboard = (
    pane: "list" | "context",
    key: string,
  ) => {
    if (key !== "ArrowLeft" && key !== "ArrowRight") return;
    const direction = key === "ArrowRight" ? 1 : -1;
    const current =
      pane === "list" ? props.listPaneWidth : props.contextPaneWidth;
    updatePaneWidth(
      pane,
      current + direction * (pane === "list" ? 16 : -16),
    );
  };

  const resetPaneWidth = (pane: "list" | "context") =>
    updatePaneWidth(
      pane,
      pane === "list" ? DEFAULT_GUEST_LIST_WIDTH : DEFAULT_GUEST_CONTEXT_WIDTH,
    );

  const paneSeparator = (pane: "list" | "context") => {
    const isList = pane === "list";
    const width = isList ? props.listPaneWidth : props.contextPaneWidth;
    const label = isList
      ? "Resize conversation list"
      : "Resize guest context panel";
    return (
      <div
        role="separator"
        tabIndex={0}
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={isList ? MIN_GUEST_LIST_WIDTH : MIN_GUEST_CONTEXT_WIDTH}
        aria-valuemax={isList ? MAX_GUEST_LIST_WIDTH : MAX_GUEST_CONTEXT_WIDTH}
        aria-valuenow={width}
        title="Drag to resize. Double-click to reset."
        className={`guest-experience-pane-resizer guest-experience-pane-resizer--${pane} ${activeResizePane === pane ? "is-dragging" : ""}`}
        onPointerDown={(event) => startPaneResize(pane, event)}
        onPointerMove={movePaneResize}
        onPointerUp={endPaneResize}
        onPointerCancel={endPaneResize}
        onDoubleClick={() => resetPaneWidth(pane)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            resizePaneWithKeyboard(pane, event.key);
          }
        }}
      >
        <span aria-hidden="true" />
      </div>
    );
  };

  return (
    <section className="guest-experience-conversation-workspace grid min-h-[680px] min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-[300px_minmax(360px,1fr)]">
      <aside className="guest-experience-list flex min-h-0 flex-col overflow-hidden border-b border-border lg:border-b-0 lg:border-r xl:rounded-2xl xl:border xl:border-border xl:bg-card" aria-label="Guest conversations">
        <div className="grid grid-cols-2 border-b border-border" role="tablist" aria-label="Conversation workspace type">
          {[
            ["conversations", "Conversations", props.conversationCount],
            ["tickets", "Tickets", props.ticketCount],
          ].map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={props.workspaceTab === id}
              onClick={() => props.onWorkspaceTab(id as WorkspaceTab)}
              className={`guest-workspace-tab border-b-2 px-3 py-3 text-xs font-semibold ${props.workspaceTab === id ? "is-active border-primary-600 text-primary-700" : "border-transparent text-text-muted"}`}
            >
              {label} <span className="ml-1 rounded-full bg-bg px-1.5 py-0.5 text-[9px]">{count}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2 border-b border-border p-3">
          <label className="relative block">
            <span className="sr-only">Search conversations</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={props.search}
              onChange={(event) => props.onSearch(event.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className="w-full rounded-lg border border-border bg-bg py-2 pl-9 pr-3 text-xs text-text-main"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={props.filter}
              onChange={(event) =>
                props.onFilter(event.target.value as ConversationFilter)
              }
              aria-label="Filter conversations"
              className="min-w-0 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] font-semibold text-text-main"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="unassigned">Unassigned</option>
              <option value="assigned">Assigned to me</option>
              <option value="escalated">Escalated / SLA</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              value={props.priorityFilter}
              onChange={(event) =>
                props.onPriorityFilter(event.target.value as PriorityFilter)
              }
              aria-label="Filter conversation priority"
              className="min-w-0 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] font-semibold text-text-main"
            >
              <option value="all">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {props.threads.map((thread) => {
            const itemTicket = props.ticketsByConversation.get(thread.id);
            return (
              <button
                type="button"
                key={thread.id}
                onClick={() => props.onSelect(thread.id)}
                className={`guest-conversation-row w-full border-b border-border p-3 text-left ${props.selectedThreadId === thread.id ? "is-selected bg-primary-50" : "hover:bg-bg"}`}
              >
                <div className="flex gap-3">
                  <span className="guest-conversation-avatar grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                    {initials(guestName(thread))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-text-main">
                        {guestName(thread)}
                      </p>
                      <span className="text-[10px] text-text-muted">
                        {new Date(thread.lastMessageAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="truncate text-xs text-text-muted">
                      {thread.lastMessage?.body || thread.subject}
                    </p>
                    <div className="guest-conversation-badges mt-2 flex flex-wrap gap-1">
                      <Badge>{thread.status}</Badge>
                      <Badge>{itemTicket?.priority || "NORMAL"}</Badge>
                      <Badge>
                        {itemTicket?.assignedTo
                          ? itemTicket.assignedTo.firstName
                          : thread.assignedSupport?.firstName || "Unassigned"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {!props.threads.length ? (
            <p className="p-8 text-center text-sm text-text-muted">
              No conversations match the current search and filter.
            </p>
          ) : null}
        </div>
      </aside>
      {paneSeparator("list")}
      <section className="guest-experience-thread flex min-h-[600px] min-w-0 flex-col bg-bg/50 xl:rounded-2xl xl:border xl:border-border" aria-label="Active guest conversation">
        {props.selectedThread ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="guest-thread-avatar grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                  {initials(guestName(props.selectedThread))}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-text-main">
                      {guestName(props.selectedThread)}
                    </h2>
                    {VIP_PATTERN.test(
                      `${props.selectedThread.subject} ${props.selectedThread.lastMessage?.body || ""}`,
                    ) ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        VIP guest
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-text-muted">
                    {props.selectedThread.booking?.bookingRef ||
                      "No booking linked"}{" "}
                    · {labelize(props.selectedThread.status)}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={props.onCall} aria-label="Call selected guest" className="rounded-lg p-2 text-text-muted hover:bg-bg"><Phone className="h-4 w-4" /></button>
                <button type="button" onClick={() => props.onUnavailable("Video calling is unavailable because a compatible video provider is not connected.")} aria-label="Video call unavailable" className="rounded-lg p-2 text-text-muted hover:bg-bg"><UsersRound className="h-4 w-4" /></button>
                <button type="button" onClick={() => props.onUnavailable("Guest email is unavailable from this conversation workspace.")} aria-label="Email guest unavailable" className="rounded-lg p-2 text-text-muted hover:bg-bg"><Inbox className="h-4 w-4" /></button>
              </div>
            </div>
            {ticket ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 text-xs">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="rounded-full bg-red-50 px-2 py-1 font-bold text-red-700">
                    {labelize(ticket.priority)}
                  </span>
                  <span className="font-semibold text-text-muted">
                    Ticket #{ticket.id.slice(0, 8)}
                  </span>
                  <span className="truncate font-semibold text-text-main">
                    {props.selectedThread.subject}
                  </span>
                </div>
                <span className="rounded-lg border border-border px-2 py-1 font-semibold text-text-main">
                  {labelize(ticket.status)}
                </span>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {props.detailLoading ? (
                <p className="text-sm text-text-muted">Loading conversation…</p>
              ) : (
                props.detail?.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    agents={props.agents}
                    currentUser={props.currentUser}
                  />
                ))
              )}
              {!props.detailLoading && !props.detail?.messages.length ? (
                <p className="py-10 text-center text-sm text-text-muted">
                  No messages in this conversation.
                </p>
              ) : null}
              <div ref={props.messageEndRef} />
            </div>
            <div className="guest-experience-composer shrink-0 border-t border-border bg-card p-3">
              <div className="guest-experience-action-toolbar mb-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => props.onUnavailable("Approval is unavailable because this conversation has no pending approval workflow.")}
                  className="guest-experience-action-control rounded-lg border border-border font-semibold"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={!props.canManage}
                  title={!props.canManage ? "Permission required" : undefined}
                  onClick={() => props.onTicketAction("escalate")}
                  className="guest-experience-action-control rounded-lg border border-border font-semibold disabled:opacity-45"
                >
                  Escalate
                </button>
                {props.canManage && props.agents.length ? (
                  <select
                    aria-label="Assign conversation owner"
                    defaultValue=""
                    onChange={(event) => {
                      if (event.target.value) props.onAssign(event.target.value);
                      event.target.value = "";
                    }}
                    className="guest-experience-action-control guest-experience-assign-control rounded-lg border border-border bg-card font-semibold"
                  >
                    <option value="">Assign</option>
                    {props.agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.firstName} {agent.lastName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    disabled
                    title={!props.canManage ? "Permission required" : "No assignable owners available"}
                    className="guest-experience-action-control guest-experience-assign-control rounded-lg border border-border font-semibold opacity-45"
                  >
                    Assign
                  </button>
                )}
                <button
                  type="button"
                  disabled={!props.canCreateTask}
                  title={
                    !props.canCreateTask ? "Permission required" : undefined
                  }
                  onClick={props.onCreateTask}
                  className="guest-experience-action-control rounded-lg border border-border font-semibold disabled:opacity-45"
                >
                  Create task
                </button>
                <button
                  type="button"
                  onClick={props.onCall}
                  className="guest-experience-action-control rounded-lg border border-border font-semibold"
                >
                  <Phone className="mr-1 inline h-3.5 w-3.5" />
                  Call guest
                </button>
                <button
                  type="button"
                  onClick={() => props.onUnavailable("Guest charging is unavailable because an authorised billing workflow is not connected.")}
                  className="guest-experience-action-control rounded-lg border border-border font-semibold"
                >
                  Charge guest
                </button>
                <button
                  type="button"
                  disabled={!props.canManage}
                  title={!props.canManage ? "Permission required" : undefined}
                  onClick={() => props.onTicketAction("resolve")}
                  className="guest-experience-action-control rounded-lg border border-border font-semibold disabled:opacity-45"
                >
                  Resolve
                </button>
                <button
                  type="button"
                  disabled={!props.canManage}
                  title={!props.canManage ? "Permission required" : undefined}
                  onClick={() => props.onTicketAction("close")}
                  className="guest-experience-action-control rounded-lg border border-border font-semibold disabled:opacity-45"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => props.onUnavailable("Internal notes are unavailable because the note service is not connected.")}
                  className="guest-experience-action-control rounded-lg border border-border font-semibold"
                >
                  Add note
                </button>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  props.onSend();
                }}
                className="flex gap-2"
              >
                <input
                  aria-label="Type a guest reply"
                  value={props.draft}
                  onChange={(event) => props.onDraft(event.target.value)}
                  disabled={!props.canMessage || props.sending}
                  placeholder={
                    props.canMessage
                      ? "Type a guest reply"
                      : "Permission required to send guest messages"
                  }
                  className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={
                    !props.canMessage || !props.draft.trim() || props.sending
                  }
                  className="guest-experience-reply-button rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast disabled:opacity-50"
                >
                  {props.sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="mr-1 inline h-4 w-4" />
                      Reply
                    </>
                  )}
                </button>
              </form>
              <details className="mt-3 border-t border-border pt-3 text-sm 2xl:hidden">
                <summary className="cursor-pointer font-semibold text-text-main">
                  Guest context
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <ContextRow
                    label="Guest"
                    value={guestName(props.selectedThread)}
                  />
                  <ContextRow
                    label="Room / booking"
                    value={
                      props.selectedThread.booking?.bookingRef || "Not linked"
                    }
                  />
                  <ContextRow
                    label="Open issues"
                    value={
                      ticket && !terminalTicket(ticket)
                        ? "1 linked ticket"
                        : "No open linked ticket"
                    }
                  />
                  <ContextRow
                    label="Sentiment / urgency"
                    value={
                      ticket?.priority
                        ? labelize(ticket.priority)
                        : "Not analysed"
                    }
                  />
                </div>
              </details>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center text-sm text-text-muted">
            Select a conversation to view its thread.
          </div>
        )}
      </section>
      {paneSeparator("context")}
      <aside className="guest-experience-context hidden min-h-0 min-w-0 overflow-hidden border-l border-border bg-card xl:block xl:rounded-2xl xl:border xl:border-border" aria-label="Guest and ticket context">
        <div className="grid grid-cols-2 border-b border-border px-3 pt-2" role="tablist" aria-label="Guest context views">
          {[
            ["guest", "Guest Details"],
            ["ticket", "Ticket Insights"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={contextTab === id}
              onClick={() => setContextTab(id as "guest" | "ticket")}
              className={`guest-context-tab border-b-2 px-2 py-3 text-xs font-semibold ${contextTab === id ? "is-active border-primary-600 text-primary-700" : "border-transparent text-text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {props.selectedThread ? (
          <div
            className="guest-experience-context-body h-[calc(100%-49px)] space-y-3 overflow-y-auto p-3 text-sm"
            data-context-tab={contextTab}
          >
            {contextTab === "guest" ? (
              <>
                <section className="guest-context-profile rounded-xl border border-border p-3">
                  <div className="flex items-center gap-3">
                    <span className="guest-profile-avatar grid h-10 w-10 place-items-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                      {initials(guestName(props.selectedThread))}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-text-main">
                        {guestName(props.selectedThread)}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {props.selectedThread.guest?.email || "Email not available"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={props.onCall}
                      className="rounded-lg border border-border px-2 py-2 text-xs font-semibold"
                    >
                      <Phone className="mr-1 inline h-3.5 w-3.5" /> Call guest
                    </button>
                    <button
                      type="button"
                      onClick={props.onGuest}
                      className="rounded-lg border border-border px-2 py-2 text-xs font-semibold"
                    >
                      <UsersRound className="mr-1 inline h-3.5 w-3.5" /> Profile
                    </button>
                  </div>
                </section>
                <section className="guest-context-stay rounded-xl border border-border p-3">
                  <h3 className="text-xs font-semibold text-text-main">
                    Stay information
                  </h3>
                  <div className="mt-3 space-y-3">
                    <ContextRow
                      label="Reservation"
                      value={props.selectedThread.booking?.bookingRef || "Not linked"}
                    />
                    <ContextRow
                      label="Check-in"
                      value={
                        props.selectedThread.booking
                          ? new Date(props.selectedThread.booking.checkInDate).toLocaleDateString()
                          : "Unavailable"
                      }
                    />
                    <ContextRow
                      label="Check-out"
                      value={
                        props.selectedThread.booking
                          ? new Date(props.selectedThread.booking.checkOutDate).toLocaleDateString()
                          : "Unavailable"
                      }
                    />
                  </div>
                </section>
                <section className="guest-context-timeline rounded-xl border border-border p-3">
                  <h3 className="text-xs font-semibold text-text-main">Issue timeline</h3>
                  <div className="mt-3 space-y-3 text-xs" role="list" aria-label="Issue timeline">
                    <TimelineItem icon={MessageSquareText} title="Issue reported" detail={timestamp(props.selectedThread.lastMessageAt)} />
                    <TimelineItem icon={UserRoundCheck} title="Owner status" detail={ticket?.assignedTo ? "Owner assigned" : "Awaiting owner"} />
                    <TimelineItem icon={Clock3} title="SLA status" detail={ticket && (ticket.status === "BREACHED" || isOverdue(ticket)) ? "Needs immediate attention" : "Within available target"} />
                  </div>
                </section>
                <section className="guest-context-status rounded-xl border border-border p-3">
                  <h3 className="text-xs font-semibold text-text-main">Ticket status</h3>
                  {ticket ? (
                    <div className="mt-3 space-y-3">
                      <ContextRow label="Status" value={labelize(ticket.status)} />
                      <ContextRow label="Priority" value={labelize(ticket.priority)} />
                      <ContextRow label="SLA" value={ticket.status === "BREACHED" || isOverdue(ticket) ? "At risk / breached" : getTimeRemaining(ticket)?.display || "No SLA due"} />
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-text-muted">No ticket is linked to this conversation.</p>
                  )}
                </section>
                <section className="guest-context-related rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-text-main">Related tasks</h3>
                    <button
                      type="button"
                      disabled={!props.canCreateTask}
                      onClick={props.onCreateTask}
                      className="text-xs font-semibold text-primary-700 disabled:opacity-45"
                    >
                      + New task
                    </button>
                  </div>
                  <p className="mt-3 rounded-lg bg-bg p-3 text-xs text-text-muted">
                    Linked task details are available from the operational task queue.
                  </p>
                  <button
                    type="button"
                    onClick={props.onOpenTasks}
                    className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                  >
                    Open task queue
                  </button>
                </section>
              </>
            ) : (
              <>
                <section className="guest-context-status rounded-xl border border-border p-3">
                  <h3 className="text-xs font-semibold text-text-main">Ticket status</h3>
                  {ticket ? (
                    <div className="mt-3 space-y-3">
                      <ContextRow label="Status" value={labelize(ticket.status)} />
                      <ContextRow label="Priority" value={labelize(ticket.priority)} />
                      <ContextRow
                        label="SLA"
                        value={
                          ticket.status === "BREACHED" || isOverdue(ticket)
                            ? "At risk / breached"
                            : getTimeRemaining(ticket)?.display || "No SLA due"
                        }
                      />
                      <ContextRow
                        label="Owner"
                        value={
                          ticket.assignedTo
                            ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
                            : "Unassigned"
                        }
                      />
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-text-muted">
                      No ticket is linked to this conversation.
                    </p>
                  )}
                </section>
                <section className="guest-context-timeline rounded-xl border border-border p-3">
                  <h3 className="text-xs font-semibold text-text-main">
                    Issue timeline
                  </h3>
                  <div className="mt-3 space-y-3 text-xs" role="list" aria-label="Issue timeline">
                    <TimelineItem icon={MessageSquareText} title="Issue reported" detail={timestamp(props.selectedThread.lastMessageAt)} />
                    <TimelineItem icon={UserRoundCheck} title="Owner status" detail={ticket?.assignedTo ? "Owner assigned" : "Awaiting owner"} />
                    <TimelineItem icon={Clock3} title="SLA status" detail={ticket && (ticket.status === "BREACHED" || isOverdue(ticket)) ? "Needs immediate attention" : "Within available target"} />
                  </div>
                </section>
              </>
            )}
            <section className="guest-context-suggestions rounded-xl border border-primary-200 bg-primary-50 p-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-text-main">
                <Sparkles className="h-4 w-4 text-primary-700" /> Suggested next actions
              </h3>
              <div className="mt-3 space-y-2">
                <ActionRow
                  icon={Wrench}
                  title="Notify the responsible department"
                  detail="Create a linked operational follow-up"
                  onClick={props.onCreateTask}
                />
                <ActionRow
                  icon={Phone}
                  title="Call the guest"
                  detail="Open Guest Calls with this contact"
                  onClick={props.onCall}
                />
                <ActionRow
                  icon={CalendarDays}
                  title="Compensate guest"
                  detail="Billing workflow is not connected"
                  onClick={() =>
                    props.onUnavailable(
                      "Guest compensation is unavailable because an authorised billing workflow is not connected.",
                    )
                  }
                />
              </div>
            </section>
            <section className="guest-context-response rounded-xl border border-border p-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-text-main">
                <Bot className="h-4 w-4 text-primary-700" /> Recommended response
              </h3>
              <p className="mt-2 rounded-lg bg-bg p-3 text-xs text-text-muted">
                I’m sorry for the inconvenience. We’re reviewing this now and will update you as soon as the next step is confirmed.
              </p>
              <button
                type="button"
                disabled={!props.canMessage}
                onClick={() =>
                  props.onDraft(
                    "I’m sorry for the inconvenience. We’re reviewing this now and will update you as soon as the next step is confirmed.",
                  )
                }
                className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-45"
              >
                Use this response
              </button>
            </section>
          </div>
        ) : (
          <p className="p-4 text-sm text-text-muted">
            Select a conversation to view authorised guest context.
          </p>
        )}
      </aside>
    </section>
  );
}

function TimelineItem({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Clock3;
  title: string;
  detail: string;
}) {
  return (
    <div className="guest-timeline-item flex gap-2" role="listitem">
      <span className="guest-timeline-icon grid h-7 w-7 shrink-0 place-items-center rounded-full bg-bg text-primary-700">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div>
        <p className="font-semibold text-text-main">{title}</p>
        <p className="text-text-muted">{detail}</p>
      </div>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  icon: typeof Clock3;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="guest-suggested-action flex w-full items-center gap-2 rounded-lg border border-primary-200 bg-card p-2 text-left"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-700">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-text-main">
          {title}
        </span>
        <span className="block truncate text-[10px] text-text-muted">
          {detail}
        </span>
      </span>
      <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-text-muted" />
    </button>
  );
}

function MessageBubble({
  message,
  agents,
  currentUser,
}: {
  message: ConversationMessage;
  agents: SupportAgent[];
  currentUser: User | null;
}) {
  const guest = message.senderType === "GUEST";
  const system = message.senderType === "SYSTEM";
  const senderName = messageSenderName(message);
  const senderNameNormalized = senderName.toLocaleLowerCase();
  const matchingAgent = agents.find(
    (agent) =>
      `${agent.firstName} ${agent.lastName}`.trim().toLocaleLowerCase() ===
      senderNameNormalized,
  );
  const matchingCurrentUser =
    currentUser &&
    `${currentUser.firstName} ${currentUser.lastName}`
      .trim()
      .toLocaleLowerCase() === senderNameNormalized
      ? currentUser
      : null;
  const senderUserId =
    message.senderUser?.id || matchingAgent?.id || matchingCurrentUser?.id;
  const isCurrentUserMessage = Boolean(
    !guest &&
      !system &&
      currentUser &&
      (senderUserId === currentUser.id || matchingCurrentUser),
  );
  const alignLeft = guest || system || !isCurrentUserMessage;
  const avatarUrl =
    message.senderUser?.avatarUrl ||
    matchingAgent?.avatarUrl ||
    matchingCurrentUser?.avatarUrl ||
    storedUserAvatar(senderUserId);
  const showAvatar = !system;
  const avatarTone = guest
    ? "bg-emerald-100 text-emerald-700"
    : isCurrentUserMessage
      ? "bg-primary-100 text-primary-700"
      : "bg-violet-100 text-violet-700";
  const avatar = showAvatar ? (
    <span
      className={`guest-message-avatar relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-[10px] font-bold ${avatarTone}`}
      title={senderName}
      data-avatar-user-id={senderUserId || "unresolved"}
      role="img"
      aria-label={`${senderName} profile`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
      ) : (
        initials(senderName)
      )}
      {matchingAgent?.online ? (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" aria-label="Online" />
      ) : null}
    </span>
  ) : null;
  return (
    <article
      aria-label={`${senderName} message`}
      className={`flex items-end gap-2 ${alignLeft ? "justify-start" : "justify-end"}`}
    >
      {showAvatar && alignLeft ? avatar : null}
      <div
        className={`guest-experience-message max-w-[80%] rounded-2xl px-3 py-2 text-xs ${system ? "is-system border border-border bg-card text-text-muted" : guest ? "is-guest border border-border bg-card text-text-main" : "is-staff bg-primary-solid text-primary-contrast"}`}
      >
        <p>{message.body}</p>
        <p
          className={`mt-1 text-[10px] ${guest || system ? "text-text-muted" : "opacity-75"}`}
        >
          {senderName}{" "}
          · {timestamp(message.createdAt)}
        </p>
      </div>
      {showAvatar && !alignLeft ? avatar : null}
    </article>
  );
}
function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border pb-3">
      <p className="text-xs font-semibold uppercase text-text-muted">{label}</p>
      <p className="mt-1 text-sm text-text-main">{value}</p>
    </div>
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-bg px-2 py-0.5 text-[9px] font-semibold uppercase text-text-muted">
      {children}
    </span>
  );
}

function TicketTable({
  title,
  detail,
  tickets,
  canManage,
  canCreateTask,
  empty = "No ticket data available.",
  onOpen,
  onAssign,
  onAction,
  onCreateTask,
  onAsk,
}: {
  title: string;
  detail: string;
  tickets: Ticket[];
  canManage: boolean;
  canCreateTask: boolean;
  empty?: string;
  onOpen: (ticket: Ticket) => void;
  onAssign: (ticket: Ticket) => void;
  onAction: (ticket: Ticket, action: TicketAction) => void;
  onCreateTask: (ticket: Ticket) => void;
  onAsk: (ticket: Ticket) => void;
}) {
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketPriority, setTicketPriority] = useState("all");
  const [ticketStatus, setTicketStatus] = useState("all");
  const filteredTickets = useMemo(() => {
    const needle = ticketSearch.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesSearch =
        !needle ||
        ticket.id.toLowerCase().includes(needle) ||
        ticket.conversation?.subject.toLowerCase().includes(needle) ||
        `${ticket.conversation?.guest?.firstName || ""} ${ticket.conversation?.guest?.lastName || ""}`
          .toLowerCase()
          .includes(needle);
      return (
        matchesSearch &&
        (ticketPriority === "all" || ticket.priority === ticketPriority) &&
        (ticketStatus === "all" || ticket.status === ticketStatus)
      );
    });
  }, [ticketPriority, ticketSearch, ticketStatus, tickets]);
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <h2 className="font-semibold text-text-main">{title}</h2>
          <p className="mt-1 text-sm text-text-muted">{detail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              value={ticketSearch}
              onChange={(event) => setTicketSearch(event.target.value)}
              placeholder="Search tickets"
              className="w-48 rounded-lg border border-border bg-bg py-2 pl-8 pr-3 text-xs"
            />
          </label>
          <select
            aria-label="Filter ticket priority"
            value={ticketPriority}
            onChange={(event) => setTicketPriority(event.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold"
          >
            <option value="all">All priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select
            aria-label="Filter ticket status"
            value={ticketStatus}
            onChange={(event) => setTicketStatus(event.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold"
          >
            <option value="all">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="BREACHED">Breached</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>
      {filteredTickets.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-xs">
            <thead className="border-y border-border bg-bg text-text-muted">
              <tr>
                {[
                  "Ticket",
                  "Guest",
                  "Department",
                  "Priority",
                  "Status",
                  "Owner",
                  "SLA",
                  "Created",
                  "Last update",
                  "Actions",
                ].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpen(ticket)}
                      className="max-w-[210px] text-left font-semibold text-primary-700"
                    >
                      {ticket.conversation?.subject ||
                        `Ticket ${ticket.id.slice(0, 8)}`}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {ticket.conversation?.guest
                      ? `${ticket.conversation.guest.firstName} ${ticket.conversation.guest.lastName}`
                      : "Not linked"}
                  </td>
                  <td className="px-4 py-3">{labelize(ticket.department)}</td>
                  <td className="px-4 py-3">{labelize(ticket.priority)}</td>
                  <td className="px-4 py-3">{labelize(ticket.status)}</td>
                  <td className="px-4 py-3">
                    {ticket.assignedTo
                      ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
                      : "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    {ticket.status === "BREACHED" || isOverdue(ticket)
                      ? "At risk / breached"
                      : getTimeRemaining(ticket)?.display || "No SLA due"}
                  </td>
                  <td className="px-4 py-3">
                    {timestamp(ticket.createdAtUtc)}
                  </td>
                  <td className="px-4 py-3">
                    {timestamp(ticket.updatedAtUtc)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => onOpen(ticket)}
                        className="rounded-lg border border-border px-2 py-1.5 font-semibold"
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        disabled={!canManage}
                        title={!canManage ? "Permission required" : undefined}
                        onClick={() => onAssign(ticket)}
                        className="rounded-lg border border-border px-2 py-1.5 font-semibold disabled:opacity-45"
                      >
                        Assign
                      </button>
                      <button
                        type="button"
                        disabled={!canManage || terminalTicket(ticket)}
                        onClick={() => onAction(ticket, "escalate")}
                        className="rounded-lg border border-border px-2 py-1.5 font-semibold disabled:opacity-45"
                      >
                        Escalate
                      </button>
                      <button
                        type="button"
                        disabled={!canCreateTask}
                        title={
                          !canCreateTask ? "Permission required" : undefined
                        }
                        onClick={() => onCreateTask(ticket)}
                        className="rounded-lg border border-border px-2 py-1.5 font-semibold disabled:opacity-45"
                      >
                        Create task
                      </button>
                      <button
                        type="button"
                        disabled={!canManage || terminalTicket(ticket)}
                        onClick={() => onAction(ticket, "resolve")}
                        className="rounded-lg border border-border px-2 py-1.5 font-semibold disabled:opacity-45"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        disabled={!canManage || ticket.status === "CLOSED"}
                        onClick={() => onAction(ticket, "close")}
                        className="rounded-lg border border-border px-2 py-1.5 font-semibold disabled:opacity-45"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => onAsk(ticket)}
                        className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1.5 font-semibold text-primary-700"
                      >
                        Ask LaFlo
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-t border-border p-10 text-center text-sm text-text-muted">
          {tickets.length ? "No tickets match the current filters." : empty}
        </p>
      )}
    </section>
  );
}

function StateCard({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: typeof Inbox;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
      <Icon className="mx-auto h-8 w-8 text-text-muted" />
      <h2 className="mt-3 font-semibold text-text-main">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-text-muted">{detail}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
function TaskDialog({
  task,
  pending,
  onClose,
  onConfirm,
}: {
  task: TaskDraft;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-text-main/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Create task from guest issue"
        className="w-full max-w-lg rounded-3xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-700">
              Prefilled guest follow-up task
            </p>
            <h2 className="mt-1 text-lg font-semibold text-text-main">
              Create task from guest issue
            </h2>
          </div>
          <button type="button" aria-label="Close task form" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3 rounded-2xl border border-border p-4 text-sm">
          <ContextRow label="Task" value={task.title} />
          <ContextRow label="Reason" value={task.reason} />
          <ContextRow label="Department" value={labelize(task.department)} />
          <ContextRow label="Priority" value={labelize(task.priority)} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create task"}
          </button>
        </div>
      </section>
    </div>
  );
}
