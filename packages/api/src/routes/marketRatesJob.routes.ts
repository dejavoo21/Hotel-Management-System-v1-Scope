import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { fetchGoogleHotelsRates } from '../services/marketRates.serpapi.provider.js';

const router = Router();
const JOB_SECRET = process.env.MARKET_JOB_SECRET || process.env.SLA_JOB_SECRET;

function validateJobSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-job-secret'] as string | undefined;

  if (!JOB_SECRET) {
    res.status(503).json({
      success: false,
      error: 'Job endpoint not configured (missing MARKET_JOB_SECRET or SLA_JOB_SECRET)',
    });
    return;
  }

  if (!secret) {
    res.status(401).json({ success: false, error: 'Missing X-Job-Secret header' });
    return;
  }

  const a = Buffer.from(secret);
  const b = Buffer.from(JOB_SECRET);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) {
    res.status(401).json({ success: false, error: 'Invalid X-Job-Secret header' });
    return;
  }

  next();
}

router.post(
  '/market-rates/sync',
  validateJobSecret,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const hotels = await prisma.hotel.findMany({
        select: { id: true, city: true, country: true, currency: true },
      });

      const today = new Date();
      const checkIn = today.toISOString().slice(0, 10);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const results: Array<{ hotelId: string; rowsFetched: number; rowsStored: number }> = [];

      for (const hotel of hotels) {
        const rows = await fetchGoogleHotelsRates({
          city: hotel.city,
          country: hotel.country,
          checkInDate: checkIn,
          checkOutDate: tomorrow,
        });

        let rowsStored = 0;

        for (const row of rows) {
          const existing = await prisma.competitorHotel.findFirst({
            where: { hotelId: hotel.id, name: row.name },
            select: { id: true },
          });

          const competitor = existing
            ? existing
            : await prisma.competitorHotel.create({
                data: {
                  hotelId: hotel.id,
                  name: row.name,
                  city: hotel.city,
                  country: hotel.country,
                  isActive: true,
                },
                select: { id: true },
              });

          await prisma.competitorRateSnapshot.create({
            data: {
              competitorHotelId: competitor.id,
              nightDate: new Date(checkIn),
              rate: row.rate,
              currency: row.currency ?? hotel.currency ?? 'USD',
              source: 'SERPAPI',
            },
          });

          rowsStored += 1;
        }

        results.push({ hotelId: hotel.id, rowsFetched: rows.length, rowsStored });
      }

      res.json({ success: true, data: { checkIn, results } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
