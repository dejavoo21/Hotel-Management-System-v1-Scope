import { prisma } from '../../config/database.js';
import { getOperationsContext } from '../operationsContext.service.js';
import { syncWeatherSignalsForHotel } from '../weatherSignal.service.js';
import { runPricingSnapshotJob } from '../pricingSnapshot.job.js';
import { Department, TicketPriority } from '@prisma/client';
import { pickAssigneeForDepartment } from '../opsAssignment.rules.js';
import { createTask } from '../../platform/tasks/taskEngine.service.js';

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
        syncedAtUtc: new Date(result.fetchedAtUtc).toISOString(),
        daysStored: result.daysStored,
        location: {
          city: result.city,
          country: result.country,
          timezone: result.timezone,
          lat: result.lat,
          lon: result.lon,
        },
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
      const assignedToId = await prisma.$transaction((tx) =>
        pickAssigneeForDepartment({
          tx,
          hotelId,
          department,
        })
      );

      const task = await createTask({
        hotelId,
        title: subject,
        description: reason,
        category: 'OTHER',
        department,
        priority,
        assignedToId,
        details: {
          source: 'OPS_ASSISTANT',
          subject,
          reason,
          ...details,
        },
        actor: { userId },
        source: 'ai',
      });

      return {
        ticketId: task.id,
        conversationId: task.conversationId,
        department: task.department,
        priority: task.priority,
        status: task.status,
        ticketUrl: `/tickets/${task.id}`,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
