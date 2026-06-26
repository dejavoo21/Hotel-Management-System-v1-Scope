import {
  AccessActorType,
  CameraStatus,
  DoorAccessResult,
  DoorLockState,
  DoorOpenState,
  IoTDeviceStatus,
  IoTDeviceType,
  Prisma,
  SecurityAlertSeverity,
  SecurityAlertStatus,
  SecurityAlertType,
  SensorStatus,
  SensorType,
} from '@prisma/client';
import { prisma } from '../config/database.js';

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const eventTimestamp = (value?: string | Date | null) => (value ? new Date(value) : new Date());

const cameraStatusToDeviceStatus = (status: CameraStatus): IoTDeviceStatus => {
  if (status === CameraStatus.ONLINE) return IoTDeviceStatus.ONLINE;
  if (status === CameraStatus.OFFLINE) return IoTDeviceStatus.OFFLINE;
  if (status === CameraStatus.WARNING) return IoTDeviceStatus.WARNING;
  return IoTDeviceStatus.MAINTENANCE;
};

async function findDeviceId(hotelId: string, externalId?: string | null) {
  if (!externalId) return null;
  const device = await prisma.ioTDevice.findUnique({
    where: { hotelId_externalId: { hotelId, externalId } },
    select: { id: true },
  });
  return device?.id || null;
}

async function ensureAlert(args: {
  hotelId: string;
  deviceId?: string | null;
  externalId?: string | null;
  alertType: SecurityAlertType;
  severity?: SecurityAlertSeverity;
  title: string;
  message?: string | null;
  location?: string | null;
  occurredAt?: Date;
  metadata?: Prisma.InputJsonValue;
}) {
  const data = {
    hotelId: args.hotelId,
    deviceId: args.deviceId || undefined,
    externalId: args.externalId || undefined,
    alertType: args.alertType,
    severity: args.severity || SecurityAlertSeverity.MEDIUM,
    status: SecurityAlertStatus.ACTIVE,
    title: args.title,
    message: args.message || undefined,
    location: args.location || undefined,
    occurredAt: args.occurredAt || new Date(),
    metadata: args.metadata,
  };

  if (args.externalId) {
    return prisma.securityAlert.upsert({
      where: { hotelId_externalId: { hotelId: args.hotelId, externalId: args.externalId } },
      update: {
        ...data,
        status: SecurityAlertStatus.ACTIVE,
        resolvedAt: null,
        resolvedById: null,
      },
      create: data,
    });
  }

  return prisma.securityAlert.create({ data });
}

export async function getSmartBuildingOverview(hotelId: string) {
  const [
    onlineCameras,
    offlineCameras,
    lockedDoors,
    openDoors,
    accessEventsToday,
    motionAlerts,
    temperatureNormal,
    temperatureWarning,
    waterLeakAlerts,
    panicAlerts,
    activeAlerts,
    onlineDevices,
    totalDevices,
  ] = await Promise.all([
    prisma.cameraFeed.count({ where: { hotelId, status: CameraStatus.ONLINE } }),
    prisma.cameraFeed.count({ where: { hotelId, status: CameraStatus.OFFLINE } }),
    prisma.doorStatus.count({ where: { hotelId, lockState: DoorLockState.LOCKED } }),
    prisma.doorStatus.count({ where: { hotelId, openState: { in: [DoorOpenState.OPEN, DoorOpenState.FORCED_OPEN, DoorOpenState.HELD_OPEN] } } }),
    prisma.doorAccessEvent.count({ where: { hotelId, occurredAt: { gte: todayStart() } } }),
    prisma.securityAlert.count({ where: { hotelId, alertType: SecurityAlertType.MOTION, status: SecurityAlertStatus.ACTIVE } }),
    prisma.sensorReading.count({ where: { hotelId, sensorType: SensorType.TEMPERATURE, status: SensorStatus.NORMAL } }),
    prisma.sensorReading.count({ where: { hotelId, sensorType: SensorType.TEMPERATURE, status: SensorStatus.WARNING } }),
    prisma.securityAlert.count({ where: { hotelId, alertType: SecurityAlertType.WATER_LEAK, status: SecurityAlertStatus.ACTIVE } }),
    prisma.securityAlert.count({ where: { hotelId, alertType: SecurityAlertType.PANIC, status: SecurityAlertStatus.ACTIVE } }),
    prisma.securityAlert.count({ where: { hotelId, status: SecurityAlertStatus.ACTIVE } }),
    prisma.ioTDevice.count({ where: { hotelId, status: IoTDeviceStatus.ONLINE } }),
    prisma.ioTDevice.count({ where: { hotelId } }),
  ]);

  return {
    cameras: { online: onlineCameras, offline: offlineCameras },
    doors: { locked: lockedDoors, open: openDoors },
    accessEvents: { today: accessEventsToday },
    motionAlerts: { active: motionAlerts },
    temperatureSensors: { normal: temperatureNormal, warning: temperatureWarning },
    waterLeakSensors: { alerts: waterLeakAlerts },
    panicButtons: { active: panicAlerts },
    health: {
      activeAlerts,
      onlineDevices,
      totalDevices,
    },
  };
}

