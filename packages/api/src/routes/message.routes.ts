import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as messageController from '../controllers/message.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', messageController.listThreads);
router.post('/live-support', messageController.getOrCreateLiveSupportThread);
router.get('/:id', messageController.getThread);
router.post('/:id/messages', messageController.createMessage);

export default router;
