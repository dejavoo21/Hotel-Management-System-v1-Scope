import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';
import { AppError, ValidationError, NotFoundError } from '../middleware/errorHandler.js';

interface BookingFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
  guestId?: string;
  roomId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface AvailabilityQuery {
  checkInDate: string;
  checkOutDate: string;
  roomTypeId?: string;
  guests?: number;
}

function generateBookingRef(): string {
  const prefix = 'BK';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

function calculateTotal(roomRate: number, checkInDate: Date, checkOutDate: Date) {
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
  return roomRate * nights;
}

export async function getAllBookings(hotelId: string, filters: BookingFilters) {
  const { status, startDate, endDate, guestId, roomId, search, page = 1, limit = 20 } = filters;

  const where: Prisma.BookingWhereInput = {
    hotelId,
    ...(status && { status }),
    ...(guestId && { guestId }),
    ...(roomId && { roomId }),
    ...(startDate && { checkInDate: { gte: new Date(startDate) } }),
    ...(endDate && { checkOutDate: { lte: new Date(endDate) } }),
    ...(search && {
      OR: [
        { bookingRef: { contains: search, mode: 'insensitive' } },
        { guest: { firstName: { contains: search, mode: 'insensitive' } } },
        { guest: { lastName: { contains: search, mode: 'insensitive' } } },
        { room: { number: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        guest: true,
        room: { include: { roomType: true } },
        charges: true,
        payments: true,
      },
      orderBy: { checkInDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    data: bookings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

export async function getBookingsCalendar(hotelId: string, startDate?: string, endDate?: string) {
  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return prisma.booking.findMany({
    where: {
      hotelId,
      checkInDate: { lte: end },
      checkOutDate: { gte: start },
    },
    include: {
      guest: { select: { firstName: true, lastName: true } },
      room: { select: { number: true } },
    },
    orderBy: { checkInDate: 'asc' },
  });
}

export async function checkAvailability(hotelId: string, query: AvailabilityQuery) {
  const checkInDate = new Date(query.checkInDate);
  const checkOutDate = new Date(query.checkOutDate);

  if (checkInDate >= checkOutDate) {
    throw new ValidationError('Check-out date must be after check-in date');
  }

  const rooms = await prisma.room.findMany({
    where: {
      hotelId,
      status: 'AVAILABLE',
      isActive: true,
      ...(query.roomTypeId && { roomTypeId: query.roomTypeId }),
      bookings: {
        none: {
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          OR: [{ checkInDate: { lte: checkOutDate }, checkOutDate: { gte: checkInDate } }],
        },
      },
    },
    include: { roomType: true },
    orderBy: [{ floor: 'asc' }, { number: 'asc' }],
  });

  return {
    available: rooms.length > 0,
    rooms,
  };
}

export async function getBookingById(hotelId: string, id: string) {
  const booking = await prisma.booking.findFirst({
    where: { id, hotelId },
    include: {
      guest: true,
      room: { include: { roomType: true } },
      charges: { orderBy: { date: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' } },
      invoices: true,
    },
  });

  if (!booking) throw new NotFoundError('Booking');
  return booking;
}

export async function createBooking(hotelId: string, userId: string, data: any) {
  const checkInDate = new Date(data.checkInDate);
  const checkOutDate = new Date(data.checkOutDate);

  if (checkInDate >= checkOutDate) {
    throw new ValidationError('Check-out date must be after check-in date');
  }

  let guestId = data.guestId as string | undefined;
  if (!guestId && data.guest) {
    const guest = await prisma.guest.create({
      data: {
        hotelId,
        firstName: data.guest.firstName,
        lastName: data.guest.lastName,
        email: data.guest.email || null,
        phone: data.guest.phone || null,
      },
    });
    guestId = guest.id;
  }

  if (!guestId) {
    throw new ValidationError('Guest information is required');
  }

  let roomRate = data.roomRate as number | undefined;
  if (!roomRate && data.roomTypeId) {
    const roomType = await prisma.roomType.findFirst({
      where: { id: data.roomTypeId, hotelId },
    });
    roomRate = roomType ? Number(roomType.baseRate) : undefined;
  }

  if (!roomRate) {
    throw new ValidationError('Room rate is required');
  }

  if (data.roomId) {
    const conflicts = await prisma.booking.count({
      where: {
        roomId: data.roomId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        OR: [{ checkInDate: { lte: checkOutDate }, checkOutDate: { gte: checkInDate } }],
      },
    });
    if (conflicts > 0) {
      throw new AppError('Room is not available for the selected dates', 400);
    }
  }

  const totalAmount = calculateTotal(roomRate, checkInDate, checkOutDate);

  const booking = await prisma.booking.create({
    data: {
      hotelId,
      guestId,
      roomId: data.roomId || null,
      bookingRef: generateBookingRef(),
      checkInDate,
      checkOutDate,
      numberOfAdults: data.numberOfAdults || 1,
      numberOfChildren: data.numberOfChildren || 0,
      source: data.source || 'DIRECT',
      paymentMethod: data.paymentMethod || null,
      specialRequests: data.specialRequests,
      internalNotes: data.internalNotes,
      roomRate,
      totalAmount,
    },
    include: {
      guest: true,
      room: { include: { roomType: true } },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      bookingId: booking.id,
      action: 'BOOKING_CREATED',
      entity: 'booking',
      entityId: booking.id,
      details: { bookingRef: booking.bookingRef },
    },
  });

  await prisma.conversation.create({
    data: {
      hotelId,
      guestId,
      bookingId: booking.id,
      subject: `Reservation ${booking.bookingRef}`,
      status: 'OPEN',
      lastMessageAt: new Date(),
      messages: {
        create: {
          senderType: 'SYSTEM',
          body: `Reservation created for ${booking.guest.firstName} ${booking.guest.lastName}.`,
        },
      },
    },
  });

  return booking;
}

export async function updateBooking(hotelId: string, id: string, userId: string, data: any) {
  const booking = await getBookingById(hotelId, id);

  const checkInDate = data.checkInDate ? new Date(data.checkInDate) : booking.checkInDate;
  const checkOutDate = data.checkOutDate ? new Date(data.checkOutDate) : booking.checkOutDate;
  const roomRate = data.roomRate ? data.roomRate : Number(booking.roomRate);

  if (checkInDate >= checkOutDate) {
    throw new ValidationError('Check-out date must be after check-in date');
  }

  const totalAmount = calculateTotal(roomRate, checkInDate, checkOutDate);

  const updated = await prisma.booking.update({
    where: { id },
    data: {
      ...data,
      checkInDate,
      checkOutDate,
      roomRate,
      totalAmount,
    },
    include: {
      guest: true,
      room: { include: { roomType: true } },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      bookingId: id,
      action: 'BOOKING_UPDATED',
      entity: 'booking',
      entityId: id,
    },
  });

  return updated;
}

export async function cancelBooking(hotelId: string, id: string, userId: string) {
  const booking = await getBookingById(hotelId, id);

  if (['CHECKED_OUT', 'CANCELLED'].includes(booking.status)) {
    throw new AppError(`Cannot cancel a booking with status: ${booking.status}`, 400);
  }

  await prisma.$transaction([
    prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } }),
    prisma.activityLog.create({
      data: {
        userId,
        bookingId: id,
        action: 'BOOKING_CANCELLED',
        entity: 'booking',
        entityId: id,
      },
    }),
  ]);
}

export async function checkIn(hotelId: string, id: string, userId: string, roomId: string, notes?: string) {
  const booking = await getBookingById(hotelId, id);

  if (booking.status !== 'CONFIRMED') {
    throw new AppError(`Cannot check in a booking with status: ${booking.status}`, 400);
  }

  const balance = Number(booking.totalAmount) - Number(booking.paidAmount);
  if (!booking.paymentConfirmed && balance > 0) {
    throw new AppError('Payment must be confirmed before check-in', 400);
  }

  const finalRoomId = roomId || booking.roomId;
  if (!finalRoomId) {
    throw new ValidationError('Room must be assigned for check-in');
  }

  const room = await prisma.room.findUnique({ where: { id: finalRoomId } });
  if (!room) throw new NotFoundError('Room');

  if (room.status !== 'AVAILABLE') {
    throw new AppError('Room is not available', 400);
  }

  if (room.housekeepingStatus !== 'CLEAN') {
    throw new AppError('Room is not clean', 400);
  }

  const [updatedBooking] = await prisma.$transaction([
    prisma.booking.update({
      where: { id },
      data: {
        status: 'CHECKED_IN',
        roomId: finalRoomId,
        actualCheckIn: new Date(),
      },
      include: { guest: true, room: { include: { roomType: true } } },
    }),
    prisma.room.update({
      where: { id: finalRoomId },
      data: { status: 'OCCUPIED', notes: notes || room.notes },
    }),
    prisma.activityLog.create({
      data: {
        userId,
        bookingId: id,
        action: 'CHECK_IN',
        entity: 'booking',
        entityId: id,
      },
    }),
  ]);

  return updatedBooking;
}

export async function checkOut(hotelId: string, id: string, userId: string) {
  const booking = await getBookingById(hotelId, id);

  if (booking.status !== 'CHECKED_IN') {
    throw new AppError(`Cannot check out a booking with status: ${booking.status}`, 400);
  }

  if (!booking.roomId) {
    throw new ValidationError('No room assigned to this booking');
  }

  const [updatedBooking] = await prisma.$transaction([
    prisma.booking.update({
      where: { id },
      data: {
        status: 'CHECKED_OUT',
        actualCheckOut: new Date(),
      },
      include: { guest: true, room: { include: { roomType: true } } },
    }),
    prisma.room.update({
      where: { id: booking.roomId },
      data: { status: 'AVAILABLE', housekeepingStatus: 'DIRTY' },
    }),
    prisma.guest.update({
      where: { id: booking.guestId },
      data: {
        totalStays: { increment: 1 },
        totalSpent: { increment: Number(booking.totalAmount) },
      },
    }),
    prisma.activityLog.create({
      data: {
        userId,
        bookingId: id,
        action: 'CHECK_OUT',
        entity: 'booking',
        entityId: id,
      },
    }),
  ]);

  return updatedBooking;
}

export async function getBookingCharges(hotelId: string, bookingId: string) {
  await getBookingById(hotelId, bookingId);
  return prisma.charge.findMany({
    where: { bookingId },
    orderBy: { date: 'desc' },
  });
}

export async function addCharge(hotelId: string, bookingId: string, userId: string, data: any) {
  await getBookingById(hotelId, bookingId);

  const charge = await prisma.charge.create({
    data: {
      bookingId,
      description: data.description,
      category: data.category,
      amount: data.amount * (data.quantity || 1),
      quantity: data.quantity || 1,
      unitPrice: data.amount,
    },
  });

  await prisma.booking.update({
    where: { id: bookingId },
    data: { totalAmount: { increment: charge.amount } },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      bookingId,
      action: 'CHARGE_ADDED',
      entity: 'booking',
      entityId: bookingId,
    },
  });

  return charge;
}

export async function voidCharge(hotelId: string, bookingId: string, userId: string, chargeId: string, reason?: string) {
  await getBookingById(hotelId, bookingId);

  const charge = await prisma.charge.findFirst({ where: { id: chargeId, bookingId } });
  if (!charge) throw new NotFoundError('Charge');

  if (charge.isVoided) {
    throw new AppError('Charge is already voided', 400);
  }

  await prisma.$transaction([
    prisma.charge.update({ where: { id: chargeId }, data: { isVoided: true, voidReason: reason } }),
    prisma.booking.update({
      where: { id: bookingId },
      data: { totalAmount: { decrement: charge.amount } },
    }),
  ]);
}

export async function getBookingPayments(hotelId: string, bookingId: string) {
  await getBookingById(hotelId, bookingId);
  return prisma.payment.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addPayment(hotelId: string, bookingId: string, userId: string, data: any) {
  const booking = await getBookingById(hotelId, bookingId);

  const payment = await prisma.payment.create({
    data: {
      bookingId,
      amount: data.amount,
      method: data.method,
      reference: data.reference,
      notes: data.notes,
      status: 'COMPLETED',
    },
  });

  const newPaidAmount = Number(booking.paidAmount) + Number(data.amount);
  const shouldConfirm = newPaidAmount >= Number(booking.totalAmount);

  await prisma.booking.update({
    where: { id: bookingId },
    data: { paidAmount: { increment: data.amount } },
  });

  if (shouldConfirm && !booking.paymentConfirmed) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { paymentConfirmed: true },
    });
  }

  await prisma.activityLog.create({
    data: {
      userId,
      bookingId,
      action: 'PAYMENT_ADDED',
      entity: 'booking',
      entityId: bookingId,
    },
  });

  return payment;
}

export async function confirmPayment(hotelId: string, bookingId: string, userId: string, paymentMethod?: string) {
  await getBookingById(hotelId, bookingId);

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentConfirmed: true,
      ...(paymentMethod ? { paymentMethod: paymentMethod as any } : {}),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      bookingId,
      action: 'PAYMENT_CONFIRMED',
      entity: 'booking',
      entityId: bookingId,
    },
  });

  return updated;
}
