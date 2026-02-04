import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';

export async function listConciergeRequests(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { status } = req.query;

    const requests = await prisma.conciergeRequest.findMany({
      where: {
        hotelId,
        ...(status ? { status: String(status) } : {}),
      },
      include: {
        guest: { select: { firstName: true, lastName: true } },
        room: { select: { number: true } },
        booking: { select: { bookingRef: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
}

export async function createConciergeRequest(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const request = await prisma.conciergeRequest.create({
      data: {
        hotelId,
        guestId: req.body.guestId || null,
        roomId: req.body.roomId || null,
        bookingId: req.body.bookingId || null,
        assignedToId: req.body.assignedToId || null,
        title: req.body.title,
        details: req.body.details || null,
        status: req.body.status ?? 'PENDING',
        priority: req.body.priority ?? 'MEDIUM',
        dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
      },
    });

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
}

export async function updateConciergeRequest(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const existing = await prisma.conciergeRequest.findFirst({ where: { id, hotelId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Concierge request not found' });
      return;
    }

    const updated = await prisma.conciergeRequest.update({
      where: { id },
      data: {
        title: req.body.title ?? existing.title,
        details: req.body.details ?? existing.details,
        status: req.body.status ?? existing.status,
        priority: req.body.priority ?? existing.priority,
        assignedToId: req.body.assignedToId ?? existing.assignedToId,
        dueAt: req.body.dueAt ? new Date(req.body.dueAt) : existing.dueAt,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}
