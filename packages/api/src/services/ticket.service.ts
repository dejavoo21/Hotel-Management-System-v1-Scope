/**
 * Ticket + SLA Service
 *
 * Provides ticket management functionality including:
 * - Auto-creation of tickets for conversations
 * - SLA policy application and deadline calculation
 * - Ticket classification based on keywords
 * - SLA escalation processing
 */

import { prisma } from '../config/database.js';
import {
  Ticket,
  TicketType,
  TicketStatus,
  TicketPriority,
  Department,
  TicketCategory,
  Prisma,
} from '@prisma/client';
import * as notificationService from './notification.service.js';

// ============================================
// Configuration & Constants
// ============================================

// SLA_JOB_SECRET must be set in environment for job authentication
export const SLA_JOB_SECRET = process.env.SLA_JOB_SECRET || '';

// Keyword classification rules for auto-categorization
const KEYWORD_RULES: Array<{
  keywords: string[];
  category: TicketCategory;
  department: Department;
  priority: TicketPriority;
}> = [
  // Urgent / Complaints
  {
    keywords: ['urgent', 'emergency', 'immediately', 'asap', 'critical'],
    category: 'COMPLAINT',
    department: 'MANAGEMENT',
    priority: 'URGENT',
  },
  {
    keywords: ['complaint', 'unhappy', 'disappointed', 'terrible', 'unacceptable', 'furious', 'angry'],
    category: 'COMPLAINT',
    department: 'MANAGEMENT',
    priority: 'HIGH',
  },
  // Billing
  {
    keywords: ['invoice', 'bill', 'charge', 'payment', 'refund', 'overcharge', 'receipt'],
    category: 'BILLING',
    department: 'BILLING',
    priority: 'MEDIUM',
  },
  // Housekeeping
  {
    keywords: ['clean', 'dirty', 'towel', 'sheet', 'housekeeping', 'maid', 'tidy', 'vacuum', 'trash', 'amenities'],
    category: 'HOUSEKEEPING',
    department: 'HOUSEKEEPING',
    priority: 'MEDIUM',
  },
  // Maintenance
  {
    keywords: ['broken', 'fix', 'repair', 'maintenance', 'leak', 'noise', 'ac', 'air conditioning', 'heating', 'plumbing', 'wifi', 'internet', 'tv', 'light'],
    category: 'MAINTENANCE',
    department: 'MAINTENANCE',
    priority: 'MEDIUM',
  },
  // Concierge
  {
    keywords: ['restaurant', 'reservation', 'taxi', 'cab', 'tour', 'recommend', 'direction', 'sightseeing', 'spa', 'gym'],
    category: 'CONCIERGE',
    department: 'CONCIERGE',
    priority: 'LOW',
  },
  // Room Service
  {
    keywords: ['food', 'room service', 'breakfast', 'lunch', 'dinner', 'menu', 'order', 'hungry'],
    category: 'ROOM_SERVICE',
    department: 'FRONT_DESK',
    priority: 'MEDIUM',
  },
  // Check-in/Check-out
  {
    keywords: ['check-in', 'checkin', 'check-out', 'checkout', 'early', 'late', 'arrival', 'departure', 'extend', 'extension'],
    category: 'CHECK_IN_OUT',
    department: 'FRONT_DESK',
    priority: 'MEDIUM',
  },
  // Booking
  {
    keywords: ['booking', 'reservation', 'cancel', 'modify', 'change', 'room type', 'upgrade', 'downgrade'],
    category: 'BOOKING',
    department: 'FRONT_DESK',
    priority: 'MEDIUM',
  },
];

// Default SLA times (in minutes) when no policy exists
const DEFAULT_SLA = {
  responseMinutes: 60,      // 1 hour response time
  resolutionMinutes: 480,   // 8 hours resolution time
};

// Escalation configuration (minutes without response triggers escalation)
const ESCALATION_LEVELS = [
  { level: 1, afterMinutes: 60, notifyRoles: ['MANAGER'] },   // Level 1: after 1 hour - notify department lead
  { level: 2, afterMinutes: 120, notifyRoles: ['MANAGER', 'ADMIN'] },  // Level 2: after 2 hours - notify ops manager
  { level: 3, afterMinutes: 240, notifyRoles: ['ADMIN'] },  // Level 3: after 4 hours - notify senior manager
];

// ============================================
// Core Ticket Functions
// ============================================

