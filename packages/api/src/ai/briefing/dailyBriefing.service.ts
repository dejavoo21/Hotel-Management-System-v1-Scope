import { buildHotelContext, type AIHotelContext } from '../context/index.js';
import { generateAIRecommendation } from '../ai.service.js';
import { persistAIRecommendations, type AIRecommendationSeed } from '../recommendations/index.js';
import { recordAuditEvent } from '../../platform/audit/auditEngine.service.js';
import type {
  DailyBriefingItem,
  DailyBriefingOptions,
  DailyGMBriefing,
  DailyRecommendedAction,
} from './dailyBriefing.types.js';

const MAX_ITEMS = 6;

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

function firstText(item: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = text(item[key]);
    if (value) return value;
  }
  return fallback;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function pushItem(target: DailyBriefingItem[], item: DailyBriefingItem) {
  if (target.length < MAX_ITEMS) target.push(item);
}

function pushAction(target: DailyRecommendedAction[], action: DailyRecommendedAction) {
  if (target.length < MAX_ITEMS) target.push(action);
}

function calculateHealthScore(context: AIHotelContext): number {
  let score = 100;
  const criticalIncidents = list(context.incidents?.criticalIncidents).length;
  const activeIncidents = list(context.incidents?.activeIncidents).length;
  const securityAlerts = list(context.security?.activeSecurityAlerts).length;
  const offlineDevices = list(context.smartBuilding?.devicesOffline).length;
  const criticalSensors = list(context.smartBuilding?.criticalSensors).length;
  const urgentFaults = list(context.maintenance?.urgentFaults).length;
  const overdueRepairs = list(context.maintenance?.overdueRepairs).length;
  const overdueTasks = list(context.tasks?.overdueTasks).length;
  const lowReviews = list(context.reviews?.lowRatings).length;
  const slaBreaches = asNumber(context.messages?.slaBreaches);

  score -= criticalIncidents * 12;
  score -= activeIncidents * 4;
  score -= securityAlerts * 8;
  score -= offlineDevices * 3;
  score -= criticalSensors * 10;
  score -= urgentFaults * 7;
  score -= overdueRepairs * 5;
  score -= overdueTasks * 4;
  score -= lowReviews * 3;
  score -= slaBreaches * 5;

  return clampScore(score);
}

function buildExecutiveSummary(context: AIHotelContext, score: number): string {
  const hotelName = context.hotelProfile?.name || 'the hotel';
  const occupancy = asNumber(context.occupancy?.occupancyPercentage);
  const arrivals = asNumber(context.occupancy?.arrivalsToday);
  const departures = asNumber(context.occupancy?.departuresToday);
  const criticalIncidents = list(context.incidents?.criticalIncidents).length;
  const securityAlerts = list(context.security?.activeSecurityAlerts).length;
  const maintenance = list(context.maintenance?.urgentFaults).length + list(context.maintenance?.openWorkOrders).length;

  const posture = score >= 85 ? 'stable' : score >= 70 ? 'watch-list' : score >= 50 ? 'strained' : 'critical';
  return `${hotelName} is in a ${posture} operating posture with a health score of ${score}. Occupancy is ${occupancy}% with ${arrivals} arrivals and ${departures} departures today. Current focus areas: ${criticalIncidents} critical incidents, ${securityAlerts} active security alerts, and ${maintenance} maintenance items.`;
}

