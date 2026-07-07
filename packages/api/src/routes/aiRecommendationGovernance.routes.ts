import { Router } from 'express';
import {
  approveRecommendation,
  createRecommendationTask,
  executeRecommendationAction,
  expireRecommendation,
  getRecommendation,
  listRecommendations,
  rejectRecommendation,
} from '../controllers/aiRecommendationGovernance.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/recommendations', listRecommendations);
router.get('/recommendations/:id', getRecommendation);
router.post('/recommendations/:id/approve', approveRecommendation);
router.post('/recommendations/:id/reject', rejectRecommendation);
router.post('/recommendations/:id/create-task', createRecommendationTask);
router.post('/recommendations/:id/execute', executeRecommendationAction);
router.post('/recommendations/:id/expire', expireRecommendation);

export default router;