/**
 * Ensures a ticket exists for a conversation.
 * Creates one if it doesn't exist, returns existing one if it does.
 *
 * @param conversationId - The conversation to link the ticket to
 * @param actorUserId - Optional user ID for activity logging
 * @returns The ticket (created or existing)
 */
export async function ensureTicketForConversation(
  conversationId: string,
  actorUserId?: string
): Promise<Ticket> {
  // Check if ticket already exists
  const existing = await prisma.ticket.findUnique({
    where: { conversationId },
  });

  if (existing) {
    return existing;
  }

  // Fetch conversation with latest message for classification
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      booking: true,
    },
  });

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  // Combine message bodies for keyword analysis
  const messageText = conversation.messages
    .map(m => m.body)
    .join(' ')
    .toLowerCase();

  // Classify the ticket
  const classification = classifyTicket(conversation.subject || '', messageText);

  // Determine ticket type
  const ticketType: TicketType = conversation.booking ? 'BOOKING_RELATED' : 'GENERAL_INQUIRY';

  // Get SLA policy and calculate due dates
  const slaDueDates = await applySlaPolicy(conversation.hotelId, classification.category);

  // Create the ticket
  const ticket = await prisma.ticket.create({
    data: {
      hotelId: conversation.hotelId,
      conversationId,
      type: ticketType,
      category: classification.category,
      department: classification.department,
      priority: classification.priority,
      status: 'OPEN',
      responseDueAtUtc: slaDueDates.responseDueAtUtc,
      resolutionDueAtUtc: slaDueDates.resolutionDueAtUtc,
      escalatedLevel: 0,
    },
  });

  // Log activity
  if (actorUserId) {
    await prisma.activityLog.create({
      data: {
        userId: actorUserId,
        action: 'TICKET_CREATED',
        entity: 'ticket',
        entityId: ticket.id,
        details: {
          conversationId,
          category: classification.category,
          priority: classification.priority,
          department: classification.department,
        },
      },
    });
  }

  return ticket;
}

/**
 * Classifies a ticket based on subject and message content.
 *
 * @param subject - The conversation subject
 * @param messageText - Combined message text (lowercase)
 * @returns Classification with category, department, and priority
 */
export function classifyTicket(
  subject: string,
  messageText: string
): { category: TicketCategory; department: Department; priority: TicketPriority } {
  const text = `${subject} ${messageText}`.toLowerCase();

  // Check each rule in order (first match wins)
  for (const rule of KEYWORD_RULES) {
    const hasMatch = rule.keywords.some(keyword => text.includes(keyword));
    if (hasMatch) {
      return {
        category: rule.category,
        department: rule.department,
        priority: rule.priority,
      };
    }
  }

  // Default classification
  return {
    category: 'OTHER',
    department: 'FRONT_DESK',
    priority: 'MEDIUM',
  };
}

/**
 * Applies SLA policy to calculate response and resolution due dates.
 *
 * @param hotelId - The hotel ID to look up SLA policy
 * @param category - The ticket category
 * @returns Due dates for response and resolution
 */
export async function applySlaPolicy(
  hotelId: string,
  category: TicketCategory
): Promise<{ responseDueAtUtc: Date; resolutionDueAtUtc: Date }> {
  // Look for hotel-specific SLA policy
  const policy = await prisma.sLAPolicy.findFirst({
    where: {
      hotelId,
      category,
      isActive: true,
    },
  });

  const now = new Date();
  const responseMinutes = policy?.responseMinutes ?? DEFAULT_SLA.responseMinutes;
  const resolutionMinutes = policy?.resolutionMinutes ?? DEFAULT_SLA.resolutionMinutes;

  return {
    responseDueAtUtc: new Date(now.getTime() + responseMinutes * 60 * 1000),
    resolutionDueAtUtc: new Date(now.getTime() + resolutionMinutes * 60 * 1000),
  };
}

// ============================================
// SLA Escalation Functions
// ============================================

/**
 * Processes SLA escalations for all open tickets.
 * This is called by the cron job endpoint.
 *
 * @returns Summary of escalations processed
 */
