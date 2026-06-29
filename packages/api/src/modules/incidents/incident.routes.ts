import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireModuleAccess } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as incidentController from './incident.controller.js';

const router = Router();

const incidentBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(['SECURITY', 'MAINTENANCE', 'SMART_BUILDING', 'OPERATIONS', 'WEATHER', 'HOUSEKEEPING', 'IT', 'GUEST']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  status: z.enum(['NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  sourceModule: z.string().min(1),
  linkedEntityType: z.string().optional(),
  linkedEntityId: z.string().optional(),
  assignedManagerId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const incidentUpdateSchema = incidentBodySchema.partial();
const commentSchema = z.object({ body: z.string().min(1) });

router.use(authenticate);
router.use(requireModuleAccess('incident_management'));

router.get('/overview', incidentController.overview);
router.get('/', incidentController.list);
router.get('/:id', incidentController.get);
router.post('/', validate(incidentBodySchema), incidentController.create);
router.patch('/:id', validate(incidentUpdateSchema), incidentController.update);
router.post('/:id/acknowledge', incidentController.acknowledge);
router.post('/:id/resolve', incidentController.resolve);
router.post('/:id/close', incidentController.close);
router.post('/:id/comment', validate(commentSchema), incidentController.comment);

export default router;
