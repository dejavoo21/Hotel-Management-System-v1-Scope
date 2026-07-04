import { buildHotelContext, type AIHotelContext } from '../context/index.js';
import { generateAIRecommendation } from '../ai.service.js';
import { persistAIRecommendations, type AIRecommendationSeed } from '../recommendations/index.js';
import { recordAuditEvent } from '../../platform/audit/auditEngine.service.js';
import type {
  DepartmentBriefing,
  DepartmentBriefingItem,
  DepartmentBriefingOptions,
  DepartmentIntelligenceDepartment,
  DepartmentRecommendedAction,
} from './departmentIntelligence.types.js';

const DEPARTMENTS: DepartmentIntelligenceDepartment[] = [
  'front-desk',
  'housekeeping',
  'maintenance',
  'security',
  'revenue',
  'guest-experience',
];

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) : [];
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function titleFrom(item: Record<string, unknown>, fallback: string): string {
  return text(item.title, text(item.bookingRef, text(item.incidentNumber, fallback)));
}

function pushItem(items: DepartmentBriefingItem[], item: DepartmentBriefingItem) {
  if (items.length < 6) items.push(item);
}

function pushAction(items: DepartmentRecommendedAction[], item: DepartmentRecommendedAction) {
  if (items.length < 6) items.push(item);
}

function statusFrom(high: number, medium: number): DepartmentBriefing['currentStatus'] {
  if (high >= 3) return 'CRITICAL';
  if (high > 0) return 'AT_RISK';
  if (medium >= 3) return 'BUSY';
  if (medium > 0) return 'WATCH';
  return 'STABLE';
}

function buildBase(
  department: DepartmentIntelligenceDepartment,
  context: AIHotelContext,
  status: DepartmentBriefing['currentStatus'],
  summary: string,
  workloadIndicators: DepartmentBriefing['workloadIndicators']
): DepartmentBriefing {
  return {
    department,
    summary,
    currentStatus: status,
    topRisks: [],
    topPriorities: [],
    recommendedActions: [],
    workloadIndicators,
    escalationItems: [],
    generatedAt: new Date().toISOString(),
    contextVersion: context.metadata.contextVersion,
    source: 'RULES',
    contextMetadata: context.metadata,
  };
}

function buildFrontDesk(context: AIHotelContext): DepartmentBriefing {
  const arrivals = list(context.bookings?.arrivals);
  const departures = list(context.bookings?.departures);
  const vipArrivals = arrivals.filter((arrival) => Boolean((arrival.guest as Record<string, unknown> | undefined)?.vipStatus));
  const unpaidInvoices = asNumber(context.revenue?.unpaidInvoices);
  const openMessages = asNumber(context.messages?.openConversations);
  const unreadMessages = asNumber(context.messages?.unreadSupportMessages);
  const briefing = buildBase('front-desk', context, statusFrom(unpaidInvoices + unreadMessages, arrivals.length + departures.length), `${arrivals.length} arrivals, ${departures.length} departures, and ${vipArrivals.length} VIP arrivals need front desk coordination today.`, {
    arrivalsToday: arrivals.length,
    departuresToday: departures.length,
    vipArrivals: vipArrivals.length,
    paymentIssues: unpaidInvoices,
    unresolvedGuestMessages: openMessages,
  });

  if (arrivals.length || departures.length) pushItem(briefing.topPriorities, { title: 'Manage arrival and departure flow', detail: `${arrivals.length} arrivals and ${departures.length} departures scheduled today.`, severity: arrivals.length + departures.length > 20 ? 'HIGH' : 'MEDIUM' });
  if (vipArrivals.length) pushItem(briefing.topPriorities, { title: 'Prepare VIP arrivals', detail: `${vipArrivals.length} VIP guest${vipArrivals.length === 1 ? '' : 's'} arriving today.`, severity: 'HIGH' });
  if (unpaidInvoices) pushItem(briefing.topRisks, { title: 'Payment issues before arrival/departure', detail: `${unpaidInvoices} unpaid or partially paid invoice${unpaidInvoices === 1 ? '' : 's'} need review.`, severity: 'HIGH' });
  if (openMessages || unreadMessages) pushItem(briefing.topRisks, { title: 'Unresolved guest messages', detail: `${openMessages} open conversations and ${unreadMessages} unread guest messages.`, severity: unreadMessages ? 'HIGH' : 'MEDIUM' });
  pushAction(briefing.recommendedActions, { title: 'Run front desk pre-shift huddle', detail: 'Review VIPs, room readiness, payment issues, and arrival timing.', priority: arrivals.length > 10 ? 'HIGH' : 'MEDIUM', ownerDepartment: 'FRONT_DESK', supportsTask: true });
  if (unpaidInvoices) pushItem(briefing.escalationItems, { title: 'Resolve payment exceptions', detail: 'Coordinate with billing before check-in/check-out pressure builds.', severity: 'HIGH' });
  return briefing;
}

