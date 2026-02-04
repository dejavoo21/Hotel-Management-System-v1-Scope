import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireManager } from '../middleware/auth.js';
import * as floorController from '../controllers/floor.controller.js';

const router = Router();

const createFloorSchema = z.object({
  number: z.number().int(),
  name: z.string().optional(),
});

router.use(authenticate);

router.get('/', floorController.getFloors);
router.post('/', requireManager, validate(createFloorSchema), floorController.createFloor);
router.delete('/:id', requireManager, floorController.deleteFloor);

export default router;
