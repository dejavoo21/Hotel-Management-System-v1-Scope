import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { NotFoundError, ConflictError } from '../middleware/errorHandler.js';

export async function getAllRoomTypes(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;

    const roomTypes = await prisma.roomType.findMany({
      where: { hotelId },
      include: {
        _count: { select: { rooms: true } },
      },
      orderBy: { baseRate: 'asc' },
    });

    res.json({ success: true, data: roomTypes });
  } catch (error) {
    next(error);
  }
}

export async function getRoomTypeById(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const roomType = await prisma.roomType.findFirst({
      where: { id, hotelId },
      include: {
        rooms: { where: { isActive: true } },
      },
    });

    if (!roomType) throw new NotFoundError('Room type');
    res.json({ success: true, data: roomType });
  } catch (error) {
    next(error);
  }
}

export async function createRoomType(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;

    const existing = await prisma.roomType.findFirst({
      where: { hotelId, name: req.body.name },
    });
    if (existing) throw new ConflictError('Room type with this name already exists');

    const roomType = await prisma.roomType.create({
      data: { hotelId, ...req.body },
    });

    res.status(201).json({ success: true, data: roomType, message: 'Room type created' });
  } catch (error) {
    next(error);
  }
}

export async function updateRoomType(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const roomType = await prisma.roomType.findFirst({ where: { id, hotelId } });
    if (!roomType) throw new NotFoundError('Room type');

    const updated = await prisma.roomType.update({
      where: { id },
      data: req.body,
    });

    res.json({ success: true, data: updated, message: 'Room type updated' });
  } catch (error) {
    next(error);
  }
}

export async function deleteRoomType(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const roomType = await prisma.roomType.findFirst({ where: { id, hotelId } });
    if (!roomType) throw new NotFoundError('Room type');

    await prisma.roomType.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Room type deleted' });
  } catch (error) {
    next(error);
  }
}
