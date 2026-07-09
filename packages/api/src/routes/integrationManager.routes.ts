import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as controller from '../controllers/integrationManager.controller.js';

const router = Router();

const eventSchema = z.object({
  eventType: z.enum([
    'integration.created',
    'integration.updated',
    'integration.connection.tested',
    'integration.connection.failed',
    'integration.device.discovered',
    'integration.device.imported',
    'integration.device.statusChanged',
    'integration.sync.completed',
    'integration.sync.failed',
  ]),
  integrationId: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

router.use(authenticate);
router.use(requireModuleAccess('settings'));

router.get('/overview', controller.getOverview);
router.get('/registry', controller.getRegistry);
router.get('/logs', controller.getLogs);
router.get('/devices', controller.getDevices);
router.post('/events', validate(eventSchema), controller.publishSetupEvent);

export default router;
