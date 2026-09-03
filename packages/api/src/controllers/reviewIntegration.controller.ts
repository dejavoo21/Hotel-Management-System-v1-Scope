import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { config } from '../config/index.js';
import { completeGoogleAuthorization, createGoogleAuthorizationUrl, getGoogleConnection, syncGoogleReviews } from '../services/googleBusinessReviews.service.js';
import { recordAuditEvent } from '../platform/audit/auditEngine.service.js';

export async function getReviewConnectorStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: { google: await getGoogleConnection(req.user!.hotelId) } });
  } catch (error) { next(error); }
}

export async function connectGoogle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authorizationUrl = createGoogleAuthorizationUrl(req.user!.hotelId, req.user!.id);
    await recordAuditEvent({ hotelId: req.user!.hotelId, actor: { userId: req.user!.id, ipAddress: req.ip, userAgent: req.get('user-agent') || null }, action: 'GOOGLE_REVIEW_OAUTH_STARTED', entity: 'REVIEW_PROVIDER', entityId: 'google-business-profile', source: 'integration-manager' });
    res.json({ success: true, data: { authorizationUrl } });
  } catch (error) { next(error); }
}

export async function googleCallback(req: Request, res: Response) {
  const settingsUrl = `${config.appUrl.replace(/\/$/, '')}/settings?tab=integration-manager&reviewProvider=google`;
  try {
    if (typeof req.query.error === 'string') throw new Error(req.query.error_description?.toString() || req.query.error);
    if (typeof req.query.code !== 'string' || typeof req.query.state !== 'string') throw new Error('Google did not return a valid authorization response.');
    await completeGoogleAuthorization(req.query.code, req.query.state);
    res.redirect(`${settingsUrl}&connected=1`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google connection failed.';
    res.redirect(`${settingsUrl}&error=${encodeURIComponent(message)}`);
  }
}

export async function syncGoogle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await syncGoogleReviews(req.user!.hotelId);
    await recordAuditEvent({ hotelId: req.user!.hotelId, actor: { userId: req.user!.id, ipAddress: req.ip, userAgent: req.get('user-agent') || null }, action: 'GOOGLE_REVIEWS_SYNCED', entity: 'REVIEW_PROVIDER', entityId: 'google-business-profile', source: 'integration-manager', details: result });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
}
