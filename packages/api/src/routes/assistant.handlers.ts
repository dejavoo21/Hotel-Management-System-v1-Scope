import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  unifiedAssistantChat,
  unifiedAssistantStatus,
  type UnifiedChatMode,
} from '../services/assistant/unifiedAssistant.service.js';

type ChatBody = {
  message?: string;
  mode?: UnifiedChatMode;
  conversationId?: string | null;
  context?: Record<string, unknown> | null;
};

function mapAssistantError(error: unknown): AppError {
  const err = error as {
    message?: string;
    status?: number;
    statusCode?: number;
    code?: string;
    type?: string;
  };

  const message = String(err?.message ?? 'Assistant backend failed.');
  const status = Number(err?.status ?? err?.statusCode ?? 500);
  const normalizedCode = String(err?.code ?? '').toLowerCase();
  const normalizedType = String(err?.type ?? '').toLowerCase();
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('message is required')) {
    return new AppError('Message is required.', 400, true);
  }

  if (
    status === 429 ||
    normalizedCode === 'insufficient_quota' ||
    normalizedCode === 'rate_limit_exceeded' ||
    normalizedType === 'insufficient_quota' ||
    normalizedMessage.includes('insufficient_quota') ||
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('quota')
  ) {
    return new AppError(
      'AI provider quota exceeded. Please update billing/quota and retry.',
      429,
      true
    );
  }

  if (status === 401 || normalizedMessage.includes('invalid api key')) {
    return new AppError('AI provider authentication failed.', 502, true);
  }

  if (status >= 400 && status < 500) {
    return new AppError(message, status, true);
  }

  return new AppError('Assistant backend failed.', 500, true);
}

export async function handleUnifiedAssistantStatus(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    res.json({ success: true, data: unifiedAssistantStatus() });
  } catch (error) {
    next(error);
  }
}

export async function handleUnifiedAssistantChat(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const body = (req.body ?? {}) as ChatBody;

    const result = await unifiedAssistantChat({
      hotelId,
      userId,
      message: String(body.message ?? ''),
      mode: body.mode ?? 'general',
      context: body.context ?? null,
      conversationId: body.conversationId ?? null,
      subjectPrefix: 'Main Assistant',
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(mapAssistantError(error));
  }
}

export async function handleUnifiedAssistantOps(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const body = (req.body ?? {}) as ChatBody;

    const result = await unifiedAssistantChat({
      hotelId,
      userId,
      message: String(body.message ?? ''),
      mode: 'operations',
      context: body.context ?? null,
      conversationId: body.conversationId ?? null,
      subjectPrefix: 'Main Assistant',
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(mapAssistantError(error));
  }
}