function buildRuleBasedBriefing(context: AIHotelContext): DailyGMBriefing {
  const hotelHealthScore = calculateHealthScore(context);
  const todayPriorities: DailyBriefingItem[] = [];
  const operationalRisks: DailyBriefingItem[] = [];
  const guestExperienceRisks: DailyBriefingItem[] = [];
  const revenueOpportunities: DailyBriefingItem[] = [];
  const weatherImpacts: DailyBriefingItem[] = [];
  const maintenanceConcerns: DailyBriefingItem[] = [];
  const securityConcerns: DailyBriefingItem[] = [];
  const smartBuildingConcerns: DailyBriefingItem[] = [];
  const staffingSuggestions: DailyBriefingItem[] = [];
  const recommendedActions: DailyRecommendedAction[] = [];

  const arrivals = asNumber(context.occupancy?.arrivalsToday);
  const departures = asNumber(context.occupancy?.departuresToday);
  const inHouse = asNumber(context.occupancy?.currentInHouseGuests);
  const occupancy = asNumber(context.occupancy?.occupancyPercentage);
  const overdueTasks = list(context.tasks?.overdueTasks);
  const highPriorityTasks = list(context.tasks?.highPriority);
  const criticalIncidents = list(context.incidents?.criticalIncidents);
  const activeIncidents = list(context.incidents?.activeIncidents);
  const urgentFaults = list(context.maintenance?.urgentFaults);
  const overdueRepairs = list(context.maintenance?.overdueRepairs);
  const securityAlerts = list(context.security?.activeSecurityAlerts);
  const visitors = asNumber(context.security?.visitorsCurrentlyOnsite);
  const offlineDevices = list(context.smartBuilding?.devicesOffline);
  const criticalSensors = list(context.smartBuilding?.criticalSensors);
  const openConversations = asNumber(context.messages?.openConversations);
  const escalatedTickets = asNumber(context.messages?.escalatedTickets);
  const revenueToday = asNumber(context.revenue?.revenueToday);
  const unpaidInvoices = asNumber(context.revenue?.unpaidInvoices);
  const outstandingInvoices = asNumber(context.revenue?.outstandingInvoices);
  const weatherSummary = text((context.weather?.currentWeather as Record<string, unknown> | undefined)?.summary)
    || text((context.weather?.forecast as Record<string, unknown> | undefined)?.summary);

  if (criticalIncidents.length) {
    pushItem(todayPriorities, {
      title: 'Resolve critical incidents',
      detail: `${criticalIncidents.length} critical incident${criticalIncidents.length === 1 ? '' : 's'} need GM visibility today.`,
      severity: 'CRITICAL',
      department: 'Management',
    });
    pushAction(recommendedActions, {
      title: 'Hold incident review standup',
      owner: 'General Manager',
      priority: 'CRITICAL',
      rationale: 'Critical incidents are the strongest drag on hotel health and guest confidence.',
    });
  }

  if (arrivals || departures) {
    pushItem(todayPriorities, {
      title: 'Coordinate arrival and departure flow',
      detail: `${arrivals} arrivals, ${departures} departures, and ${inHouse} guests currently in house.`,
      severity: arrivals + departures > 20 ? 'HIGH' : 'MEDIUM',
      department: 'Front Desk',
    });
  }

  if (overdueTasks.length || highPriorityTasks.length) {
    pushItem(todayPriorities, {
      title: 'Clear urgent task backlog',
      detail: `${overdueTasks.length} overdue and ${highPriorityTasks.length} high-priority tasks require follow-up.`,
      severity: overdueTasks.length ? 'HIGH' : 'MEDIUM',
      department: 'Operations',
    });
    pushAction(recommendedActions, {
      title: 'Assign owners for overdue tasks',
      owner: 'Operations Manager',
      priority: overdueTasks.length ? 'HIGH' : 'MEDIUM',
      rationale: 'Unowned operational tasks increase service and SLA risk.',
    });
  }

  if (occupancy >= 85) {
    pushItem(operationalRisks, {
      title: 'High occupancy pressure',
      detail: `Occupancy is ${occupancy}%; watch front desk, housekeeping, and breakfast capacity.`,
      severity: 'HIGH',
      department: 'Operations',
    });
    pushItem(staffingSuggestions, {
      title: 'Add peak-hour coverage',
      detail: 'Prioritize front desk and housekeeping coverage around arrivals, departures, and breakfast.',
      severity: 'MEDIUM',
      department: 'Operations',
    });
  }

  if (openConversations || escalatedTickets) {
    pushItem(guestExperienceRisks, {
      title: 'Support queue attention needed',
      detail: `${openConversations} open conversations and ${escalatedTickets} escalated tickets are active.`,
      severity: escalatedTickets ? 'HIGH' : 'MEDIUM',
      department: 'Guest Services',
    });
  }

  if (revenueToday || unpaidInvoices || outstandingInvoices) {
    pushItem(revenueOpportunities, {
      title: 'Review revenue and collections',
      detail: `Today revenue: ${revenueToday}. Unpaid invoices: ${unpaidInvoices}. Outstanding balance: ${outstandingInvoices}.`,
      severity: unpaidInvoices ? 'MEDIUM' : 'LOW',
      department: 'Finance',
    });
  }

  if (weatherSummary || list(context.weather?.weatherAlerts).length) {
    pushItem(weatherImpacts, {
      title: 'Weather-driven service planning',
      detail: weatherSummary || `${list(context.weather?.weatherAlerts).length} weather alert signals are available.`,
      severity: list(context.weather?.weatherAlerts).length ? 'HIGH' : 'MEDIUM',
      department: 'Operations',
    });
  }

  for (const fault of urgentFaults.slice(0, 3)) {
    pushItem(maintenanceConcerns, {
      title: firstText(fault, ['title', 'description'], 'Urgent maintenance fault'),
      detail: firstText(fault, ['description', 'location'], 'Urgent fault needs maintenance review.'),
      severity: 'HIGH',
      department: 'Maintenance',
    });
  }
  if (overdueRepairs.length) {
    pushItem(maintenanceConcerns, {
      title: 'Overdue repairs',
      detail: `${overdueRepairs.length} overdue repair${overdueRepairs.length === 1 ? '' : 's'} need action.`,
      severity: 'HIGH',
      department: 'Maintenance',
    });
  }

  for (const alert of securityAlerts.slice(0, 3)) {
    pushItem(securityConcerns, {
      title: firstText(alert, ['title', 'type'], 'Active security alert'),
      detail: firstText(alert, ['description', 'location', 'message'], 'Active security alert requires review.'),
      severity: 'HIGH',
      department: 'Security',
    });
  }
  if (visitors > 0) {
    pushItem(securityConcerns, {
      title: 'Visitor oversight',
      detail: `${visitors} visitor${visitors === 1 ? '' : 's'} currently onsite.`,
      severity: 'LOW',
      department: 'Security',
    });
  }

  if (criticalSensors.length) {
    pushItem(smartBuildingConcerns, {
      title: 'Critical sensor state',
      detail: `${criticalSensors.length} critical Smart Building sensor${criticalSensors.length === 1 ? '' : 's'} detected.`,
      severity: 'CRITICAL',
      department: 'Maintenance',
    });
  }
  if (offlineDevices.length) {
    pushItem(smartBuildingConcerns, {
      title: 'Offline Smart Building devices',
      detail: `${offlineDevices.length} device${offlineDevices.length === 1 ? '' : 's'} offline; verify device health and vendor connectivity.`,
      severity: 'MEDIUM',
      department: 'Security/IT',
    });
  }

  if (!recommendedActions.length) {
    pushAction(recommendedActions, {
      title: 'Run morning department huddle',
      owner: 'General Manager',
      priority: hotelHealthScore >= 80 ? 'MEDIUM' : 'HIGH',
      rationale: 'Align teams around arrivals, departures, maintenance, security, and guest service priorities.',
    });
  }

  if (!todayPriorities.length) {
    pushItem(todayPriorities, {
      title: 'Maintain standard operating rhythm',
      detail: 'No major operational blockers detected in the available context.',
      severity: 'LOW',
      department: 'Operations',
    });
  }

  const generatedAt = new Date().toISOString();
  return {
    hotelHealthScore,
    executiveSummary: buildExecutiveSummary(context, hotelHealthScore),
    todayPriorities,
    operationalRisks,
    guestExperienceRisks,
    revenueOpportunities,
    weatherImpacts,
    maintenanceConcerns,
    securityConcerns,
    smartBuildingConcerns,
    staffingSuggestions,
    recommendedActions,
    generatedAt,
    contextVersion: context.metadata.contextVersion,
    source: 'RULES',
    contextMetadata: context.metadata,
  };
}

