import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as maintenanceCenterController from '../controllers/maintenanceCenter.controller.js';

const router = Router();

const optionalDate = z.string().datetime().optional();

const workOrderSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  assetName: z.string().optional(),
  assetExternalId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).default('OPEN'),
  assignedTo: z.string().optional(),
  dueAt: optionalDate,
});

const updateWorkOrderSchema = workOrderSchema.partial();

const faultSchema = z.object({
  workOrderId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  assetName: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']).default('MEDIUM'),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).default('OPEN'),
});

const repairSchema = z.object({
  workOrderId: z.string().optional(),
  faultId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  technician: z.string().optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED']).default('SCHEDULED'),
  startedAt: optionalDate,
  completedAt: optionalDate,
  cost: z.number().nonnegative().optional(),
});

router.use(authenticate);
router.use(requireModuleAccess('maintenance_center'));

router.get('/overview', maintenanceCenterController.getOverview);
router.get('/work-orders', maintenanceCenterController.listWorkOrders);
router.post('/work-orders', validate(workOrderSchema), maintenanceCenterController.createWorkOrder);
router.patch('/work-orders/:id', validate(updateWorkOrderSchema), maintenanceCenterController.updateWorkOrder);
router.get('/faults', maintenanceCenterController.listFaults);
router.post('/faults', validate(faultSchema), maintenanceCenterController.createFault);
router.get('/repairs', maintenanceCenterController.listRepairs);
router.post('/repairs', validate(repairSchema), maintenanceCenterController.createRepair);
router.get('/preventive-maintenance', maintenanceCenterController.listPreventiveMaintenance);
router.get('/assets', maintenanceCenterController.listAssets);
router.get('/smart-building-tasks', maintenanceCenterController.listSmartBuildingTasks);

export default router;
