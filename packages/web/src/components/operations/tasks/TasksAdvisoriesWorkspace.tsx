import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  CreditCard,
  Flag,
  House,
  Eye,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import { operationsService, timelineService } from "@/services";
import type {
  OperationsContext,
  CreateAdvisoryTicketResult,
} from "@/services/operations";
import type {
  TimelineEvent,
  TimelineFilters,
  TimelineSeverity,
} from "@/services/timeline";
import { useAuthStore } from "@/stores/authStore";
import { appendAuditLog } from "@/utils/auditLog";

type Advisory = NonNullable<OperationsContext["advisories"]>[number];
type AdvisoryState = "ALL" | "OPEN" | "NOT_CREATED" | "ASSIGNED" | "CREATED" | "DISMISSED" | "COMPLETED";
type AdvisoryRequest = { state?: AdvisoryState; priority?: string; department?: string; source?: string; unassigned?: boolean; key: number };
type SearchTaskHandoff = {
  sourceSearchResult?: {
    id?: string;
    title?: string;
    summary?: string;
    snippet?: string;
    category?: string;
    sourceModule?: string;
    severity?: string | null;
  };
  requestedAction?: "create" | "assign";
};

type Props = {
  context?: OperationsContext;
  isLoading: boolean;
  isError: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
};

const card = "rounded-2xl border border-border bg-card shadow-card";
const iconBox =
  "theme-kpi-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl";
const pretty = (value?: string) =>
  (value || "Operations")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Just now";

