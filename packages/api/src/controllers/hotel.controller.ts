import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';

export async function getMyHotel(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) {
      res.status(404).json({ success: false, error: 'Hotel not found' });
      return;
    }
    res.json({ success: true, data: hotel });
  } catch (error) {
    next(error);
  }
}

export async function updateMyHotel(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const hotel = await prisma.hotel.update({
      where: { id: hotelId },
      data: {
        name: req.body.name,
        address: req.body.address,
        city: req.body.city,
        country: req.body.country,
        phone: req.body.phone,
        email: req.body.email,
        website: req.body.website,
        timezone: req.body.timezone,
        currency: req.body.currency,
      },
    });
    res.json({ success: true, data: hotel });
  } catch (error) {
    next(error);
  }
}
