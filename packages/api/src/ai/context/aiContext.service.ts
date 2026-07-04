import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { getWeatherContextForHotel } from '../../services/weatherContext.provider.js';
import type {
  AIContextMetadata,
  AIContextOptions,
  AIContextSection,
  AIGuestContext,
  AIHotelContext,
  AIIncidentContext,
  AIOperationalContext,
  AIRoomContext,
} from './aiContext.types.js';

const CONTEXT_VERSION = 'hotel-brain-v1' as const;
const DEFAULT_LIMIT = 10;

const HOTEL_SECTIONS: AIContextSection[] = [
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

const OPERATIONAL_SECTIONS: AIContextSection[] = [
  'hotelProfile',
  'occupancy',
  'weather',
  'bookings',
  'housekeeping',
  'maintenance',
  'security',
  'smartBuilding',
  'incidents',
  'tasks',
  'messages',
];

function asDate(value: Date | string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function resolveRange(options: AIContextOptions) {
  const now = new Date();
  return {
    now,
    from: asDate(options.from, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
    to: asDate(options.to, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)),
    todayStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    todayEnd: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    last7DaysStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
  };
}

function resolveSections(defaultSections: AIContextSection[], options: AIContextOptions): AIContextSection[] {
  const requested = options.sections?.length ? options.sections : defaultSections;
  const excluded = new Set(options.excludeSections || []);
  return requested.filter((section) => !excluded.has(section));
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function countMap<T extends string>(rows: Array<Record<string, unknown>>, key: string): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] || 'UNKNOWN');
    acc[value] = Number(row._count || 0);
    return acc;
  }, {});
}

function addFreshness(metadata: AIContextMetadata, section: string, value?: Date | string | null) {
  metadata.dataFreshness[section] = value
    ? new Date(value).toISOString()
    : 'not_available';
}

function createMetadata(hotelId: string, sections: AIContextSection[], options: AIContextOptions): AIContextMetadata {
  const { from, to } = resolveRange(options);
  return {
    generatedAt: new Date().toISOString(),
    hotelId,
    contextVersion: CONTEXT_VERSION,
    sectionsIncluded: sections,
    warnings: [],
    dataFreshness: {},
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
  };
}

async function buildHotelProfile(hotelId: string, metadata: AIContextMetadata) {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      name: true,
      city: true,
      country: true,
      timezone: true,
      currency: true,
      checkInTime: true,
      checkOutTime: true,
      updatedAt: true,
    },
  });
  addFreshness(metadata, 'hotelProfile', hotel?.updatedAt);
  if (!hotel) {
    metadata.warnings.push('Hotel profile not found.');
    return undefined;
  }
  return {
    name: hotel.name,
    city: hotel.city,
    country: hotel.country,
    timezone: hotel.timezone,
    currency: hotel.currency,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
  };
}

async function buildOccupancy(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const { now, todayStart, todayEnd } = resolveRange(options);
  const [totalRooms, occupiedRooms, availableRooms, arrivalsToday, departuresToday, inHouseGuests] = await Promise.all([
    prisma.room.count({ where: { hotelId, isActive: true } }),
    prisma.room.count({ where: { hotelId, isActive: true, status: 'OCCUPIED' } }),
    prisma.room.count({ where: { hotelId, isActive: true, status: 'AVAILABLE' } }),
    prisma.booking.count({ where: { hotelId, checkInDate: { gte: todayStart, lt: todayEnd }, status: { in: ['CONFIRMED', 'CHECKED_IN'] } } }),
    prisma.booking.count({ where: { hotelId, checkOutDate: { gte: todayStart, lt: todayEnd }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] } } }),
    prisma.booking.count({ where: { hotelId, status: 'CHECKED_IN', checkInDate: { lte: now }, checkOutDate: { gte: now } } }),
  ]);
  addFreshness(metadata, 'occupancy', now);
  return {
    roomsTotal: totalRooms,
    roomsOccupied: occupiedRooms,
    roomsAvailable: availableRooms,
    occupancyPercentage: totalRooms ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
    arrivalsToday,
    departuresToday,
    currentInHouseGuests: inHouseGuests,
  };
}

