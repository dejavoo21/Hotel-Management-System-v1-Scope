import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as controller from '../controllers/hardwareIntegration.controller.js';

const router = Router();

const integrationType = z.enum(['CCTV_CAMERA', 'CCTV_NVR', 'SMART_DEVICE', 'SMART_GATEWAY']);
const provider = z.enum([
  'HIKVISION',
  'DAHUA',
  'AXIS',
  'ONVIF',
  'GENERIC_RTSP',
  'GENERIC_HLS',
  'GENERIC_MJPEG',
  'MQTT',
  'BACNET',
  'MODBUS',
  'REST_API',
  'WEBHOOK',
  'VENDOR_API',
  'TTLOCK',
  'SALTO',
  'OTHER',
]);
const protocol = z.enum(['RTSP', 'HLS', 'MJPEG', 'ONVIF', 'MQTT', 'BACNET', 'MODBUS', 'REST_API', 'WEBHOOK', 'VENDOR_API']);

const hardwareIntegrationSchema = z.object({
  integrationType,
  name: z.string().min(1),
  location: z.string().optional(),
  floor: z.number().int().optional(),
  roomArea: z.string().optional(),
  provider,
  protocol,
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  channelNumber: z.number().int().min(0).optional(),
  username: z.string().optional(),
  secret: z.string().optional(),
  streamPath: z.string().optional(),
  gatewayId: z.string().optional(),
  deviceIdentifier: z.string().optional(),
  topicPathChannel: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateHardwareIntegrationSchema = hardwareIntegrationSchema.partial();

const listQuerySchema = z.object({
  integrationType: integrationType.optional(),
});

router.use(authenticate);
router.use(requireModuleAccess('security_center', 'smart_building', 'settings'));

router.get('/', validate(listQuerySchema, 'query'), controller.listHardwareIntegrations);
router.post('/', validate(hardwareIntegrationSchema), controller.createHardwareIntegration);
router.get('/:id', controller.getHardwareIntegration);
router.patch('/:id', validate(updateHardwareIntegrationSchema), controller.updateHardwareIntegration);
router.post('/:id/test', controller.testHardwareIntegration);
router.get('/:id/health', controller.getHardwareIntegrationHealth);
router.post('/:id/disable', controller.disableHardwareIntegration);
router.delete('/:id', controller.deleteHardwareIntegration);
router.post('/:id/view', controller.viewCameraFeed);

export default router;
