import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';

export async function listCalendarEvents(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(String(startDate)) : new Date();
    const end = endDate ? new Date(String(endDate)) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const events = await prisma.calendarEvent.findMany({
      where: {
        hotelId,
        startAt: { lte: end },
        endAt: { gte: start },
      },
      include: {
        room: { select: { id: true, number: true } },
        booking: { select: { id: true, bookingRef: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
}

export async function createCalendarEvent(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const event = await prisma.calendarEvent.create({
      data: {
        hotelId,
        title: req.body.title,
        type: req.body.type,
        status: req.body.status ?? 'SCHEDULED',
        startAt: new Date(req.body.startAt),
        endAt: new Date(req.body.endAt),
        roomId: req.body.roomId || null,
        bookingId: req.body.bookingId || null,
        notes: req.body.notes || null,
      },
    });

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
}

export async function updateCalendarEvent(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const existing = await prisma.calendarEvent.findFirst({ where: { id, hotelId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Calendar event not found' });
      return;
    }

    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title: req.body.title ?? existing.title,
        type: req.body.type ?? existing.type,
        status: req.body.status ?? existing.status,
        startAt: req.body.startAt ? new Date(req.body.startAt) : existing.startAt,
        endAt: req.body.endAt ? new Date(req.body.endAt) : existing.endAt,
        roomId: req.body.roomId ?? existing.roomId,
        bookingId: req.body.bookingId ?? existing.bookingId,
        notes: req.body.notes ?? existing.notes,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function deleteCalendarEvent(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const existing = await prisma.calendarEvent.findFirst({ where: { id, hotelId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Calendar event not found' });
      return;
    }

    await prisma.calendarEvent.delete({ where: { id } });
    res.json({ success: true, message: 'Calendar event deleted' });
  } catch (error) {
    next(error);
  }
}
