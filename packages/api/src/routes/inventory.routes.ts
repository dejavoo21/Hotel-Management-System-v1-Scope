import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as inventoryController from '../controllers/inventory.controller.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().min(1),
  quantityOnHand: z.number().int().min(0),
  reorderPoint: z.number().int().min(0).optional(),
  cost: z.number().min(0).optional(),
  location: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  quantityOnHand: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  cost: z.number().min(0).optional(),
  location: z.string().optional(),
  isActive: z.boolean().optional(),
});

router.use(authenticate);

router.get('/', inventoryController.listInventoryItems);
router.post('/', validate(createSchema), inventoryController.createInventoryItem);
router.patch('/:id', validate(updateSchema), inventoryController.updateInventoryItem);
router.delete('/:id', inventoryController.deactivateInventoryItem);

export default router;