function normalizeArray(value: unknown): DailyBriefingItem[] {
  return list(value).slice(0, MAX_ITEMS).map((item) => ({
    title: text(item.title, 'Briefing item'),
    detail: text(item.detail, text(item.description, 'No detail provided.')),
    severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(item.severity)) ? item.severity as DailyBriefingItem['severity'] : undefined,
    department: text(item.department) || undefined,
  }));
}

function normalizeActions(value: unknown): DailyRecommendedAction[] {
  return list(value).slice(0, MAX_ITEMS).map((item) => ({
    title: text(item.title, 'Recommended action'),
    owner: text(item.owner, 'Operations'),
    priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(item.priority)) ? item.priority as DailyRecommendedAction['priority'] : 'MEDIUM',
    rationale: text(item.rationale, text(item.detail, 'Recommended from hotel context.')),
  }));
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

function mergeAiBriefing(ai: Record<string, unknown>, fallback: DailyGMBriefing, context: AIHotelContext): DailyGMBriefing {
  return {
    hotelHealthScore: clampScore(asNumber(ai.hotelHealthScore, fallback.hotelHealthScore)),
    executiveSummary: text(ai.executiveSummary, fallback.executiveSummary),
    todayPriorities: normalizeArray(ai.todayPriorities).length ? normalizeArray(ai.todayPriorities) : fallback.todayPriorities,
    operationalRisks: normalizeArray(ai.operationalRisks).length ? normalizeArray(ai.operationalRisks) : fallback.operationalRisks,
    guestExperienceRisks: normalizeArray(ai.guestExperienceRisks).length ? normalizeArray(ai.guestExperienceRisks) : fallback.guestExperienceRisks,
    revenueOpportunities: normalizeArray(ai.revenueOpportunities).length ? normalizeArray(ai.revenueOpportunities) : fallback.revenueOpportunities,
    weatherImpacts: normalizeArray(ai.weatherImpacts).length ? normalizeArray(ai.weatherImpacts) : fallback.weatherImpacts,
    maintenanceConcerns: normalizeArray(ai.maintenanceConcerns).length ? normalizeArray(ai.maintenanceConcerns) : fallback.maintenanceConcerns,
    securityConcerns: normalizeArray(ai.securityConcerns).length ? normalizeArray(ai.securityConcerns) : fallback.securityConcerns,
    smartBuildingConcerns: normalizeArray(ai.smartBuildingConcerns).length ? normalizeArray(ai.smartBuildingConcerns) : fallback.smartBuildingConcerns,
    staffingSuggestions: normalizeArray(ai.staffingSuggestions).length ? normalizeArray(ai.staffingSuggestions) : fallback.staffingSuggestions,
    recommendedActions: normalizeActions(ai.recommendedActions).length ? normalizeActions(ai.recommendedActions) : fallback.recommendedActions,
    generatedAt: new Date().toISOString(),
    contextVersion: context.metadata.contextVersion,
    source: 'AI',
    contextMetadata: context.metadata,
  };
}

