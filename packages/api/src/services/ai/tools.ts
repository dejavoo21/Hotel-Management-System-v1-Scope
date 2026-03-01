import { prisma } from '../../config/database.js';
import { getOperationsContext } from '../operationsContext.service.js';
import { syncWeatherSignalsForHotel } from '../weatherSignal.service.js';
import { runPricingSnapshotJob } from '../pricingSnapshot.job.js';
import { Department, TicketPriority } from '@prisma/client';
import { pickAssigneeForDepartment } from '../opsAssignment.rules.js';

export const tools = [
  {
    type: 'function',
    name: 'get_operations_context',
    description: 'Fetch full operations and pricing context for a hotel.',
    parameters: {
      type: 'object',
      properties: {
        hotelId: { type: 'string' },
      },
      required: ['hotelId'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'refresh_weather',
    description: 'Sync weather signals for a hotel and return latest status.',
    parameters: {
      type: 'object',
      properties: {
        hotelId: { type: 'string' },
      },
      required: ['hotelId'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'run_pricing_snapshot',
    description: 'Generate/store pricing snapshots for a hotel.',
    parameters: {
      type: 'object',
      properties: {
        hotelId: { type: 'string' },
        daysAhead: { type: 'number', default: 30 },
        force: { type: 'boolean', default: false },
      },
      required: ['hotelId'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'create_ticket',
    description: 'Create an operations task ticket for staff follow-up.',
    parameters: {
      type: 'object',
      properties: {
        hotelId: { type: 'string' },
        subject: { type: 'string' },
        reason: { type: 'string' },
        department: {
          type: 'string',
          enum: ['FRONT_DESK', 'HOUSEKEEPING', 'MAINTENANCE', 'CONCIERGE', 'BILLING', 'MANAGEMENT'],
        },
        priority: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        },
        details: { type: 'object' },
      },
      required: ['hotelId', 'subject', 'department', 'priority'],
      additionalProperties: false,
    },
  },
] as const;

type ToolArgs = Record<string, unknown>;

function parseDepartment(value: unknown): Department {
  const normalized = String(value ?? '').trim().toUpperCase();
  switch (normalized) {
    case 'FRONT_DESK':
    case 'HOUSEKEEPING':
    case 'MAINTENANCE':
    case 'CONCIERGE':
    case 'BILLING':
    case 'MANAGEMENT':
      return normalized;
    default:
      return 'MANAGEMENT';
  }
}

function parsePriority(value: unknown): TicketPriority {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'LOW') return 'LOW';
  if (normalized === 'HIGH') return 'HIGH';
  if (normalized === 'URGENT') return 'URGENT';
  return 'MEDIUM';
}

export async function runTool(name: string, args: ToolArgs): Promise<unknown> {
  switch (name) {
    case 'get_operations_context': {
      const hotelId = String(args.hotelId ?? '');
      if (!hotelId) throw new Error('hotelId is required');
      return getOperationsContext(hotelId);
    }

    case 'refresh_weather': {
      const hotelId = String(args.hotelId ?? '');
      if (!hotelId) throw new Error('hotelId is required');
      const result = await syncWeatherSignalsForHotel(hotelId);
      return {
        hotelId,
        syncedAtUtc: result.syncedAtUtc.toISOString(),
        daysStored: result.daysStored,
        location: result.location,
      };
    }

    case 'run_pricing_snapshot': {
      const hotelId = String(args.hotelId ?? '');
      if (!hotelId) throw new Error('hotelId is required');
      return runPricingSnapshotJob({
        hotelId,
        daysAhead: Number(args.daysAhead ?? 30),
        force: Boolean(args.force),
      });
    }

    case 'create_ticket': {
      const hotelId = String(args.hotelId ?? '');
      const userId = String(args.__userId ?? '');
      const subject = String(args.subject ?? '').trim();
      const reason = String(args.reason ?? subject).trim();
      const details = (args.details ?? {}) as Record<string, unknown>;
      if (!hotelId || !userId || !subject) {
        throw new Error('hotelId, __userId, and subject are required');
      }

      const department = parseDepartment(args.department);
      const priority = parsePriority(args.priority);

      return prisma.$transaction(async (tx) => {
        const conversation = await tx.conversation.create({
          data: {
            hotelId,
            subject: subject.slice(0, 120),
            status: 'OPEN',
            lastMessageAt: new Date(),
          },
        });

        await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderType: 'SYSTEM',
            senderUserId: userId,
            body: reason.slice(0, 500),
          },
        });

        const ticket = await tx.ticket.create({
          data: {
            hotelId,
            conversationId: conversation.id,
            type: 'GENERAL_INQUIRY',
            category: 'OTHER',
            department,
            priority,
            status: 'OPEN',
            assignedToId: await pickAssigneeForDepartment({
              tx,
              hotelId,
              department,
            }),
            details: {
              source: 'OPS_ASSISTANT',
              ...details,
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
              conversationId: conversation.id,
              subject,
              reason,
              department,
              priority,
              ...details,
            },
          },
        });

        return {
          ticketId: ticket.id,
          conversationId: conversation.id,
          department: ticket.department,
          priority: ticket.priority,
          status: ticket.status,
          ticketUrl: `/tickets/${ticket.id}`,
        };
      });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
