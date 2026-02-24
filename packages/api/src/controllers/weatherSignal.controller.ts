import { NextFunction, Response } from 'express';
import { ApiResponse, AuthenticatedRequest } from '../types/index.js';
import {
  getLatestWeatherSignals,
  getWeatherSignalsStatus,
  syncWeatherSignalsForHotel,
} from '../services/weatherSignal.service.js';
import { prisma } from '../config/database.js';

type WeatherQuery = { hotelId?: string };

async function appendWeatherAudit(
  req: AuthenticatedRequest,
  action: string,
  hotelId: string,
  details: Record<string, unknown>
) {
  if (!req.user?.id) return;
  await prisma.activityLog.create({
    data: {
      userId: req.user.id,
      action,
      entity: 'weather_signal',
      entityId: hotelId,
      details,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    },
  });
}

function getHotelIdFromQuery(req: AuthenticatedRequest): string {
  const query = req.query as WeatherQuery;
  const hotelId = query.hotelId || req.user?.hotelId;
  if (!hotelId) {
    throw new Error('hotelId is required');
  }
  return hotelId;
}

export async function syncWeather(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  let hotelId = '';
  try {
    hotelId = getHotelIdFromQuery(req);
    await appendWeatherAudit(req, 'WEATHER_SYNC_START', hotelId, {
      provider: 'openweathermap',
    });

    const result = await syncWeatherSignalsForHotel(hotelId);

    await appendWeatherAudit(req, 'WEATHER_SYNC_SUCCESS', hotelId, {
      provider: 'openweathermap',
      responseStatus: 'success',
      daysStored: result.daysStored,
      fetchedAtUtc: result.fetchedAtUtc,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    if (hotelId) {
      await appendWeatherAudit(req, 'WEATHER_SYNC_FAIL', hotelId, {
        provider: 'openweathermap',
        responseStatus: 'fail',
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined);
    }
    next(error);
  }
}

export async function getWeatherStatus(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const hotelId = getHotelIdFromQuery(req);
    const status = await getWeatherSignalsStatus(hotelId);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
}

export async function getWeatherLatest(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const hotelId = getHotelIdFromQuery(req);
    const rows = await getLatestWeatherSignals(hotelId);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

