import type { Response, NextFunction } from 'express';
import { buildHotelContext, type AIContextOptions, type AIContextSection } from '../ai/context/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

const VALID_SECTIONS = new Set<AIContextSection>([
  'hotelProfile',
  'occupancy',
  'revenue',
  'weather',
  'bookings',
  'guests',
  'housekeeping',
  'maintenance',
  'security',
  'smartBuilding',
  'incidents',
  'tasks',
  'reviews',
  'messages',
  'financialSummary',
]);

function parseSectionList(value: unknown): AIContextSection[] | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const sections = value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is AIContextSection => VALID_SECTIONS.has(item as AIContextSection));
  return sections.length ? sections : undefined;
}

function parseOptions(req: AuthenticatedRequest): AIContextOptions {
  const limit = Number(req.query.limit);
  return {
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    sections: parseSectionList(req.query.sections),
    excludeSections: parseSectionList(req.query.excludeSections),
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 25)) : undefined,
  };
}

export async function getHotelContext(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const hotelId = req.user!.hotelId;
    const context = await buildHotelContext(hotelId, parseOptions(req));
    res.json({ success: true, data: context });
  } catch (error) {
    next(error);
  }
}
