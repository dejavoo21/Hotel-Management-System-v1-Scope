import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
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
    next(error);
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
    next(error);
  }
}