async function buildRevenue(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const { todayStart, todayEnd, last7DaysStart } = resolveRange(options);
  const [todayPayments, last7Payments, outstanding, unpaidInvoices, paymentSummary] = await Promise.all([
    prisma.payment.aggregate({
      where: { booking: { hotelId }, status: 'COMPLETED', processedAt: { gte: todayStart, lt: todayEnd } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { booking: { hotelId }, status: 'COMPLETED', processedAt: { gte: last7DaysStart } },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { hotelId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
      _sum: { total: true },
    }),
    prisma.invoice.count({ where: { hotelId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } } }),
    prisma.payment.groupBy({ by: ['status'], where: { booking: { hotelId }, processedAt: { gte: last7DaysStart } }, _count: true, _sum: { amount: true } }),
  ]);
  addFreshness(metadata, 'revenue', new Date());
  return {
    revenueToday: roundMoney(decimalToNumber(todayPayments._sum.amount)),
    revenueLast7Days: roundMoney(decimalToNumber(last7Payments._sum.amount)),
    outstandingInvoices: roundMoney(decimalToNumber(outstanding._sum.total)),
    unpaidInvoices,
    paymentSummary: paymentSummary.map((row) => ({
      status: row.status,
      count: row._count,
      amount: roundMoney(decimalToNumber(row._sum.amount)),
    })),
  };
}

async function buildWeather(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const { from, to } = resolveRange(options);
  const [weather, signals] = await Promise.all([
    getWeatherContextForHotel(hotelId).catch(() => null),
    prisma.externalSignal.findMany({
      where: { hotelId, dateLocal: { gte: from, lte: to } },
      orderBy: { fetchedAtUtc: 'desc' },
      take: options.limit || DEFAULT_LIMIT,
      select: { type: true, dateLocal: true, timezone: true, metricsJson: true, source: true, fetchedAtUtc: true },
    }),
  ]);
  addFreshness(metadata, 'weather', signals[0]?.fetchedAtUtc || (weather as any)?.syncedAtUtc);
  return {
    currentWeather: weather,
    forecast: (weather as any)?.next24h ?? null,
    weatherAlerts: signals.filter((signal) => String(signal.type).toLowerCase().includes('alert')),
    externalSignals: signals,
  };
}

async function buildBookings(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const { from, to, todayStart, todayEnd } = resolveRange(options);
  const limit = options.limit || DEFAULT_LIMIT;
  const select = {
    id: true,
    bookingRef: true,
    status: true,
    checkInDate: true,
    checkOutDate: true,
    source: true,
    specialRequests: true,
    guest: { select: { id: true, firstName: true, lastName: true, vipStatus: true } },
    room: { select: { id: true, number: true, floor: true } },
  };
  const [arrivals, departures, cancellations, noShows, upcomingBookings] = await Promise.all([
    prisma.booking.findMany({ where: { hotelId, checkInDate: { gte: todayStart, lt: todayEnd } }, orderBy: { checkInDate: 'asc' }, take: limit, select }),
    prisma.booking.findMany({ where: { hotelId, checkOutDate: { gte: todayStart, lt: todayEnd } }, orderBy: { checkOutDate: 'asc' }, take: limit, select }),
    prisma.booking.findMany({ where: { hotelId, status: 'CANCELLED', updatedAt: { gte: from } }, orderBy: { updatedAt: 'desc' }, take: limit, select }),
    prisma.booking.findMany({ where: { hotelId, status: 'NO_SHOW', updatedAt: { gte: from } }, orderBy: { updatedAt: 'desc' }, take: limit, select }),
    prisma.booking.findMany({ where: { hotelId, checkInDate: { gte: todayStart, lte: to }, status: 'CONFIRMED' }, orderBy: { checkInDate: 'asc' }, take: limit, select }),
  ]);
  addFreshness(metadata, 'bookings', upcomingBookings[0]?.checkInDate || new Date());
  return { arrivals, departures, cancellations, noShows, upcomingBookings };
}

async function buildGuests(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const { now, from } = resolveRange(options);
  const limit = options.limit || DEFAULT_LIMIT;
  const [vipGuests, guestsWithOpenIssues, guestsInHouse, recentGuestActivity] = await Promise.all([
    prisma.guest.findMany({ where: { hotelId, vipStatus: true, isDeleted: false }, orderBy: { updatedAt: 'desc' }, take: limit, select: { id: true, firstName: true, lastName: true, vipStatus: true, totalStays: true } }),
    prisma.guest.findMany({ where: { hotelId, conversations: { some: { status: 'OPEN' } } }, orderBy: { updatedAt: 'desc' }, take: limit, select: { id: true, firstName: true, lastName: true } }),
    prisma.booking.findMany({ where: { hotelId, status: 'CHECKED_IN', checkInDate: { lte: now }, checkOutDate: { gte: now } }, take: limit, select: { id: true, guest: { select: { id: true, firstName: true, lastName: true, vipStatus: true } }, room: { select: { number: true } } } }),
    prisma.guestJourneyEvent.findMany({ where: { hotelId, createdAt: { gte: from } }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, stage: true, eventType: true, summary: true, createdAt: true, guest: { select: { firstName: true, lastName: true } } } }),
  ]);
  addFreshness(metadata, 'guests', recentGuestActivity[0]?.createdAt || new Date());
  return { vipGuests, guestsWithOpenIssues, guestsCurrentlyInHouse: guestsInHouse, recentGuestActivity };
}

