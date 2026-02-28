import { Router, Response, NextFunction } from 'express';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { getOpsContextForHotel, getWeatherOpsActions } from '../services/aiHooks.service.js';
import { getWeatherContextForHotel } from '../services/weatherContext.provider.js';

const router = Router();

router.use(authenticate);
router.use(requireModuleAccess('bookings'));

router.get('/context', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const [weather, ops] = await Promise.all([
      getWeatherContextForHotel(hotelId),
      getOpsContextForHotel(hotelId),
    ]);

    const advisoriesResult = await getWeatherOpsActions(weather, ops);
    const demandTrend: 'down' | 'flat' | 'up' =
      ops.arrivalsNext24h > ops.departuresNext24h
        ? 'up'
        : ops.arrivalsNext24h < ops.departuresNext24h
          ? 'down'
          : 'flat';
    const opportunityPct = demandTrend === 'up' ? 6 : demandTrend === 'down' ? -4 : 0;
    const confidence: 'low' | 'medium' | 'high' =
      weather?.isFresh ? 'medium' : 'low';

    res.json({
      success: true,
      data: {
        hotelId,
        generatedAtUtc: new Date().toISOString(),
        ops: {
          arrivalsNext24h: ops.arrivalsNext24h,
          departuresNext24h: ops.departuresNext24h,
          inhouseNow: ops.inhouseNow,
          windowStartUtc: ops.windowStartUtc,
          windowEndUtc: ops.windowEndUtc,
        },
        weather: weather
          ? {
              syncedAtUtc: weather.syncedAtUtc,
              timezone: weather.timezone,
              location: weather.location,
              daysAvailable: weather.daysAvailable,
              isFresh: weather.isFresh,
              stale: weather.stale,
              staleHours: weather.staleHours,
              next24h: weather.next24h,
            }
          : null,
        pricing: {
          demandTrend,
          opportunityPct,
          confidence,
          suggestion:
            demandTrend === 'up'
              ? `Consider a +${opportunityPct}% rate lift for high-demand windows.`
              : demandTrend === 'down'
                ? `Consider promotional pricing (${opportunityPct}%) to stabilize occupancy.`
                : 'Keep current rates and monitor booking pace.',
        },
        advisories: advisoriesResult.actions.slice(0, 5).map((item, index) => ({
          id: `${item.title}-${index}`,
          title: item.title,
          reason: item.reason,
          priority: item.priority,
          department: item.category || 'Front Desk',
          source: 'WEATHER_ACTIONS' as const,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

