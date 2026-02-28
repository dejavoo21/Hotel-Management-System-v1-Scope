/**
 * AI Hooks Service - Backend-ready stubs for AI integration
 * 
 * These endpoints provide placeholder implementations that can be
 * connected to actual AI/LLM services (OpenAI, Anthropic, etc.)
 */

import { prisma } from '../config/database.js';
import type { WeatherContext } from './weatherContext.provider.js';

// Intent categories detected from messages
export type IntentCategory = 
  | 'BOOKING_REQUEST'
  | 'LATE_CHECKOUT'
  | 'ROOM_SERVICE'
  | 'HOUSEKEEPING'
  | 'MAINTENANCE'
  | 'COMPLAINT'
  | 'BILLING_INQUIRY'
  | 'GENERAL_INQUIRY'
  | 'COMPLIMENT'
  | 'UNKNOWN';

export interface DetectedIntent {
  category: IntentCategory;
  confidence: number;
  keywords: string[];
  suggestedCategory?: string;
  suggestedDepartment?: string;
  suggestedPriority?: string;
}

export interface SuggestedReply {
  id: string;
  text: string;
  type: 'quick_response' | 'template' | 'ai_generated';
  confidence: number;
}

export interface RecommendedAction {
  id: string;
  action: string;
  type: 'ASSIGN_HOUSEKEEPING' | 'ASSIGN_MAINTENANCE' | 'ESCALATE' | 'APPROVE_REQUEST' | 'CREATE_TASK' | 'SEND_TEMPLATE' | 'RESOLVE';
  description: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface AiRequestContext {
  weather?: WeatherContext | null;
  latestMessage?: string;
}

export type WeatherActionPriority = 'low' | 'medium' | 'high';
export type WeatherActionCategory =
  | 'Front Desk'
  | 'Concierge'
  | 'Housekeeping'
  | 'F&B'
  | 'Maintenance';

export interface WeatherOpsAction {
  title: string;
  reason: string;
  priority: WeatherActionPriority;
  category?: WeatherActionCategory;
}

export interface WeatherOpsActionsResult {
  actions: WeatherOpsAction[];
  generatedAtUtc: string;
}

export interface OpsContext {
  arrivalsNext24h: number;
  departuresNext24h: number;
  inhouseNow: number;
  windowStartUtc: string;
  windowEndUtc: string;
}

// Simple keyword-based intent detection (can be replaced with ML model)
const INTENT_KEYWORDS: Record<IntentCategory, string[]> = {
  BOOKING_REQUEST: ['book', 'reservation', 'reserve', 'available', 'availability', 'room for'],
  LATE_CHECKOUT: ['late checkout', 'late check-out', 'check out later', 'extend stay', 'stay longer'],
  ROOM_SERVICE: ['room service', 'order food', 'menu', 'breakfast', 'lunch', 'dinner', 'hungry'],
  HOUSEKEEPING: ['clean', 'cleaning', 'towels', 'sheets', 'dirty', 'housekeeping', 'maid', 'vacuum'],
  MAINTENANCE: ['broken', 'fix', 'repair', 'not working', 'leaking', 'ac', 'air conditioning', 'heater', 'light', 'bulb'],
  COMPLAINT: ['complaint', 'terrible', 'worst', 'awful', 'disappointed', 'unacceptable', 'manager', 'refund'],
  BILLING_INQUIRY: ['bill', 'charge', 'payment', 'invoice', 'receipt', 'price', 'cost', 'expensive'],
  GENERAL_INQUIRY: ['where', 'what time', 'how do', 'can you', 'please', 'help', 'information'],
  COMPLIMENT: ['thank', 'amazing', 'wonderful', 'great', 'excellent', 'appreciate', 'love'],
  UNKNOWN: [],
};

const DEPARTMENT_BY_INTENT: Record<IntentCategory, string> = {
  BOOKING_REQUEST: 'FRONT_DESK',
  LATE_CHECKOUT: 'FRONT_DESK',
  ROOM_SERVICE: 'CONCIERGE',
  HOUSEKEEPING: 'HOUSEKEEPING',
  MAINTENANCE: 'MAINTENANCE',
  COMPLAINT: 'MANAGEMENT',
  BILLING_INQUIRY: 'BILLING',
  GENERAL_INQUIRY: 'FRONT_DESK',
  COMPLIMENT: 'FRONT_DESK',
  UNKNOWN: 'FRONT_DESK',
};

const PRIORITY_BY_INTENT: Record<IntentCategory, string> = {
  BOOKING_REQUEST: 'MEDIUM',
  LATE_CHECKOUT: 'LOW',
  ROOM_SERVICE: 'MEDIUM',
  HOUSEKEEPING: 'MEDIUM',
  MAINTENANCE: 'HIGH',
  COMPLAINT: 'HIGH',
  BILLING_INQUIRY: 'MEDIUM',
  GENERAL_INQUIRY: 'LOW',
  COMPLIMENT: 'LOW',
  UNKNOWN: 'MEDIUM',
};

/**
 * Detect intent from a message
 */
export async function detectIntent(message: string): Promise<DetectedIntent> {
  const lowerMessage = message.toLowerCase();
  const foundKeywords: string[] = [];
  let bestMatch: IntentCategory = 'UNKNOWN';
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    const matched: string[] = [];
    
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        score += keyword.split(' ').length; // Multi-word matches score higher
        matched.push(keyword);
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = intent as IntentCategory;
      foundKeywords.length = 0;
      foundKeywords.push(...matched);
    }
  }

  const confidence = bestScore > 0 ? Math.min(0.95, 0.5 + (bestScore * 0.1)) : 0.3;

  return {
    category: bestMatch,
    confidence,
    keywords: foundKeywords,
    suggestedCategory: bestMatch === 'UNKNOWN' ? undefined : bestMatch.replace(/_/g, ' '),
    suggestedDepartment: DEPARTMENT_BY_INTENT[bestMatch],
    suggestedPriority: PRIORITY_BY_INTENT[bestMatch],
  };
}

