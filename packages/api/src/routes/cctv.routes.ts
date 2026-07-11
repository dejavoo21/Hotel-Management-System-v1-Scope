import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as controller from '../controllers/cctv.controller.js';

const router = Router();

const provider = z.enum(['HIKVISION', 'DAHUA', 'AXIS', 'ONVIF', 'GENERIC_RTSP', 'GENERIC_HLS', 'GENERIC_MJPEG', 'OTHER']);
const protocol = z.enum(['RTSP', 'HLS', 'MJPEG', 'ONVIF', 'REST_API']);

const cameraSchema = z.object({
  connectionMethod: z.enum(['MANUAL_CAMERA', 'CONNECT_NVR', 'CLOUD_PROVIDER']).optional(),
  integrationType: z.enum(['CCTV_CAMERA', 'CCTV_NVR']).optional(),
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
  deviceIdentifier: z.string().optional(),
  streamKind: z.enum(['HLS', 'MJPEG', 'SNAPSHOT', 'RTSP', 'ONVIF']).optional(),
  cloudProvider: z.enum(['VERKADA', 'EAGLE_EYE', 'RHOMBUS', 'OTHER']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const discoverSchema = z.object({
  subnet: z.string().min(3),
  provider: provider.optional(),
});

const nvrTestSchema = z.object({
  provider,
  protocol: z.enum(['ONVIF', 'RTSP', 'REST_API']).default('ONVIF'),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  secret: z.string().optional(),
  channelCount: z.number().int().min(1).max(256).optional(),
});

router.use(authenticate);
router.use(requireModuleAccess('security_center', 'settings'));

router.get('/cameras', controller.listCctvCameras);
router.post('/cameras', validate(cameraSchema), controller.createCctvCamera);
router.post('/discover', validate(discoverSchema), controller.discoverCctv);
router.post('/nvr/test', validate(nvrTestSchema), controller.testNvr);
router.post('/preview/test', validate(nvrTestSchema), controller.testPreview);
router.post('/cameras/:id/test', controller.testCamera);
router.get('/cameras/:id/playback', controller.getCameraPlayback);

export default router;