function buildHousekeeping(context: AIHotelContext): DepartmentBriefing {
  const dirty = asNumber(context.housekeeping?.dirtyRooms);
  const inspection = asNumber(context.housekeeping?.inspectionRooms);
  const outOfService = asNumber(context.housekeeping?.outOfServiceRooms);
  const pendingTasks = list(context.housekeeping?.pendingHousekeepingTasks);
  const departures = list(context.bookings?.departures);
  const overdueTasks = list(context.tasks?.overdueTasks).filter((task) => text(task.department) === 'HOUSEKEEPING');
  const briefing = buildBase('housekeeping', context, statusFrom(dirty + overdueTasks.length, inspection + departures.length), `${dirty} dirty rooms, ${inspection} inspection rooms, and ${departures.length} departures shape housekeeping workload.`, {
    dirtyRooms: dirty,
    inspectionRooms: inspection,
    roomsDueCheckout: departures.length,
    overdueCleaningTasks: overdueTasks.length,
    pendingHousekeepingTasks: pendingTasks.length,
    outOfServiceRooms: outOfService,
  });
  if (dirty) pushItem(briefing.topPriorities, { title: 'Clean dirty rooms', detail: `${dirty} dirty room${dirty === 1 ? '' : 's'} need turnover.`, severity: dirty > 10 ? 'HIGH' : 'MEDIUM' });
  if (inspection) pushItem(briefing.topPriorities, { title: 'Release inspection rooms', detail: `${inspection} room${inspection === 1 ? '' : 's'} waiting for inspection.`, severity: 'MEDIUM' });
  if (departures.length) pushItem(briefing.topPriorities, { title: 'Plan checkout turns', detail: `${departures.length} rooms due checkout today.`, severity: departures.length > 10 ? 'HIGH' : 'MEDIUM' });
  if (overdueTasks.length) pushItem(briefing.topRisks, { title: 'Overdue housekeeping tasks', detail: `${overdueTasks.length} overdue housekeeping task${overdueTasks.length === 1 ? '' : 's'}.`, severity: 'HIGH' });
  if (outOfService) pushItem(briefing.topRisks, { title: 'Out-of-service rooms', detail: `${outOfService} room${outOfService === 1 ? '' : 's'} unavailable.`, severity: 'HIGH' });
  pushAction(briefing.recommendedActions, { title: 'Prioritize checkout and VIP rooms', detail: 'Sequence rooms by arrival time, VIP status, and inspection blockers.', priority: dirty + inspection > 10 ? 'HIGH' : 'MEDIUM', ownerDepartment: 'HOUSEKEEPING', supportsTask: true });
  return briefing;
}

function buildMaintenance(context: AIHotelContext): DepartmentBriefing {
  const openWorkOrders = list(context.maintenance?.openWorkOrders);
  const urgentFaults = list(context.maintenance?.urgentFaults);
  const overdueRepairs = list(context.maintenance?.overdueRepairs);
  const preventiveDue = list(context.maintenance?.preventiveMaintenanceDue);
  const iotGenerated = asNumber(context.tasks?.iotGenerated);
  const briefing = buildBase('maintenance', context, statusFrom(urgentFaults.length + overdueRepairs.length, openWorkOrders.length + preventiveDue.length), `${openWorkOrders.length} open work orders, ${urgentFaults.length} urgent faults, and ${overdueRepairs.length} overdue repairs are active.`, {
    urgentFaults: urgentFaults.length,
    openWorkOrders: openWorkOrders.length,
    overdueRepairs: overdueRepairs.length,
    preventiveMaintenanceDue: preventiveDue.length,
    iotGeneratedTasks: iotGenerated,
  });
  urgentFaults.slice(0, 3).forEach((fault) => pushItem(briefing.topRisks, { title: titleFrom(fault, 'Urgent fault'), detail: text(fault.location, text(fault.assetName, 'Urgent maintenance review required.')), severity: 'HIGH' }));
  if (overdueRepairs.length) pushItem(briefing.topRisks, { title: 'Overdue repairs', detail: `${overdueRepairs.length} repair${overdueRepairs.length === 1 ? '' : 's'} overdue or waiting on parts.`, severity: 'HIGH' });
  if (preventiveDue.length) pushItem(briefing.topPriorities, { title: 'Preventive maintenance due', detail: `${preventiveDue.length} schedule${preventiveDue.length === 1 ? '' : 's'} due now.`, severity: 'MEDIUM' });
  pushAction(briefing.recommendedActions, { title: 'Triage urgent and overdue maintenance', detail: 'Assign urgent faults first, then clear overdue repairs and preventive maintenance due today.', priority: urgentFaults.length ? 'HIGH' : 'MEDIUM', ownerDepartment: 'MAINTENANCE', supportsTask: true });
  return briefing;
}

