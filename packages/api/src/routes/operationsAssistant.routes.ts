import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { buildConversationTranscript } from '../services/transcript.service.js';
import { sendEmail } from '../services/email.service.js';
import {
  handleUnifiedAssistantChat,
  handleUnifiedAssistantOps,
  handleUnifiedAssistantStatus,
} from './assistant.handlers.js';

const router = Router();

router.use(authenticate);

// Legacy alias endpoints; kept for backward compatibility during migration.
router.get('/status', handleUnifiedAssistantStatus);
router.post('/chat', handleUnifiedAssistantChat);
router.post('/ops/chat', handleUnifiedAssistantChat);
router.post('/ops', handleUnifiedAssistantOps);

router.get('/conversations/:id/transcript', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

router.post('/conversations/:id/email', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

export default router;
