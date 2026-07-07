import { Router } from 'express';
import {
  listEvaluationCases,
  runAllEvaluations,
  runEvaluation,
} from '../controllers/aiEvaluation.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/evaluation/cases', listEvaluationCases);
router.post('/evaluation/run', runEvaluation);
router.post('/evaluation/run-all', runAllEvaluations);

export default router;
