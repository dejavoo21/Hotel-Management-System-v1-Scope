import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  handleUnifiedAssistantChat,
  handleUnifiedAssistantOps,
  handleUnifiedAssistantStatus,
} from './assistant.handlers.js';

const router = Router();

router.use(authenticate);

router.get('/status', handleUnifiedAssistantStatus);
router.get('/health', handleUnifiedAssistantStatus);
router.post('/chat', handleUnifiedAssistantChat);
router.post('/ops/chat', handleUnifiedAssistantChat);
router.post('/ops', handleUnifiedAssistantOps);

export default router;
