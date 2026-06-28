import type { Server as SocketIOServer } from 'socket.io';
import { eventBus, type PlatformEvent } from '../event-bus/eventBus.service.js';
import { logger } from '../../config/logger.js';

export type TimelineSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

export type TimelineEvent = {
  id: string;
  timestamp: string;
  hotelId: string;
  module: string;
  eventType: string;
  severity: TimelineSeverity;
  actor?: {
    userId?: string;
    name?: string;
    type?: string;
  };
  department?: string;
  location?: string;
  linkedEntity?: {
    type: string;
    id?: string;
  };
  status?: string;
  summary: string;
  icon: string;
  sourceEventId: string;
  correlationId: string;
};

export type TimelineFilters = {
  module?: string;
  severity?: TimelineSeverity;
  department?: string;
  time?: '1h' | '6h' | '24h' | '7d';
  limit?: number;
};

const MAX_EVENTS_PER_HOTEL = 500;
const DEFAULT_LIMIT = 100;

const eventsByHotel = new Map<string, TimelineEvent[]>();
let started = false;
let socketServer: SocketIOServer | null = null;

const moduleBySource: Record<string, string> = {
  'operations-center': 'Operations Center',
  'smart-building': 'Smart Building',
  'security-center': 'Security Center',
  'maintenance-center': 'Maintenance Center',
  ai: 'AI',
  'task-engine': 'Tasks',
  bookings: 'Reservations',
  housekeeping: 'Housekeeping',
  rooms: 'Rooms',
  financials: 'Financials',
  messages: 'Messages',
  calls: 'Calls',
};

const iconByModule: Record<string, string> = {
  'Operations Center': 'sparkles',
  'Smart Building': 'building-2',
  'Security Center': 'shield',
  'Maintenance Center': 'wrench',
  AI: 'bot',
  Tasks: 'clipboard-list',
  Reservations: 'calendar-check',
  Housekeeping: 'sparkles',
  Rooms: 'bed',
  Financials: 'receipt',
  Messages: 'message-square',
  Calls: 'phone',
};

function payloadRecord(event: PlatformEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
    ? (event.payload as Record<string, unknown>)
    : {};
}

function valueAsString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function pickModule(event: PlatformEvent) {
  const source = event.metadata.source;
  const type = event.metadata.eventType;
  if (source in moduleBySource) return moduleBySource[source];
  if (type.startsWith('smart_building.')) return 'Smart Building';
  if (type.startsWith('security.')) return 'Security Center';
  if (type.startsWith('maintenance.')) return 'Maintenance Center';
  if (type.startsWith('task.')) return 'Tasks';
  if (type.startsWith('booking.')) return 'Reservations';
  if (type.startsWith('housekeeping.')) return 'Housekeeping';
  if (type.startsWith('room.')) return 'Rooms';
  if (type.startsWith('financial.')) return 'Financials';
  if (type.startsWith('message.')) return 'Messages';
  if (type.startsWith('call.')) return 'Calls';
  if (type.startsWith('ai.')) return 'AI';
  return source || 'Platform';
}

function pickSeverity(event: PlatformEvent, payload: Record<string, unknown>): TimelineSeverity {
  const raw = valueAsString(payload.severity) || valueAsString(payload.priority) || valueAsString(payload.status);
  const normalized = raw?.toUpperCase();
  if (normalized === 'CRITICAL' || normalized === 'URGENT' || normalized === 'FORCED' || normalized === 'ALERT') return 'CRITICAL';
  if (normalized === 'HIGH' || normalized === 'WARNING' || normalized === 'OFFLINE' || normalized === 'OPEN') return 'WARNING';
  if (normalized === 'RESOLVED' || normalized === 'COMPLETED' || normalized === 'CHECKED_OUT') return 'SUCCESS';
  if (event.metadata.eventType.includes('alert_detected')) return 'CRITICAL';
  if (event.metadata.eventType.includes('created')) return 'SUCCESS';
  return 'INFO';
}