async function buildHousekeeping(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const limit = options.limit || DEFAULT_LIMIT;
  const [counts, pendingTasks] = await Promise.all([
    prisma.room.groupBy({ by: ['housekeepingStatus'], where: { hotelId, isActive: true }, _count: true }),
    prisma.ticket.findMany({
      where: { hotelId, department: 'HOUSEKEEPING', status: { in: ['OPEN', 'PENDING', 'IN_PROGRESS', 'BREACHED'] } },
      orderBy: [{ priority: 'desc' }, { createdAtUtc: 'desc' }],
      take: limit,
      select: { id: true, category: true, priority: true, status: true, details: true, resolutionDueAtUtc: true },
    }),
  ]);
  addFreshness(metadata, 'housekeeping', new Date());
  const byStatus = countMap(counts as unknown as Array<Record<string, unknown>>, 'housekeepingStatus');
  return {
    cleanRooms: byStatus.CLEAN || 0,
    dirtyRooms: byStatus.DIRTY || 0,
    inspectionRooms: byStatus.INSPECTION || 0,
    outOfServiceRooms: byStatus.OUT_OF_SERVICE || 0,
    pendingHousekeepingTasks: pendingTasks,
  };
}

async function buildMaintenance(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const { now } = resolveRange(options);
  const limit = options.limit || DEFAULT_LIMIT;
  const [openWorkOrders, urgentFaults, overdueRepairs, preventiveMaintenanceDue] = await Promise.all([
    prisma.maintenanceWorkOrder.findMany({ where: { hotelId, status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] } }, orderBy: { updatedAt: 'desc' }, take: limit, select: { id: true, title: true, location: true, assetName: true, priority: true, status: true, dueAt: true } }),
    prisma.maintenanceFault.findMany({ where: { hotelId, status: { in: ['OPEN', 'IN_PROGRESS'] }, severity: { in: ['URGENT', 'CRITICAL'] } }, orderBy: { reportedAt: 'desc' }, take: limit, select: { id: true, title: true, location: true, assetName: true, severity: true, status: true, reportedAt: true } }),
    prisma.maintenanceRepair.findMany({ where: { hotelId, status: { in: ['SCHEDULED', 'IN_PROGRESS', 'WAITING_PARTS'] }, startedAt: { lt: now } }, orderBy: { startedAt: 'asc' }, take: limit, select: { id: true, title: true, technician: true, status: true, startedAt: true } }),
    prisma.preventiveMaintenanceSchedule.findMany({ where: { hotelId, nextDueAt: { lte: now }, status: { in: ['ACTIVE', 'OVERDUE'] } }, orderBy: { nextDueAt: 'asc' }, take: limit, select: { id: true, title: true, assetName: true, frequency: true, nextDueAt: true, status: true } }),
  ]);
  addFreshness(metadata, 'maintenance', new Date());
  return { openWorkOrders, urgentFaults, overdueRepairs, preventiveMaintenanceDue };
}

