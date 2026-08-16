import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  CreditCard,
  Flag,
  House,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UsersRound,
  Wrench,
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
type AdvisoryState = "ALL" | "NOT_CREATED" | "CREATED" | "DISMISSED";

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
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  detail: string;
  tone?: "primary" | "risk" | "good" | "info";
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
    <article className={`${card} flex min-h-24 items-center gap-3 p-4`}>
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
    </article>
  );
}

function TasksLoadingState() {
  return (
    <div className="space-y-4" aria-label="Loading tasks and advisories">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-24 animate-shimmer rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-[560px] animate-shimmer rounded-2xl" />
        <div className="h-[560px] animate-shimmer rounded-2xl" />
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
        meta: { generatedAtUtc: new Date().toISOString() },
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
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4"
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
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4"
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
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4"
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
          This will remove it from the active advisory queue but keep it in
          history.
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
            className="min-h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white"
          >
            Dismiss advisory
          </button>
        </div>
      </div>
    </div>
  );
}

function AdvisoryQueue({
  context,
  canManage,
}: {
  context?: OperationsContext;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const advisories = context?.advisories || [];
  const [state, setState] = useState<AdvisoryState>("ALL");
  const [priority, setPriority] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [created, setCreated] = useState<
    Record<string, CreateAdvisoryTicketResult>
  >(() =>
    Object.fromEntries(
      advisories
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
  const [dismissed, setDismissed] = useState(new Set<string>());
  const [createTarget, setCreateTarget] = useState<Advisory | null>(null);
  const [assignTarget, setAssignTarget] = useState<Advisory | null>(null);
  const [dismissTarget, setDismissTarget] = useState<Advisory | null>(null);
  const [serviceBlocked, setServiceBlocked] = useState(false);
  const departments = [
    ...new Set(advisories.map((item) => item.department).filter(Boolean)),
  ] as string[];
  const filtered = advisories.filter((item) => {
    const isCreated = Boolean(created[item.id] || item.createdTicket);
    const isDismissed = dismissed.has(item.id);
    if (state === "CREATED" && !isCreated) return false;
    if (state === "NOT_CREATED" && (isCreated || isDismissed)) return false;
    if (state === "DISMISSED" && !isDismissed) return false;
    if (state !== "DISMISSED" && isDismissed) return false;
    if (priority !== "ALL" && item.priority !== priority) return false;
    if (department !== "ALL" && item.department !== department) return false;
    return true;
  });
  const dismiss = (item: Advisory) => {
    setDismissed((current) => new Set(current).add(item.id));
    appendAuditLog({
      action: "Operations Advisory Dismissed",
      actorId: user?.id,
      actorName: user?.email || "Operations user",
      targetId: item.id,
      targetLabel: item.title,
      details: { source: item.source, department: item.department },
    });
    setDismissTarget(null);
    window.dispatchEvent(new Event("hotelos:timeline-event"));
    toast.success("Advisory moved to history");
  };
  return (
    <section className={`${card} overflow-hidden`}>
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
              ["ALL", "NOT_CREATED", "CREATED", "DISMISSED"] as AdvisoryState[]
            ).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setState(item)}
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
      <div className="divide-y divide-border">
        {filtered.map((item) => {
          const result = created[item.id];
          const status =
            result || item.createdTicket ? "Created" : "Not created";
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
                  <button
                    type="button"
                    disabled={
                      !canManage ||
                      serviceBlocked ||
                      Boolean(result || item.createdTicket)
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
                    disabled={!canManage || serviceBlocked}
                    onClick={() => setAssignTarget(item)}
                    className="min-h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-text-main disabled:opacity-50"
                  >
                    Assign
                  </button>
                  <button
                    type="button"
                    disabled={!canManage}
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
            <button
              type="button"
              onClick={() => {
                setState("ALL");
                setPriority("ALL");
                setDepartment("ALL");
              }}
              className="mt-3 text-xs font-semibold text-primary-700"
            >
              Clear filters
            </button>
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
    </section>
  );
}

function RecentActivity() {
  const [filters, setFilters] = useState<TimelineFilters>({
    limit: 24,
    time: "24h",
  });
  const query = useQuery({
    queryKey: ["timeline", "tasks-workspace", filters],
    queryFn: () => timelineService.list(filters),
    staleTime: 10_000,
  });
  const events = query.data?.events || [];
  const setFilter = <K extends keyof TimelineFilters>(
    key: K,
    value: TimelineFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value || undefined }));
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
            value={filters.module || ""}
            onChange={(event) => setFilter("module", event.target.value)}
            className="rounded-xl border border-border bg-card px-2.5 py-2 text-[10px] text-text-main"
          >
            <option value="">All modules</option>
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
            onClick={() => setFilters({ limit: 24, time: "24h" })}
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
          <div className="p-6 text-center text-sm text-rose-700">
            Recent activity could not be loaded.
          </div>
        ) : events.length ? (
          <div className="divide-y divide-border">
            {events.map((event: TimelineEvent) => (
              <div
                key={event.id}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_110px] sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="theme-kpi-icon grid h-8 w-8 shrink-0 place-items-center rounded-xl">
                    <Activity className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-text-main">
                      {event.summary}
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
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-text-muted">
            No operational events match these filters.
          </div>
        )}
      </div>
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
  return (
    <section className={`${card} p-4`}>
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
          onClick={onRefresh}
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
  return (
    <article className={`${card} p-4`}>
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
        to="/operations-center/ai#ai-recommendation-governance"
        className="mt-4 flex items-center justify-center gap-1 border-t border-border pt-3 text-xs font-semibold text-primary-700"
      >
        View in AI Governance <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

export default function TasksAdvisoriesWorkspace({
  context,
  isLoading,
  isError,
  isRefreshing,
  onRefresh,
}: Props) {
  const user = useAuthStore((state) => state.user);
  const canManage =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    (user?.modulePermissions || []).includes("maintenance_center");
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
  const advisories = context?.advisories || [];
  const created = advisories.filter((item) => item.createdTicket).length;
  const high = advisories.filter((item) => item.priority === "high").length;
  return (
    <div className="space-y-4 pb-20">
      <section
        aria-label="Tasks and advisories summary"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        <SummaryCard
          icon={ShieldCheck}
          label="Open Advisories"
          value={advisories.length}
          detail="Recommendations needing review"
        />
        <SummaryCard
          icon={ClipboardList}
          label="Tasks Created"
          value={created}
          detail="Created from advisories"
          tone="good"
        />
        <SummaryCard
          icon={Flag}
          label="High Priority"
          value={high}
          detail="Requires attention"
          tone="risk"
        />
        <SummaryCard
          icon={Activity}
          label="Recent Events"
          value={24}
          detail="Latest Event Bus window"
          tone="info"
        />
        <SummaryCard
          icon={UserRoundCheck}
          label="Unassigned Tasks"
          value={
            advisories.filter(
              (item) =>
                item.createdTicket && !("assignedTo" in item.createdTicket),
            ).length
          }
          detail="Need owner assignment"
        />
      </section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="min-w-0 space-y-4">
          <AdvisoryQueue context={context} canManage={canManage} />
          <RecentActivity />
        </main>
        <aside className="space-y-3">
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
          <IntelligenceCard
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
          />
          <IntelligenceCard
            name="Maintenance"
            icon={Wrench}
            status={
              advisories.some((item) => item.department === "MAINTENANCE")
                ? "Attention"
                : "Stable"
            }
            priority="Resolve active blockers"
            risk="Delayed response"
            action="Review maintenance queue"
          />
          <IntelligenceCard
            name="Security"
            icon={ShieldCheck}
            status="Stable"
            priority="Monitor alerts"
            risk="Unassigned incidents"
            action="Review open alerts"
          />
        </aside>
      </div>
    </div>
  );
}