const priorityClass: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  medium: "bg-blue-50 text-blue-700 ring-blue-200",
  high: "bg-amber-50 text-amber-700 ring-amber-200",
  critical: "bg-rose-50 text-rose-700 ring-rose-200",
};
const accentClass: Record<string, string> = {
  low: "border-l-emerald-400",
  medium: "border-l-blue-400",
  high: "border-l-amber-400",
  critical: "border-l-rose-500",
};
const severityClass: Record<TimelineSeverity, string> = {
  INFO: "bg-blue-50 text-blue-700 ring-blue-200",
  SUCCESS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  WARNING: "bg-amber-50 text-amber-700 ring-amber-200",
  CRITICAL: "bg-rose-50 text-rose-700 ring-rose-200",
};

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "primary",
  onClick,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  detail: string;
  tone?: "primary" | "risk" | "good" | "info";
  onClick: () => void;
}) {
  const toneClass =
    tone === "risk"
      ? "bg-rose-50 text-rose-600"
      : tone === "good"
        ? "bg-emerald-50 text-emerald-600"
        : tone === "info"
          ? "bg-blue-50 text-blue-600"
          : "theme-kpi-icon";
  return (
    <button type="button" onClick={onClick} className={`${card} flex min-h-24 items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2`}>
      <span
        className={`grid h-11 w-11 place-items-center rounded-xl ${toneClass}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold text-text-main">{value}</p>
        <p className="mt-1 text-[10px] text-text-muted">{detail}</p>
      </div>
    </button>
  );
}

function TasksLoadingState() {
  return (
    <div
      className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]"
      aria-label="Loading tasks and advisories"
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-24 animate-shimmer rounded-2xl" />
          ))}
        </div>
        <div className="h-[390px] animate-shimmer rounded-2xl" />
        <div className="h-[300px] animate-shimmer rounded-2xl" />
      </div>
      <div className="space-y-3">
        <div className="h-36 animate-shimmer rounded-2xl" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-52 animate-shimmer rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function CreateTaskDialog({
  advisory,
  onClose,
  onCreated,
  onServiceBlocked,
}: {
  advisory: Advisory;
  onClose: () => void;
  onCreated: (result: CreateAdvisoryTicketResult) => void;
  onServiceBlocked: () => void;
}) {
  const user = useAuthStore((state) => state.user);
  const [title, setTitle] = useState(advisory.title);
  const [description, setDescription] = useState(advisory.reason);
  const [department, setDepartment] = useState(
    advisory.department || "MANAGEMENT",
  );
  const [priority, setPriority] = useState(advisory.priority);
  const [dueDate, setDueDate] = useState(() =>
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const mutation = useMutation({
    mutationFn: () =>
      operationsService.createAdvisoryTicket({
        advisoryId: advisory.id,
        title: title.trim(),
        reason: description.trim(),
        priority,
        department,
        source: advisory.source,
        meta: { generatedAtUtc: new Date().toISOString(), dueDate },
      }),
    onSuccess: (result) => {
      appendAuditLog({
        action: "Operations Advisory Task Created",
        actorId: user?.id,
        actorName: user?.email || "Operations user",
        targetId: result.ticketId,
        targetLabel: title,
        details: { advisoryId: advisory.id, department, priority, dueDate },
      });
      onCreated(result);
      toast.success(
        result.deduped
          ? "Existing task opened"
          : "Task created and audit event recorded",
      );
    },
    onError: (error) => {
      const message =
        (error as any)?.response?.data?.error || "Task could not be created";
      if (
        (error as any)?.response?.status === 503 ||
        /not connected|unavailable|task service/i.test(message)
      ) {
        onServiceBlocked();
      }
      toast.error(message);
    },
  });
  const valid = Boolean(title.trim() && description.trim() && dueDate);
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-text-main/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-title"
    >
      <div className={`${card} w-full max-w-2xl p-5`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="create-task-title"
              className="text-lg font-bold text-text-main"
            >
              Create task from advisory
            </h2>
            <p className="mt-1 text-xs text-text-muted">
              Review the prefilled operational details before creating the task.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task form"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border text-text-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-xs font-semibold text-text-main">
            Task title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-normal"
            />
          </label>
          <label className="sm:col-span-2 text-xs font-semibold text-text-main">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-text-main">
            Department
            <select
              value={department}
              onChange={(event) =>
                setDepartment(event.target.value as typeof department)
              }
              className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-normal"
            >
              {[
                "FRONT_DESK",
                "HOUSEKEEPING",
                "MAINTENANCE",
                "CONCIERGE",
                "BILLING",
                "MANAGEMENT",
              ].map((item) => (
                <option key={item} value={item}>
                  {pretty(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-text-main">
            Priority
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as Advisory["priority"])
              }
              className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-normal"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-text-main">
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-text-main">
            Suggested owner
            <input
              readOnly
              value="Automatic department routing"
              className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-normal text-text-muted"
            />
          </label>
        </div>
        <div className="mt-5 rounded-xl bg-bg px-3 py-2 text-[10px] text-text-muted">
          Source advisory: {advisory.id} · Related source: {advisory.source}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-text-main"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary-solid px-4 text-sm font-semibold text-primary-contrast disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardList className="h-4 w-4" />
            )}
            Create task
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignDialog({
  advisory,
  created,
  onClose,
}: {
  advisory: Advisory;
  created?: CreateAdvisoryTicketResult;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-text-main/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-title"
    >
      <div className={`${card} w-full max-w-md p-5`}>
        <div className="flex items-start gap-3">
          <span className={iconBox}>
            <UserRoundCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 id="assign-title" className="font-bold text-text-main">
              Assign operational work
            </h2>
            <p className="mt-1 text-sm leading-6 text-text-muted">
              {created?.assignedTo
                ? `This task is routed to ${created.assignedTo.firstName} ${created.assignedTo.lastName}.`
                : "Direct assignment is not yet connected. Create the task first so LaFlo can route it through the task service."}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-bg p-3 text-xs text-text-muted">
          <strong className="text-text-main">{advisory.title}</strong>
          <br />
          Suggested team: {pretty(advisory.department)}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-xl bg-primary-solid px-4 text-sm font-semibold text-primary-contrast"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DismissDialog({
  advisory,
  onCancel,
  onConfirm,
}: {
  advisory: Advisory;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-text-main/45 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dismiss-title"
    >
      <div className={`${card} w-full max-w-md p-5`}>
        <AlertTriangle className="h-6 w-6 text-amber-500" />
        <h2 id="dismiss-title" className="mt-3 font-bold text-text-main">
          Dismiss this advisory?
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          LaFlo will request removal from the active advisory queue. If the
          dismissal service is unavailable, the advisory will remain active.
        </p>
        <p className="mt-3 rounded-xl bg-bg p-3 text-xs font-semibold text-text-main">
          {advisory.title}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-10 rounded-xl border border-border px-4 text-sm font-semibold text-text-main"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-primary-contrast"
          >
            Dismiss advisory
          </button>
        </div>
      </div>
    </div>
  );
}

function AdvisoryDetailDrawer({ advisory, task, dismissed, onClose, onAsk }: {
  advisory: Advisory;
  task?: CreateAdvisoryTicketResult;
  dismissed: boolean;
  onClose: () => void;
  onAsk: () => void;
}) {
  const status = dismissed
    ? "Dismissed"
    : task && ["RESOLVED", "CLOSED"].includes(task.status)
      ? "Completed"
      : task?.assignedTo
        ? "Assigned"
        : task
          ? "Created"
          : "Open / not created";
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-text-main/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Advisory details" className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Operations Advisory</p><h2 className="mt-1 text-xl font-semibold text-text-main">{advisory.title}</h2></div><button type="button" aria-label="Close advisory details" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-border"><X className="h-4 w-4" /></button></div>
        <p className="mt-4 rounded-xl bg-bg p-4 text-sm leading-6 text-text-muted">{advisory.reason}</p>
        <div className="mt-5 divide-y divide-border rounded-xl border border-border">
          <DetailRow label="Status" value={status} />
          <DetailRow label="Priority" value={pretty(advisory.priority)} />
          <DetailRow label="Department" value={pretty(advisory.department)} />
          <DetailRow label="Suggested owner" value={task?.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : `${pretty(advisory.department)} team`} />
          <DetailRow label="Source" value={pretty(advisory.source)} />
          <DetailRow label="Rationale" value={advisory.reason} />
          <DetailRow label="Task reference" value={task?.ticketId || advisory.createdTicket?.ticketId || "No task created"} />
          <DetailRow label="Related records" value="Available from the source module and operational activity history" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={onAsk} className="rounded-xl bg-primary-solid px-4 py-2 text-xs font-semibold text-primary-contrast">Ask LaFlo about this advisory</button>{task?.ticketId ? <Link to={`/tickets/${task.ticketId}`} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-text-main">Open task</Link> : null}</div>
      </section>
    </div>
  );
}

function AdvisoryQueue({
  context,
  canManage,
  request,
  handoff,
  onHandoffConsumed,
  onCountsChange,
}: {
  context?: OperationsContext;
  canManage: boolean;
  request: AdvisoryRequest;
  handoff?: SearchTaskHandoff;
  onHandoffConsumed: () => void;
  onCountsChange: (counts: { open: number; created: number; dismissed: number; pending: number; critical: number }) => void;
}) {
  const queryClient = useQueryClient();
  const contextAdvisories = context?.advisories || [];
  const [handoffAdvisories, setHandoffAdvisories] = useState<Advisory[]>([]);
  const advisories = [
    ...contextAdvisories,
    ...handoffAdvisories.filter((handoffItem) => !contextAdvisories.some((item) => item.id === handoffItem.id)),
  ];
  const [state, setState] = useState<AdvisoryState>("ALL");
  const [priority, setPriority] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [created, setCreated] = useState<
    Record<string, CreateAdvisoryTicketResult>
  >(() =>
    Object.fromEntries(
      contextAdvisories
        .filter((item) => item.createdTicket)
        .map((item) => [
          item.id,
          {
            ticketId: item.createdTicket!.ticketId,
            conversationId: item.createdTicket!.conversationId,
            status: "OPEN",
            department: item.department || "MANAGEMENT",
          } as CreateAdvisoryTicketResult,
        ]),
    ),
  );
  const [dismissed] = useState(new Set<string>());
  const [createTarget, setCreateTarget] = useState<Advisory | null>(null);
  const [assignTarget, setAssignTarget] = useState<Advisory | null>(null);
  const [dismissTarget, setDismissTarget] = useState<Advisory | null>(null);
  const [detailTarget, setDetailTarget] = useState<Advisory | null>(null);
  const [serviceBlocked, setServiceBlocked] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  useEffect(() => {
    const result = handoff?.sourceSearchResult;
    if (!result?.title) return;
    const category = String(result.category || result.sourceModule || "").toUpperCase();
    const department: Advisory["department"] = /MAINTENANCE|SMART_BUILDING|DEVICE|SENSOR/.test(category)
      ? "MAINTENANCE"
      : /GUEST|RESERVATION|ROOM/.test(category)
        ? "FRONT_DESK"
        : "MANAGEMENT";
    const severity = String(result.severity || "").toUpperCase();
    const isSmartBuilding = /SMART_BUILDING|DEVICE|SENSOR/.test(category);
    const source: Advisory["source"] = isSmartBuilding ? "SMART_BUILDING" : "ENTERPRISE_SEARCH";
    const advisory: Advisory = {
      id: `${isSmartBuilding ? "smart-building" : "enterprise-search"}:${result.id || result.title}`,
      title: result.title,
      reason: result.summary || result.snippet || `Follow up on this ${pretty(result.category)} ${isSmartBuilding ? "record" : "Enterprise Search result"}.`,
      priority: /CRITICAL|HIGH|URGENT/.test(severity) ? "high" : /LOW|INFO/.test(severity) ? "low" : "medium",
      department,
      source,
      createdTicket: null,
    };
    if (!canManage) {
      toast.error("Operations management permission is required for this action.");
      onHandoffConsumed();
      return;
    }
    setHandoffAdvisories((current) => current.some((item) => item.id === advisory.id) ? current : [...current, advisory]);
    if (handoff?.requestedAction === "assign") setAssignTarget(advisory);
    else setCreateTarget(advisory);
    onHandoffConsumed();
  }, [canManage, handoff, onHandoffConsumed]);
  const departments = [
    ...new Set(advisories.map((item) => item.department).filter(Boolean)),
  ] as string[];
  const filtered = advisories.filter((item) => {
    const isCreated = Boolean(created[item.id] || item.createdTicket);
    const isDismissed = dismissed.has(item.id);
    const task = created[item.id];
    const isAssigned = Boolean(task?.assignedTo);
    const isCompleted = Boolean(task && ["RESOLVED", "CLOSED"].includes(task.status));
    if (state === "OPEN" && isDismissed) return false;
    if (state === "CREATED" && !isCreated) return false;
    if (state === "NOT_CREATED" && (isCreated || isDismissed)) return false;
    if (state === "ASSIGNED" && (!isAssigned || isDismissed)) return false;
    if (state === "COMPLETED" && (!isCompleted || isDismissed)) return false;
    if (state === "DISMISSED" && !isDismissed) return false;
    if (!["ALL", "DISMISSED"].includes(state) && isDismissed) return false;
    if (priority !== "ALL" && item.priority !== priority) return false;
    if (department !== "ALL" && item.department !== department) return false;
    if (source !== "ALL" && item.source !== source) return false;
    if (unassignedOnly && (!isCreated || isAssigned)) return false;
    return true;
  });
  useEffect(() => {
    if (!request.key) return;
    setState(request.state || "ALL");
    setPriority(request.priority || "ALL");
    setDepartment(request.department || "ALL");
    setSource(request.source || "ALL");
    setUnassignedOnly(Boolean(request.unassigned));
    const queue = document.getElementById("operations-advisory");
    if (typeof queue?.scrollIntoView === "function") {
      queue.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [request]);
  useEffect(() => {
    const active = advisories.filter((item) => !dismissed.has(item.id));
    onCountsChange({
      open: active.length,
      created: active.filter((item) => Boolean(created[item.id] || item.createdTicket)).length,
      dismissed: dismissed.size,
      pending: active.filter((item) => Boolean(created[item.id] || item.createdTicket) && !created[item.id]?.assignedTo).length,
      critical: active.filter((item) => item.priority === "high").length,
    });
  }, [advisories, created, dismissed, onCountsChange]);
  const dismiss = (item: Advisory) => {
    setDismissTarget(null);
    toast.error(`Advisory dismissal is not connected. ${item.title} remains active.`);
  };
  const askAbout = (item: Advisory) => {
    window.dispatchEvent(new CustomEvent("laflo:open-assistant", { detail: {
      mode: "tasks-advisories",
      prompt: `Review the advisory \"${item.title}\" and recommend the next authorised operational action.`,
      context: { page: "Tasks & Advisories", advisoryId: item.id, title: item.title, source: item.source, department: item.department, priority: item.priority, rationale: item.reason },
    } }));
  };
  return (
    <section id="operations-advisory" className={`${card} overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="font-semibold text-text-main">Operations Advisory</h2>
          <p className="mt-1 text-xs text-text-muted">
            Actionable recommendations based on current operational indicators.
          </p>
          <div className="mt-2 flex gap-2">
            <span className="theme-chip rounded-full px-2 py-1 text-[9px] font-semibold text-primary-700">
              Updated {formatTime(context?.generatedAtUtc)}
            </span>
            <span className="theme-chip rounded-full px-2 py-1 text-[9px] font-semibold text-primary-700">
              {filtered.length} item{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-xl border border-border bg-bg p-1">
            {(
              ["ALL", "OPEN", "NOT_CREATED", "ASSIGNED", "CREATED", "DISMISSED", "COMPLETED"] as AdvisoryState[]
            ).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => { setState(item); setUnassignedOnly(false); }}
                aria-pressed={state === item}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${state === item ? "bg-primary-solid text-primary-contrast" : "text-text-muted"}`}
              >
                {item === "ALL"
                  ? "All"
                  : item === "NOT_CREATED"
                    ? "Not created"
                    : pretty(item)}
              </button>
            ))}
          </div>
          <select
            aria-label="Advisory priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="rounded-xl border border-border bg-card px-2.5 py-2 text-[10px] font-semibold text-text-main"
          >
            <option value="ALL">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select
            aria-label="Advisory source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="rounded-xl border border-border bg-card px-2.5 py-2 text-[10px] font-semibold text-text-main"
          >
            <option value="ALL">All sources</option>
            {[...new Set(advisories.map((item) => item.source))].map((item) => <option key={item} value={item}>{pretty(item)}</option>)}
          </select>
          <select
            aria-label="Advisory department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className="rounded-xl border border-border bg-card px-2.5 py-2 text-[10px] font-semibold text-text-main"
          >
            <option value="ALL">All departments</option>
            {departments.map((item) => (
              <option key={item} value={item}>
                {pretty(item)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {serviceBlocked ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <span>
            <strong>Task service is not connected.</strong> Connect the task
            service to create and assign operational tasks.
          </span>
          <Link
            to="/settings?tab=integrations"
            className="font-semibold underline underline-offset-2"
          >
            Open Integration Manager
          </Link>
        </div>
      ) : null}
      {unassignedOnly ? <div className="flex items-center justify-between border-b border-border bg-blue-50 px-4 py-2 text-xs text-blue-800"><span>Showing created tasks that still need an owner.</span><button type="button" onClick={() => setUnassignedOnly(false)} className="font-semibold underline">Clear</button></div> : null}
      <div className="divide-y divide-border">
        {filtered.map((item) => {
          const result = created[item.id];
          const isDismissed = dismissed.has(item.id);
          const status = isDismissed ? "Dismissed" : result && ["RESOLVED", "CLOSED"].includes(result.status) ? "Completed" : result?.assignedTo ? "Assigned" : result || item.createdTicket ? "Created" : "Open";
          return (
            <article
              key={item.id}
              className={`border-l-4 ${accentClass[item.priority] || accentClass.medium} px-4 py-3`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <span className={iconBox}>
                  {item.source === "PRICING" ? (
                    <CreditCard className="h-5 w-5" />
                  ) : item.department === "HOUSEKEEPING" ? (
                    <House className="h-5 w-5" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-main">
                      {item.title}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ring-1 ${priorityClass[item.priority] || priorityClass.medium}`}
                    >
                      {item.priority}
                    </span>
                    <span className="rounded-full bg-bg px-2 py-0.5 text-[9px] font-semibold text-text-muted ring-1 ring-border">
                      {status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                    {item.reason}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[9px]">
                    <span className="theme-chip rounded-full px-2 py-1 font-semibold text-primary-700">
                      {pretty(item.source)}
                    </span>
                    <span className="rounded-full bg-bg px-2 py-1 font-semibold text-text-muted ring-1 ring-border">
                      {pretty(item.department)}
                    </span>
                    <span className="text-text-muted">
                      Updated {formatTime(context?.generatedAtUtc)}
                    </span>
                    {result?.assignedTo ? (
                      <span className="text-text-muted">
                        Owner: {result.assignedTo.firstName}{" "}
                        {result.assignedTo.lastName}
                      </span>
                    ) : (
                      <span className="text-text-muted">
                        Suggested owner: {pretty(item.department)} team
                      </span>
                    )}
                  </div>
                  {result ? (
                    <Link
                      to={`/tickets/${result.ticketId}`}
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-primary-700"
                    >
                      Task {result.ticketId.slice(0, 8)}{" "}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 md:mr-28 xl:mr-0">
                  <button type="button" onClick={() => setDetailTarget(item)} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-text-main"><Eye className="h-3.5 w-3.5" />View details</button>
                  <button type="button" onClick={() => askAbout(item)} className="min-h-9 rounded-xl border border-primary-200 bg-primary-50 px-3 text-xs font-semibold text-primary-700">Ask LaFlo</button>
                  <button
                    type="button"
                    disabled={
                      !canManage ||
                      serviceBlocked ||
                      Boolean(result || item.createdTicket) || isDismissed
                    }
                    onClick={() => setCreateTarget(item)}
                    className="min-h-9 rounded-xl bg-primary-solid px-3 text-xs font-semibold text-primary-contrast disabled:opacity-50"
                  >
                    {result || item.createdTicket
                      ? "Task created"
                      : "Create task"}
                  </button>
                  <button
                    type="button"
                    disabled={!canManage || serviceBlocked || isDismissed}
                    onClick={() => setAssignTarget(item)}
                    className="min-h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-text-main disabled:opacity-50"
                  >
                    Assign
                  </button>
                  <button
                    type="button"
                    disabled={!canManage || isDismissed}
                    aria-label={`Dismiss ${item.title}`}
                    onClick={() => setDismissTarget(item)}
                    className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-text-muted disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {!filtered.length ? (
          <div className="p-8 text-center">
            <ClipboardList className="mx-auto h-6 w-6 text-text-muted" />
            <p className="mt-2 text-sm font-semibold text-text-main">
              {advisories.length
                ? "No advisories match the selected filters."
                : "No operational advisories available."}
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-text-muted">Try clearing filters, viewing all advisories, or asking LaFlo to identify operational priorities.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => {
                setState("ALL");
                setPriority("ALL");
                setDepartment("ALL");
                setSource("ALL");
                setUnassignedOnly(false);
              }} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-main">Clear filters</button><button type="button" onClick={() => { setState("ALL"); setPriority("ALL"); setDepartment("ALL"); setSource("ALL"); setUnassignedOnly(false); }} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-primary-700">View all advisories</button><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("laflo:open-assistant", { detail: { mode: "tasks-advisories", prompt: "Identify today’s highest operational priorities from the authorised tasks and advisories context.", context: { page: "Tasks & Advisories", state, priority, department, source } } }))} className="rounded-xl bg-primary-solid px-3 py-2 text-xs font-semibold text-primary-contrast">Ask LaFlo about priorities</button></div>
          </div>
        ) : null}
      </div>
      {!canManage ? (
        <div className="border-t border-border bg-amber-50 px-4 py-3 text-xs text-amber-800">
          You can review advisories, but task creation, assignment, and
          dismissal require operations management permission.
        </div>
      ) : null}
      {createTarget ? (
        <CreateTaskDialog
          advisory={createTarget}
          onClose={() => setCreateTarget(null)}
          onServiceBlocked={() => setServiceBlocked(true)}
          onCreated={(result) => {
            setCreated((current) => ({
              ...current,
              [createTarget.id]: result,
            }));
            setCreateTarget(null);
            queryClient.invalidateQueries({ queryKey: ["timeline"] });
          }}
        />
      ) : null}
      {assignTarget ? (
        <AssignDialog
          advisory={assignTarget}
          created={created[assignTarget.id]}
          onClose={() => setAssignTarget(null)}
        />
      ) : null}
      {dismissTarget ? (
        <DismissDialog
          advisory={dismissTarget}
          onCancel={() => setDismissTarget(null)}
          onConfirm={() => dismiss(dismissTarget)}
        />
      ) : null}
      {detailTarget ? <AdvisoryDetailDrawer advisory={detailTarget} task={created[detailTarget.id]} dismissed={dismissed.has(detailTarget.id)} onClose={() => setDetailTarget(null)} onAsk={() => askAbout(detailTarget)} /> : null}
    </section>
  );
}

function RecentActivity({ canViewTechnical }: { canViewTechnical: boolean }) {
  const [filters, setFilters] = useState<TimelineFilters>({
    limit: 24,
    time: "24h",
  });
  const query = useQuery({
    queryKey: ["timeline", "tasks-workspace", filters],
    queryFn: () => timelineService.list(filters),
    staleTime: 10_000,
  });
  const [showTechnical, setShowTechnical] = useState(false);
  const [selected, setSelected] = useState<TimelineEvent | null>(null);
  const allEvents = query.data?.events || [];
  const isTechnical = (event: TimelineEvent) => /enterprise.?search|system|index|rebuild|audit/i.test(`${event.module} ${event.eventType}`);
  const events = showTechnical ? allEvents.filter(isTechnical) : allEvents.filter((event) => !isTechnical(event));
  const friendlyTitle = (event: TimelineEvent) => {
    if (/search index updated/i.test(event.summary)) return "Search index updated";
    if (/audit recorded/i.test(event.summary) && /hotel.?brain/i.test(event.module)) return "AI recommendation recorded";
    return event.summary.replace(/^[a-z-]+:\s*/i, "");
  };
  const setFilter = <K extends keyof TimelineFilters>(
    key: K,
    value: TimelineFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value || undefined }));
  const clearFilters = () => {
    setFilters({ limit: 24, time: "24h" });
    setShowTechnical(false);
  };
  const refreshActivity = async () => {
    const result = await query.refetch();
    if (result.error) toast.error((result.error as Error).message || "Recent activity could not be refreshed");
    else toast.success("Recent activity refreshed");
  };
  return (
    <section className={`${card} overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="font-semibold text-text-main">Recent Activity</h2>
          <p className="mt-1 text-xs text-text-muted">
            Latest operational events from the platform Event Bus.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Activity module"
            value={showTechnical ? "SYSTEM_TECHNICAL" : filters.module || ""}
            onChange={(event) => { const value = event.target.value; setShowTechnical(value === "SYSTEM_TECHNICAL"); setFilter("module", value === "SYSTEM_TECHNICAL" ? undefined : value); }}
            className="rounded-xl border border-border bg-card px-2.5 py-2 text-[10px] text-text-main"
          >
            <option value="">All modules</option>
            {canViewTechnical ? (
              <option value="SYSTEM_TECHNICAL">System / Technical</option>
            ) : null}
            {query.data?.filters.modules.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="Activity severity"
            value={filters.severity || ""}
            onChange={(event) =>
              setFilter("severity", event.target.value as TimelineSeverity)
            }
            className="rounded-xl border border-border bg-card px-2.5 py-2 text-[10px] text-text-main"
          >
            <option value="">All severities</option>
            {query.data?.filters.severities.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="Activity department"
            value={filters.department || ""}
            onChange={(event) => setFilter("department", event.target.value)}
            className="rounded-xl border border-border bg-card px-2.5 py-2 text-[10px] text-text-main"
          >
            <option value="">All departments</option>
            {query.data?.filters.departments.map((item) => (
              <option key={item}>{pretty(item)}</option>
            ))}
          </select>
          <select
            aria-label="Activity time"
            value={filters.time || ""}
            onChange={(event) =>
              setFilter("time", event.target.value as TimelineFilters["time"])
            }
            className="rounded-xl border border-border bg-card px-2.5 py-2 text-[10px] text-text-main"
          >
            <option value="24h">Last 24 hours</option>
            <option value="1h">Last hour</option>
            <option value="7d">Last 7 days</option>
          </select>
          <button
            type="button"
            onClick={clearFilters}
            className="text-[10px] font-semibold text-primary-700"
          >
            Clear filters
          </button>
        </div>
      </div>
      <div className="max-h-[310px] overflow-y-auto">
        {query.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-12 animate-shimmer rounded-xl" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-8 text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-rose-500" />
            <p className="mt-2 text-sm font-semibold text-text-main">Recent activity could not be loaded.</p>
            <p className="mt-1 text-xs text-text-muted">The activity service may be temporarily unavailable. Your advisories are unaffected.</p>
            <button type="button" onClick={() => void refreshActivity()} disabled={query.isFetching} className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-xl bg-primary-solid px-4 text-xs font-semibold text-primary-contrast disabled:opacity-60">
              <RefreshCcw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> {query.isFetching ? "Refreshing…" : "Refresh activity"}
            </button>
          </div>
        ) : events.length ? (
          <div className="divide-y divide-border">
            {events.map((event: TimelineEvent) => (
              <button type="button" onClick={() => setSelected(event)}
                key={event.id}
                className="grid w-full gap-2 px-4 py-3 text-left hover:bg-primary-50 sm:grid-cols-[minmax(0,1fr)_120px_120px_110px] sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="theme-kpi-icon grid h-8 w-8 shrink-0 place-items-center rounded-xl">
                    <Activity className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-text-main">
                      {friendlyTitle(event)}
                    </p>
                    <p className="mt-0.5 text-[9px] text-text-muted">
                      {event.module}
                      {event.linkedEntity?.id
                        ? ` · ${event.linkedEntity.type} ${event.linkedEntity.id.slice(0, 8)}`
                        : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`w-fit rounded-full px-2 py-1 text-[9px] font-semibold ring-1 ${severityClass[event.severity]}`}
                >
                  {event.severity}
                </span>
                <span className="w-fit rounded-full bg-bg px-2 py-1 text-[9px] text-text-muted ring-1 ring-border">
                  {pretty(event.department)}
                </span>
                <time className="text-[10px] text-text-muted">
                  {formatTime(event.timestamp)}
                </time>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Activity className="mx-auto h-7 w-7 text-text-muted" />
            <p className="mt-2 text-sm font-semibold text-text-main">No recent activity matches these filters</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-text-muted">Try a wider time range, clear the current filters, or refresh to check for newly recorded operational events.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={clearFilters} className="min-h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-text-main">Clear filters</button>
              <button type="button" onClick={() => void refreshActivity()} disabled={query.isFetching} className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-primary-solid px-3 text-xs font-semibold text-primary-contrast disabled:opacity-60"><RefreshCcw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />{query.isFetching ? "Refreshing…" : "Refresh activity"}</button>
              {canViewTechnical ? <button type="button" onClick={() => { setFilters({ limit: 24, time: "24h" }); setShowTechnical(true); }} className="min-h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-primary-700">View system / technical activity</button> : null}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-center border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={() =>
            setFilters((current) => ({
              ...current,
              limit: current.limit === 100 ? 24 : 100,
            }))
          }
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700"
        >
          {filters.limit === 100 ? "Show recent activity" : "View all activity"}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {selected ? <div className="fixed inset-0 z-[90] flex justify-end bg-text-main/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-label="Activity details" className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">{selected.module}</p><h2 className="mt-1 text-xl font-semibold text-text-main">{friendlyTitle(selected)}</h2></div><button type="button" aria-label="Close activity details" onClick={() => setSelected(null)}><X className="h-4 w-4" /></button></div><div className="mt-5 divide-y divide-border rounded-xl border border-border"><DetailRow label="Severity" value={selected.severity} /><DetailRow label="Department" value={pretty(selected.department)} /><DetailRow label="Time" value={formatTime(selected.timestamp)} /><DetailRow label="Category" value={isTechnical(selected) ? "System / Technical" : "Operational"} /><DetailRow label="Related record" value={selected.linkedEntity?.id || "No related record available"} /></div>{selected.linkedEntity?.id ? <Link to={`/${selected.linkedEntity.type.toLowerCase()}/${selected.linkedEntity.id}`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-solid px-4 py-2 text-xs font-semibold text-primary-contrast">Open related record <ArrowRight className="h-3.5 w-3.5" /></Link> : null}</section></div> : null}
    </section>
  );
}

function ArrivalForecast({
  context,
  onRefresh,
  refreshing,
}: {
  context?: OperationsContext;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section role="button" tabIndex={0} onClick={() => setOpen(true)} onKeyDown={(event) => { if (event.key === "Enter") setOpen(true); }} className={`${card} cursor-pointer p-4 transition hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <span className={iconBox}>
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-text-main">Arrival Forecast</h2>
            <p className="mt-1 text-xs text-text-muted">
              Operational load next 24h
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onRefresh(); }}
          disabled={refreshing}
          aria-label="Refresh arrival forecast"
          className="grid h-9 w-9 place-items-center rounded-xl border border-border text-text-muted"
        >
          <RefreshCcw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>
      <div className="mt-5 grid grid-cols-3 divide-x divide-border text-center">
        {[
          ["Arrivals expected", context?.ops?.arrivalsNext24h || 0],
          ["Departures expected", context?.ops?.departuresNext24h || 0],
          ["In-house now", context?.ops?.inhouseNow || 0],
        ].map(([label, value]) => (
          <div key={label} className="px-2">
            <p className="text-[10px] text-text-muted">{label}</p>
            <p className="mt-2 text-xl font-bold text-text-main">{value}</p>
          </div>
        ))}
      </div>
      {open ? <div className="fixed inset-0 z-[90] flex justify-end bg-text-main/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section role="dialog" aria-modal="true" aria-label="Arrival forecast details" className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Tasks & Advisories</p><h2 className="mt-1 text-xl font-semibold text-text-main">Arrival Forecast</h2></div><button type="button" aria-label="Close arrival forecast" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div><div className="mt-5 divide-y divide-border rounded-xl border border-border"><DetailRow label="Arrivals expected" value={context?.ops?.arrivalsNext24h ?? "Unavailable"} /><DetailRow label="Departures expected" value={context?.ops?.departuresNext24h ?? "Unavailable"} /><DetailRow label="In-house now" value={context?.ops?.inhouseNow ?? "Unavailable"} /><DetailRow label="Source data" value={context?.ops ? "Authorised booking operations context" : "Booking source unavailable"} /><DetailRow label="Calculation window" value={context?.ops?.windowStartUtc && context?.ops?.windowEndUtc ? `${formatTime(context.ops.windowStartUtc)} – ${formatTime(context.ops.windowEndUtc)}` : "Next 24 hours"} /><DetailRow label="Last updated" value={formatTime(context?.generatedAtUtc)} /></div></section></div> : null}
    </section>
  );
}

function IntelligenceCard({
  name,
  icon: Icon,
  status,
  risk,
  priority,
  action,
}: {
  name: string;
  icon: typeof Activity;
  status: string;
  risk: string;
  priority: string;
  action: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article role="button" tabIndex={0} onClick={() => setOpen(true)} onKeyDown={(event) => { if (event.key === "Enter") setOpen(true); }} className={`${card} cursor-pointer p-4 transition hover:shadow-md`}>
      <div className="flex items-start gap-3">
        <span className={iconBox}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-text-main">
              {name} Intelligence
            </h3>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700 ring-1 ring-amber-200">
              {status}
            </span>
            <span className="theme-chip rounded-full px-2 py-0.5 text-[9px] font-semibold text-primary-700">
              Rules fallback
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 divide-x divide-border text-[10px]">
        <div className="pr-3">
          <p className="font-semibold text-text-main">Top priority</p>
          <p className="mt-2 leading-4 text-text-muted">{priority}</p>
        </div>
        <div className="px-3">
          <p className="font-semibold text-text-main">Top risk</p>
          <p className="mt-2 leading-4 text-text-muted">{risk}</p>
        </div>
        <div className="pl-3">
          <p className="font-semibold text-text-main">Recommended action</p>
          <p className="mt-2 leading-4 text-text-muted">{action}</p>
        </div>
      </div>
      <Link
        to={`/operations-center/ai?department=${encodeURIComponent(name)}#ai-recommendation-governance`}
        onClick={(event) => event.stopPropagation()}
        className="mt-4 flex items-center justify-center gap-1 border-t border-border pt-3 text-xs font-semibold text-primary-700"
      >
        Open AI Recommendations <ArrowRight className="h-3.5 w-3.5" />
      </Link>
      {open ? <div className="fixed inset-0 z-[90] flex justify-end bg-text-main/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section role="dialog" aria-modal="true" aria-label={`${name} Intelligence details`} className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Department Intelligence</p><h2 className="mt-1 text-xl font-semibold text-text-main">{name}</h2></div><button type="button" aria-label={`Close ${name} Intelligence`} onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div><div className="mt-5 divide-y divide-border rounded-xl border border-border"><DetailRow label="Status" value={status} /><DetailRow label="Top priority" value={priority || "No department intelligence available"} /><DetailRow label="Top risk" value={risk || "No department intelligence available"} /><DetailRow label="Recommended action" value={action || "No department intelligence available"} /><DetailRow label="Related advisories" value="Available in the operational advisory queue" /><DetailRow label="Related tasks" value="Open Tasks & Advisories filters to review" /><DetailRow label="Recent activity" value="Filtered operational Event Bus activity" /></div><Link to={`/operations-center/ai?department=${encodeURIComponent(name)}#ai-recommendation-governance`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-solid px-4 py-2 text-xs font-semibold text-primary-contrast">Open AI Recommendations <ArrowRight className="h-3.5 w-3.5" /></Link></section></div> : null}
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) { return <div className="grid grid-cols-[130px_1fr] gap-3 p-3 text-sm"><strong className="text-text-main">{label}</strong><span className="text-text-muted">{value}</span></div>; }

export default function TasksAdvisoriesWorkspace({
  context,
  isLoading,
  isError,
  isRefreshing,
  onRefresh,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canManage =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    (user?.modulePermissions || []).includes("maintenance_center");
  const privileged = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canViewHousekeeping = privileged || Boolean(user?.modulePermissions?.includes("housekeeping"));
  const canViewSecurity = privileged || Boolean(user?.modulePermissions?.includes("security_center"));
  const advisories = context?.advisories || [];
  const initialCreated = advisories.filter((item) => item.createdTicket).length;
  const [request, setRequest] = useState<AdvisoryRequest>({ key: 0 });
  const [counts, setCounts] = useState({ open: advisories.length, created: initialCreated, dismissed: 0, pending: advisories.length, critical: advisories.filter((item) => item.priority === "high").length });
  const updateCounts = useCallback((next: typeof counts) => setCounts(next), []);
  const requestView = (next: Omit<AdvisoryRequest, "key">) => setRequest((current) => ({ ...next, key: current.key + 1 }));
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const rawState = (params.get("state") || params.get("status") || "").toUpperCase();
    const view = params.get("view");
    const allowedStates: AdvisoryState[] = ["ALL", "OPEN", "NOT_CREATED", "ASSIGNED", "CREATED", "DISMISSED", "COMPLETED"];
    const state = allowedStates.includes(rawState as AdvisoryState)
      ? rawState as AdvisoryState
      : view === "recommended"
        ? "NOT_CREATED"
        : view === "priorities"
          ? "OPEN"
          : undefined;
    const priority = params.get("priority")?.toLowerCase();
    const department = params.get("department")?.toUpperCase();
    const source = params.get("source")?.toUpperCase();
    if (!state && !priority && !department && !source && params.get("unassigned") !== "true") return;
    setRequest((current) => ({ state, priority, department, source, unassigned: params.get("unassigned") === "true", key: current.key + 1 }));
  }, [location.search]);
  const handoff = useMemo<SearchTaskHandoff | undefined>(() => {
    const stateHandoff = location.state as SearchTaskHandoff | undefined;
    if (stateHandoff?.sourceSearchResult) return stateHandoff;
    if (new URLSearchParams(location.search).get("create") !== "1") return undefined;
    return {
      requestedAction: "create",
      sourceSearchResult: {
        id: "operations-center-manual-task",
        title: "New operational task",
        summary: "Create and assign a hotel operations task from the Operations Workspace.",
        category: "OPERATIONS",
        sourceModule: "OPERATIONS_CENTER",
      },
    };
  }, [location.search, location.state]);
  const consumeHandoff = useCallback(() => {
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, navigate]);
  const openAssistant = () => window.dispatchEvent(new CustomEvent("laflo:open-assistant", { detail: { mode: "tasks-advisories", prompt: "Summarise the highest-priority tasks and advisories and recommend the next operational action.", context: { page: "Tasks & Advisories", currentFilters: request, openAdvisories: counts.open, tasksCreated: counts.created, pendingAssignment: counts.pending, criticalItems: counts.critical, recentActivitySummary: "Operational Event Bus activity for the current authorised view", departmentIntelligenceSummary: { frontDesk: "Arrival coordination and readiness", housekeeping: canViewHousekeeping ? "Room-readiness follow-up" : "Restricted", security: canViewSecurity ? "Alert and incident follow-up" : "Restricted" } } } }));
  if (isLoading) return <TasksLoadingState />;
  if (isError)
    return (
      <div className={`${card} p-8 text-center`}>
        <AlertTriangle className="mx-auto h-7 w-7 text-rose-500" />
        <h2 className="mt-3 font-semibold text-text-main">
          Tasks and advisories could not be loaded.
        </h2>
        <p className="mt-1 text-sm text-text-muted">Please try again.</p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 rounded-xl bg-primary-solid px-4 py-2 text-sm font-semibold text-primary-contrast"
        >
          Try again
        </button>
      </div>
    );
  return (
    <div className="grid gap-4 pb-32 xl:grid-cols-[minmax(0,1fr)_420px]">
      <main className="min-w-0 space-y-4">
        <section
          aria-label="Tasks and advisories summary"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <SummaryCard
            icon={ShieldCheck}
            label="Open Advisories"
            value={counts.open}
            detail="Operational recommendations requiring review"
            onClick={() => requestView({ state: "OPEN" })}
          />
          <SummaryCard
            icon={ClipboardList}
            label="Tasks Created"
            value={counts.created}
            detail="Created from advisories"
            tone="good"
            onClick={() => requestView({ state: "CREATED" })}
          />
          <SummaryCard
            icon={UserRoundCheck}
            label="Pending Assignment"
            value={counts.pending}
            detail="Need owner assignment"
            tone="info"
            onClick={() => requestView({ state: "ALL", unassigned: true })}
          />
          <SummaryCard
            icon={Flag}
            label="Critical Items"
            value={counts.critical}
            detail="Requires urgent attention"
            tone="risk"
            onClick={() => requestView({ state: "ALL", priority: "high" })}
          />
        </section>
        <AdvisoryQueue context={context} canManage={canManage} request={request} handoff={handoff} onHandoffConsumed={consumeHandoff} onCountsChange={updateCounts} />
        <RecentActivity canViewTechnical={privileged} />
      </main>
      <aside className="space-y-3 pb-20">
        <ArrivalForecast
          context={context}
          onRefresh={onRefresh}
          refreshing={isRefreshing}
        />
        <IntelligenceCard
          name="Front Desk"
          icon={UsersRound}
          status={context?.ops?.arrivalsNext24h ? "Active" : "At risk"}
          priority={
            context?.ops?.arrivalsNext24h
              ? "Coordinate arrivals"
              : "No priority pressure"
          }
          risk="Payment or readiness issues"
          action="Run pre-shift huddle"
        />
        {canViewHousekeeping ? <IntelligenceCard
          name="Housekeeping"
          icon={House}
          status={
            advisories.some((item) => item.department === "HOUSEKEEPING")
              ? "Attention"
              : "Stable"
          }
          priority="Room readiness"
          risk="Out-of-service rooms"
          action="Prioritise checkout rooms"
        /> : null}
        {canViewSecurity ? <IntelligenceCard
          name="Security"
          icon={ShieldCheck}
          status="Stable"
          priority="Monitor alerts"
          risk="Unassigned incidents"
          action="Review open alerts"
        /> : null}
        <button type="button" onClick={openAssistant} className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-primary-700 shadow-card hover:bg-primary-50">Ask LaFlo about tasks</button>
      </aside>
    </div>
  );
}
