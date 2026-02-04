import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';

export async function listReviews(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { source, rating } = req.query;

    const reviews = await prisma.review.findMany({
      where: {
        hotelId,
        ...(source ? { source: String(source) } : {}),
        ...(rating ? { rating: Number(rating) } : {}),
      },
      include: {
        guest: { select: { firstName: true, lastName: true } },
        booking: { select: { bookingRef: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
}

export async function createReview(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const review = await prisma.review.create({
      data: {
        hotelId,
        guestId: req.body.guestId || null,
        bookingId: req.body.bookingId || null,
        rating: req.body.rating,
        source: req.body.source,
        comment: req.body.comment || null,
      },
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
}

export async function respondToReview(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const existing = await prisma.review.findFirst({ where: { id, hotelId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Review not found' });
      return;
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        response: req.body.response,
        respondedAt: new Date(),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}