function buildSecurity(context: AIHotelContext): DepartmentBriefing {
  const alerts = list(context.security?.activeSecurityAlerts);
  const accessEvents = list(context.security?.recentAccessEvents);
  const visitors = list(context.security?.visitorsCurrentlyOnsite);
  const unresolvedIncidents = list(context.security?.unresolvedIncidents);
  const doorAnomalies = list(context.smartBuilding?.doorForcedOpenEvents);
  const cctvIssues = list(context.smartBuilding?.cameraOfflineEvents);
  const briefing = buildBase('security', context, statusFrom(alerts.length + unresolvedIncidents.length + doorAnomalies.length, visitors.length + cctvIssues.length), `${alerts.length} active alerts, ${visitors.length} visitors onsite, and ${cctvIssues.length} CCTV/device issues need security oversight.`, {
    activeAlerts: alerts.length,
    visitorExceptions: visitors.length,
    doorAccessEvents: accessEvents.length,
    doorAccessAnomalies: doorAnomalies.length,
    cctvDeviceIssues: cctvIssues.length,
    activeIncidents: unresolvedIncidents.length,
  });
  alerts.slice(0, 3).forEach((alert) => pushItem(briefing.topRisks, { title: titleFrom(alert, 'Security alert'), detail: text(alert.location, 'Active security alert requires review.'), severity: text(alert.severity) === 'CRITICAL' ? 'CRITICAL' : 'HIGH' }));
  if (doorAnomalies.length) pushItem(briefing.topRisks, { title: 'Door/access anomalies', detail: `${doorAnomalies.length} forced/open door event${doorAnomalies.length === 1 ? '' : 's'} detected.`, severity: 'HIGH' });
  if (cctvIssues.length) pushItem(briefing.topPriorities, { title: 'CCTV/device inspection', detail: `${cctvIssues.length} camera feed${cctvIssues.length === 1 ? '' : 's'} offline.`, severity: 'MEDIUM' });
  pushAction(briefing.recommendedActions, { title: 'Review active alerts and access anomalies', detail: 'Prioritize forced door events, active alerts, and offline camera coverage gaps.', priority: alerts.length || doorAnomalies.length ? 'HIGH' : 'MEDIUM', ownerDepartment: 'SECURITY', supportsTask: true });
  return briefing;
}

function buildRevenue(context: AIHotelContext): DepartmentBriefing {
  const occupancy = asNumber(context.occupancy?.occupancyPercentage);
  const revenueToday = asNumber(context.revenue?.revenueToday);
  const revenue7 = asNumber(context.revenue?.revenueLast7Days);
  const outstanding = asNumber(context.financialSummary?.outstandingBalances);
  const cancellations = list(context.bookings?.cancellations);
  const noShows = list(context.bookings?.noShows);
  const signals = list(context.weather?.externalSignals);
  const briefing = buildBase('revenue', context, statusFrom(outstanding > 0 ? 1 : 0, cancellations.length + noShows.length), `Occupancy is ${occupancy}% with ${revenueToday} revenue today and ${revenue7} over the last 7 days.`, {
    occupancyPercentage: occupancy,
    revenueToday,
    revenueLast7Days: revenue7,
    outstandingBalances: outstanding,
    cancellations: cancellations.length,
    noShows: noShows.length,
    marketSignals: signals.length,
  });
  if (occupancy >= 85) pushItem(briefing.topPriorities, { title: 'Protect high-demand pricing', detail: `Occupancy is ${occupancy}%; review rates and restrictions.`, severity: 'HIGH' });
  if (occupancy <= 45) pushItem(briefing.topRisks, { title: 'Soft demand', detail: `Occupancy is ${occupancy}%; consider tactical offers and channel mix.`, severity: 'MEDIUM' });
  if (cancellations.length || noShows.length) pushItem(briefing.topRisks, { title: 'Cancellation/no-show pressure', detail: `${cancellations.length} cancellations and ${noShows.length} no-shows in the current context window.`, severity: 'MEDIUM' });
  if (outstanding) pushItem(briefing.topPriorities, { title: 'Collections opportunity', detail: `${outstanding} in outstanding balances.`, severity: 'MEDIUM' });
  pushAction(briefing.recommendedActions, { title: 'Review pricing and collections', detail: 'Check demand, weather/market signals, and outstanding balances before rate changes.', priority: occupancy >= 85 || occupancy <= 45 ? 'HIGH' : 'MEDIUM', ownerDepartment: 'MANAGEMENT', supportsTask: true });
  return briefing;
}

