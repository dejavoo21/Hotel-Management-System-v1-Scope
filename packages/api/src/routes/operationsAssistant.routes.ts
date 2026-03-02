import { Router, Response, NextFunction } from 'express';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { buildConversationTranscript } from '../services/transcript.service.js';
import { sendEmail } from '../services/email.service.js';
import {
  unifiedAssistantChat,
  unifiedAssistantStatus,
  type UnifiedChatMode,
} from '../services/assistant/unifiedAssistant.service.js';

const router = Router();

router.use(authenticate);

type ChatBody = {
  message?: string;
  mode?: UnifiedChatMode;
  conversationId?: string | null;
  context?: Record<string, unknown> | null;
};

router.get('/status', (_req, res) => {
  res.json({ success: true, data: unifiedAssistantStatus() });
});

async function handleOperationsAssistantChat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const hotelId = req.user!.hotelId;
    const userId = req.user!.id;
    const body = (req.body ?? {}) as ChatBody;

    const result = await unifiedAssistantChat({
      hotelId,
      userId,
      message: String(body.message ?? ''),
      mode: body.mode ?? 'operations',
      context: body.context ?? null,
      conversationId: body.conversationId ?? null,
      subjectPrefix: 'Operations Assistant',
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

router.post('/chat', handleOperationsAssistantChat);
router.post('/ops/chat', handleOperationsAssistantChat);

router.post('/ops', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
      subjectPrefix: 'Operations Assistant',
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/conversations/:id/transcript', requireModuleAccess('bookings'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const conversationId = String(req.params.id ?? '').trim();

    if (!conversationId) {
      res.status(400).json({ success: false, error: 'Conversation id is required' });
      return;
    }

    const { conversation, text } = await buildConversationTranscript(conversationId, hotelId);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="laflo-transcript-${conversation.id}.txt"`);
    res.status(200).send(text);
  } catch (error) {
    next(error);
  }
});

router.post('/conversations/:id/email', requireModuleAccess('bookings'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const conversationId = String(req.params.id ?? '').trim();
    const to = String(req.body?.to ?? '').trim();
    const subject = String(req.body?.subject ?? 'LaFlo Ops Assistant Transcript').trim();

    if (!conversationId) {
      res.status(400).json({ success: false, error: 'Conversation id is required' });
      return;
    }

    if (!to) {
      res.status(400).json({ success: false, error: '`to` email is required' });
      return;
    }

    const { text } = await buildConversationTranscript(conversationId, hotelId);
    const safeText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    await sendEmail({
      to,
      subject,
      text,
      html: `<pre style="font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space:pre-wrap;">${safeText}</pre>`,
    });

    res.json({ success: true, data: { sent: true } });
  } catch (error) {
    next(error);
  }
});

router.get('/transcript/:conversationId', requireModuleAccess('bookings'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const conversationId = String(req.params.conversationId ?? '').trim();

    if (!conversationId) {
      res.status(400).json({ success: false, error: 'Conversation id is required' });
      return;
    }

    const { conversation, text } = await buildConversationTranscript(conversationId, hotelId);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="laflo-transcript-${conversation.id}.txt"`);
    res.status(200).send(text);
  } catch (error) {
    next(error);
  }
});

router.post('/transcript/email', requireModuleAccess('bookings'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const conversationId = String(req.body?.conversationId ?? '').trim();
    const to = String(req.body?.toEmail ?? req.body?.to ?? '').trim();
    const subject = String(req.body?.subject ?? 'LaFlo Ops Assistant Transcript').trim();

    if (!conversationId || !to) {
      res.status(400).json({ success: false, error: 'conversationId and toEmail are required' });
      return;
    }

    const { text } = await buildConversationTranscript(conversationId, hotelId);
    const safeText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    await sendEmail({
      to,
      subject,
      text,
      html: `<pre style="font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space:pre-wrap;">${safeText}</pre>`,
    });

    res.json({ success: true, data: { sent: true } });
  } catch (error) {
    next(error);
  }
});

export default router;