/**
 * Get suggested replies based on intent and conversation context
 */
export async function getSuggestedReplies(
  conversationId: string,
  intent?: DetectedIntent,
  context?: AiRequestContext
): Promise<SuggestedReply[]> {
  const suggestions: SuggestedReply[] = [];

  // Default responses based on intent
  const intentResponses: Record<IntentCategory, string[]> = {
    BOOKING_REQUEST: [
      "I'd be happy to help you with a reservation. What dates are you looking at?",
      "Let me check our availability for you. How many guests will be staying?",
    ],
    LATE_CHECKOUT: [
      "I can arrange a late checkout for you. Would 2 PM work?",
      "Late checkout is available. There may be a small fee depending on the time.",
    ],
    ROOM_SERVICE: [
      "I'll send our room service menu to you right away.",
      "Room service is available 24/7. What would you like to order?",
    ],
    HOUSEKEEPING: [
      "I'll send housekeeping to your room shortly.",
      "Our housekeeping team will be there within 30 minutes.",
    ],
    MAINTENANCE: [
      "I apologize for the inconvenience. I'm dispatching maintenance immediately.",
      "We'll have this fixed as soon as possible. Is there anything else you need?",
    ],
    COMPLAINT: [
      "I sincerely apologize for this experience. Let me escalate this to our manager.",
      "I understand your frustration. We'll make this right.",
    ],
    BILLING_INQUIRY: [
      "Let me pull up your billing details right away.",
      "I can send a detailed invoice to your email. Would that help?",
    ],
    GENERAL_INQUIRY: [
      "I'd be happy to help! What would you like to know?",
      "Of course! Let me find that information for you.",
    ],
    COMPLIMENT: [
      "Thank you so much for the kind words! We're delighted you enjoyed your stay.",
      "Your feedback means a lot to our team. Thank you!",
    ],
    UNKNOWN: [
      "How may I assist you today?",
      "I'm here to help. Could you provide more details?",
    ],
  };

  const category = intent?.category || 'UNKNOWN';
  const responses = intentResponses[category] || intentResponses.UNKNOWN;

  const weather = context?.weather;
  const latestMessage = (context?.latestMessage || '').toLowerCase();
  const weatherRelevant =
    /\b(pool|outdoor|outside|tour|beach|walk|rain|weather|temperature|wind|transport)\b/.test(latestMessage);
  if (weather && weatherRelevant) {
    if (!weather.syncedAtUtc || weather.stale || !weather.isFresh) {
      const staleText =
        weather.staleHours != null
          ? ` (last synced ${weather.staleHours}h ago)`
          : '';
      suggestions.unshift({
        id: 'suggestion-weather-stale',
        text: `Weather data may be stale${staleText}. I can refresh the forecast before confirming outdoor plans.`,
        type: 'ai_generated',
        confidence: 0.9,
      });
    } else if (weather.next24h) {
      const summary = weather.next24h.summary || 'mixed conditions';
      const temp =
        weather.next24h.highC != null && weather.next24h.lowC != null
          ? ` (${weather.next24h.lowC}C to ${weather.next24h.highC}C)`
          : '';
      suggestions.unshift({
        id: 'suggestion-weather-context',
        text: `Current forecast suggests ${summary}${temp}. I can suggest indoor alternatives and the best outdoor timing.`,
        type: 'ai_generated',
        confidence: 0.92,
      });
    }
  }

  responses.forEach((text, index) => {
    suggestions.push({
      id: `suggestion-${category}-${index}`,
      text,
      type: 'template',
      confidence: intent?.confidence || 0.5,
    });
  });

  return suggestions;
}

