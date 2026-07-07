import { Role } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { buildHotelContext, type AIContextSection, type AIHotelContext } from '../context/index.js';
import { persistAIRecommendations } from '../recommendations/index.js';
import { recordAuditEvent } from '../../platform/audit/auditEngine.service.js';
import type {
  AICopilotAskOptions,
  AICopilotResponse,
  AICopilotSuggestedAction,
  AICopilotUser,
} from './aiCopilot.types.js';

const ALL_SECTIONS: AIContextSection[] = [
  'hotelProfile',
  'occupancy',
  'revenue',
  'weather',
  'bookings',
  'guests',
  'housekeeping',
  'maintenance',
  'security',
  'smartBuilding',
  'incidents',
  'tasks',
  'reviews',
  'messages',
  'financialSummary',
];

const SECTION_PERMISSIONS: Record<AIContextSection, string[]> = {
  hotelProfile: ['dashboard', 'settings'],
  occupancy: ['dashboard', 'bookings', 'rooms'],
  revenue: ['financials'],
  weather: ['dashboard', 'bookings'],
  bookings: ['bookings'],
  guests: ['guests', 'bookings'],
  housekeeping: ['housekeeping', 'rooms'],
  maintenance: ['maintenance_center'],
  security: ['security_center'],
  smartBuilding: ['smart_building'],
  incidents: ['incident_management', 'security_center', 'maintenance_center', 'smart_building'],
  tasks: ['dashboard', 'bookings', 'housekeeping', 'maintenance_center', 'security_center', 'smart_building', 'messages'],
  reviews: ['reviews'],
  messages: ['messages'],
  financialSummary: ['financials'],
  guest: ['guests'],
  room: ['rooms'],
  incident: ['incident_management'],
};

function hasPermission(user: AICopilotUser, section: AIContextSection) {
  if (user.role === Role.ADMIN || user.role === 'ADMIN') return true;
  const required = SECTION_PERMISSIONS[section] || [];
  return required.some((permission) => user.modulePermissions.includes(permission));
}

function allowedSectionsFor(user: AICopilotUser, requested?: AIContextSection[]) {
  const base = requested?.length ? requested : ALL_SECTIONS;
  return base.filter((section) => hasPermission(user, section));
}

async function resolveUser(userId: string, overrideUser?: AICopilotUser): Promise<AICopilotUser> {
  if (overrideUser) return overrideUser;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, modulePermissions: true, isActive: true },
  });
  if (!user || !user.isActive) throw new Error('User not found or inactive');
  return {
    id: user.id,
    role: user.role,
    modulePermissions: (user.modulePermissions || []) as string[],
  };
}