async function buildSecurity(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const { from } = resolveRange(options);
  const limit = options.limit || DEFAULT_LIMIT;
  const [activeSecurityAlerts, recentAccessEvents, visitorsCurrentlyOnsite, unresolvedIncidents] = await Promise.all([
    prisma.securityAlert.findMany({ where: { hotelId, status: { in: ['ACTIVE', 'ACKNOWLEDGED'] } }, orderBy: { occurredAt: 'desc' }, take: limit, select: { id: true, alertType: true, severity: true, status: true, title: true, location: true, occurredAt: true } }),
    prisma.doorAccessEvent.findMany({ where: { hotelId, occurredAt: { gte: from } }, orderBy: { occurredAt: 'desc' }, take: limit, select: { id: true, doorName: true, actorName: true, actorType: true, result: true, occurredAt: true } }),
    prisma.visitor.findMany({ where: { hotelId, status: 'CHECKED_IN' }, orderBy: { checkInAt: 'desc' }, take: limit, select: { id: true, fullName: true, company: true, purpose: true, hostName: true, checkInAt: true, status: true } }),
    prisma.incident.findMany({ where: { hotelId, category: 'SECURITY', status: { notIn: ['RESOLVED', 'CLOSED'] } }, orderBy: { startedAt: 'desc' }, take: limit, select: { id: true, incidentNumber: true, title: true, severity: true, status: true, startedAt: true } }),
  ]);
  addFreshness(metadata, 'security', activeSecurityAlerts[0]?.occurredAt || recentAccessEvents[0]?.occurredAt);
  return { activeSecurityAlerts, recentAccessEvents, visitorsCurrentlyOnsite, unresolvedIncidents };
}

async function buildSmartBuilding(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const { from } = resolveRange(options);
  const limit = options.limit || DEFAULT_LIMIT;
  const [devicesOffline, criticalSensors, doorForcedOpenEvents, cameraOfflineEvents] = await Promise.all([
    prisma.ioTDevice.findMany({ where: { hotelId, status: { in: ['OFFLINE', 'WARNING'] } }, orderBy: { updatedAt: 'desc' }, take: limit, select: { id: true, externalId: true, name: true, deviceType: true, status: true, location: true, lastSeenAt: true } }),
    prisma.sensorReading.findMany({ where: { hotelId, status: 'ALERT', recordedAt: { gte: from } }, orderBy: { recordedAt: 'desc' }, take: limit, select: { id: true, sensorType: true, location: true, value: true, unit: true, status: true, recordedAt: true } }),
    prisma.securityAlert.findMany({ where: { hotelId, alertType: { in: ['FORCED_DOOR', 'DOOR_HELD_OPEN'] }, occurredAt: { gte: from } }, orderBy: { occurredAt: 'desc' }, take: limit, select: { id: true, title: true, severity: true, status: true, location: true, occurredAt: true } }),
    prisma.cameraFeed.findMany({ where: { hotelId, status: 'OFFLINE' }, orderBy: { updatedAt: 'desc' }, take: limit, select: { id: true, externalId: true, name: true, location: true, status: true, lastSeenAt: true } }),
  ]);
  addFreshness(metadata, 'smartBuilding', new Date());
  return {
    devicesOffline,
    criticalSensors: criticalSensors.map((reading) => ({ ...reading, value: decimalToNumber(reading.value) })),
    doorForcedOpenEvents,
    cameraOfflineEvents,
  };
}

