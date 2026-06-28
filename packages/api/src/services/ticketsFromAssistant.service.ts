import { Department, TicketCategory, TicketPriority } from '@prisma/client';
import { prisma } from '../config/database.js';
import { pickAssigneeForDepartment } from './opsAssignment.rules.js';
import { createTask } from '../platform/tasks/taskEngine.service.js';

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

  const assignedToId = await prisma.$transaction((tx) =>
    pickAssigneeForDepartment({
      tx,
      hotelId,
      department,
    })
  );

  const task = await createTask({
    hotelId,
    title,
    description: reason || `Created from ${source}.`,
    category: categoryForDepartment(department),
    department,
    priority,
    assignedToId,
    details: {
      source,
      reason: reason ?? null,
      ...(details ?? {}),
    },
    actor: { userId },
    source: 'ai',
  });

  return {
    ticketId: task.id,
    conversationId: task.conversationId,
    ticketUrl: `/tickets/${task.id}`,
    department: task.department,
    priority: task.priority,
    status: task.status,
  };
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
