import express, { Router } from 'express';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import * as messageController from '../controllers/message.controller.js';

const router = Router();

// Public Twilio webhook (Twilio cannot send auth bearer token).
router.post('/support/voice/twiml', messageController.supportVoiceTwiml);
router.post('/support/voice/status', express.urlencoded({ extended: false }), messageController.handleVoiceStatus);

router.use(authenticate);
router.use(requireModuleAccess('messages'));

router.get('/', messageController.listThreads);
router.post('/support/presence', messageController.heartbeatSupportPresence);
router.get('/support/voice/token', messageController.getSupportVoiceToken);
router.get('/support/video/token', messageController.getSupportVideoToken);
router.post('/support/voice/call-phone', messageController.startSupportPhoneCall);
router.get('/support/agents', messageController.listSupportAgents);
router.post('/live-support', messageController.getOrCreateLiveSupportThread);
router.post('/:id/assign', messageController.assignSupportAgent);
router.get('/:id', messageController.getThread);
router.post('/:id/messages', messageController.createMessage);

export default router;