/**
 * Get recommended actions based on conversation and ticket state
 */
export async function getRecommendedActions(
  conversationId: string,
  ticketId?: string,
  intent?: DetectedIntent,
  context?: AiRequestContext
): Promise<RecommendedAction[]> {
  const actions: RecommendedAction[] = [];
  const category = intent?.category || 'UNKNOWN';

  // Action recommendations based on intent
  switch (category) {
    case 'HOUSEKEEPING':
      actions.push({
        id: 'action-assign-housekeeping',
        action: 'Assign Housekeeping',
        type: 'ASSIGN_HOUSEKEEPING',
        description: 'Create a housekeeping task for this room',
        confidence: 0.85,
      });
      break;

    case 'MAINTENANCE':
      actions.push({
        id: 'action-assign-maintenance',
        action: 'Assign Maintenance',
        type: 'ASSIGN_MAINTENANCE',
        description: 'Create a maintenance work order',
        confidence: 0.9,
      });
      actions.push({
        id: 'action-escalate',
        action: 'Escalate to Manager',
        type: 'ESCALATE',
        description: 'Escalate this issue for immediate attention',
        confidence: 0.75,
      });
      break;

    case 'COMPLAINT':
      actions.push({
        id: 'action-escalate',
        action: 'Escalate to Manager',
        type: 'ESCALATE',
        description: 'Escalate complaint to management',
        confidence: 0.95,
      });
      break;

    case 'LATE_CHECKOUT':
      actions.push({
        id: 'action-approve-request',
        action: 'Approve Late Checkout',
        type: 'APPROVE_REQUEST',
        description: 'Approve the late checkout request',
        confidence: 0.8,
        metadata: { requestType: 'LATE_CHECKOUT' },
      });
      break;

    case 'ROOM_SERVICE':
      actions.push({
        id: 'action-create-task',
        action: 'Create Room Service Order',
        type: 'CREATE_TASK',
        description: 'Create a task for the kitchen/room service',
        confidence: 0.85,
      });
      break;

    default:
      actions.push({
        id: 'action-resolve',
        action: 'Mark as Resolved',
        type: 'RESOLVE',
        description: 'Resolve this ticket if the issue is addressed',
        confidence: 0.5,
      });
  }

  // Always suggest resolve for completed conversations
  if (ticketId) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (ticket && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
      actions.push({
        id: 'action-resolve',
        action: 'Resolve Ticket',
        type: 'RESOLVE',
        description: 'Mark this ticket as resolved',
        confidence: 0.4,
      });
    }
  }

  const weather = context?.weather;
  const latestMessage = (context?.latestMessage || '').toLowerCase();
  const weatherRelevant =
    /\b(pool|outdoor|outside|tour|beach|walk|rain|weather|temperature|wind|transport)\b/.test(latestMessage);
  if (weather && weatherRelevant && weather.next24h) {
    actions.push({
      id: 'action-send-weather-advice',
      action: 'Send Weather Advisory',
      type: 'SEND_TEMPLATE',
      description: weather.isFresh
        ? 'Share weather-aware alternatives and recommended activity timing.'
        : 'Refresh weather first, then send updated activity advice.',
      confidence: weather.isFresh ? 0.82 : 0.9,
      metadata: {
        weatherSyncedAtUtc: weather.syncedAtUtc,
        weatherFresh: weather.isFresh,
        weatherStale: weather.stale,
        weatherStaleHours: weather.staleHours,
        weatherSummary: weather.next24h.summary,
        rainRisk: weather.next24h.rainRisk,
      },
    });
  }

  return actions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Log AI interaction for analytics
 */
