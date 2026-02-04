import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireManager } from '../middleware/auth.js';
import * as purchaseOrderController from '../controllers/purchaseOrder.controller.js';

const router = Router();

const itemSchema = z.object({
  inventoryItemId: z.string().optional(),
  name: z.string().min(1, 'Item name is required'),
  unit: z.string().min(1, 'Unit is required'),
  quantity: z.number().int().min(1),
  unitCost: z.number().min(0),
});

const createSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  vendorEmail: z.string().email().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'At least one item is required'),
});

const emailSchema = z.object({
  recipientEmail: z.string().email().optional(),
});

router.use(authenticate);

router.get('/', purchaseOrderController.listPurchaseOrders);
router.get('/:id', purchaseOrderController.getPurchaseOrder);
router.post('/', requireManager, validate(createSchema), purchaseOrderController.createPurchaseOrder);
router.get('/:id/export', purchaseOrderController.exportPurchaseOrder);
router.post('/:id/email', validate(emailSchema), purchaseOrderController.emailPurchaseOrder);

export default router;
