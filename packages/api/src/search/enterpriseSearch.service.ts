import { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/database.js';
import { eventBus, type PlatformEvent } from '../platform/event-bus/eventBus.service.js';
import { buildHotelContext } from '../ai/context/index.js';
import type {
  EnterpriseSearchActor,
  EnterpriseSearchFilters,
  EnterpriseSearchResponse,
  EnterpriseSearchResult,
  HotelBrainAnswer,
  SearchIndexRecordInput,
} from './enterpriseSearch.types.js';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const EVENT_TYPES_TO_INDEX = new Set([
  'guest.created',
  'reservation.created',
  'reservation.updated',
  'room.statusChanged',
  'housekeeping.taskUpdated',
  'maintenance.taskCreated',
  'incident.created',
  'incident.updated',
  'cctv.integration.created',
  'cctv.camera.imported',
  'cctv.nvr.channelImported',
  'smartBuilding.device.imported',
  'smartBuilding.device.statusChanged',
  'integration.created',
  'integration.updated',
  'audit.recorded',
  'ai.recommendation.created',
]);

function compact(values: Array<unknown>) {
  return values
    .filter((value) => value !== null && value !== undefined && String(value).trim().length > 0)
    .map((value) => String(value).trim());
}

function text(values: Array<unknown>) {
  return compact(values).join(' ');
}

function searchId(hotelId: string, entityType: string, entityId: string) {
  return `${hotelId}:${entityType}:${entityId}`;
}

function isAdmin(actor: EnterpriseSearchActor) {
  return actor.role === Role.ADMIN || actor.role === 'ADMIN';
}

function canRead(actor: EnterpriseSearchActor, accessScope: string[]) {
  if (isAdmin(actor)) return true;
  if (!accessScope.length) return true;
  return accessScope.some((permission) => actor.modulePermissions.includes(permission));
}

function toResult(record: any, query = ''): EnterpriseSearchResult {
  const raw = String(record.searchableText || record.summary || record.title || '');
  const normalized = query.trim().toLowerCase();
  const index = normalized ? raw.toLowerCase().indexOf(normalized) : -1;
  const start = index >= 0 ? Math.max(0, index - 60) : 0;
  const snippet = raw.slice(start, start + 180) || record.summary || record.title;
  return {
    id: record.id,
    searchId: record.searchId,
    entityId: record.entityId,
    entityType: record.entityType,
    category: record.entityType,
    sourceModule: record.sourceModule,
    title: record.title,
    summary: record.summary,
    snippet,
    status: record.status,
    priority: record.priority,
    severity: record.severity,
    hotelArea: record.hotelArea,
    roomNumber: record.roomNumber,
    ownerId: record.ownerId,
    sourceUrl: record.sourceUrl,
    indexedAt: record.indexedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    metadata: record.metadata,
  };
}

export async function upsertSearchIndexRecord(hotelId: string, input: SearchIndexRecordInput) {
  return prisma.searchIndex.upsert({
    where: {
      hotelId_entityType_entityId: {
        hotelId,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    },
    create: {
      searchId: searchId(hotelId, input.entityType, input.entityId),
      hotelId,
      ...input,
      tags: input.tags || [],
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      indexedAt: new Date(),
    },
    update: {
      sourceModule: input.sourceModule,
      title: input.title,
      summary: input.summary,
      searchableText: input.searchableText,
      tags: input.tags || [],
      status: input.status,
      priority: input.priority,
      severity: input.severity,
      hotelArea: input.hotelArea,
      roomNumber: input.roomNumber,
      guestId: input.guestId,
      reservationId: input.reservationId,
      ownerId: input.ownerId,
      accessScope: input.accessScope,
      sourceUrl: input.sourceUrl,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      sourceCreatedAt: input.sourceCreatedAt,
      sourceUpdatedAt: input.sourceUpdatedAt,
      indexedAt: new Date(),
    },
  });
}

async function collectIndexRecords(hotelId: string): Promise<SearchIndexRecordInput[]> {
  const [
    guests,
    bookings,
    rooms,
    invoices,
    inventoryItems,
    reviews,
    conversations,
    tickets,
    cameraFeeds,
    hardwareIntegrations,
    iotDevices,
    securityAlerts,
    workOrders,
    faults,
    repairs,
    incidents,
    aiRecommendations,
    users,
    activityLogs,
  ] = await Promise.all([
    prisma.guest.findMany({ where: { hotelId, isDeleted: false }, take: 500, orderBy: { updatedAt: 'desc' } }),
    prisma.booking.findMany({ where: { hotelId }, include: { guest: true, room: true }, take: 500, orderBy: { updatedAt: 'desc' } }),
    prisma.room.findMany({ where: { hotelId }, include: { roomType: true }, take: 500, orderBy: { updatedAt: 'desc' } }),
    prisma.invoice.findMany({ where: { hotelId }, include: { booking: { include: { guest: true } } }, take: 300, orderBy: { createdAt: 'desc' } }),
    prisma.inventoryItem.findMany({ where: { hotelId }, take: 500, orderBy: { updatedAt: 'desc' } }),
    prisma.review.findMany({ where: { hotelId }, include: { guest: true }, take: 300, orderBy: { createdAt: 'desc' } }),
    prisma.conversation.findMany({ where: { hotelId }, include: { guest: true, messages: { take: 2, orderBy: { createdAt: 'desc' } } }, take: 300, orderBy: { updatedAt: 'desc' } }),
    prisma.ticket.findMany({ where: { hotelId }, include: { assignedTo: true, conversation: { include: { guest: true } } }, take: 300, orderBy: { updatedAtUtc: 'desc' } }),
    prisma.cameraFeed.findMany({ where: { hotelId }, take: 300, orderBy: { updatedAt: 'desc' } }),
    prisma.hardwareIntegration.findMany({ where: { hotelId }, take: 500, orderBy: { updatedAt: 'desc' } }),
    prisma.ioTDevice.findMany({ where: { hotelId }, take: 500, orderBy: { updatedAt: 'desc' } }),
    prisma.securityAlert.findMany({ where: { hotelId }, take: 300, orderBy: { updatedAt: 'desc' } }),
    prisma.maintenanceWorkOrder.findMany({ where: { hotelId }, take: 300, orderBy: { updatedAt: 'desc' } }),
    prisma.maintenanceFault.findMany({ where: { hotelId }, take: 300, orderBy: { updatedAt: 'desc' } }),
    prisma.maintenanceRepair.findMany({ where: { hotelId }, take: 300, orderBy: { updatedAt: 'desc' } }),
    prisma.incident.findMany({ where: { hotelId }, take: 300, orderBy: { updatedAt: 'desc' } }),
    prisma.aIRecommendation.findMany({ where: { hotelId }, take: 300, orderBy: { updatedAt: 'desc' } }),
    prisma.user.findMany({ where: { hotelId }, take: 300, orderBy: { updatedAt: 'desc' } }),
    prisma.activityLog.findMany({ where: { user: { hotelId } }, take: 300, orderBy: { createdAt: 'desc' } }),
  ]);

  return [
    ...guests.map((guest) => ({
      entityId: guest.id,
      entityType: 'GUEST',
      sourceModule: 'GUESTS',
      title: `${guest.firstName} ${guest.lastName}`,
      summary: guest.vipStatus ? 'VIP guest profile' : 'Guest profile',
      searchableText: text([guest.firstName, guest.lastName, guest.email, guest.phone, guest.notes, guest.city, guest.country]),
      tags: guest.vipStatus ? ['vip'] : [],
      status: guest.vipStatus ? 'VIP' : 'ACTIVE',
      guestId: guest.id,
      accessScope: ['guests', 'bookings'],
      sourceUrl: `/guests?guest=${guest.id}`,
      sourceCreatedAt: guest.createdAt,
      sourceUpdatedAt: guest.updatedAt,
    })),
    ...bookings.map((booking) => ({
      entityId: booking.id,
      entityType: 'RESERVATION',
      sourceModule: 'RESERVATIONS',
      title: `Reservation ${booking.bookingRef}`,
      summary: `${booking.guest.firstName} ${booking.guest.lastName}${booking.room ? ` / Room ${booking.room.number}` : ''}`,
      searchableText: text([booking.bookingRef, booking.status, booking.source, booking.specialRequests, booking.internalNotes, booking.guest.firstName, booking.guest.lastName, booking.guest.email, booking.room?.number]),
      status: booking.status,
      roomNumber: booking.room?.number,
      guestId: booking.guestId,
      reservationId: booking.id,
      accessScope: ['bookings'],
      sourceUrl: `/bookings/${booking.id}`,
      sourceCreatedAt: booking.createdAt,
      sourceUpdatedAt: booking.updatedAt,
    })),
    ...rooms.map((room) => ({
      entityId: room.id,
      entityType: 'ROOM',
      sourceModule: 'ROOMS',
      title: `Room ${room.number}`,
      summary: `${room.roomType.name} / ${room.status} / Housekeeping ${room.housekeepingStatus}`,
      searchableText: text([room.number, room.floor, room.status, room.housekeepingStatus, room.notes, room.roomType.name]),
      status: room.status,
      hotelArea: `Floor ${room.floor}`,
      roomNumber: room.number,
      accessScope: ['rooms', 'housekeeping'],
      sourceUrl: `/rooms?room=${room.id}`,
      sourceCreatedAt: room.createdAt,
      sourceUpdatedAt: room.updatedAt,
    })),
    ...invoices.map((invoice) => ({
      entityId: invoice.id,
      entityType: 'FINANCIAL',
      sourceModule: 'FINANCIALS',
      title: `Invoice ${invoice.invoiceNo}`,
      summary: `${invoice.status} / ${invoice.total.toString()} for ${invoice.booking.guest.firstName} ${invoice.booking.guest.lastName}`,
      searchableText: text([invoice.invoiceNo, invoice.status, invoice.total, invoice.booking.bookingRef, invoice.booking.guest.firstName, invoice.booking.guest.lastName]),
      status: invoice.status,
      guestId: invoice.booking.guestId,
      reservationId: invoice.bookingId,
      accessScope: ['financials'],
      sourceUrl: `/invoices`,
      sourceCreatedAt: invoice.createdAt,
      sourceUpdatedAt: invoice.createdAt,
    })),
    ...inventoryItems.map((item) => ({
      entityId: item.id,
      entityType: 'INVENTORY',
      sourceModule: 'INVENTORY',
      title: item.name,
      summary: `${item.category} / ${item.quantityOnHand} ${item.unit}`,
      searchableText: text([item.name, item.category, item.location, item.unit]),
      status: item.quantityOnHand <= item.reorderPoint ? 'LOW_STOCK' : 'AVAILABLE',
      hotelArea: item.location,
      accessScope: ['inventory'],
      sourceUrl: '/inventory',
      sourceCreatedAt: item.createdAt,
      sourceUpdatedAt: item.updatedAt,
    })),
    ...reviews.map((review) => ({
      entityId: review.id,
      entityType: 'REVIEW',
      sourceModule: 'REVIEWS',
      title: `${review.rating}-star review`,
      summary: review.comment,
      searchableText: text([review.comment, review.source, review.guest?.firstName, review.guest?.lastName]),
      status: review.response ? 'RESPONDED' : 'OPEN',
      guestId: review.guestId,
      accessScope: ['reviews'],
      sourceUrl: '/reviews',
      sourceCreatedAt: review.createdAt,
      sourceUpdatedAt: review.updatedAt,
    })),
    ...conversations.map((conversation) => ({
      entityId: conversation.id,
      entityType: 'MESSAGE',
      sourceModule: 'MESSAGES',
      title: conversation.subject || `Conversation ${conversation.id.slice(0, 8)}`,
      summary: conversation.messages[0]?.body || 'Guest conversation',
      searchableText: text([conversation.subject, conversation.status, conversation.guest?.firstName, conversation.guest?.lastName, ...conversation.messages.map((message) => message.body)]),
      status: conversation.status,
      guestId: conversation.guestId,
      reservationId: conversation.bookingId,
      accessScope: ['messages'],
      sourceUrl: `/messages?thread=${conversation.id}`,
      sourceCreatedAt: conversation.createdAt,
      sourceUpdatedAt: conversation.updatedAt,
    })),
    ...tickets.map((ticket) => ({
      entityId: ticket.id,
      entityType: 'TASK',
      sourceModule: 'TASK_ENGINE',
      title: `${ticket.department} task`,
      summary: ticket.type,
      searchableText: text([ticket.type, ticket.category, ticket.department, ticket.priority, ticket.status, ticket.conversation.guest?.firstName, ticket.conversation.guest?.lastName]),
      status: ticket.status,
      priority: ticket.priority,
      ownerId: ticket.assignedToId,
      guestId: ticket.conversation.guestId,
      reservationId: ticket.conversation.bookingId,
      accessScope: ['messages', 'maintenance_center', 'security_center', 'housekeeping'],
      sourceUrl: `/messages?thread=${ticket.conversationId}`,
      sourceCreatedAt: ticket.createdAtUtc,
      sourceUpdatedAt: ticket.updatedAtUtc,
    })),
    ...cameraFeeds.map((camera) => ({
      entityId: camera.id,
      entityType: 'CCTV',
      sourceModule: 'CCTV',
      title: camera.name,
      summary: `${camera.status}${camera.location ? ` / ${camera.location}` : ''}`,
      searchableText: text([camera.name, camera.location, camera.status, camera.externalId]),
      status: camera.status,
      hotelArea: camera.location,
      accessScope: ['security_center'],
      sourceUrl: '/security-center/cctv',
      sourceCreatedAt: camera.createdAt,
      sourceUpdatedAt: camera.updatedAt,
    })),
    ...hardwareIntegrations.map((integration) => ({
      entityId: integration.id,
      entityType: integration.integrationType === 'CCTV_CAMERA' || integration.integrationType === 'CCTV_NVR' ? 'CCTV' : 'SMART_BUILDING',
      sourceModule: 'INTEGRATION_MANAGER',
      title: integration.name,
      summary: `${integration.provider} ${integration.protocol} / ${integration.status}`,
      searchableText: text([integration.name, integration.location, integration.roomArea, integration.provider, integration.protocol, integration.status, integration.healthStatus, integration.deviceIdentifier]),
      status: integration.status,
      severity: integration.healthStatus === 'CRITICAL' ? 'CRITICAL' : integration.healthStatus,
      hotelArea: integration.roomArea || integration.location,
      accessScope: integration.integrationType === 'CCTV_CAMERA' || integration.integrationType === 'CCTV_NVR' ? ['security_center', 'settings'] : ['smart_building', 'settings'],
      sourceUrl: integration.integrationType === 'CCTV_CAMERA' || integration.integrationType === 'CCTV_NVR' ? '/security-center/cctv' : '/operations/smart-building',
      sourceCreatedAt: integration.createdAt,
      sourceUpdatedAt: integration.updatedAt,
    })),
    ...iotDevices.map((device) => ({
      entityId: device.id,
      entityType: 'SMART_BUILDING',
      sourceModule: 'SMART_BUILDING',
      title: device.name,
      summary: `${device.deviceType} / ${device.status}${device.location ? ` / ${device.location}` : ''}`,
      searchableText: text([device.name, device.deviceType, device.status, device.location, device.zone, device.vendor, device.externalId]),
      status: device.status,
      hotelArea: device.zone || device.location,
      accessScope: ['smart_building'],
      sourceUrl: '/operations/smart-building',
      sourceCreatedAt: device.createdAt,
      sourceUpdatedAt: device.updatedAt,
    })),
    ...securityAlerts.map((alert) => ({
      entityId: alert.id,
      entityType: 'SECURITY',
      sourceModule: 'SECURITY_CENTER',
      title: alert.title,
      summary: alert.message,
      searchableText: text([alert.title, alert.message, alert.alertType, alert.severity, alert.status, alert.location]),
      status: alert.status,
      severity: alert.severity,
      hotelArea: alert.location,
      accessScope: ['security_center'],
      sourceUrl: '/security-center/alerts',
      sourceCreatedAt: alert.createdAt,
      sourceUpdatedAt: alert.updatedAt,
    })),
    ...workOrders.map((order) => ({
      entityId: order.id,
      entityType: 'MAINTENANCE',
      sourceModule: 'MAINTENANCE_CENTER',
      title: order.title,
      summary: order.description,
      searchableText: text([order.title, order.description, order.category, order.assetName, order.priority, order.status, order.location]),
      status: order.status,
      priority: order.priority,
      hotelArea: order.location,
      ownerId: order.assignedTo,
      accessScope: ['maintenance_center'],
      sourceUrl: '/maintenance-center/work-orders',
      sourceCreatedAt: order.createdAt,
      sourceUpdatedAt: order.updatedAt,
    })),
    ...faults.map((fault) => ({
      entityId: fault.id,
      entityType: 'MAINTENANCE',
      sourceModule: 'MAINTENANCE_CENTER',
      title: fault.title,
      summary: fault.description,
      searchableText: text([fault.title, fault.description, fault.location, fault.assetName, fault.severity, fault.status]),
      status: fault.status,
      severity: fault.severity,
      hotelArea: fault.location,
      accessScope: ['maintenance_center'],
      sourceUrl: '/maintenance-center/faults',
      sourceCreatedAt: fault.createdAt,
      sourceUpdatedAt: fault.updatedAt,
    })),
    ...repairs.map((repair) => ({
      entityId: repair.id,
      entityType: 'MAINTENANCE',
      sourceModule: 'MAINTENANCE_CENTER',
      title: repair.title,
      summary: repair.description,
      searchableText: text([repair.title, repair.description, repair.technician, repair.status]),
      status: repair.status,
      accessScope: ['maintenance_center'],
      sourceUrl: '/maintenance-center/repairs',
      sourceCreatedAt: repair.createdAt,
      sourceUpdatedAt: repair.updatedAt,
    })),
    ...incidents.map((incident) => ({
      entityId: incident.id,
      entityType: 'INCIDENT',
      sourceModule: 'INCIDENT_CENTER',
      title: `${incident.incidentNumber} ${incident.title}`,
      summary: incident.description,
      searchableText: text([incident.incidentNumber, incident.title, incident.description, incident.category, incident.severity, incident.status, incident.sourceModule, incident.linkedEntityType, incident.linkedEntityId]),
      status: incident.status,
      severity: incident.severity,
      ownerId: incident.assignedManagerId,
      accessScope: ['incident_management', 'security_center', 'maintenance_center', 'smart_building'],
      sourceUrl: '/incidents',
      sourceCreatedAt: incident.createdAt,
      sourceUpdatedAt: incident.updatedAt,
    })),
    ...aiRecommendations.map((recommendation) => ({
      entityId: recommendation.id,
      entityType: 'AI_RECOMMENDATION',
      sourceModule: 'HOTEL_BRAIN',
      title: recommendation.title,
      summary: recommendation.description,
      searchableText: text([recommendation.title, recommendation.description, recommendation.rationale, recommendation.category, recommendation.department, recommendation.priority, recommendation.status]),
      status: recommendation.status,
      priority: recommendation.priority,
      accessScope: ['dashboard', 'bookings', 'settings'],
      sourceUrl: '/operations-center/ai',
      sourceCreatedAt: recommendation.createdAt,
      sourceUpdatedAt: recommendation.updatedAt,
    })),
    ...users.map((user) => ({
      entityId: user.id,
      entityType: 'USER',
      sourceModule: 'USER_MANAGEMENT',
      title: `${user.firstName} ${user.lastName}`,
      summary: `${user.role} / ${user.isActive ? 'Active' : 'Inactive'}`,
      searchableText: text([user.firstName, user.lastName, user.email, user.role]),
      status: user.isActive ? 'ACTIVE' : 'INACTIVE',
      ownerId: user.id,
      accessScope: ['users', 'settings'],
      sourceUrl: '/users',
      sourceCreatedAt: user.createdAt,
      sourceUpdatedAt: user.updatedAt,
    })),
    ...activityLogs.map((log) => ({
      entityId: log.id,
      entityType: 'AUDIT_LOG',
      sourceModule: 'AUDIT_ENGINE',
      title: `${log.action} ${log.entity}`,
      summary: log.entityId || undefined,
      searchableText: text([log.action, log.entity, log.entityId, JSON.stringify(log.details || {})]),
      accessScope: ['settings', 'users'],
      sourceUrl: '/settings?tab=audit-trail',
      sourceCreatedAt: log.createdAt,
      sourceUpdatedAt: log.createdAt,
    })),
  ];
}

export async function rebuildSearchIndex(hotelId: string, actor?: EnterpriseSearchActor) {
  await eventBus.publish({
    eventType: 'search.index.rebuildRequested',
    hotelId,
    source: 'enterprise-search',
    userId: actor?.userId,
    payload: { requestedBy: actor?.userId || null },
  });

  try {
    const records = await collectIndexRecords(hotelId);
    for (const record of records) {
      await upsertSearchIndexRecord(hotelId, record);
    }
    await eventBus.publish({
      eventType: 'search.index.rebuildCompleted',
      hotelId,
      source: 'enterprise-search',
      userId: actor?.userId,
      payload: { indexedRecords: records.length },
    });
    return { indexedRecords: records.length, indexedAt: new Date().toISOString() };
  } catch (error) {
    await eventBus.publish({
      eventType: 'search.index.rebuildFailed',
      hotelId,
      source: 'enterprise-search',
      userId: actor?.userId,
      payload: { message: error instanceof Error ? error.message : 'Unknown search index rebuild error' },
    });
    throw error;
  }
}

export async function searchEnterpriseIndex(hotelId: string, actor: EnterpriseSearchActor, filters: EnterpriseSearchFilters): Promise<EnterpriseSearchResponse> {
  const query = (filters.query || '').trim();
  const limit = Math.min(Math.max(filters.limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const and: Prisma.SearchIndexWhereInput[] = [{ hotelId }];

  if (query) {
    and.push({
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { summary: { contains: query, mode: 'insensitive' } },
        { searchableText: { contains: query, mode: 'insensitive' } },
        { roomNumber: { contains: query, mode: 'insensitive' } },
      ],
    });
  }
  if (filters.categories?.length) and.push({ entityType: { in: filters.categories } });
  if (filters.sourceModules?.length) and.push({ sourceModule: { in: filters.sourceModules } });
  if (filters.status) and.push({ status: filters.status });
  if (filters.priority) and.push({ priority: filters.priority });
  if (filters.severity) and.push({ severity: filters.severity });
  if (filters.ownerId) and.push({ ownerId: filters.ownerId });
  if (filters.dateFrom || filters.dateTo) {
    and.push({
      sourceUpdatedAt: {
        gte: filters.dateFrom,
        lte: filters.dateTo,
      },
    });
  }

  const rows = await prisma.searchIndex.findMany({
    where: { AND: and },
    orderBy: [{ sourceUpdatedAt: 'desc' }, { indexedAt: 'desc' }],
    take: limit * 3,
  });

  const allowed = rows.filter((row) => canRead(actor, row.accessScope));
  const results = allowed.slice(0, limit).map((row) => toResult(row, query));
  const groups = Object.values(
    results.reduce<Record<string, { category: string; count: number; results: EnterpriseSearchResult[] }>>((acc, result) => {
      if (!acc[result.category]) acc[result.category] = { category: result.category, count: 0, results: [] };
      acc[result.category].count += 1;
      acc[result.category].results.push(result);
      return acc;
    }, {})
  );

  await eventBus.publish({
    eventType: results.length ? 'enterpriseSearch.results.returned' : 'enterpriseSearch.noResults',
    hotelId,
    source: 'enterprise-search',
    userId: actor.userId,
    payload: {
      query,
      total: results.length,
      restrictedCount: rows.length - allowed.length,
      categories: groups.map((group) => group.category),
    },
  });

  return {
    query,
    results,
    groups,
    total: results.length,
    restrictedCount: rows.length - allowed.length,
    generatedAt: new Date().toISOString(),
  };
}

export async function answerHotelBrainQuestion(hotelId: string, actor: EnterpriseSearchActor, question: string): Promise<HotelBrainAnswer> {
  const query = question.trim();
  const search = await searchEnterpriseIndex(hotelId, actor, { query, limit: 8 });
  const context = await buildHotelContext(hotelId, { limit: 8 });
  const supportingRecords = search.results.slice(0, 5);
  const critical = supportingRecords.filter((result) => result.severity === 'CRITICAL' || result.priority === 'CRITICAL');
  const warnings: string[] = [];

  if (!supportingRecords.length) {
    warnings.push('No matching indexed operational records were found. Rebuild the index or connect more operational data if this looks incomplete.');
  }
  if (search.restrictedCount > 0) {
    warnings.push(`${search.restrictedCount} restricted result${search.restrictedCount === 1 ? '' : 's'} omitted based on your permissions.`);
  }

  const answer = supportingRecords.length
    ? `I found ${supportingRecords.length} authorised record${supportingRecords.length === 1 ? '' : 's'} related to this question. ${critical.length ? `${critical.length} critical item${critical.length === 1 ? '' : 's'} should be reviewed first.` : 'No critical matching item is visible in your authorised results.'}`
    : 'I do not have enough authorised indexed data to answer that with evidence.';

  const suggestedActions = critical.length
    ? [
        {
          title: 'Review critical matching records',
          description: 'Open the linked records and confirm ownership before taking action.',
          department: 'OPERATIONS',
          priority: 'HIGH' as const,
          requiresConfirmation: true,
        },
      ]
    : [
        {
          title: 'Refine search or rebuild index',
          description: 'Try a room number, guest name, incident number, or rebuild the Enterprise Search index.',
          department: 'OPERATIONS',
          priority: 'LOW' as const,
          requiresConfirmation: false,
        },
      ];

  await eventBus.publish({
    eventType: supportingRecords.length ? 'hotelBrain.answer.generated' : 'hotelBrain.answer.failed',
    hotelId,
    source: 'hotel-brain',
    userId: actor.userId,
    payload: {
      questionLength: query.length,
      supportingRecordCount: supportingRecords.length,
      restrictedCount: search.restrictedCount,
    },
  });

  return {
    answer,
    confidence: supportingRecords.length ? 0.72 : 0.35,
    supportingRecords,
    citedContextSections: Object.keys(context).filter((key) => !['metadata'].includes(key)).slice(0, 8),
    suggestedActions,
    safetyWarnings: warnings,
    generatedAt: new Date().toISOString(),
  };
}

let handlersRegistered = false;

export function registerEnterpriseSearchEventHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;
  eventBus.subscribeAll(async (event: PlatformEvent) => {
    if (!EVENT_TYPES_TO_INDEX.has(event.metadata.eventType)) return;
    await eventBus.publish({
      eventType: 'search.index.updated',
      hotelId: event.metadata.hotelId,
      source: 'enterprise-search',
      correlationId: event.metadata.correlationId,
      causationId: event.metadata.eventId,
      idempotencyKey: `search-index-event:${event.metadata.eventId}`,
      payload: {
        sourceEventType: event.metadata.eventType,
        sourceEventId: event.metadata.eventId,
        mode: 'event-received',
      },
    });
  });
}
