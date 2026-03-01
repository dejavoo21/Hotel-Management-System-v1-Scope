import { Department, TicketCategory, TicketPriority, TicketType } from '@prisma/client';
import { prisma } from '../config/database.js';
import { pickAssigneeForDepartment } from './opsAssignment.rules.js';

export type CreateAssistantTicketInput = {
  hotelId: string;
  userId: string;
  title: string;
  reason?: string;
  department: Department;
  priority: TicketPriority;
  source?: string;
  details?: Record<string, unknown> | null;
};

export async function createAssistantTicket(input: CreateAssistantTicketInput) {
  const {
    hotelId,
    userId,
    title,
    reason,
    department,
    priority,
    source = 'OPS_ASSISTANT',
    details = null,
  } = input;

  return prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        hotelId,
        subject: title.slice(0, 120),
        status: 'OPEN',
        lastMessageAt: new Date(),
      },
      select: { id: true },
    });

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'SYSTEM',
        senderUserId: userId,
        body: (reason || `Created from ${source}.`).slice(0, 500),
      },
    });

    const ticket = await tx.ticket.create({
      data: {
        hotelId,
        conversationId: conversation.id,
        type: TicketType.GENERAL_INQUIRY,
        category: categoryForDepartment(department),
        department,
        priority,
        status: 'OPEN',
        assignedToId: await pickAssigneeForDepartment({
          tx,
          hotelId,
          department,
        }),
        details: {
          source,
          reason: reason ?? null,
          ...(details ?? {}),
        },
      },
      select: {
        id: true,
        conversationId: true,
        department: true,
        priority: true,
        status: true,
      },
    });

    await tx.activityLog.create({
      data: {
        userId,
        entity: 'OPS_ASSISTANT',
        entityId: ticket.id,
        action: 'CREATE_TICKET',
        details: {
          source,
          title,
          reason: reason ?? null,
          department,
          priority,
          conversationId: conversation.id,
          ...(details ?? {}),
        },
      },
    });

    return {
      ticketId: ticket.id,
      conversationId: conversation.id,
      ticketUrl: `/tickets/${ticket.id}`,
      department: ticket.department,
      priority: ticket.priority,
      status: ticket.status,
    };
  });
}

function categoryForDepartment(department: Department): TicketCategory {
  switch (department) {
    case 'HOUSEKEEPING':
      return 'HOUSEKEEPING';
    case 'MAINTENANCE':
      return 'MAINTENANCE';
    case 'CONCIERGE':
      return 'CONCIERGE';
    case 'BILLING':
      return 'BILLING';
    case 'MANAGEMENT':
      return 'COMPLAINT';
    case 'FRONT_DESK':
    default:
      return 'OTHER';
  }
}