async function buildIncidents(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const limit = options.limit || DEFAULT_LIMIT;
  const [activeIncidents, criticalIncidents, unresolvedIncidents, resolved] = await Promise.all([
    prisma.incident.findMany({ where: { hotelId, status: { notIn: ['RESOLVED', 'CLOSED'] } }, orderBy: { startedAt: 'desc' }, take: limit, select: { id: true, incidentNumber: true, title: true, category: true, severity: true, status: true, sourceModule: true, startedAt: true } }),
    prisma.incident.findMany({ where: { hotelId, severity: 'CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED'] } }, orderBy: { startedAt: 'desc' }, take: limit, select: { id: true, incidentNumber: true, title: true, category: true, status: true, startedAt: true } }),
    prisma.incident.count({ where: { hotelId, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    prisma.incident.findMany({ where: { hotelId, resolvedAt: { not: null } }, orderBy: { resolvedAt: 'desc' }, take: 25, select: { startedAt: true, resolvedAt: true } }),
  ]);
  const resolutionMinutes = resolved
    .map((incident) => incident.resolvedAt ? incident.resolvedAt.getTime() - incident.startedAt.getTime() : null)
    .filter((value): value is number => typeof value === 'number')
    .map((ms) => Math.round(ms / 60000));
  addFreshness(metadata, 'incidents', activeIncidents[0]?.startedAt || resolved[0]?.resolvedAt);
  return {
    activeIncidents,
    criticalIncidents,
    unresolvedIncidents,
    averageResolutionMinutes: resolutionMinutes.length
      ? Math.round(resolutionMinutes.reduce((sum, value) => sum + value, 0) / resolutionMinutes.length)
      : null,
  };
}

async function buildTasks(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const { now, todayEnd } = resolveRange(options);
  const limit = options.limit || DEFAULT_LIMIT;
  const openStatuses = ['OPEN', 'PENDING', 'IN_PROGRESS', 'BREACHED'] as const;
  const [overdueTasks, dueToday, highPriority, aiGenerated, iotGenerated] = await Promise.all([
    prisma.ticket.findMany({ where: { hotelId, status: { in: [...openStatuses] }, resolutionDueAtUtc: { lt: now } }, orderBy: { resolutionDueAtUtc: 'asc' }, take: limit, select: { id: true, department: true, priority: true, status: true, resolutionDueAtUtc: true, details: true } }),
    prisma.ticket.findMany({ where: { hotelId, status: { in: [...openStatuses] }, resolutionDueAtUtc: { gte: now, lt: todayEnd } }, orderBy: { resolutionDueAtUtc: 'asc' }, take: limit, select: { id: true, department: true, priority: true, status: true, resolutionDueAtUtc: true, details: true } }),
    prisma.ticket.findMany({ where: { hotelId, status: { in: [...openStatuses] }, priority: { in: ['HIGH', 'URGENT'] } }, orderBy: { updatedAtUtc: 'desc' }, take: limit, select: { id: true, department: true, priority: true, status: true, details: true } }),
    prisma.ticket.count({ where: { hotelId, details: { path: ['source'], equals: 'OPS_ASSISTANT' } } }),
    prisma.ticket.count({ where: { hotelId, details: { path: ['sourceModule'], equals: 'SMART_BUILDING' } } }),
  ]);
  addFreshness(metadata, 'tasks', overdueTasks[0]?.resolutionDueAtUtc || dueToday[0]?.resolutionDueAtUtc);
  return { overdueTasks, dueToday, highPriority, aiGenerated, iotGenerated };
}

async function buildReviews(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const { from } = resolveRange(options);
  const limit = options.limit || DEFAULT_LIMIT;
  const [recentReviews, lowRatings, unresolvedReviewResponses] = await Promise.all([
    prisma.review.findMany({ where: { hotelId, createdAt: { gte: from } }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, rating: true, source: true, comment: true, response: true, createdAt: true } }),
    prisma.review.findMany({ where: { hotelId, rating: { lte: 2 }, createdAt: { gte: from } }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, rating: true, source: true, comment: true, createdAt: true } }),
    prisma.review.count({ where: { hotelId, response: null } }),
  ]);
  addFreshness(metadata, 'reviews', recentReviews[0]?.createdAt);
  return {
    recentReviews,
    lowRatings,
    unresolvedReviewResponses,
    sentimentSummary: 'Sentiment service is not implemented yet.',
  };
}

