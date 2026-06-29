import {
  Department,
  GuestJourneyStage,
  GuestJourneyStatus,
  TicketCategory,
  TicketPriority,
  TicketType,
  type Booking,
  type Guest,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { eventBus, type PlatformEvent } from '../platform/event-bus/eventBus.service.js';
import { createTask } from '../platform/tasks/taskEngine.service.js';
import { notifyRoles } from '../platform/notifications/notificationEngine.service.js';
import { recordAuditEvent, type AuditActor } from '../platform/audit/auditEngine.service.js';

type JourneyBooking = Booking & {
  guest?: Guest | null;
  room?: { id: string; number: string } | null;
};

type RecordJourneyStageInput = {
  hotelId: string;
  guestId: string;
  bookingId?: string | null;
  stage: GuestJourneyStage;
  eventType: string;
  summary: string;
  sourceModule: string;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  status?: GuestJourneyStatus;
  metadata?: Record<string, unknown>;
  actor?: AuditActor;
  correlationId?: string;
  idempotencyKey?: string;
};

const SOURCE = 'guest-journey';

const stageLabels: Record<GuestJourneyStage, string> = {
  RESERVATION_CREATED: 'Reservation Created',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  PRE_ARRIVAL: 'Pre-arrival',
  CHECK_IN: 'Check-in',
  IN_STAY: 'In Stay',
  SERVICE_REQUESTS: 'Service Requests',
  MAINTENANCE: 'Maintenance',
  CHECKOUT: 'Checkout',
  INVOICE: 'Invoice',
  REVIEW: 'Review',
  LOYALTY: 'Loyalty',
};

const terminalStages = new Set<GuestJourneyStage>(['REVIEW', 'LOYALTY']);

function asJsonObject(value: Record<string, unknown> = {}): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

async function findOrCreateJourney(input: RecordJourneyStageInput) {
  const existing = await prisma.guestJourney.findFirst({
    where: {
      hotelId: input.hotelId,
      guestId: input.guestId,
      bookingId: input.bookingId || null,
    },
  });

  if (existing) return existing;

  return prisma.guestJourney.create({
    data: {
      hotelId: input.hotelId,
      guestId: input.guestId,
      bookingId: input.bookingId || null,
      currentStage: input.stage,
      status: terminalStages.has(input.stage) ? GuestJourneyStatus.COMPLETED : GuestJourneyStatus.ACTIVE,
      lastEventAt: new Date(),
      aiContextJson: asJsonObject({
        guestId: input.guestId,
        bookingId: input.bookingId || null,
        currentStage: input.stage,
      }),
    },
  });
}

export async function recordGuestJourneyStage(input: RecordJourneyStageInput) {
  const journey = await findOrCreateJourney(input);
  const now = new Date();
  const eventStatus = input.status || GuestJourneyStatus.COMPLETED;
  const journeyStatus = terminalStages.has(input.stage) ? GuestJourneyStatus.COMPLETED : GuestJourneyStatus.ACTIVE;

  const existingEvent = await prisma.guestJourneyEvent.findFirst({
    where: {
      journeyId: journey.id,
      eventType: input.eventType,
      linkedEntityType: input.linkedEntityType || null,
      linkedEntityId: input.linkedEntityId || null,
    },
  });

  const event =
    existingEvent ||
    (await prisma.guestJourneyEvent.create({
      data: {
        journeyId: journey.id,
        hotelId: input.hotelId,
        guestId: input.guestId,
        bookingId: input.bookingId || null,
        stage: input.stage,
        status: eventStatus,
        eventType: input.eventType,
        summary: input.summary,
        sourceModule: input.sourceModule,
        linkedEntityType: input.linkedEntityType || null,
        linkedEntityId: input.linkedEntityId || null,
        metadata: input.metadata ? asJsonObject(input.metadata) : undefined,
      },
    }));

  const updatedJourney = await prisma.guestJourney.update({
    where: { id: journey.id },
    data: {
      currentStage: input.stage,
      status: journeyStatus,
      completedAt: journeyStatus === GuestJourneyStatus.COMPLETED ? now : null,
      lastEventAt: now,
      aiContextJson: asJsonObject({
        ...(journey.aiContextJson && typeof journey.aiContextJson === 'object' && !Array.isArray(journey.aiContextJson)
          ? (journey.aiContextJson as Record<string, unknown>)
          : {}),
        currentStage: input.stage,
        currentStageLabel: stageLabels[input.stage],
        lastSummary: input.summary,
        lastEventType: input.eventType,
        lastEventAt: now.toISOString(),
        sourceModule: input.sourceModule,
      }),
    },
  });

  await eventBus.publish({
    eventType: `guest_journey.${input.stage.toLowerCase()}`,
    hotelId: input.hotelId,
    source: SOURCE,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey || `${journey.id}:${input.eventType}:${input.linkedEntityId || 'none'}`,
    userId: input.actor?.userId || undefined,
    payload: {
      journeyId: journey.id,
      journeyEventId: event.id,
      guestId: input.guestId,
      bookingId: input.bookingId || null,
      stage: input.stage,
      module: input.sourceModule,
      linkedEntityType: input.linkedEntityType || null,
      linkedEntityId: input.linkedEntityId || null,
      summary: input.summary,
      status: updatedJourney.status,
      severity: input.stage === 'MAINTENANCE' ? 'WARNING' : 'INFO',
    },
  });

  await recordAuditEvent({
    hotelId: input.hotelId,
    actor: input.actor,
    action: 'GUEST_JOURNEY_STAGE_RECORDED',
    entity: 'guest_journey',
    entityId: journey.id,
    bookingId: input.bookingId || null,
    details: {
      stage: input.stage,
      eventType: input.eventType,
      summary: input.summary,
      guestJourneyEventId: event.id,
    },
    source: SOURCE,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
  });

  return { journey: updatedJourney, event };
}

export async function getGuestJourneyTimeline(hotelId: string, guestId: string, bookingId?: string) {
  const journeys = await prisma.guestJourney.findMany({
    where: {
      hotelId,
      guestId,
      ...(bookingId ? { bookingId } : {}),
    },
    orderBy: { lastEventAt: 'desc' },
    include: {
      events: { orderBy: { createdAt: 'asc' } },
      booking: { select: { id: true, bookingRef: true, status: true, checkInDate: true, checkOutDate: true } },
    },
  });

  return {
    stages: Object.entries(stageLabels).map(([id, label]) => ({ id, label })),
    journeys,
  };
}

export async function onReservationCreated(input: {
  hotelId: string;
  booking: JourneyBooking;
  actor?: AuditActor;
  correlationId?: string;
}) {
  const guestName = input.booking.guest
    ? `${input.booking.guest.firstName} ${input.booking.guest.lastName}`
    : 'Guest';

  const result = await recordGuestJourneyStage({
    hotelId: input.hotelId,
    guestId: input.booking.guestId,
    bookingId: input.booking.id,
    stage: GuestJourneyStage.RESERVATION_CREATED,
    eventType: 'reservation.created',
    summary: `Reservation ${input.booking.bookingRef} created for ${guestName}.`,
    sourceModule: 'RESERVATIONS',
    linkedEntityType: 'booking',
    linkedEntityId: input.booking.id,
    metadata: {
      bookingRef: input.booking.bookingRef,
      checkInDate: input.booking.checkInDate,
      checkOutDate: input.booking.checkOutDate,
      specialRequests: input.booking.specialRequests || null,
    },
    actor: input.actor,
    correlationId: input.correlationId,
  });

  if (input.booking.specialRequests || input.booking.guest?.vipStatus) {
    await createTask({
      hotelId: input.hotelId,
      title: input.booking.guest?.vipStatus ? 'Prepare VIP pre-arrival plan' : 'Review guest pre-arrival request',
      description:
        input.booking.specialRequests ||
        `VIP guest ${guestName} has an upcoming reservation. Prepare arrival notes and service preferences.`,
      type: TicketType.BOOKING_RELATED,
      category: TicketCategory.BOOKING,
      department: Department.FRONT_DESK,
      priority: input.booking.guest?.vipStatus ? TicketPriority.HIGH : TicketPriority.MEDIUM,
      dueDate: input.booking.checkInDate,
      sourceKey: `guest-journey:pre-arrival:${input.booking.id}`,
      details: {
        sourceModule: 'GUEST_JOURNEY',
        journeyId: result.journey.id,
        linkedEntityType: 'booking',
        linkedEntityId: input.booking.id,
        stage: GuestJourneyStage.PRE_ARRIVAL,
      },
      actor: input.actor,
      source: SOURCE,
      correlationId: input.correlationId,
    });

    await notifyRoles({
      hotelId: input.hotelId,
      roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
      channels: ['DASHBOARD'],
      type: 'SYSTEM',
      title: 'Pre-arrival attention needed',
      body: `${guestName} has ${input.booking.guest?.vipStatus ? 'VIP status' : 'special requests'} for ${input.booking.bookingRef}.`,
      source: SOURCE,
      correlationId: input.correlationId,
      idempotencyKey: `guest-journey:pre-arrival-notify:${input.booking.id}`,
    });
  }

  return result;
}

export async function onPaymentConfirmed(input: {
  hotelId: string;
  booking: JourneyBooking;
  paymentId?: string;
  actor?: AuditActor;
  correlationId?: string;
}) {
  return recordGuestJourneyStage({
    hotelId: input.hotelId,
    guestId: input.booking.guestId,
    bookingId: input.booking.id,
    stage: GuestJourneyStage.PAYMENT_CONFIRMED,
    eventType: 'payment.confirmed',
    summary: `Payment confirmed for reservation ${input.booking.bookingRef}.`,
    sourceModule: 'PAYMENTS',
    linkedEntityType: input.paymentId ? 'payment' : 'booking',
    linkedEntityId: input.paymentId || input.booking.id,
    metadata: { bookingRef: input.booking.bookingRef, paymentId: input.paymentId || null },
    actor: input.actor,
    correlationId: input.correlationId,
  });
}

export async function onCheckIn(input: {
  hotelId: string;
  booking: JourneyBooking;
  actor?: AuditActor;
  correlationId?: string;
}) {
  await recordGuestJourneyStage({
    hotelId: input.hotelId,
    guestId: input.booking.guestId,
    bookingId: input.booking.id,
    stage: GuestJourneyStage.CHECK_IN,
    eventType: 'booking.checked_in',
    summary: `Guest checked in${input.booking.room ? ` to room ${input.booking.room.number}` : ''}.`,
    sourceModule: 'RESERVATIONS',
    linkedEntityType: 'booking',
    linkedEntityId: input.booking.id,
    metadata: { roomId: input.booking.roomId || null, bookingRef: input.booking.bookingRef },
    actor: input.actor,
    correlationId: input.correlationId,
  });

  return recordGuestJourneyStage({
    hotelId: input.hotelId,
    guestId: input.booking.guestId,
    bookingId: input.booking.id,
    stage: GuestJourneyStage.IN_STAY,
    eventType: 'guest.in_stay_started',
    summary: 'Guest stay is active.',
    sourceModule: 'GUESTS',
    linkedEntityType: 'booking',
    linkedEntityId: input.booking.id,
    metadata: { roomId: input.booking.roomId || null, bookingRef: input.booking.bookingRef },
    actor: input.actor,
    correlationId: input.correlationId,
  });
}

export async function onCheckOut(input: {
  hotelId: string;
  booking: JourneyBooking;
  actor?: AuditActor;
  correlationId?: string;
}) {
  return recordGuestJourneyStage({
    hotelId: input.hotelId,
    guestId: input.booking.guestId,
    bookingId: input.booking.id,
    stage: GuestJourneyStage.CHECKOUT,
    eventType: 'booking.checked_out',
    summary: `Guest checked out${input.booking.room ? ` of room ${input.booking.room.number}` : ''}.`,
    sourceModule: 'RESERVATIONS',
    linkedEntityType: 'booking',
    linkedEntityId: input.booking.id,
    metadata: { roomId: input.booking.roomId || null, bookingRef: input.booking.bookingRef },
    actor: input.actor,
    correlationId: input.correlationId,
  });
}

export async function onInvoiceCreated(input: {
  hotelId: string;
  booking: JourneyBooking;
  invoiceId: string;
  invoiceNo: string;
  actor?: AuditActor;
  correlationId?: string;
}) {
  return recordGuestJourneyStage({
    hotelId: input.hotelId,
    guestId: input.booking.guestId,
    bookingId: input.booking.id,
    stage: GuestJourneyStage.INVOICE,
    eventType: 'invoice.created',
    summary: `Invoice ${input.invoiceNo} created for ${input.booking.bookingRef}.`,
    sourceModule: 'FINANCIALS',
    linkedEntityType: 'invoice',
    linkedEntityId: input.invoiceId,
    metadata: { invoiceNo: input.invoiceNo, bookingRef: input.booking.bookingRef },
    actor: input.actor,
    correlationId: input.correlationId,
  });
}

export async function onReviewCreated(input: {
  hotelId: string;
  guestId: string;
  bookingId?: string | null;
  reviewId: string;
  rating: number;
  actor?: AuditActor;
  correlationId?: string;
}) {
  await recordGuestJourneyStage({
    hotelId: input.hotelId,
    guestId: input.guestId,
    bookingId: input.bookingId || null,
    stage: GuestJourneyStage.REVIEW,
    eventType: 'review.created',
    summary: `Guest review recorded with rating ${input.rating}.`,
    sourceModule: 'REVIEWS',
    linkedEntityType: 'review',
    linkedEntityId: input.reviewId,
    metadata: { rating: input.rating },
    actor: input.actor,
    correlationId: input.correlationId,
  });

  return recordGuestJourneyStage({
    hotelId: input.hotelId,
    guestId: input.guestId,
    bookingId: input.bookingId || null,
    stage: GuestJourneyStage.LOYALTY,
    eventType: 'loyalty.updated',
    summary: 'Guest lifecycle reached loyalty follow-up.',
    sourceModule: 'GUESTS',
    linkedEntityType: 'guest',
    linkedEntityId: input.guestId,
    metadata: { reviewId: input.reviewId },
    actor: input.actor,
    correlationId: input.correlationId,
  });
}

let subscriptionsStarted = false;

async function bookingFromEvent(event: PlatformEvent) {
  const payload = event.payload as Record<string, unknown>;
  const bookingId = typeof payload.bookingId === 'string' ? payload.bookingId : null;
  if (!bookingId) return null;
  return prisma.booking.findFirst({
    where: { id: bookingId, hotelId: event.metadata.hotelId },
    include: { guest: true, room: { select: { id: true, number: true } } },
  });
}

export function startGuestJourneyAutomation() {
  if (subscriptionsStarted) return;
  subscriptionsStarted = true;

  eventBus.subscribe('booking.checked_in', async (event) => {
    const booking = await bookingFromEvent(event);
    if (!booking) return;
    await onCheckIn({
      hotelId: event.metadata.hotelId,
      booking,
      actor: { userId: event.metadata.userId },
      correlationId: event.metadata.correlationId,
    });
  });

  eventBus.subscribe('booking.checked_out', async (event) => {
    const booking = await bookingFromEvent(event);
    if (!booking) return;
    await onCheckOut({
      hotelId: event.metadata.hotelId,
      booking,
      actor: { userId: event.metadata.userId },
      correlationId: event.metadata.correlationId,
    });
  });

  logger.info('Guest Journey automation started');
}