export async function listDevices(hotelId: string) {
  return prisma.ioTDevice.findMany({
    where: { hotelId },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    take: 250,
  });
}

export async function listCameraFeeds(hotelId: string) {
  return prisma.cameraFeed.findMany({
    where: { hotelId },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    take: 250,
  });
}

export async function listDoorAccessEvents(hotelId: string) {
  return prisma.doorAccessEvent.findMany({
    where: { hotelId },
    orderBy: { occurredAt: 'desc' },
    take: 250,
  });
}

export async function listDoorStatuses(hotelId: string) {
  return prisma.doorStatus.findMany({
    where: { hotelId },
    orderBy: [{ openState: 'asc' }, { name: 'asc' }],
    take: 250,
  });
}

export async function listSensorReadings(hotelId: string) {
  return prisma.sensorReading.findMany({
    where: { hotelId },
    orderBy: { recordedAt: 'desc' },
    take: 500,
  });
}

export async function listSecurityAlerts(hotelId: string) {
  return prisma.securityAlert.findMany({
    where: { hotelId },
    orderBy: [{ status: 'asc' }, { occurredAt: 'desc' }],
    take: 250,
  });
}

export async function acknowledgeSecurityAlert(hotelId: string, alertId: string, userId: string) {
  const alert = await prisma.securityAlert.findFirst({
    where: { id: alertId, hotelId },
    select: { id: true },
  });
  if (!alert) throw new Error('Security alert not found');

  return prisma.securityAlert.update({
    where: { id: alert.id },
    data: {
      status: SecurityAlertStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date(),
      acknowledgedById: userId,
    },
  });
}

export async function resolveSecurityAlert(hotelId: string, alertId: string, userId: string) {
  const alert = await prisma.securityAlert.findFirst({
    where: { id: alertId, hotelId },
    select: { id: true },
  });
  if (!alert) throw new Error('Security alert not found');

  return prisma.securityAlert.update({
    where: { id: alert.id },
    data: {
      status: SecurityAlertStatus.RESOLVED,
      resolvedAt: new Date(),
      resolvedById: userId,
      acknowledgedAt: new Date(),
      acknowledgedById: userId,
    },
  });
}

export type SmartBuildingEvent =
  | {
      type: 'DEVICE_STATUS';
      device: {
        externalId: string;
        name?: string;
        deviceType: IoTDeviceType;
        status: IoTDeviceStatus;
        location?: string;
        floor?: number;
        zone?: string;
        vendor?: string;
      };
      occurredAt?: string;
      metadata?: Prisma.InputJsonValue;
    }
  | {
      type: 'CAMERA_STATUS';
      camera: {
        externalId: string;
        name?: string;
        deviceExternalId?: string;
        status: CameraStatus;
        location?: string;
        streamUrl?: string;
        snapshotUrl?: string;
      };
      occurredAt?: string;
      metadata?: Prisma.InputJsonValue;
    }
  | {
      type: 'DOOR_ACCESS';
      accessEvent: {
        externalId?: string;
        doorExternalId?: string;
        doorName?: string;
        actorName?: string;
        actorType?: AccessActorType;
        credentialId?: string;
        result: DoorAccessResult;
      };
      occurredAt?: string;
      metadata?: Prisma.InputJsonValue;
    }
  | {
      type: 'DOOR_STATUS';
      door: {
        externalId: string;
        name?: string;
        deviceExternalId?: string;
        location?: string;
        floor?: number;
        lockState: DoorLockState;
        openState: DoorOpenState;
        batteryLevel?: number;
      };
      occurredAt?: string;
      metadata?: Prisma.InputJsonValue;
    }
  | {
      type: 'SENSOR_READING';
      sensor: {
        externalId?: string;
        deviceExternalId?: string;
        sensorType: SensorType;
        location?: string;
        value: number;
        unit: string;
        status: SensorStatus;
      };
      occurredAt?: string;
      metadata?: Prisma.InputJsonValue;
    }
  | {
      type: 'SECURITY_ALERT';
      alert: {
        externalId?: string;
        deviceExternalId?: string;
        alertType: SecurityAlertType;
        severity?: SecurityAlertSeverity;
        title: string;
        message?: string;
        location?: string;
      };
      occurredAt?: string;
      metadata?: Prisma.InputJsonValue;
    };

