import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler.js';
import { RoomStatus, HousekeepingStatus } from '@prisma/client';
import { startOfDay, endOfDay, getDateRange } from '../utils/date.js';

interface RoomFilters {
  status?: string;
  housekeepingStatus?: string;
  floor?: number;
  roomTypeId?: string;
  isActive?: boolean;
}

interface CreateRoomData {
  roomTypeId: string;
  number: string;
  floor: number;
  notes?: string;
}

interface UpdateRoomData {
  roomTypeId?: string;
  number?: string;
  floor?: number;
  notes?: string | null;
  isActive?: boolean;
}

/**
 * Get all rooms for a hotel with filters
 */
export async function getAllRooms(hotelId: string, filters: RoomFilters) {
  const where: Record<string, unknown> = { hotelId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.housekeepingStatus) {
    where.housekeepingStatus = filters.housekeepingStatus;
  }
  if (filters.floor !== undefined) {
    where.floor = filters.floor;
  }
  if (filters.roomTypeId) {
    where.roomTypeId = filters.roomTypeId;
  }
  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  const rooms = await prisma.room.findMany({
    where,
    include: {
      roomType: {
        select: {
          id: true,
          name: true,
          baseRate: true,
        },
      },
      bookings: {
        where: {
          status: 'CHECKED_IN',
        },
        include: {
          guest: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              vipStatus: true,
            },
          },
        },
        take: 1,
      },
    },
    orderBy: [{ floor: 'asc' }, { number: 'asc' }],
  });

  return rooms.map(room => ({
    ...room,
    currentGuest: room.bookings[0]?.guest || null,
    currentBooking: room.bookings[0] || null,
  }));
}

/**
 * Get room by ID
 */
export async function getRoomById(hotelId: string, roomId: string) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, hotelId },
    include: {
      roomType: true,
      bookings: {
        where: {
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        },
        include: {
          guest: true,
        },
        orderBy: { checkInDate: 'asc' },
        take: 5,
      },
      housekeepingLogs: {
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      maintenanceIssues: {
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!room) {
    throw new NotFoundError('Room');
  }

  return room;
}

/**
 * Get room availability for a date range
 */
export async function getAvailability(
  hotelId: string,
  startDate: string,
  endDate: string,
  roomTypeId?: string
) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Get all rooms
  const rooms = await prisma.room.findMany({
    where: {
      hotelId,
      isActive: true,
      ...(roomTypeId && { roomTypeId }),
    },
    include: {
      roomType: {
        select: { id: true, name: true, baseRate: true },
      },
      bookings: {
        where: {
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          OR: [
            { checkInDate: { lte: end }, checkOutDate: { gte: start } },
          ],
        },
        select: {
          id: true,
          checkInDate: true,
          checkOutDate: true,
          status: true,
          guest: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: [{ floor: 'asc' }, { number: 'asc' }],
  });

  // Build availability grid
  const dateRange = getDateRange(start, end);

  return rooms.map(room => ({
    id: room.id,
    number: room.number,
    floor: room.floor,
    roomType: room.roomType,
    status: room.status,
    availability: dateRange.map(date => {
      const dateStart = startOfDay(date);
      const dateEnd = endOfDay(date);

      const booking = room.bookings.find(b => {
        const checkIn = new Date(b.checkInDate);
        const checkOut = new Date(b.checkOutDate);
        return checkIn <= dateEnd && checkOut >= dateStart;
      });

      return {
        date: date.toISOString().split('T')[0],
        available: !booking && room.status !== 'OUT_OF_SERVICE',
        booking: booking ? {
          id: booking.id,
          guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
          status: booking.status,
        } : null,
      };
    }),
  }));
}

/**
 * Create a new room
 */
export async function createRoom(hotelId: string, userId: string, data: CreateRoomData) {
  // Check if room number already exists
  const existing = await prisma.room.findFirst({
    where: { hotelId, number: data.number },
  });

  if (existing) {
    throw new ConflictError(`Room ${data.number} already exists`);
  }

  // Verify room type exists
  const roomType = await prisma.roomType.findFirst({
    where: { id: data.roomTypeId, hotelId },
  });

  if (!roomType) {
    throw new ValidationError('Invalid room type');
  }

  const room = await prisma.room.create({
    data: {
      hotelId,
      roomTypeId: data.roomTypeId,
      number: data.number,
      floor: data.floor,
      notes: data.notes,
    },
    include: {
      roomType: true,
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId,
      action: 'ROOM_CREATED',
      entity: 'room',
      entityId: room.id,
      details: { roomNumber: room.number },
    },
  });

  logger.info(`Room created: ${room.number}`);
  return room;
}

/**
 * Update a room
 */
export async function updateRoom(hotelId: string, roomId: string, userId: string, data: UpdateRoomData) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, hotelId },
  });

  if (!room) {
    throw new NotFoundError('Room');
  }

  // Check for duplicate room number
  if (data.number && data.number !== room.number) {
    const existing = await prisma.room.findFirst({
      where: { hotelId, number: data.number, id: { not: roomId } },
    });

    if (existing) {
      throw new ConflictError(`Room ${data.number} already exists`);
    }
  }

  const updated = await prisma.room.update({
    where: { id: roomId },
    data,
    include: {
      roomType: true,
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId,
      action: 'ROOM_UPDATED',
      entity: 'room',
      entityId: roomId,
      details: data,
    },
  });

  return updated;
}

/**
 * Delete a room (soft delete)
 */
export async function deleteRoom(hotelId: string, roomId: string, userId: string) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, hotelId },
  });

  if (!room) {
    throw new NotFoundError('Room');
  }

  // Check for active bookings
  const activeBookings = await prisma.booking.count({
    where: {
      roomId,
      status: { in: ['CONFIRMED', 'CHECKED_IN'] },
    },
  });

  if (activeBookings > 0) {
    throw new ValidationError('Cannot delete room with active bookings');
  }

  await prisma.room.update({
    where: { id: roomId },
    data: { isActive: false },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId,
      action: 'ROOM_DELETED',
      entity: 'room',
      entityId: roomId,
      details: { roomNumber: room.number },
    },
  });

  logger.info(`Room deleted: ${room.number}`);
}

/**
 * Update room status
 */
export async function updateRoomStatus(
  hotelId: string,
  roomId: string,
  userId: string,
  status: RoomStatus,
  notes?: string
) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, hotelId },
  });

  if (!room) {
    throw new NotFoundError('Room');
  }

  const updated = await prisma.room.update({
    where: { id: roomId },
    data: {
      status,
      notes: notes || room.notes,
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId,
      action: 'ROOM_STATUS_CHANGED',
      entity: 'room',
      entityId: roomId,
      details: { from: room.status, to: status, notes },
    },
  });

  return updated;
}

/**
 * Update housekeeping status
 */
export async function updateHousekeepingStatus(
  hotelId: string,
  roomId: string,
  userId: string,
  housekeepingStatus: HousekeepingStatus,
  notes?: string
) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, hotelId },
  });

  if (!room) {
    throw new NotFoundError('Room');
  }

  const updated = await prisma.room.update({
    where: { id: roomId },
    data: { housekeepingStatus },
  });

  // Create housekeeping log
  await prisma.housekeepingLog.create({
    data: {
      roomId,
      userId,
      fromStatus: room.housekeepingStatus,
      toStatus: housekeepingStatus,
      notes,
    },
  });

  logger.info(`Room ${room.number} housekeeping status: ${room.housekeepingStatus} -> ${housekeepingStatus}`);
  return updated;
}