async function buildMessages(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const limit = options.limit || DEFAULT_LIMIT;
  const [openConversations, escalatedTickets, slaBreaches, unreadSupportMessages] = await Promise.all([
    prisma.conversation.count({ where: { hotelId, status: 'OPEN' } }),
    prisma.ticket.findMany({ where: { hotelId, escalatedLevel: { gt: 0 }, status: { notIn: ['RESOLVED', 'CLOSED'] } }, orderBy: { lastEscalationAtUtc: 'desc' }, take: limit, select: { id: true, department: true, priority: true, status: true, escalatedLevel: true, lastEscalationAtUtc: true } }),
    prisma.ticket.findMany({ where: { hotelId, status: 'BREACHED' }, orderBy: { updatedAtUtc: 'desc' }, take: limit, select: { id: true, department: true, priority: true, status: true, responseDueAtUtc: true, resolutionDueAtUtc: true } }),
    prisma.message.count({ where: { conversation: { hotelId, status: 'OPEN' }, senderType: 'GUEST', readAt: null } }),
  ]);
  addFreshness(metadata, 'messages', new Date());
  return { openConversations, escalatedTickets, slaBreaches, unreadSupportMessages };
}

async function buildFinancialSummary(hotelId: string, options: AIContextOptions, metadata: AIContextMetadata) {
  const { from } = resolveRange(options);
  const [payments, refunds, outstanding, purchaseOrders] = await Promise.all([
    prisma.payment.aggregate({ where: { booking: { hotelId }, status: 'COMPLETED', processedAt: { gte: from } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { booking: { hotelId }, status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] }, processedAt: { gte: from } }, _sum: { amount: true } }),
    prisma.invoice.aggregate({ where: { hotelId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, _sum: { total: true } }),
    prisma.purchaseOrder.aggregate({ where: { hotelId, status: { in: ['SENT', 'APPROVED', 'RECEIVED'] }, createdAt: { gte: from } }, _sum: { totalCost: true } }),
  ]);
  addFreshness(metadata, 'financialSummary', new Date());
  return {
    revenue: roundMoney(decimalToNumber(payments._sum.amount)),
    payments: roundMoney(decimalToNumber(payments._sum.amount)),
    refunds: roundMoney(decimalToNumber(refunds._sum.amount)),
    expenses: roundMoney(decimalToNumber(purchaseOrders._sum.totalCost)),
    outstandingBalances: roundMoney(decimalToNumber(outstanding._sum.total)),
  };
}

async function assignSection(context: AIHotelContext, section: AIContextSection, hotelId: string, options: AIContextOptions) {
  switch (section) {
    case 'hotelProfile':
      context.hotelProfile = await buildHotelProfile(hotelId, context.metadata);
      break;
    case 'occupancy':
      context.occupancy = await buildOccupancy(hotelId, options, context.metadata);
      break;
    case 'revenue':
      context.revenue = await buildRevenue(hotelId, options, context.metadata);
      break;
    case 'weather':
      context.weather = await buildWeather(hotelId, options, context.metadata);
      break;
    case 'bookings':
      context.bookings = await buildBookings(hotelId, options, context.metadata);
      break;
    case 'guests':
      context.guests = await buildGuests(hotelId, options, context.metadata);
      break;
    case 'housekeeping':
      context.housekeeping = await buildHousekeeping(hotelId, options, context.metadata);
      break;
    case 'maintenance':
      context.maintenance = await buildMaintenance(hotelId, options, context.metadata);
      break;
    case 'security':
      context.security = await buildSecurity(hotelId, options, context.metadata);
      break;
    case 'smartBuilding':
      context.smartBuilding = await buildSmartBuilding(hotelId, options, context.metadata);
      break;
    case 'incidents':
      context.incidents = await buildIncidents(hotelId, options, context.metadata);
      break;
    case 'tasks':
      context.tasks = await buildTasks(hotelId, options, context.metadata);
      break;
    case 'reviews':
      context.reviews = await buildReviews(hotelId, options, context.metadata);
      break;
    case 'messages':
      context.messages = await buildMessages(hotelId, options, context.metadata);
      break;
    case 'financialSummary':
      context.financialSummary = await buildFinancialSummary(hotelId, options, context.metadata);
      break;
    default:
      break;
  }
}

export async function buildHotelContext(hotelId: string, options: AIContextOptions = {}): Promise<AIHotelContext> {
  const sections = resolveSections(HOTEL_SECTIONS, options);
  const context: AIHotelContext = {
    metadata: createMetadata(hotelId, sections, options),
  };

  for (const section of sections) {
    await assignSection(context, section, hotelId, options);
  }

  return context;
}

export async function buildOperationalContext(hotelId: string, options: AIContextOptions = {}): Promise<AIOperationalContext> {
  return buildHotelContext(hotelId, {
    ...options,
    sections: options.sections || OPERATIONAL_SECTIONS,
  });
}

