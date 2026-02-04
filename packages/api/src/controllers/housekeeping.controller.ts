import { Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { emitToHotel } from '../socket/index.js';
import { startOfDay, endOfDay } from '../utils/date.js';

export async function getRoomsByStatus(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { status, floor, priority } = req.query;

    const where: Record<string, unknown> = { hotelId, isActive: true };
    if (status) where.housekeepingStatus = status;
    if (floor) where.floor = parseInt(floor as string);

    const rooms = await prisma.room.findMany({
      where,
      include: {
        roomType: { select: { name: true } },
        bookings: {
          where: { status: 'CHECKED_IN' },
          include: { guest: { select: { firstName: true, lastName: true, vipStatus: true } } },
          take: 1,
        },
      },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });

    res.json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
}

export async function getHousekeepingSummary(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;

    const statusCounts = await prisma.room.groupBy({
      by: ['housekeepingStatus'],
      where: { hotelId, isActive: true },
      _count: true,
    });

    res.json({
      success: true,
      data: {
        clean: statusCounts.find(s => s.housekeepingStatus === 'CLEAN')?._count || 0,
        dirty: statusCounts.find(s => s.housekeepingStatus === 'DIRTY')?._count || 0,
        inspection: statusCounts.find(s => s.housekeepingStatus === 'INSPECTION')?._count || 0,
        outOfService: statusCounts.find(s => s.housekeepingStatus === 'OUT_OF_SERVICE')?._count || 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getPriorityRooms(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const today = new Date();

    const rooms = await prisma.room.findMany({
      where: {
        hotelId,
        isActive: true,
        housekeepingStatus: 'DIRTY',
        bookings: {
          some: {
            checkInDate: { gte: startOfDay(today), lte: endOfDay(today) },
            status: 'CONFIRMED',
          },
        },
      },
      include: {
        roomType: { select: { name: true } },
        bookings: {
          where: { checkInDate: { gte: startOfDay(today), lte: endOfDay(today) } },
          take: 1,
        },
      },
      take: 10,
    });

    res.json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
}

export async function updateRoomStatus(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const { roomId } = req.params;
    const { status, notes } = req.body;

    const room = await prisma.room.findFirst({ where: { id: roomId, hotelId } });
    if (!room) throw new NotFoundError('Room');

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { housekeepingStatus: status },
    });

    await prisma.housekeepingLog.create({
      data: { roomId, userId, fromStatus: room.housekeepingStatus, toStatus: status, notes },
    });

    const io = req.app.get('io') as SocketIOServer;
    emitToHotel(io, hotelId, 'housekeeping:updated', {
      roomId,
      status,
      roomNumber: room.number,
    });

    res.json({ success: true, data: updated, message: 'Status updated' });
  } catch (error) {
    next(error);
  }
}

export async function getRoomHistory(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { roomId } = req.params;

    const room = await prisma.room.findFirst({ where: { id: roomId, hotelId } });
    if (!room) throw new NotFoundError('Room');

    const history = await prisma.housekeepingLog.findMany({
      where: { roomId },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
}

export async function getMaintenanceIssues(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;

    const issues = await prisma.maintenanceIssue.findMany({
      where: { room: { hotelId }, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      include: { room: { select: { number: true, floor: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    res.json({ success: true, data: issues });
  } catch (error) {
    next(error);
  }
}

export async function reportIssue(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { roomId } = req.params;

    const room = await prisma.room.findFirst({ where: { id: roomId, hotelId } });
    if (!room) throw new NotFoundError('Room');

    const issue = await prisma.maintenanceIssue.create({
      data: { roomId, ...req.body },
    });

    res.status(201).json({ success: true, data: issue, message: 'Issue reported' });
  } catch (error) {
    next(error);
  }
}

export async function updateIssue(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { issueId } = req.params;
    const { status, notes } = req.body;

    const issue = await prisma.maintenanceIssue.update({
      where: { id: issueId },
      data: {
        status,
        ...(status === 'RESOLVED' || status === 'CLOSED' ? { resolvedAt: new Date() } : {}),
      },
    });

    res.json({ success: true, data: issue, message: 'Issue updated' });
  } catch (error) {
    next(error);
  }
}
