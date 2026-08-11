import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, requireModuleAccess } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as controller from '../controllers/integrationManager.controller.js';
import * as reviewConnector from '../controllers/reviewIntegration.controller.js';

const router = Router();

// Google redirects the browser here, so this callback validates a short-lived,
// signed OAuth state instead of requiring an existing LaFlo access token.
router.get('/review-platforms/google/callback', reviewConnector.googleCallback);

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
router.get('/review-platforms/status', reviewConnector.getReviewConnectorStatus);
router.post('/review-platforms/google/connect', requireAdmin, reviewConnector.connectGoogle);
router.post('/review-platforms/google/sync', requireAdmin, reviewConnector.syncGoogle);
router.post('/events', requireAdmin, validate(eventSchema), controller.publishSetupEvent);

export default router;
