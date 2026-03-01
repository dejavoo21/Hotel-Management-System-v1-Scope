import { Router, Response, NextFunction } from 'express';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { prisma } from '../config/database.js';

const router = Router();

router.use(authenticate);
router.use(requireModuleAccess('bookings'));

router.get('/competitors', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const comps = await prisma.competitorHotel.findMany({
      where: { hotelId, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: comps });
  } catch (e) {
    next(e);
  }
});

router.post('/competitors', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }

    const created = await prisma.competitorHotel.create({
      data: {
        hotelId,
        name,
        city: req.body?.city ? String(req.body.city).trim() : null,
        country: req.body?.country ? String(req.body.country).trim() : null,
        latitude: req.body?.latitude != null ? Number(req.body.latitude) : null,
        longitude: req.body?.longitude != null ? Number(req.body.longitude) : null,
      },
    });

    res.json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
});

router.patch('/competitors/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const id = req.params.id;

    const existing = await prisma.competitorHotel.findFirst({ where: { id, hotelId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Competitor not found' });
      return;
    }

    const updated = await prisma.competitorHotel.update({
      where: { id },
      data: {
        name: req.body?.name != null ? String(req.body.name).trim() : undefined,
        city: req.body?.city != null ? String(req.body.city).trim() : undefined,
        country: req.body?.country != null ? String(req.body.country).trim() : undefined,
        latitude: req.body?.latitude != null ? Number(req.body.latitude) : undefined,
        longitude: req.body?.longitude != null ? Number(req.body.longitude) : undefined,
        isActive: req.body?.isActive != null ? Boolean(req.body.isActive) : undefined,
      },
    });

    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
});

router.post('/rates', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const competitorHotelId = String(req.body?.competitorHotelId ?? '').trim();
    const nightDate = String(req.body?.nightDate ?? '').trim();
    const rate = Number(req.body?.rate);

    if (!competitorHotelId || !nightDate || !Number.isFinite(rate)) {
      res.status(400).json({ success: false, error: 'competitorHotelId, nightDate, rate are required' });
      return;
    }

    const comp = await prisma.competitorHotel.findFirst({
      where: { id: competitorHotelId, hotelId, isActive: true },
    });
    if (!comp) {
      res.status(404).json({ success: false, error: 'Competitor not found for this hotel' });
      return;
    }

    const created = await prisma.competitorRateSnapshot.create({
      data: {
        competitorHotelId,
        nightDate: toUtcMidnight(nightDate),
        rate,
        currency: req.body?.currency ? String(req.body.currency).trim() : 'USD',
        source: 'MANUAL',
      },
    });

    res.json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
});

router.post('/rates/bulk', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const competitorHotelId = String(req.body?.competitorHotelId ?? '').trim();
    const startDate = String(req.body?.startDate ?? '').trim();
    const endDate = String(req.body?.endDate ?? '').trim();
    const rate = Number(req.body?.rate);

    if (!competitorHotelId || !startDate || !endDate || !Number.isFinite(rate)) {
      res
        .status(400)
        .json({ success: false, error: 'competitorHotelId, startDate, endDate, rate are required' });
      return;
    }

    const comp = await prisma.competitorHotel.findFirst({
      where: { id: competitorHotelId, hotelId, isActive: true },
    });
    if (!comp) {
      res.status(404).json({ success: false, error: 'Competitor not found for this hotel' });
      return;
    }

    const dates = enumerateYmdInclusive(startDate, endDate);
    const currency = req.body?.currency ? String(req.body.currency).trim() : 'USD';

    await prisma.competitorRateSnapshot.createMany({
      data: dates.map((d) => ({
        competitorHotelId,
        nightDate: toUtcMidnight(d),
        rate,
        currency,
        source: 'MANUAL',
        collectedAtUtc: new Date(),
      })),
      skipDuplicates: false,
    });

    res.json({ success: true, data: { nightsWritten: dates.length } });
  } catch (e) {
    next(e);
  }
});

function toUtcMidnight(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((n) => Number(n));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
}

function enumerateYmdInclusive(startYmd: string, endYmd: string): string[] {
  const start = toUtcMidnight(startYmd);
  const end = toUtcMidnight(endYmd);
  const out: string[] = [];
  for (let cur = new Date(start.getTime()); cur.getTime() <= end.getTime(); cur.setUTCDate(cur.getUTCDate() + 1)) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
  }
  return out;
}

export default router;