function countArray(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function numberValue(value: unknown, key: string) {
  if (!value || typeof value !== 'object') return 0;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'number' ? candidate : 0;
}

function sectionHasData(context: AIHotelContext, section: AIContextSection) {
  const value = (context as unknown as Record<string, unknown>)[section];
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function detectSafetyWarnings(question: string, allowedSections: AIContextSection[], requested?: AIContextSection[]) {
  const warnings: string[] = [];
  const q = question.toLowerCase();
  if (/(password|token|secret|2fa|two-factor|full card|card number|cvv|cid|raw payment)/.test(q)) {
    warnings.push('Sensitive credentials, secrets, 2FA values, and raw payment card data are never exposed.');
  }
  const denied = (requested || []).filter((section) => !allowedSections.includes(section));
  if (denied.length) {
    warnings.push(`Some requested context was omitted because this user lacks access: ${denied.join(', ')}.`);
  }
  return warnings;
}

function action(
  title: string,
  description: string,
  department: string,
  priority: AICopilotSuggestedAction['priority'],
  rationale: string,
  category = 'OPERATIONS',
  confidence = 0.78
): AICopilotSuggestedAction {
  return {
    title,
    description,
    department,
    priority,
    rationale,
    category,
    confidence,
    supportsRecommendation: true,
  };
}

function buildSignals(context: AIHotelContext) {
  const incidents = context.incidents || {};
  const maintenance = context.maintenance || {};
  const security = context.security || {};
  const smartBuilding = context.smartBuilding || {};
  const housekeeping = context.housekeeping || {};
  const occupancy = context.occupancy || {};
  const bookings = context.bookings || {};
  const messages = context.messages || {};
  const reviews = context.reviews || {};

  return {
    criticalIncidents: numberValue(incidents, 'criticalIncidents') || countArray((incidents as any).critical),
    activeIncidents: numberValue(incidents, 'activeIncidents') || countArray((incidents as any).active),
    openWorkOrders: numberValue(maintenance, 'openWorkOrders') || countArray((maintenance as any).openWorkOrders),
    urgentFaults: numberValue(maintenance, 'urgentFaults') || countArray((maintenance as any).urgentFaults),
    activeSecurityAlerts: numberValue(security, 'activeAlerts') || countArray((security as any).activeSecurityAlerts),
    devicesOffline: numberValue(smartBuilding, 'devicesOffline') || countArray((smartBuilding as any).devicesOffline),
    criticalSensors: numberValue(smartBuilding, 'criticalSensors') || countArray((smartBuilding as any).criticalSensors),
    dirtyRooms: numberValue(housekeeping, 'dirtyRooms'),
    inspectionRooms: numberValue(housekeeping, 'inspectionRooms'),
    arrivalsToday: numberValue(occupancy, 'arrivalsToday') || numberValue(bookings, 'arrivalsToday'),
    departuresToday: numberValue(occupancy, 'departuresToday') || numberValue(bookings, 'departuresToday'),
    inHouseGuests: numberValue(occupancy, 'currentInHouseGuests') || numberValue(occupancy, 'inHouseGuests'),
    openMessages: numberValue(messages, 'openConversations') || countArray((messages as any).openConversations),
    lowReviews: numberValue(reviews, 'lowRatings') || countArray((reviews as any).lowRatings),
  };
}

function answerFromQuestion(question: string, context: AIHotelContext, allowedSections: AIContextSection[]) {
  const q = question.toLowerCase();
  const signals = buildSignals(context);
  const actions: AICopilotSuggestedAction[] = [];
  const lines: string[] = [];

  if (q.includes('maintenance') || q.includes('urgent')) {
    lines.push(`Maintenance focus: ${signals.urgentFaults} urgent faults and ${signals.openWorkOrders} open work orders are visible in accessible context.`);
    if (signals.urgentFaults > 0 || signals.openWorkOrders > 0) {
      actions.push(action(
        'Review urgent maintenance queue',
        'Triage urgent faults and assign same-day ownership.',
        'MAINTENANCE',
        signals.urgentFaults > 0 ? 'HIGH' : 'MEDIUM',
        'Maintenance context contains open or urgent work.'
      ));
    }
  } else if (q.includes('security') || q.includes('risk')) {
    lines.push(`Security focus: ${signals.activeSecurityAlerts} active alerts, ${signals.criticalIncidents} critical incidents, and ${signals.devicesOffline} offline devices are visible.`);
    if (signals.activeSecurityAlerts > 0 || signals.devicesOffline > 0 || signals.criticalIncidents > 0) {
      actions.push(action(
        'Review active security exceptions',
        'Confirm alert ownership and verify affected cameras, doors, or access events.',
        'SECURITY',
        signals.criticalIncidents > 0 ? 'CRITICAL' : 'HIGH',
        'Security or smart building context indicates active risk.',
        'SECURITY'
      ));
    }
  } else if (q.includes('guest')) {
    lines.push(`Guest experience focus: ${signals.inHouseGuests} in-house guests, ${signals.openMessages} open conversations, and ${signals.lowReviews} low-review signals are visible.`);
    if (signals.openMessages > 0 || signals.lowReviews > 0) {
      actions.push(action(
        'Prioritize guest follow-up queue',
        'Review unresolved guest messages and low-review cases before service impact grows.',
        'GUEST_EXPERIENCE',
        'MEDIUM',
        'Guest context contains unresolved service signals.',
        'GUEST'
      ));
    }
  } else if (q.includes('reception') || q.includes('front desk') || q.includes('prepare')) {
    lines.push(`Reception focus: ${signals.arrivalsToday} arrivals, ${signals.departuresToday} departures, and ${signals.inHouseGuests} current in-house guests are visible.`);
    if (signals.arrivalsToday > 0 || signals.departuresToday > 0) {
      actions.push(action(
        'Prepare front desk shift brief',
        'Check arrivals, departures, payment exceptions, and room readiness before peak desk load.',
        'FRONT_DESK',
        'MEDIUM',
        'Arrival/departure context affects front desk workload.',
        'FRONT_DESK'
      ));
    }
  } else if (q.includes('housekeeping')) {
    lines.push(`Housekeeping focus: ${signals.dirtyRooms} dirty rooms and ${signals.inspectionRooms} inspection rooms are visible.`);
    if (signals.dirtyRooms > 0 || signals.inspectionRooms > 0) {
      actions.push(action(
        'Prioritize room readiness list',
        'Sequence dirty and inspection rooms against expected arrivals and departures.',
        'HOUSEKEEPING',
        'MEDIUM',
        'Housekeeping context indicates rooms needing readiness work.',
        'HOUSEKEEPING'
      ));
    }
  } else {
    lines.push(`Today needs attention across ${allowedSections.length} accessible context sections.`);
    lines.push(`Visible pressure points: ${signals.criticalIncidents} critical incidents, ${signals.openWorkOrders} open maintenance work orders, ${signals.activeSecurityAlerts} security alerts, ${signals.dirtyRooms} dirty rooms, and ${signals.arrivalsToday} arrivals.`);
    if (signals.criticalIncidents > 0 || signals.activeSecurityAlerts > 0 || signals.criticalSensors > 0) {
      actions.push(action(
        'Run manager exception review',
        'Review critical incidents, active alerts, and smart building exceptions before shift handover.',
        'MANAGEMENT',
        'HIGH',
        'Critical or active exception signals are present in accessible context.',
        'OPERATIONS'
      ));
    }
  }

  if (actions.length === 0) {
    actions.push(action(
      'Maintain shift watch',
      'No urgent exception was detected in accessible context; keep monitoring live activity and open queues.',
      'OPERATIONS',
      'LOW',
      'Accessible context did not indicate a high-risk exception.'
    ));
  }

  return {
    answer: `${lines.join(' ')} Recommendations are based only on context sections this user can access.`,
    confidence: Math.max(0.55, Math.min(0.9, 0.62 + allowedSections.length * 0.015)),
    suggestedActions: actions.slice(0, 3),
  };
}

export async function askCopilot(
  hotelId: string,
  userId: string,
  question: string,
  options: AICopilotAskOptions = {}
): Promise<AICopilotResponse> {
  const normalizedQuestion = question.trim();
  if (!normalizedQuestion) throw new Error('Question is required');

  const user = await resolveUser(userId, options.overrideUser);
  const allowedSections = allowedSectionsFor(user, options.contextScope);
  const safetyWarnings = detectSafetyWarnings(normalizedQuestion, allowedSections, options.contextScope);

  if (!options.skipAudit) {
    await recordAuditEvent({
      hotelId,
      actor: options.actor || { userId },
      action: 'AI_COPILOT_QUESTION_ASKED',
      entity: 'AI_COPILOT',
      entityId: userId,
      source: 'hotel-brain',
      details: {
        questionLength: normalizedQuestion.length,
        requestedScope: options.contextScope,
        allowedSections,
        linkedEntityType: options.linkedEntityType,
        linkedEntityId: options.linkedEntityId,
      },
    });
  }

  if (!allowedSections.length) {
    const response: AICopilotResponse = {
      answer: 'I cannot answer with hotel data because this user has no accessible operational context sections.',
      confidence: 0.2,
      citedContextSections: [],
      suggestedActions: [],
      safetyWarnings: [...safetyWarnings, 'No accessible context sections were available for this request.'],
      generatedAt: new Date().toISOString(),
    };
    return response;
  }

  const context = options.overrideContext || await buildHotelContext(hotelId, {
    sections: allowedSections,
    limit: 10,
  });
  const citedContextSections = allowedSections.filter((section) => sectionHasData(context, section));
  const generated = answerFromQuestion(normalizedQuestion, context, allowedSections);

  let createdRecommendationIds: string[] | undefined;
  if (options.saveAsRecommendation && generated.suggestedActions.length) {
    const saved = await persistAIRecommendations({
      hotelId,
      sourceType: 'AI_COPILOT',
      sourceId: `copilot:${userId}:${Buffer.from(normalizedQuestion).toString('base64url').slice(0, 48)}`,
      recommendations: generated.suggestedActions.map((item) => ({
        title: item.title,
        description: item.description,
        category: item.category,
        department: item.department,
        priority: item.priority,
        confidence: item.confidence,
        rationale: item.rationale,
      })),
      actor: options.actor || { userId },
    });
    createdRecommendationIds = saved.map((item) => item.id);

    if (!options.skipAudit) {
      await recordAuditEvent({
        hotelId,
        actor: options.actor || { userId },
        action: 'AI_COPILOT_RECOMMENDATION_CREATED',
        entity: 'AI_COPILOT',
        entityId: userId,
        source: 'hotel-brain',
        details: {
          recommendationIds: createdRecommendationIds,
          questionLength: normalizedQuestion.length,
        },
      });
    }
  }

  const response: AICopilotResponse = {
    answer: generated.answer,
    confidence: generated.confidence,
    citedContextSections,
    suggestedActions: generated.suggestedActions,
    safetyWarnings,
    generatedAt: new Date().toISOString(),
    createdRecommendationIds,
  };

  if (!options.skipAudit) {
    await recordAuditEvent({
      hotelId,
      actor: options.actor || { userId },
      action: 'AI_COPILOT_RESPONSE_GENERATED',
      entity: 'AI_COPILOT',
      entityId: userId,
      source: 'hotel-brain',
      details: {
        confidence: response.confidence,
        citedContextSections,
        suggestedActionCount: response.suggestedActions.length,
        safetyWarningCount: response.safetyWarnings.length,
      },
    });
  }

  return response;
}

export const AICopilotService = {
  askCopilot,
};