function buildGuestExperience(context: AIHotelContext): DepartmentBriefing {
  const lowReviews = list(context.reviews?.lowRatings);
  const openComplaints = list(context.guests?.guestsWithOpenIssues);
  const escalatedTickets = list(context.messages?.escalatedTickets);
  const slaBreaches = list(context.messages?.slaBreaches);
  const vipGuests = list(context.guests?.vipGuests);
  const unread = asNumber(context.messages?.unreadSupportMessages);
  const briefing = buildBase('guest-experience', context, statusFrom(lowReviews.length + escalatedTickets.length + slaBreaches.length, openComplaints.length + unread), `${openComplaints.length} guests have open issues, ${lowReviews.length} low reviews are in scope, and ${escalatedTickets.length} support tickets are escalated.`, {
    openComplaints: openComplaints.length,
    lowReviews: lowReviews.length,
    escalatedSupportConversations: escalatedTickets.length,
    slaBreaches: slaBreaches.length,
    vipGuests: vipGuests.length,
    unreadSupportMessages: unread,
  });
  if (lowReviews.length) pushItem(briefing.topRisks, { title: 'Low review follow-up', detail: `${lowReviews.length} low-rating review${lowReviews.length === 1 ? '' : 's'} need response.`, severity: 'HIGH' });
  if (escalatedTickets.length || slaBreaches.length) pushItem(briefing.topRisks, { title: 'Escalated support risk', detail: `${escalatedTickets.length} escalated tickets and ${slaBreaches.length} SLA breaches.`, severity: 'HIGH' });
  if (vipGuests.length) pushItem(briefing.topPriorities, { title: 'VIP guest needs', detail: `${vipGuests.length} VIP guest profile${vipGuests.length === 1 ? '' : 's'} should be reviewed.`, severity: 'MEDIUM' });
  pushAction(briefing.recommendedActions, { title: 'Close guest experience loops', detail: 'Prioritize low reviews, escalated conversations, and VIP needs.', priority: lowReviews.length || escalatedTickets.length ? 'HIGH' : 'MEDIUM', ownerDepartment: 'CONCIERGE', supportsTask: true });
  return briefing;
}

function buildRuleBasedDepartmentBriefing(department: DepartmentIntelligenceDepartment, context: AIHotelContext): DepartmentBriefing {
  switch (department) {
    case 'front-desk':
      return buildFrontDesk(context);
    case 'housekeeping':
      return buildHousekeeping(context);
    case 'maintenance':
      return buildMaintenance(context);
    case 'security':
      return buildSecurity(context);
    case 'revenue':
      return buildRevenue(context);
    case 'guest-experience':
      return buildGuestExperience(context);
    default:
      return buildBase(department, context, 'STABLE', 'No department intelligence is available for this department.', {});
  }
}

function normalizeDepartment(value: string): DepartmentIntelligenceDepartment {
  const normalized = value.toLowerCase().replace(/_/g, '-').trim() as DepartmentIntelligenceDepartment;
  if (!DEPARTMENTS.includes(normalized)) {
    throw new Error(`Unsupported department: ${value}`);
  }
  return normalized;
}

function extractJson(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] || trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeItems(value: unknown): DepartmentBriefingItem[] {
  return list(value).slice(0, 6).map((item) => ({
    title: text(item.title, 'Department item'),
    detail: text(item.detail, text(item.description, 'No detail provided.')),
    severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(item.severity)) ? item.severity as DepartmentBriefingItem['severity'] : undefined,
  }));
}

function normalizeActions(value: unknown, fallbackDepartment: string): DepartmentRecommendedAction[] {
  return list(value).slice(0, 6).map((item) => ({
    title: text(item.title, 'Recommended action'),
    detail: text(item.detail, text(item.rationale, 'Recommended from department context.')),
    priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(item.priority)) ? item.priority as DepartmentRecommendedAction['priority'] : 'MEDIUM',
    ownerDepartment: text(item.ownerDepartment, fallbackDepartment),
    supportsTask: item.supportsTask !== false,
  }));
}

