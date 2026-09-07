import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { getGuestJourneyTimeline } from '../services/guestJourney.service.js';

export async function getAllGuests(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const {
      search,
      vipStatus,
      status,
      country,
      returning,
      contactable,
      needsAttention,
      lastStayDays,
      page = '1',
      limit = '20',
    } = req.query;

    const where: Record<string, unknown> = {
      hotelId,
      isDeleted: false,
    };
    if (vipStatus === 'true') where.vipStatus = true;
    if (country) where.country = { equals: country as string, mode: 'insensitive' };
    if (returning === 'true') where.totalStays = { gt: 1 };
    if (contactable === 'true') {
      where.OR = [
        { email: { not: null } },
        { phone: { not: null } },
      ];
    }
    if (needsAttention === 'true') where.notes = { not: null };
    const bookingFilter: Record<string, unknown> = {};
    if (status === 'IN_HOUSE') bookingFilter.status = 'CHECKED_IN';
    if (status === 'CHECKED_OUT') bookingFilter.status = 'CHECKED_OUT';
    if (lastStayDays) {
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - Number(lastStayDays));
      bookingFilter.checkInDate = { gte: since };
    }
    if (Object.keys(bookingFilter).length) where.bookings = { some: bookingFilter };
    if (search) {
      const searchConditions = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
        { bookings: { some: { bookingRef: { contains: search as string, mode: 'insensitive' } } } },
        { bookings: { some: { room: { number: { contains: search as string, mode: 'insensitive' } } } } },
      ];
      const existingOr = Array.isArray(where.OR) ? where.OR : [];
      if (existingOr.length) {
        where.AND = [{ OR: existingOr }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { lastName: 'asc' },
        include: {
          _count: { select: { bookings: true } },
          bookings: {
            orderBy: { checkInDate: 'desc' },
            take: 1,
            select: {
              id: true,
              bookingRef: true,
              status: true,
              checkInDate: true,
              checkOutDate: true,
              room: { select: { number: true } },
            },
          },
        },
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

export async function getGuestDirectorySummary(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const base = { hotelId, isDeleted: false };
    const [total, vip, inHouse, returning, contactable, needsFollowUp, spend, recentlyAdded] = await Promise.all([
      prisma.guest.count({ where: base }),
      prisma.guest.count({ where: { ...base, vipStatus: true } }),
      prisma.guest.count({ where: { ...base, bookings: { some: { status: 'CHECKED_IN' } } } }),
      prisma.guest.count({ where: { ...base, totalStays: { gt: 1 } } }),
      prisma.guest.count({ where: { ...base, OR: [{ email: { not: null } }, { phone: { not: null } }] } }),
      prisma.guest.count({ where: { ...base, notes: { not: null } } }),
      prisma.guest.aggregate({ where: base, _sum: { totalSpent: true }, _avg: { totalSpent: true } }),
      prisma.guest.findMany({
        where: base,
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { id: true, firstName: true, lastName: true, createdAt: true, vipStatus: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        vip,
        inHouse,
        returning,
        contactable,
        needsFollowUp,
        totalLifetimeSpend: Number(spend._sum.totalSpent || 0),
        averageSpend: Number(spend._avg.totalSpent || 0),
        repeatStayRate: total ? Math.round((returning / total) * 1000) / 10 : 0,
        recentlyAdded,
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

export async function getGuestJourney(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;
    const { bookingId } = req.query;

    const guest = await prisma.guest.findFirst({
      where: { id, hotelId, isDeleted: false },
      select: { id: true },
    });
    if (!guest) throw new NotFoundError('Guest');

    const journey = await getGuestJourneyTimeline(hotelId, id, typeof bookingId === 'string' ? bookingId : undefined);
    res.json({ success: true, data: journey });
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
