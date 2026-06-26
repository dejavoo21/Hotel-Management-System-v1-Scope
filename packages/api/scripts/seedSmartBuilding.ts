import {
  AccessActorType,
  CameraStatus,
  DoorAccessResult,
  DoorLockState,
  DoorOpenState,
  IoTDeviceStatus,
  IoTDeviceType,
  PrismaClient,
  SecurityAlertSeverity,
  SecurityAlertStatus,
  SecurityAlertType,
  SensorStatus,
  SensorType,
} from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, '../../../.env') });
dotenv.config({ path: path.resolve(scriptDir, '../.env'), override: true });

const prisma = new PrismaClient();
const now = new Date();
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

const DEMO_PREFIX = 'demo-smart-building-';

async function main() {
  const hotel = await prisma.hotel.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!hotel) {
    throw new Error('No hotel found. Create a hotel first, then rerun the Smart Building seed.');
  }

  // Idempotency: remove only this demo namespace before recreating the sample telemetry.
  await prisma.securityAlert.deleteMany({ where: { hotelId: hotel.id, externalId: { startsWith: DEMO_PREFIX } } });
  await prisma.sensorReading.deleteMany({ where: { hotelId: hotel.id, externalId: { startsWith: DEMO_PREFIX } } });
  await prisma.doorAccessEvent.deleteMany({ where: { hotelId: hotel.id, externalId: { startsWith: DEMO_PREFIX } } });
  await prisma.doorStatus.deleteMany({ where: { hotelId: hotel.id, externalId: { startsWith: DEMO_PREFIX } } });
  await prisma.cameraFeed.deleteMany({ where: { hotelId: hotel.id, externalId: { startsWith: DEMO_PREFIX } } });
  await prisma.ioTDevice.deleteMany({ where: { hotelId: hotel.id, externalId: { startsWith: DEMO_PREFIX } } });

  const devices = await Promise.all([
    prisma.ioTDevice.create({
      data: {
        hotelId: hotel.id,
        externalId: `${DEMO_PREFIX}reception-camera`,
        name: 'Reception Camera',
        deviceType: IoTDeviceType.CAMERA,
        status: IoTDeviceStatus.ONLINE,
        location: 'Reception',
        floor: 0,
        zone: 'Front Office',
        vendor: 'LaFlo Demo CCTV',
        lastSeenAt: minutesAgo(1),
      },
    }),
    prisma.ioTDevice.create({
      data: {
        hotelId: hotel.id,
        externalId: `${DEMO_PREFIX}parking-camera`,
        name: 'Parking Camera',
        deviceType: IoTDeviceType.CAMERA,
        status: IoTDeviceStatus.ONLINE,
        location: 'Parking',
        floor: -1,
        zone: 'Exterior',
        vendor: 'LaFlo Demo CCTV',
        lastSeenAt: minutesAgo(2),
      },
    }),
    prisma.ioTDevice.create({
      data: {
        hotelId: hotel.id,
        externalId: `${DEMO_PREFIX}corridor-camera`,
        name: 'Corridor Camera',
        deviceType: IoTDeviceType.CAMERA,
        status: IoTDeviceStatus.OFFLINE,
        location: 'Guest Corridor',
        floor: 1,
        zone: 'Guest Floors',
        vendor: 'LaFlo Demo CCTV',
        lastSeenAt: minutesAgo(42),
      },
    }),
    prisma.ioTDevice.create({
      data: {
        hotelId: hotel.id,
        externalId: `${DEMO_PREFIX}room-101-smart-lock`,
        name: 'Room 101 Smart Lock',
        deviceType: IoTDeviceType.DOOR_LOCK,
        status: IoTDeviceStatus.ONLINE,
        location: 'Room 101',
        floor: 1,
        zone: 'Guest Rooms',
        vendor: 'LaFlo Demo Locks',
        lastSeenAt: minutesAgo(1),
      },
    }),
    prisma.ioTDevice.create({
      data: {
        hotelId: hotel.id,
        externalId: `${DEMO_PREFIX}basement-water-leak-sensor`,
        name: 'Basement Water Leak Sensor',
        deviceType: IoTDeviceType.WATER_LEAK_SENSOR,
        status: IoTDeviceStatus.WARNING,
        location: 'Basement',
        floor: -1,
        zone: 'Plant / Utilities',
        vendor: 'LaFlo Demo Sensors',
        lastSeenAt: minutesAgo(3),
      },
    }),
    prisma.ioTDevice.create({
      data: {
        hotelId: hotel.id,
        externalId: `${DEMO_PREFIX}lobby-temperature-sensor`,
        name: 'Lobby Temperature Sensor',
        deviceType: IoTDeviceType.TEMPERATURE_SENSOR,
        status: IoTDeviceStatus.ONLINE,
        location: 'Lobby',
        floor: 0,
        zone: 'Front of House',
        vendor: 'LaFlo Demo Sensors',
        lastSeenAt: minutesAgo(1),
      },
    }),
    prisma.ioTDevice.create({
      data: {
        hotelId: hotel.id,
        externalId: `${DEMO_PREFIX}motion-sensor-pool-area`,
        name: 'Motion Sensor Pool Area',
        deviceType: IoTDeviceType.MOTION_SENSOR,
        status: IoTDeviceStatus.WARNING,
        location: 'Pool Area',
        floor: 0,
        zone: 'Leisure',
        vendor: 'LaFlo Demo Sensors',
        lastSeenAt: minutesAgo(4),
      },
    }),
    prisma.ioTDevice.create({
      data: {
        hotelId: hotel.id,
        externalId: `${DEMO_PREFIX}panic-button-reception`,
        name: 'Panic Button Reception',
        deviceType: IoTDeviceType.PANIC_BUTTON,
        status: IoTDeviceStatus.ONLINE,
        location: 'Reception',
        floor: 0,
        zone: 'Front Office',
        vendor: 'LaFlo Demo Safety',
        lastSeenAt: minutesAgo(1),
      },
    }),
  ]);

  const deviceByExternalId = new Map(devices.map((device) => [device.externalId, device]));

  await Promise.all([
    prisma.cameraFeed.create({
      data: {
        hotelId: hotel.id,
        deviceId: deviceByExternalId.get(`${DEMO_PREFIX}reception-camera`)?.id,
        externalId: `${DEMO_PREFIX}feed-reception-camera`,
        name: 'Reception Camera',
        location: 'Reception',
        status: CameraStatus.ONLINE,
        streamUrl: 'rtsp://demo.local/reception-camera',
        snapshotUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
        lastSeenAt: minutesAgo(1),
      },
    }),
    prisma.cameraFeed.create({
      data: {
        hotelId: hotel.id,
        deviceId: deviceByExternalId.get(`${DEMO_PREFIX}parking-camera`)?.id,
        externalId: `${DEMO_PREFIX}feed-parking-camera`,
        name: 'Parking Camera',
        location: 'Parking',
        status: CameraStatus.ONLINE,
        streamUrl: 'rtsp://demo.local/parking-camera',
        lastSeenAt: minutesAgo(2),
      },
    }),
    prisma.cameraFeed.create({
      data: {
        hotelId: hotel.id,
        deviceId: deviceByExternalId.get(`${DEMO_PREFIX}corridor-camera`)?.id,
        externalId: `${DEMO_PREFIX}feed-corridor-camera`,
        name: 'Corridor Camera',
        location: 'Guest Corridor',
        status: CameraStatus.OFFLINE,
        streamUrl: 'rtsp://demo.local/corridor-camera',
        lastSeenAt: minutesAgo(42),
      },
    }),
  ]);

  await Promise.all([
    prisma.doorStatus.create({
      data: {
        hotelId: hotel.id,
        deviceId: deviceByExternalId.get(`${DEMO_PREFIX}room-101-smart-lock`)?.id,
        externalId: `${DEMO_PREFIX}door-room-101`,
        name: 'Room 101 Smart Lock',
        location: 'Room 101',
        floor: 1,
        lockState: DoorLockState.LOCKED,
        openState: DoorOpenState.CLOSED,
        batteryLevel: 94,
        lastEventAt: minutesAgo(2),
      },
    }),
    prisma.doorStatus.create({
      data: {
        hotelId: hotel.id,
        externalId: `${DEMO_PREFIX}door-emergency-exit`,
        name: 'Emergency Exit Door',
        location: 'Emergency Exit',
        floor: 0,
        lockState: DoorLockState.UNLOCKED,
        openState: DoorOpenState.OPEN,
        batteryLevel: 78,
        lastEventAt: minutesAgo(5),
      },
    }),
  ]);

  await Promise.all([
    prisma.doorAccessEvent.create({
      data: {
        hotelId: hotel.id,
        externalId: `${DEMO_PREFIX}access-room-101-granted`,
        doorExternalId: `${DEMO_PREFIX}door-room-101`,
        doorName: 'Room 101 Smart Lock',
        actorName: 'Guest Demo',
        actorType: AccessActorType.GUEST,
        credentialId: 'DEMO-GUEST-101',
        result: DoorAccessResult.GRANTED,
        occurredAt: minutesAgo(18),
      },
    }),
    prisma.doorAccessEvent.create({
      data: {
        hotelId: hotel.id,
        externalId: `${DEMO_PREFIX}access-emergency-exit-open`,
        doorExternalId: `${DEMO_PREFIX}door-emergency-exit`,
        doorName: 'Emergency Exit Door',
        actorName: 'System',
        actorType: AccessActorType.SYSTEM,
        result: DoorAccessResult.HELD_OPEN,
        occurredAt: minutesAgo(5),
      },
    }),
  ]);

  await Promise.all([
    prisma.sensorReading.create({
      data: {
        hotelId: hotel.id,
        deviceId: deviceByExternalId.get(`${DEMO_PREFIX}basement-water-leak-sensor`)?.id,
        externalId: `${DEMO_PREFIX}reading-basement-water-leak`,
        sensorType: SensorType.WATER_LEAK,
        location: 'Basement',
        value: 1,
        unit: 'state',
        status: SensorStatus.ALERT,
        recordedAt: minutesAgo(3),
      },
    }),
    prisma.sensorReading.create({
      data: {
        hotelId: hotel.id,
        deviceId: deviceByExternalId.get(`${DEMO_PREFIX}lobby-temperature-sensor`)?.id,
        externalId: `${DEMO_PREFIX}reading-lobby-temperature`,
        sensorType: SensorType.TEMPERATURE,
        location: 'Lobby',
        value: 21.5,
        unit: 'C',
        status: SensorStatus.NORMAL,
        recordedAt: minutesAgo(1),
      },
    }),
    prisma.sensorReading.create({
      data: {
        hotelId: hotel.id,
        deviceId: deviceByExternalId.get(`${DEMO_PREFIX}motion-sensor-pool-area`)?.id,
        externalId: `${DEMO_PREFIX}reading-motion-pool-area`,
        sensorType: SensorType.MOTION,
        location: 'Pool Area',
        value: 1,
        unit: 'state',
        status: SensorStatus.WARNING,
        recordedAt: minutesAgo(4),
      },
    }),
    prisma.sensorReading.create({
      data: {
        hotelId: hotel.id,
        deviceId: deviceByExternalId.get(`${DEMO_PREFIX}panic-button-reception`)?.id,
        externalId: `${DEMO_PREFIX}reading-panic-button-reception`,
        sensorType: SensorType.PANIC_BUTTON,
        location: 'Reception',
        value: 0,
        unit: 'state',
        status: SensorStatus.NORMAL,
        recordedAt: minutesAgo(1),
      },
    }),
  ]);

  await Promise.all([
    prisma.securityAlert.create({
      data: {
        hotelId: hotel.id,
        deviceId: deviceByExternalId.get(`${DEMO_PREFIX}corridor-camera`)?.id,
        externalId: `${DEMO_PREFIX}alert-corridor-camera-offline`,
        alertType: SecurityAlertType.CAMERA_OFFLINE,
        severity: SecurityAlertSeverity.MEDIUM,
        status: SecurityAlertStatus.ACTIVE,
        title: 'Corridor Camera offline',
        message: 'Corridor Camera has not reported in over 40 minutes.',
        location: 'Guest Corridor',
        occurredAt: minutesAgo(42),
      },
    }),
    prisma.securityAlert.create({
      data: {
        hotelId: hotel.id,
        externalId: `${DEMO_PREFIX}alert-emergency-exit-open`,
        alertType: SecurityAlertType.DOOR_HELD_OPEN,
        severity: SecurityAlertSeverity.HIGH,
        status: SecurityAlertStatus.ACTIVE,
        title: 'Emergency Exit Door open',
        message: 'Emergency Exit Door is open and needs review.',
        location: 'Emergency Exit',
        occurredAt: minutesAgo(5),
      },
    }),
    prisma.securityAlert.create({
      data: {
        hotelId: hotel.id,
        deviceId: deviceByExternalId.get(`${DEMO_PREFIX}basement-water-leak-sensor`)?.id,
        externalId: `${DEMO_PREFIX}alert-basement-water-leak-critical`,
        alertType: SecurityAlertType.WATER_LEAK,
        severity: SecurityAlertSeverity.CRITICAL,
        status: SecurityAlertStatus.ACTIVE,
        title: 'Basement Water Leak Sensor critical',
        message: 'Basement Water Leak Sensor is reporting an active leak condition.',
        location: 'Basement',
        occurredAt: minutesAgo(3),
      },
    }),
    prisma.securityAlert.create({
      data: {
        hotelId: hotel.id,
        deviceId: deviceByExternalId.get(`${DEMO_PREFIX}motion-sensor-pool-area`)?.id,
        externalId: `${DEMO_PREFIX}alert-motion-pool-area-warning`,
        alertType: SecurityAlertType.MOTION,
        severity: SecurityAlertSeverity.LOW,
        status: SecurityAlertStatus.ACTIVE,
        title: 'Motion Sensor Pool Area warning',
        message: 'Motion Sensor Pool Area detected movement outside the expected window.',
        location: 'Pool Area',
        occurredAt: minutesAgo(4),
      },
    }),
  ]);

  console.log(`Seeded Smart Building demo data for ${hotel.name} (${hotel.id}).`);
  console.log('Devices: 8');
  console.log('Camera feeds: 3');
  console.log('Door statuses: 2');
  console.log('Door access events: 2');
  console.log('Sensor readings: 4');
  console.log('Security alerts: 4');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