function mergeAiBriefing(ai: Record<string, unknown>, fallback: DepartmentBriefing, context: AIHotelContext): DepartmentBriefing {
  const status = String(ai.currentStatus);
  return {
    ...fallback,
    summary: text(ai.summary, fallback.summary),
    currentStatus: ['STABLE', 'WATCH', 'BUSY', 'AT_RISK', 'CRITICAL'].includes(status) ? status as DepartmentBriefing['currentStatus'] : fallback.currentStatus,
    topRisks: normalizeItems(ai.topRisks).length ? normalizeItems(ai.topRisks) : fallback.topRisks,
    topPriorities: normalizeItems(ai.topPriorities).length ? normalizeItems(ai.topPriorities) : fallback.topPriorities,
    recommendedActions: normalizeActions(ai.recommendedActions, fallback.department).length ? normalizeActions(ai.recommendedActions, fallback.department) : fallback.recommendedActions,
    escalationItems: normalizeItems(ai.escalationItems).length ? normalizeItems(ai.escalationItems) : fallback.escalationItems,
    generatedAt: new Date().toISOString(),
    contextVersion: context.metadata.contextVersion,
    source: 'AI',
    contextMetadata: context.metadata,
  };
}

function departmentActionsToRecommendations(briefing: DepartmentBriefing): AIRecommendationSeed[] {
  return briefing.recommendedActions.slice(0, 10).map((action) => ({
    title: action.title,
    description: action.detail,
    category: 'Department Intelligence',
    department: action.ownerDepartment || briefing.department,
    priority: action.priority,
    confidence: briefing.source === 'AI' ? 0.8 : 0.68,
    rationale: action.detail,
  }));
}

async function generateAiDepartmentBriefing(context: AIHotelContext, fallback: DepartmentBriefing): Promise<DepartmentBriefing> {
  const result = await generateAIRecommendation({
    hotelId: context.metadata.hotelId,
    userId: 'system',
    context,
    temperature: 0.1,
    systemPrompt: [
      'You generate concise department-specific hotel intelligence briefings.',
      'Use only the supplied structured hotel context.',
      'Return valid JSON only. Do not include markdown.',
      'Do not include secrets, raw card data, password hashes, tokens, or 2FA data.',
    ].join('\n'),
    prompt: [
      `Generate a ${fallback.department} briefing with this exact JSON shape:`,
      '{ "summary": string, "currentStatus": "STABLE|WATCH|BUSY|AT_RISK|CRITICAL",',
      '"topRisks": [{"title": string, "detail": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL"}],',
      '"topPriorities": [{"title": string, "detail": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL"}],',
      '"recommendedActions": [{"title": string, "detail": string, "priority": "LOW|MEDIUM|HIGH|CRITICAL", "ownerDepartment": string, "supportsTask": boolean}],',
      '"escalationItems": [{"title": string, "detail": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL"}] }',
      'Keep it practical and short.',
    ].join('\n'),
  });
  const parsed = extractJson(result.content);
  return parsed ? mergeAiBriefing(parsed, fallback, context) : fallback;
}

export async function generateDepartmentBriefing(
  hotelId: string,
  departmentInput: string,
  options: DepartmentBriefingOptions = {}
): Promise<DepartmentBriefing> {
  const department = normalizeDepartment(departmentInput);
  const context = await buildHotelContext(hotelId, { limit: 10, ...options.contextOptions });
  const fallback = buildRuleBasedDepartmentBriefing(department, context);
  const briefing = options.forceRuleBased || !process.env.OPENAI_API_KEY || process.env.ASSISTANT_PROVIDER === 'none'
    ? fallback
    : await generateAiDepartmentBriefing(context, fallback).catch(() => fallback);

  await recordAuditEvent({
    hotelId,
    actor: options.actor,
    action: 'AI_DEPARTMENT_BRIEFING_GENERATED',
    entity: 'AI_DEPARTMENT_BRIEFING',
    entityId: department,
    source: 'hotel-brain',
    details: {
      department,
      source: briefing.source,
      currentStatus: briefing.currentStatus,
      contextVersion: briefing.contextVersion,
    },
    idempotencyKey: `ai-department-briefing:${hotelId}:${department}:${options.actor?.userId || 'system'}:${new Date().toISOString().slice(0, 10)}`,
  });

  await persistAIRecommendations({
    hotelId,
    sourceType: 'DEPARTMENT_INTELLIGENCE',
    sourceId: `${department}:${new Date(briefing.generatedAt).toISOString().slice(0, 10)}`,
    recommendations: departmentActionsToRecommendations(briefing),
    actor: options.actor,
  });

  return briefing;
}

export const DepartmentIntelligenceService = {
  generateDepartmentBriefing,
};