function pickLinkedEntity(event: PlatformEvent, payload: Record<string, unknown>) {
  const id =
    valueAsString(payload.taskId) ||
    valueAsString(payload.ticketId) ||
    valueAsString(payload.bookingId) ||
    valueAsString(payload.roomId) ||
    valueAsString(payload.alertId) ||
    valueAsString(payload.visitorId) ||
    valueAsString(payload.entityId) ||
    valueAsString(payload.resultId);

  if (!id) return undefined;

  const type =
    event.metadata.eventType.startsWith('task.') ? 'ticket' :
      event.metadata.eventType.startsWith('booking.') ? 'booking' :
        event.metadata.eventType.startsWith('room.') ? 'room' :
          event.metadata.eventType.includes('alert') ? 'security_alert' :
            valueAsString(payload.entity) || 'entity';

  return { type, id };
}

function humanizeEventType(type: string) {
  return type
    .replace(/[_:.]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pickSummary(event: PlatformEvent, payload: Record<string, unknown>, module: string) {
  return (
    valueAsString(payload.summary) ||
    valueAsString(payload.title) ||
    valueAsString(payload.subject) ||
    valueAsString(payload.eventType) ||
    `${module}: ${humanizeEventType(event.metadata.eventType)}`
  );
}

function toTimelineEvent(event: PlatformEvent): TimelineEvent {
  const payload = payloadRecord(event);
  const module = valueAsString(payload.sourceModule) === 'SMART_BUILDING' ? 'Smart Building' : pickModule(event);
  const actorName = valueAsString(payload.actorName) || valueAsString(payload.userName);
  const entity = pickLinkedEntity(event, payload);

  return {
    id: event.metadata.eventId,
    timestamp: event.metadata.publishedAt,
    hotelId: event.metadata.hotelId,
    module,
    eventType: event.metadata.eventType,
    severity: pickSeverity(event, payload),
    actor: event.metadata.userId || actorName ? { userId: event.metadata.userId, name: actorName } : undefined,
    department: valueAsString(payload.department),
    location: valueAsString(payload.location),
    linkedEntity: entity,
    status: valueAsString(payload.status),
    summary: pickSummary(event, payload, module),
    icon: iconByModule[module] || 'activity',
    sourceEventId: event.metadata.eventId,
    correlationId: event.metadata.correlationId,
  };
}

function addTimelineEvent(timelineEvent: TimelineEvent) {
  const existing = eventsByHotel.get(timelineEvent.hotelId) || [];
  if (existing.some((item) => item.sourceEventId === timelineEvent.sourceEventId)) return;

  const next = [timelineEvent, ...existing].slice(0, MAX_EVENTS_PER_HOTEL);
  eventsByHotel.set(timelineEvent.hotelId, next);

  if (socketServer) {
    socketServer.to(`hotel:${timelineEvent.hotelId}`).emit('timeline:event', timelineEvent);
  }
}

export function startTimelineEngine(io?: SocketIOServer) {
  if (io) socketServer = io;
  if (started) return;
  started = true;

  eventBus.subscribeAll((event) => {
    const timelineEvent = toTimelineEvent(event);
    addTimelineEvent(timelineEvent);
  });

  logger.info('Timeline Engine subscribed to Event Bus');
}

function sinceForFilter(time?: TimelineFilters['time']) {
  const now = Date.now();
  if (time === '1h') return now - 60 * 60 * 1000;
  if (time === '6h') return now - 6 * 60 * 60 * 1000;
  if (time === '24h') return now - 24 * 60 * 60 * 1000;
  if (time === '7d') return now - 7 * 24 * 60 * 60 * 1000;
  return null;
}

export function getTimelineEvents(hotelId: string, filters: TimelineFilters = {}) {
  const limit = Math.min(Math.max(filters.limit || DEFAULT_LIMIT, 1), DEFAULT_LIMIT);
  const since = sinceForFilter(filters.time);

  return (eventsByHotel.get(hotelId) || [])
    .filter((event) => !filters.module || event.module === filters.module)
    .filter((event) => !filters.severity || event.severity === filters.severity)
    .filter((event) => !filters.department || event.department === filters.department)
    .filter((event) => !since || new Date(event.timestamp).getTime() >= since)
    .slice(0, limit);
}

export function getTimelineFilterOptions(hotelId: string) {
  const events = eventsByHotel.get(hotelId) || [];
  return {
    modules: Array.from(new Set(events.map((event) => event.module))).sort(),
    severities: Array.from(new Set(events.map((event) => event.severity))).sort(),
    departments: Array.from(new Set(events.map((event) => event.department).filter(Boolean))).sort(),
  };
}