export async function processSlaEscalations(): Promise<{
  processed: number;
  escalated: number;
  breached: number;
  errors: string[];
}> {
  const result = {
    processed: 0,
    escalated: 0,
    breached: 0,
    errors: [] as string[],
  };

  const now = new Date();

  // Find all open tickets that haven't been responded to
  const openTickets = await prisma.ticket.findMany({
    where: {
      status: { in: ['OPEN', 'PENDING'] },
      firstResponseAtUtc: null, // No response yet
    },
    include: {
      conversation: {
        include: {
          hotel: true,
        },
      },
    },
  });

  for (const ticket of openTickets) {
    result.processed++;

    try {
      const ticketAge = now.getTime() - ticket.createdAtUtc.getTime();
      const ticketAgeMinutes = ticketAge / (60 * 1000);

      // Check if response SLA is breached
      if (ticket.responseDueAtUtc && now > ticket.responseDueAtUtc) {
        // SLA breached - mark as breached
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: 'BREACHED',
          },
        });
        result.breached++;

        // Log SLA_BREACH to audit trail
        await prisma.activityLog.create({
          data: {
            userId: 'system',
            entity: 'TICKET',
            entityId: ticket.id,
            action: 'SLA_BREACH',
            details: {
              ticketId: ticket.id,
              conversationId: ticket.conversationId,
              category: ticket.category,
              responseDueAt: ticket.responseDueAtUtc?.toISOString(),
              breachedAt: now.toISOString(),
              delayMinutes: Math.round((now.getTime() - ticket.responseDueAtUtc.getTime()) / (60 * 1000)),
            },
          },
        });

        // Send notifications to managers about SLA breach
        try {
          await notificationService.notifySlaBreach(
            ticket.id,
            ticket.conversationId,
            ticket.hotelId,
            'response',
            ticket.category
          );
        } catch (notifError) {
          console.error('Failed to send breach notification:', notifError);
        }

        continue;
      }

      // Check escalation levels
      let shouldEscalate = false;
      let newLevel = ticket.escalatedLevel;

      for (const escalation of ESCALATION_LEVELS) {
        if (
          ticketAgeMinutes >= escalation.afterMinutes &&
          ticket.escalatedLevel < escalation.level
        ) {
          shouldEscalate = true;
          newLevel = escalation.level;
        }
      }

      if (shouldEscalate && newLevel > ticket.escalatedLevel) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            escalatedLevel: newLevel,
            lastEscalationAtUtc: now,
          },
        });
        result.escalated++;

        // Log ESCALATION_TRIGGERED to audit trail
        await prisma.activityLog.create({
          data: {
            userId: 'system',
            entity: 'TICKET',
            entityId: ticket.id,
            action: 'ESCALATION_TRIGGERED',
            details: {
              ticketId: ticket.id,
              conversationId: ticket.conversationId,
              category: ticket.category,
              previousLevel: ticket.escalatedLevel,
              newLevel,
              ticketAgeMinutes: Math.round(ticketAgeMinutes),
              escalatedAt: now.toISOString(),
            },
          },
        });

        // Try to read escalation steps from SLA policy in database
        let notifyRoles: string[] = ['MANAGER', 'ADMIN'];
        try {
          const slaPolicy = await prisma.sLAPolicy.findFirst({
            where: {
              category: ticket.category,
              department: ticket.department,
              isActive: true,
            },
          });
          if (slaPolicy?.escalationStepsJson) {
            const steps = slaPolicy.escalationStepsJson as Array<{ level: number; notifyRoles: string[] }>;
            const step = steps.find(s => s.level === newLevel);
            if (step?.notifyRoles) {
              notifyRoles = step.notifyRoles;
            }
          }
        } catch (policyError) {
          console.error('Failed to read SLA policy, using default escalation:', policyError);
        }

        // Fallback to hardcoded escalation levels if no policy found
        if (notifyRoles.length === 0) {
          const escalationStep = ESCALATION_LEVELS.find(e => e.level === newLevel);
          notifyRoles = escalationStep?.notifyRoles || ['MANAGER', 'ADMIN'];
        }

        try {
          await notificationService.notifyTicketEscalated(
            ticket.id,
            ticket.conversationId,
            ticket.hotelId,
            newLevel,
            ticket.category,
            notifyRoles
          );
        } catch (notifError) {
          console.error('Failed to send escalation notification:', notifError);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Ticket ${ticket.id}: ${errorMessage}`);
    }
  }

  return result;
}

// ============================================
// Ticket CRUD Functions
// ============================================

/**
 * Gets a ticket by ID.
 */
export async function getTicketById(id: string): Promise<Ticket | null> {
  return prisma.ticket.findUnique({
    where: { id },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          guest: true,
          booking: true,
        },
      },
      assignedTo: true,
    },
  });
}

/**
 * Gets a ticket by conversation ID.
 */
export async function getTicketByConversationId(conversationId: string): Promise<Ticket | null> {
  return prisma.ticket.findUnique({
    where: { conversationId },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          guest: true,
          booking: true,
        },
      },
      assignedTo: true,
    },
  });
}

/**
 * Lists tickets for a hotel with filters.
 */
export async function listTickets(
  hotelId: string,
  filters: {
    status?: TicketStatus;
    priority?: TicketPriority;
    department?: Department;
    category?: TicketCategory;
    assignedToId?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{
  data: Ticket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}> {
  const { status, priority, department, category, assignedToId, page = 1, limit = 20 } = filters;

  const where: Prisma.TicketWhereInput = {
    hotelId,
    ...(status && { status }),
    ...(priority && { priority }),
    ...(department && { department }),
    ...(category && { category }),
    ...(assignedToId && { assignedToId }),
  };

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        conversation: {
          include: {
            guest: true,
            booking: true,
          },
        },
        assignedTo: true,
      },
      orderBy: [
        { priority: 'desc' },
        { createdAtUtc: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    data: tickets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

/**
 * Updates a ticket.
 */
export async function updateTicket(
  id: string,
  data: {
    status?: TicketStatus;
    priority?: TicketPriority;
    department?: Department;
    category?: TicketCategory;
    assignedToId?: string | null;
  },
  actorUserId?: string
): Promise<Ticket> {
  const ticket = await prisma.ticket.update({
    where: { id },
    data: {
      ...data,
      // If status is being set to RESOLVED, record resolution time
      ...(data.status === 'RESOLVED' && { resolvedAtUtc: new Date() }),
    },
    include: {
      conversation: true,
      assignedTo: true,
    },
  });

  if (actorUserId) {
    await prisma.activityLog.create({
      data: {
        userId: actorUserId,
        action: 'TICKET_UPDATED',
        entity: 'ticket',
        entityId: ticket.id,
        details: data,
      },
    });
  }

  return ticket;
}

/**
 * Assigns a ticket to a user.
 */
export async function assignTicket(
  ticketId: string,
  assignedToId: string | null,
  actorUserId?: string
): Promise<Ticket> {
  return updateTicket(ticketId, { assignedToId }, actorUserId);
}

/**
 * Records first response on a ticket.
 */
export async function recordFirstResponse(
  ticketId: string,
  actorUserId?: string
): Promise<Ticket> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw new Error(`Ticket not found: ${ticketId}`);
  }

  // Only record if not already recorded
  if (ticket.firstResponseAtUtc) {
    return ticket;
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      firstResponseAtUtc: new Date(),
      status: 'IN_PROGRESS',
    },
  });

  if (actorUserId) {
    await prisma.activityLog.create({
      data: {
        userId: actorUserId,
        action: 'TICKET_FIRST_RESPONSE',
        entity: 'ticket',
        entityId: ticketId,
        details: {
          responseDueAtUtc: ticket.responseDueAtUtc,
          firstResponseAtUtc: updated.firstResponseAtUtc,
          withinSla: ticket.responseDueAtUtc
            ? updated.firstResponseAtUtc! <= ticket.responseDueAtUtc
            : true,
        },
      },
    });
  }

  return updated;
}

/**
 * Resolves a ticket.
 */
export async function resolveTicket(
  ticketId: string,
  actorUserId?: string
): Promise<Ticket> {
  return updateTicket(ticketId, { status: 'RESOLVED' }, actorUserId);
}

/**
 * Closes a ticket.
 */
export async function closeTicket(
  ticketId: string,
  actorUserId?: string
): Promise<Ticket> {
  return updateTicket(ticketId, { status: 'CLOSED' }, actorUserId);
}

// ============================================
// Backfill Function
// ============================================

/**
 * Backfills tickets for all existing conversations that don't have one.
 *
 * @returns Summary of backfill operation
 */
export async function backfillTicketsForConversations(): Promise<{
  total: number;
  created: number;
  skipped: number;
  errors: string[];
}> {
  const result = {
    total: 0,
    created: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // Find all conversations without tickets
  const conversations = await prisma.conversation.findMany({
    where: {
      ticket: null,
    },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      booking: true,
    },
  });

  result.total = conversations.length;

  for (const conversation of conversations) {
    try {
      await ensureTicketForConversation(conversation.id);
      result.created++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Conversation ${conversation.id}: ${errorMessage}`);
      result.skipped++;
    }
  }

  return result;
}