function departmentFromOwner(owner: string): string {
  const normalized = owner.toLowerCase();
  if (normalized.includes('housekeeping')) return 'Housekeeping';
  if (normalized.includes('maintenance')) return 'Maintenance';
  if (normalized.includes('security')) return 'Security';
  if (normalized.includes('revenue') || normalized.includes('finance')) return 'Revenue';
  if (normalized.includes('front') || normalized.includes('reception')) return 'Front Desk';
  if (normalized.includes('guest') || normalized.includes('concierge')) return 'Guest Experience';
  return 'Operations';
}

function dailyActionsToRecommendations(briefing: DailyGMBriefing): AIRecommendationSeed[] {
  return briefing.recommendedActions.slice(0, 10).map((action) => ({
    title: action.title,
    description: `${action.owner}: ${action.rationale}`,
    category: 'Daily GM Briefing',
    department: departmentFromOwner(action.owner),
    priority: action.priority,
    confidence: briefing.source === 'AI' ? 0.82 : 0.7,
    rationale: action.rationale,
  }));
}

async function generateAiBriefing(context: AIHotelContext, fallback: DailyGMBriefing): Promise<DailyGMBriefing> {
  const result = await generateAIRecommendation({
    hotelId: context.metadata.hotelId,
    userId: 'system',
    context,
    temperature: 0.1,
    systemPrompt: [
      'You generate concise daily general manager briefings for a hotel.',
      'Use only the supplied structured hotel context.',
      'Return valid JSON only. Do not include markdown.',
      'Do not include secrets, raw card data, password hashes, tokens, or 2FA data.',
    ].join('\n'),
    prompt: [
      'Create today\'s GM briefing with this exact JSON shape:',
      '{',
      '"hotelHealthScore": number,',
      '"executiveSummary": string,',
      '"todayPriorities": [{"title": string, "detail": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL", "department": string}],',
      '"operationalRisks": [{"title": string, "detail": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL", "department": string}],',
      '"guestExperienceRisks": [{"title": string, "detail": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL", "department": string}],',
      '"revenueOpportunities": [{"title": string, "detail": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL", "department": string}],',
      '"weatherImpacts": [{"title": string, "detail": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL", "department": string}],',
      '"maintenanceConcerns": [{"title": string, "detail": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL", "department": string}],',
      '"securityConcerns": [{"title": string, "detail": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL", "department": string}],',
      '"smartBuildingConcerns": [{"title": string, "detail": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL", "department": string}],',
      '"staffingSuggestions": [{"title": string, "detail": string, "severity": "LOW|MEDIUM|HIGH|CRITICAL", "department": string}],',
      '"recommendedActions": [{"title": string, "owner": string, "priority": "LOW|MEDIUM|HIGH|CRITICAL", "rationale": string}]',
      '}',
      'Keep it executive, practical, and short.',
    ].join('\n'),
  });

  const parsed = extractJson(result.content);
  return parsed ? mergeAiBriefing(parsed, fallback, context) : fallback;
}

