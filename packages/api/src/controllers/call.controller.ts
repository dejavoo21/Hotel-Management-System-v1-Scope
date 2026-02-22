import { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest, ApiResponse } from '../types/index.js';

const createCallSchema = z.object({
  to: z.string().min(2, 'Destination is required'),
  source: z.enum(['dialpad', 'quick_contact']),
  metadata: z.record(z.any()).optional(),
});

export async function createCall(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = createCallSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Invalid call payload',
      });
      return;
    }

    const payload = parsed.data;

    // TODO(provider): Route this request to the active telephony provider (Twilio/Plivo/etc.)
    // and persist call lifecycle state in the database. UI is intentionally provider-agnostic.
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const status: 'queued' | 'ringing' | 'connected' | 'failed' = 'queued';

    res.status(201).json({
      success: true,
      data: {
        callId,
        status,
        to: payload.to,
        source: payload.source,
      },
      message: 'Call request accepted',
    });
  } catch (error) {
    next(error);
  }
}

