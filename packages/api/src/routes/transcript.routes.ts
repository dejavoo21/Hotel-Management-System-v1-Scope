import { Router, Response, NextFunction } from 'express';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { prisma } from '../config/database.js';
import { buildConversationTranscript } from '../services/transcript.service.js';

const router = Router();

router.use(authenticate);
router.use(requireModuleAccess('bookings'));

router.get('/:conversationId/transcript.txt', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const { conversationId } = req.params;

    const { text } = await buildConversationTranscript(conversationId, hotelId);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transcript-${conversationId}.txt"`);
    res.status(200).send(text);
  } catch (error) {
    next(error);
  }
});

router.post('/:conversationId/share-transcript', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hotelId = req.user!.hotelId;
    const senderUserId = req.user!.id;
    const { conversationId } = req.params;
    const recipientUserId = String(req.body?.recipientUserId ?? '').trim();
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    if (!recipientUserId) {
      res.status(400).json({ success: false, error: 'recipientUserId is required' });
      return;
    }

    const recipient = await prisma.user.findFirst({
      where: { id: recipientUserId, hotelId },
      select: { id: true },
    });

    if (!recipient) {
      res.status(404).json({ success: false, error: 'Recipient not found in this hotel' });
      return;
    }

    const { text } = await buildConversationTranscript(conversationId, hotelId);

    const sharedConversation = await prisma.conversation.create({
      data: {
        hotelId,
        subject: `Transcript shared: ${conversationId}`,
        status: 'OPEN',
        lastMessageAt: new Date(),
        messages: {
          create: [
            {
              senderType: 'STAFF',
              senderUserId,
              body: note ? `Note: ${note}\n\n${text}` : text,
            },
          ],
        },
      },
      select: { id: true },
    });

    res.json({
      success: true,
      data: { sharedConversationId: sharedConversation.id },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
