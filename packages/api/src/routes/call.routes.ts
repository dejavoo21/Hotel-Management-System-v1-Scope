import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as callController from '../controllers/call.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', callController.createCall);

export default router;

