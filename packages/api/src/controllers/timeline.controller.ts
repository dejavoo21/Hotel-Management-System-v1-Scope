import { NextFunction, Response } from 'express';
import { ApiResponse, AuthenticatedRequest } from '../types/index.js';
import {
  getTimelineEvents,
  getTimelineFilterOptions,
  type TimelineFilters,
  type TimelineSeverity,
} from '../platform/timeline/timelineEngine.service.js';

function getHotelId(req: AuthenticatedRequest) {
  const hotelId = req.user?.hotelId;
  if (!hotelId) throw new Error('hotelId is required');
  return hotelId;
}

function parseSeverity(value: unknown): TimelineSeverity | undefined {
  if (value === 'INFO' || value === 'SUCCESS' || value === 'WARNING' || value === 'CRITICAL') return value;
  return undefined;
}

function parseTime(value: unknown): TimelineFilters['time'] | undefined {
  if (value === '1h' || value === '6h' || value === '24h' || value === '7d') return value;
  return undefined;
}

function parseLimit(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function listTimelineEvents(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) {
  try {
    const hotelId = getHotelId(req);
    const filters: TimelineFilters = {
      module: typeof req.query.module === 'string' ? req.query.module : undefined,
      severity: parseSeverity(req.query.severity),
      department: typeof req.query.department === 'string' ? req.query.department : undefined,
      time: parseTime(req.query.time),
      limit: parseLimit(req.query.limit),
    };

    res.json({
      success: true,
      data: {
        events: getTimelineEvents(hotelId, filters),
        filters: getTimelineFilterOptions(hotelId),
      },
    });
  } catch (error) {
    next(error);
  }
}
