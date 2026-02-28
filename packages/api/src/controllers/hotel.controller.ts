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
    const existingHotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!existingHotel) {
      res.status(404).json({ success: false, error: 'Hotel not found' });
      return;
    }

    const normalize = (value: unknown): string | undefined =>
      typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : undefined;

    const incomingCity = normalize(req.body.city);
    const incomingCountry = normalize(req.body.country);
    const incomingAddress = normalize(req.body.address);
    const incomingAddressLine1 = normalize(req.body.addressLine1);

    const existingCity = normalize(existingHotel.city);
    const existingCountry = normalize(existingHotel.country);
    const existingAddress = normalize(existingHotel.address);
    const existingAddressLine1 = normalize(existingHotel.addressLine1 ?? undefined);

    const locationFieldChanged =
      (incomingCity !== undefined && incomingCity !== existingCity) ||
      (incomingCountry !== undefined && incomingCountry !== existingCountry) ||
      (incomingAddress !== undefined && incomingAddress !== existingAddress) ||
      (incomingAddressLine1 !== undefined && incomingAddressLine1 !== existingAddressLine1);

    const latProvided = req.body.latitude !== undefined;
    const lonProvided = req.body.longitude !== undefined;

    const hotel = await prisma.$transaction(async (tx) => {
      if (locationFieldChanged) {
        await tx.externalSignal.deleteMany({
          where: {
            hotelId,
            type: 'WEATHER',
          },
        });
      }

      return tx.hotel.update({
        where: { id: hotelId },
        data: {
          name: req.body.name,
          address: incomingAddress ?? req.body.address,
          addressLine1: incomingAddressLine1 ?? req.body.addressLine1,
          city: incomingCity ?? req.body.city,
          country: incomingCountry ?? req.body.country,
          phone: req.body.phone,
          email: req.body.email,
          website: req.body.website,
          timezone: req.body.timezone,
          currency: req.body.currency,
          latitude: latProvided ? req.body.latitude : locationFieldChanged ? null : undefined,
          longitude: lonProvided ? req.body.longitude : locationFieldChanged ? null : undefined,
          locationUpdatedAt:
            latProvided || lonProvided || locationFieldChanged ? new Date() : undefined,
        },
      });
    });
    res.json({ success: true, data: hotel });
  } catch (error) {
    next(error);
  }
}