export async function buildGuestContext(hotelId: string, guestId: string, options: AIContextOptions = {}): Promise<AIGuestContext> {
  const context = await buildHotelContext(hotelId, {
    ...options,
    sections: options.sections || ['hotelProfile', 'occupancy', 'bookings', 'guests', 'reviews', 'messages', 'tasks'],
  }) as AIGuestContext;
  context.metadata.sectionsIncluded.push('guest');
  context.guest = await prisma.guest.findFirst({
    where: { id: guestId, hotelId, isDeleted: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      vipStatus: true,
      totalStays: true,
      totalSpent: true,
      notes: true,
      bookings: {
        orderBy: { createdAt: 'desc' },
        take: options.limit || DEFAULT_LIMIT,
        select: { id: true, bookingRef: true, status: true, checkInDate: true, checkOutDate: true, totalAmount: true },
      },
      reviews: { orderBy: { createdAt: 'desc' }, take: options.limit || DEFAULT_LIMIT, select: { id: true, rating: true, source: true, comment: true, createdAt: true } },
      conciergeRequests: { orderBy: { updatedAt: 'desc' }, take: options.limit || DEFAULT_LIMIT, select: { id: true, title: true, status: true, priority: true, dueAt: true } },
    },
  });
  addFreshness(context.metadata, 'guest', new Date());
  return context;
}

export async function buildRoomContext(hotelId: string, roomId: string, options: AIContextOptions = {}): Promise<AIRoomContext> {
  const context = await buildHotelContext(hotelId, {
    ...options,
    sections: options.sections || ['hotelProfile', 'occupancy', 'housekeeping', 'maintenance', 'smartBuilding', 'tasks'],
  }) as AIRoomContext;
  context.metadata.sectionsIncluded.push('room');
  context.room = await prisma.room.findFirst({
    where: { id: roomId, hotelId },
    select: {
      id: true,
      number: true,
      floor: true,
      status: true,
      housekeepingStatus: true,
      notes: true,
      roomType: { select: { name: true, baseRate: true, amenities: true } },
      bookings: { orderBy: { checkInDate: 'desc' }, take: options.limit || DEFAULT_LIMIT, select: { id: true, bookingRef: true, status: true, checkInDate: true, checkOutDate: true } },
      housekeepingLogs: { orderBy: { createdAt: 'desc' }, take: options.limit || DEFAULT_LIMIT, select: { fromStatus: true, toStatus: true, notes: true, createdAt: true } },
      maintenanceIssues: { orderBy: { updatedAt: 'desc' }, take: options.limit || DEFAULT_LIMIT, select: { id: true, title: true, priority: true, status: true, reportedAt: true } },
    },
  });
  addFreshness(context.metadata, 'room', new Date());
  return context;
}

export async function buildIncidentContext(hotelId: string, incidentId: string, options: AIContextOptions = {}): Promise<AIIncidentContext> {
  const context = await buildHotelContext(hotelId, {
    ...options,
    sections: options.sections || ['hotelProfile', 'incidents', 'tasks', 'security', 'maintenance', 'smartBuilding', 'messages'],
  }) as AIIncidentContext;
  context.metadata.sectionsIncluded.push('incident');
  context.incident = await prisma.incident.findFirst({
    where: { id: incidentId, hotelId },
    select: {
      id: true,
      incidentNumber: true,
      title: true,
      description: true,
      category: true,
      severity: true,
      status: true,
      sourceModule: true,
      linkedEntityType: true,
      linkedEntityId: true,
      startedAt: true,
      resolvedAt: true,
      closedAt: true,
      tasks: { select: { ticket: { select: { id: true, department: true, priority: true, status: true, details: true } } } },
      comments: { orderBy: { createdAt: 'desc' }, take: options.limit || DEFAULT_LIMIT, select: { id: true, body: true, createdAt: true } },
    },
  });
  addFreshness(context.metadata, 'incident', new Date());
  return context;
}

export const AIContextService = {
  buildHotelContext,
  buildOperationalContext,
  buildGuestContext,
  buildRoomContext,
  buildIncidentContext,
};