export async function generateDailyGMBriefing(hotelId: string, options: DailyBriefingOptions = {}): Promise<DailyGMBriefing> {
  const context = await buildHotelContext(hotelId, {
    limit: 10,
    ...options.contextOptions,
  });
  const fallback = buildRuleBasedBriefing(context);
  const briefing = options.forceRuleBased || !process.env.OPENAI_API_KEY || process.env.ASSISTANT_PROVIDER === 'none'
    ? fallback
    : await generateAiBriefing(context, fallback).catch(() => fallback);

  await recordAuditEvent({
    hotelId,
    actor: options.actor,
    action: 'AI_DAILY_BRIEFING_GENERATED',
    entity: 'AI_DAILY_BRIEFING',
    entityId: hotelId,
    source: 'hotel-brain',
    details: {
      contextVersion: briefing.contextVersion,
      source: briefing.source,
      healthScore: briefing.hotelHealthScore,
      sectionsIncluded: context.metadata.sectionsIncluded,
    },
    idempotencyKey: `ai-daily-briefing:${hotelId}:${options.actor?.userId || 'system'}:${new Date().toISOString().slice(0, 10)}`,
  });

  await persistAIRecommendations({
    hotelId,
    sourceType: 'DAILY_GM_BRIEFING',
    sourceId: new Date(briefing.generatedAt).toISOString().slice(0, 10),
    recommendations: dailyActionsToRecommendations(briefing),
    actor: options.actor,
  });

  return briefing;
}

export const DailyBriefingService = {
  generateDailyGMBriefing,
};
