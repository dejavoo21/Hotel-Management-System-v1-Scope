import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireModuleAccess } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as smartBuildingController from '../controllers/smartBuilding.controller.js';

const router = Router();

const metadataSchema = z.record(z.unknown()).optional();
const timestampSchema = z.string().datetime().optional();

const eventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('DEVICE_STATUS'),
    occurredAt: timestampSchema,
    metadata: metadataSchema,
    device: z.object({
      externalId: z.string().min(1),
      name: z.string().min(1).optional(),
      deviceType: z.enum([
        'CAMERA',
        'DOOR_LOCK',
        'TEMPERATURE_SENSOR',
        'WATER_LEAK_SENSOR',
        'MOTION_SENSOR',
        'PANIC_BUTTON',
        'ENERGY_METER',
        'HVAC',
        'ASSET',
        'OTHER',
      ]),
      status: z.enum(['ONLINE', 'OFFLINE', 'WARNING', 'MAINTENANCE', 'UNKNOWN']),
      location: z.string().optional(),
      floor: z.number().int().optional(),
      zone: z.string().optional(),
      vendor: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('CAMERA_STATUS'),
    occurredAt: timestampSchema,
    metadata: metadataSchema,
    camera: z.object({
      externalId: z.string().min(1),
      name: z.string().min(1).optional(),
      deviceExternalId: z.string().optional(),
      status: z.enum(['ONLINE', 'OFFLINE', 'WARNING', 'MAINTENANCE']),
      location: z.string().optional(),
      streamUrl: z.string().url().optional(),
      snapshotUrl: z.string().url().optional(),
    }),
  }),
  z.object({
    type: z.literal('DOOR_ACCESS'),
    occurredAt: timestampSchema,
    metadata: metadataSchema,
    accessEvent: z.object({
      externalId: z.string().optional(),
      doorExternalId: z.string().optional(),
      doorName: z.string().optional(),
      actorName: z.string().optional(),
      actorType: z.enum(['STAFF', 'GUEST', 'VENDOR', 'SYSTEM', 'UNKNOWN']).optional(),
      credentialId: z.string().optional(),
      result: z.enum(['GRANTED', 'DENIED', 'FORCED', 'HELD_OPEN']),
    }),
  }),
  z.object({
    type: z.literal('DOOR_STATUS'),
    occurredAt: timestampSchema,
    metadata: metadataSchema,
    door: z.object({
      externalId: z.string().min(1),
      name: z.string().min(1).optional(),
      deviceExternalId: z.string().optional(),
      location: z.string().optional(),
      floor: z.number().int().optional(),
      lockState: z.enum(['LOCKED', 'UNLOCKED', 'UNKNOWN']),
      openState: z.enum(['OPEN', 'CLOSED', 'FORCED_OPEN', 'HELD_OPEN', 'UNKNOWN']),
      batteryLevel: z.number().int().min(0).max(100).optional(),
    }),
  }),
  z.object({
    type: z.literal('SENSOR_READING'),
    occurredAt: timestampSchema,
    metadata: metadataSchema,
    sensor: z.object({
      externalId: z.string().optional(),
      deviceExternalId: z.string().optional(),
      sensorType: z.enum(['TEMPERATURE', 'WATER_LEAK', 'MOTION', 'PANIC_BUTTON', 'HUMIDITY', 'ENERGY', 'HVAC', 'OTHER']),
      location: z.string().optional(),
      value: z.number(),
      unit: z.string().min(1),
      status: z.enum(['NORMAL', 'WARNING', 'ALERT', 'OFFLINE']),
    }),
  }),
  z.object({
    type: z.literal('SECURITY_ALERT'),
    occurredAt: timestampSchema,
    metadata: metadataSchema,
    alert: z.object({
      externalId: z.string().optional(),
      deviceExternalId: z.string().optional(),
      alertType: z.enum([
        'MOTION',
        'WATER_LEAK',
        'PANIC',
        'FORCED_DOOR',
        'DOOR_HELD_OPEN',
        'CAMERA_OFFLINE',
        'DEVICE_OFFLINE',
        'TEMPERATURE',
        'HVAC',
        'ENERGY',
        'OTHER',
      ]),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      title: z.string().min(1),
      message: z.string().optional(),
      location: z.string().optional(),
    }),
  }),
]);

// TODO: Add vendor API-key/HMAC authentication for external IoT vendors and MQTT bridges.
// For now, live event ingestion requires a normal authenticated LaFlo user token.
router.use(authenticate);
router.use(requireModuleAccess('smart_building'));

router.get('/overview', smartBuildingController.getOverview);
router.get('/devices', smartBuildingController.listDevices);
router.get('/cameras', smartBuildingController.listCameraFeeds);
router.get('/access-events', smartBuildingController.listDoorAccessEvents);
router.get('/door-statuses', smartBuildingController.listDoorStatuses);
router.get('/sensor-readings', smartBuildingController.listSensorReadings);
router.get('/alerts', smartBuildingController.listSecurityAlerts);
router.get('/linked-tasks', smartBuildingController.listLinkedTasks);
router.patch('/alerts/:id/acknowledge', smartBuildingController.acknowledgeSecurityAlert);
router.patch('/alerts/:id/resolve', smartBuildingController.resolveSecurityAlert);
router.post('/events', validate(eventSchema), smartBuildingController.ingestEvent);

export default router;