export async function ingestSmartBuildingEvent(hotelId: string, payload: SmartBuildingEvent) {
  const occurredAt = eventTimestamp(payload.occurredAt);
  const metadata = payload.metadata;

  switch (payload.type) {
    case 'DEVICE_STATUS': {
      const { device } = payload;
      const row = await prisma.ioTDevice.upsert({
        where: { hotelId_externalId: { hotelId, externalId: device.externalId } },
        update: {
          name: device.name || device.externalId,
          deviceType: device.deviceType,
          status: device.status,
          location: device.location,
          floor: device.floor,
          zone: device.zone,
          vendor: device.vendor,
          metadata,
          lastSeenAt: occurredAt,
        },
        create: {
          hotelId,
          externalId: device.externalId,
          name: device.name || device.externalId,
          deviceType: device.deviceType,
          status: device.status,
          location: device.location,
          floor: device.floor,
          zone: device.zone,
          vendor: device.vendor,
          metadata,
          lastSeenAt: occurredAt,
        },
      });

      if (device.status === IoTDeviceStatus.OFFLINE || device.status === IoTDeviceStatus.WARNING) {
        await ensureAlert({
          hotelId,
          deviceId: row.id,
          externalId: `device-status:${device.externalId}`,
          alertType: SecurityAlertType.DEVICE_OFFLINE,
          severity: device.status === IoTDeviceStatus.OFFLINE ? SecurityAlertSeverity.HIGH : SecurityAlertSeverity.MEDIUM,
          title: `${device.name || device.externalId} ${device.status.toLowerCase()}`,
          location: device.location,
          occurredAt,
          metadata,
        });
      }
      return row;
    }

    case 'CAMERA_STATUS': {
      const { camera } = payload;
      const deviceId = await findDeviceId(hotelId, camera.deviceExternalId);
      if (deviceId) {
        await prisma.ioTDevice.update({
          where: { id: deviceId },
          data: {
            status: cameraStatusToDeviceStatus(camera.status),
            location: camera.location,
            lastSeenAt: occurredAt,
            metadata,
          },
        });
      }
      const row = await prisma.cameraFeed.upsert({
        where: { hotelId_externalId: { hotelId, externalId: camera.externalId } },
        update: {
          deviceId,
          name: camera.name || camera.externalId,
          location: camera.location,
          status: camera.status,
          streamUrl: camera.streamUrl,
          snapshotUrl: camera.snapshotUrl,
          lastSeenAt: occurredAt,
          metadata,
        },
        create: {
          hotelId,
          deviceId,
          externalId: camera.externalId,
          name: camera.name || camera.externalId,
          location: camera.location,
          status: camera.status,
          streamUrl: camera.streamUrl,
          snapshotUrl: camera.snapshotUrl,
          lastSeenAt: occurredAt,
          metadata,
        },
      });

      if (camera.status === CameraStatus.OFFLINE) {
        await ensureAlert({
          hotelId,
          deviceId,
          externalId: `camera-offline:${camera.externalId}`,
          alertType: SecurityAlertType.CAMERA_OFFLINE,
          severity: SecurityAlertSeverity.MEDIUM,
          title: `${camera.name || camera.externalId} offline`,
          location: camera.location,
          occurredAt,
          metadata,
        });
      }
      return row;
    }

    case 'DOOR_ACCESS': {
      const { accessEvent } = payload;
      const row = await prisma.doorAccessEvent.create({
        data: {
          hotelId,
          externalId: accessEvent.externalId,
          doorExternalId: accessEvent.doorExternalId,
          doorName: accessEvent.doorName,
          actorName: accessEvent.actorName,
          actorType: accessEvent.actorType || AccessActorType.UNKNOWN,
          credentialId: accessEvent.credentialId,
          result: accessEvent.result,
          occurredAt,
          metadata,
        },
      });

      if (
        accessEvent.result === DoorAccessResult.FORCED ||
        accessEvent.result === DoorAccessResult.HELD_OPEN ||
        accessEvent.result === DoorAccessResult.DENIED
      ) {
        await ensureAlert({
          hotelId,
          externalId: accessEvent.externalId ? `door-access:${accessEvent.externalId}` : undefined,
          alertType: accessEvent.result === DoorAccessResult.FORCED ? SecurityAlertType.FORCED_DOOR : SecurityAlertType.DOOR_HELD_OPEN,
          severity: accessEvent.result === DoorAccessResult.FORCED ? SecurityAlertSeverity.HIGH : SecurityAlertSeverity.MEDIUM,
          title: `${accessEvent.doorName || accessEvent.doorExternalId || 'Door'} ${accessEvent.result.toLowerCase().replace('_', ' ')}`,
          occurredAt,
          metadata,
        });
      }
      return row;
    }

    case 'DOOR_STATUS': {
      const { door } = payload;
      const deviceId = await findDeviceId(hotelId, door.deviceExternalId);
      const row = await prisma.doorStatus.upsert({
        where: { hotelId_externalId: { hotelId, externalId: door.externalId } },
        update: {
          deviceId,
          name: door.name || door.externalId,
          location: door.location,
          floor: door.floor,
          lockState: door.lockState,
          openState: door.openState,
          batteryLevel: door.batteryLevel,
          lastEventAt: occurredAt,
          metadata,
        },
        create: {
          hotelId,
          deviceId,
          externalId: door.externalId,
          name: door.name || door.externalId,
          location: door.location,
          floor: door.floor,
          lockState: door.lockState,
          openState: door.openState,
          batteryLevel: door.batteryLevel,
          lastEventAt: occurredAt,
          metadata,
        },
      });

      if (door.openState === DoorOpenState.FORCED_OPEN || door.openState === DoorOpenState.HELD_OPEN) {
        await ensureAlert({
          hotelId,
          deviceId,
          externalId: `door-status:${door.externalId}`,
          alertType: door.openState === DoorOpenState.FORCED_OPEN ? SecurityAlertType.FORCED_DOOR : SecurityAlertType.DOOR_HELD_OPEN,
          severity: door.openState === DoorOpenState.FORCED_OPEN ? SecurityAlertSeverity.HIGH : SecurityAlertSeverity.MEDIUM,
          title: `${door.name || door.externalId} ${door.openState.toLowerCase().replace('_', ' ')}`,
          location: door.location,
          occurredAt,
          metadata,
        });
      }
      return row;
    }

    case 'SENSOR_READING': {
      const { sensor } = payload;
      const deviceId = await findDeviceId(hotelId, sensor.deviceExternalId);
      const row = await prisma.sensorReading.create({
        data: {
          hotelId,
          deviceId,
          externalId: sensor.externalId,
          sensorType: sensor.sensorType,
          location: sensor.location,
          value: new Prisma.Decimal(sensor.value),
          unit: sensor.unit,
          status: sensor.status,
          recordedAt: occurredAt,
          metadata,
        },
      });

      if (sensor.status === SensorStatus.ALERT || sensor.sensorType === SensorType.PANIC_BUTTON) {
        const alertType =
          sensor.sensorType === SensorType.WATER_LEAK
            ? SecurityAlertType.WATER_LEAK
            : sensor.sensorType === SensorType.PANIC_BUTTON
              ? SecurityAlertType.PANIC
              : sensor.sensorType === SensorType.MOTION
                ? SecurityAlertType.MOTION
                : SecurityAlertType.OTHER;
        await ensureAlert({
          hotelId,
          deviceId,
          externalId: sensor.externalId ? `sensor:${sensor.externalId}:${occurredAt.toISOString()}` : undefined,
          alertType,
          severity:
            sensor.sensorType === SensorType.PANIC_BUTTON || sensor.sensorType === SensorType.WATER_LEAK
              ? SecurityAlertSeverity.CRITICAL
              : SecurityAlertSeverity.HIGH,
          title: `${sensor.sensorType.toLowerCase().replace('_', ' ')} alert`,
          location: sensor.location,
          occurredAt,
          metadata,
        });
      }
      return row;
    }

    case 'SECURITY_ALERT': {
      const { alert } = payload;
      const deviceId = await findDeviceId(hotelId, alert.deviceExternalId);
      return ensureAlert({
        hotelId,
        deviceId,
        externalId: alert.externalId,
        alertType: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        location: alert.location,
        occurredAt,
        metadata,
      });
    }
  }
}
