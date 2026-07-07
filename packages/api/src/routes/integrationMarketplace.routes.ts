import { Router } from 'express';
import {
  disconnectMarketplaceIntegration,
  getMarketplaceIntegration,
  getMarketplaceIntegrationLogs,
  listMarketplaceIntegrations,
  reconnectMarketplaceIntegration,
  testMarketplaceIntegration,
} from '../controllers/integrationMarketplace.controller.js';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireModuleAccess('settings'));

router.get('/', listMarketplaceIntegrations);
router.get('/:providerId', getMarketplaceIntegration);
router.get('/:providerId/logs', getMarketplaceIntegrationLogs);
router.post('/:providerId/test', testMarketplaceIntegration);
router.post('/:providerId/reconnect', reconnectMarketplaceIntegration);
router.post('/:providerId/disconnect', disconnectMarketplaceIntegration);

export default router;
