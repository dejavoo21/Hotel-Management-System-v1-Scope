import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { NotFoundError } from '../middleware/errorHandler.js';

export async function getAllGuests(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { search, vipStatus, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {
      hotelId,
      isDeleted: false,
      NOT: [
        { firstName: 'Deleted', lastName: 'Guest' },
        { notes: 'Guest data deleted on request' },
      ],
    };
    if (vipStatus === 'true') where.vipStatus = true;
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { lastName: 'asc' },
        include: { _count: { select: { bookings: true } } },
      }),
      prisma.guest.count({ where }),
    ]);

    res.json({
      success: true,
      data: guests,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
        hasMore: parseInt(page as string) * parseInt(limit as string) < total,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function searchGuests(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { q } = req.query;

    const guests = await prisma.guest.findMany({
      where: {
        hotelId,
        isDeleted: false,
        NOT: [
          { firstName: 'Deleted', lastName: 'Guest' },
          { notes: 'Guest data deleted on request' },
        ],
        OR: [
          { firstName: { contains: q as string, mode: 'insensitive' } },
          { lastName: { contains: q as string, mode: 'insensitive' } },
          { email: { contains: q as string, mode: 'insensitive' } },
          { phone: { contains: q as string } },
        ],
      },
      take: 10,
      orderBy: { lastName: 'asc' },
    });

    res.json({ success: true, data: guests });
  } catch (error) {
    next(error);
  }
}

export async function getGuestById(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const guest = await prisma.guest.findFirst({
      where: { id, hotelId, isDeleted: false },
      include: {
        bookings: {
          orderBy: { checkInDate: 'desc' },
          take: 10,
          include: { room: { select: { number: true } } },
        },
      },
    });

    if (!guest || (guest.firstName === 'Deleted' && guest.lastName === 'Guest')) {
      throw new NotFoundError('Guest');
    }
    res.json({ success: true, data: guest });
  } catch (error) {
    next(error);
  }
}

export async function getGuestHistory(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const guest = await prisma.guest.findFirst({
      where: { id, hotelId, isDeleted: false },
    });
    if (!guest || (guest.firstName === 'Deleted' && guest.lastName === 'Guest')) {
      throw new NotFoundError('Guest');
    }

    const bookings = await prisma.booking.findMany({
      where: { guestId: id, hotelId },
      orderBy: { checkInDate: 'desc' },
      include: {
        room: { select: { number: true, roomType: { select: { name: true } } } },
        payments: true,
      },
    });

    res.json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
}

export async function createGuest(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;

    const guest = await prisma.guest.create({
      data: { hotelId, ...req.body },
    });

    res.status(201).json({ success: true, data: guest, message: 'Guest created' });
  } catch (error) {
    next(error);
  }
}

export async function updateGuest(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const guest = await prisma.guest.findFirst({ where: { id, hotelId, isDeleted: false } });
    if (!guest) throw new NotFoundError('Guest');

    const updated = await prisma.guest.update({
      where: { id },
      data: req.body,
    });

    res.json({ success: true, data: updated, message: 'Guest updated' });
  } catch (error) {
    next(error);
  }
}

export async function deleteGuest(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const guest = await prisma.guest.findFirst({ where: { id, hotelId, isDeleted: false } });
    if (!guest) throw new NotFoundError('Guest');

    // Soft delete by anonymizing
    await prisma.guest.update({
      where: { id },
      data: {
        firstName: 'Deleted',
        lastName: 'Guest',
        email: null,
        phone: null,
        notes: 'Guest data deleted on request',
        isDeleted: true,
      },
    });

    res.json({ success: true, message: 'Guest data deleted' });
  } catch (error) {
    next(error);
  }
}