export async function logAiInteraction(
  type: 'INTENT_DETECTION' | 'SUGGESTED_REPLY' | 'RECOMMENDED_ACTION' | 'WEATHER_ACTIONS',
  input: string,
  output: any,
  userId: string
): Promise<void> {
  await prisma.activityLog.create({
    data: {
      userId,
      entity: 'AI_HOOK',
      entityId: type,
      action: type,
      details: {
        input: input.substring(0, 500), // Truncate for storage
        output,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

function clampText(value: string, maxLen: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function pushWeatherAction(
  list: WeatherOpsAction[],
  title: string,
  reason: string,
  priority: WeatherActionPriority,
  category?: WeatherActionCategory
) {
  const exists = list.some((item) => item.title.toLowerCase() === title.toLowerCase());
  if (exists) return;
  list.push({
    title: clampText(title, 60),
    reason: clampText(reason, 120),
    priority,
    category,
  });
}

export async function getOpsContextForHotel(hotelId: string): Promise<OpsContext> {
  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [arrivalsNext24h, departuresNext24h, inhouseNow] = await Promise.all([
    prisma.booking.count({
      where: {
        hotelId,
        status: 'CONFIRMED',
        checkInDate: { gte: now, lt: next24h },
      },
    }),
    prisma.booking.count({
      where: {
        hotelId,
        status: 'CHECKED_IN',
        checkOutDate: { gte: now, lt: next24h },
      },
    }),
    prisma.booking.count({
      where: {
        hotelId,
        status: 'CHECKED_IN',
        actualCheckIn: { not: null },
        actualCheckOut: null,
      },
    }),
  ]);

  return {
    arrivalsNext24h,
    departuresNext24h,
    inhouseNow,
    windowStartUtc: now.toISOString(),
    windowEndUtc: next24h.toISOString(),
  };
}

export async function getWeatherOpsActions(
  weather: WeatherContext | null,
  ops?: OpsContext
): Promise<WeatherOpsActionsResult> {
  const generatedAtUtc = new Date().toISOString();
  if (!weather || !weather.syncedAtUtc || !weather.next24h) {
    return { actions: [], generatedAtUtc };
  }

  const actions: WeatherOpsAction[] = [];

  if (weather.stale || !weather.isFresh) {
    pushWeatherAction(
      actions,
      'Refresh weather forecast now',
      'Current weather context is stale and may reduce recommendation accuracy.',
      'high',
      'Front Desk'
    );
  }

  const summary = (weather.next24h.summary || '').toLowerCase();
  const rainRisk = weather.next24h.rainRisk;
  const high = weather.next24h.highC;
  const low = weather.next24h.lowC;

  if (rainRisk === 'high') {
    pushWeatherAction(
      actions,
      'Stage umbrellas at reception',
      'High rain risk expected; prepare staff and guest-facing supplies.',
      'high',
      'Front Desk'
    );
    pushWeatherAction(
      actions,
      'Prioritize indoor breakfast seating',
      'Wet weather may reduce outdoor seating demand during breakfast hours.',
      'medium',
      'F&B'
    );
  } else if (rainRisk === 'medium') {
    pushWeatherAction(
      actions,
      'Prepare rain contingency signage',
      'Moderate rain risk expected; direct guests toward indoor alternatives.',
      'medium',
      'Front Desk'
    );
  }

  if (summary.includes('storm') || summary.includes('thunder')) {
    pushWeatherAction(
      actions,
      'Issue weather safety advisory at check-in',
      'Storm conditions are possible; align front desk messaging.',
      'high',
      'Front Desk'
    );
  }

  if (summary.includes('wind')) {
    pushWeatherAction(
      actions,
      'Secure outdoor furniture and setup',
      'Windy conditions may impact terrace and poolside safety.',
      'medium',
      'Maintenance'
    );
  }

  if (typeof high === 'number' && high >= 32) {
    pushWeatherAction(
      actions,
      'Increase hydration station checks',
      `Hot conditions expected (up to ${high}C); prioritize water availability.`,
      'medium',
      'F&B'
    );
  }

  if (typeof low === 'number' && low <= 5) {
    pushWeatherAction(
      actions,
      'Prepare cold-weather arrival support',
      `Low temperatures expected (down to ${low}C); brief front desk team.`,
      'medium',
      'Front Desk'
    );
  }

  if (ops) {
    if (ops.arrivalsNext24h >= 20 && (rainRisk === 'high' || rainRisk === 'medium')) {
      pushWeatherAction(
        actions,
        'Add lobby arrival coverage for peak check-in',
        `High arrivals (${ops.arrivalsNext24h}) plus rain risk may slow front desk throughput.`,
        'high',
        'Front Desk'
      );
    }

    if (ops.departuresNext24h >= 15 && typeof low === 'number' && low <= 5) {
      pushWeatherAction(
        actions,
        'Coordinate early transport readiness',
        `High departures (${ops.departuresNext24h}) with cold conditions can impact outbound flow.`,
        'medium',
        'Concierge'
      );
    }

    if (ops.inhouseNow >= 40 && (summary.includes('storm') || summary.includes('wind'))) {
      pushWeatherAction(
        actions,
        'Pre-brief maintenance on weather-related calls',
        `High in-house load (${ops.inhouseNow}) may increase weather-driven service requests.`,
        'medium',
        'Maintenance'
      );
    }
  }

  if (actions.length === 0) {
    pushWeatherAction(
      actions,
      'Proceed with standard operations plan',
      'No weather disruptions detected in the current forecast window.',
      'low',
      'Front Desk'
    );
  }

  return {
    actions: actions.slice(0, 5),
    generatedAtUtc,
  };
}
