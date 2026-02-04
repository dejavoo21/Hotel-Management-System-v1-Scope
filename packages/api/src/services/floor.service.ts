import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { ConflictError, ValidationError } from '../middleware/errorHandler.js';

interface CreateFloorData {
  number: number;
  name?: string | null;
}

export async function deleteFloor(hotelId: string, userId: string, floorId: string) {
  const floor = await prisma.floor.findFirst({
    where: { id: floorId, hotelId },
  });

  if (!floor) {
    throw new ValidationError('Floor not found');
  }

  const dependentRooms = await prisma.room.count({
    where: { hotelId, floor: floor.number },
  });

  if (dependentRooms > 0) {
    throw new ConflictError('Cannot delete a floor with rooms assigned');
  }

  await prisma.floor.delete({
    where: { id: floorId },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: 'FLOOR_DELETED',
      entity: 'floor',
      entityId: floorId,
      details: { floorNumber: floor.number },
    },
  });

  logger.info(`Floor deleted: ${floor.number}`, { service: 'hotelos-api' });
}

export async function getFloors(hotelId: string) {
  return prisma.floor.findMany({
    where: { hotelId },
    orderBy: { number: 'asc' },
  });
}

export async function createFloor(hotelId: string, userId: string, data: CreateFloorData) {
  const parsedNumber = Number(data.number);
  if (!Number.isFinite(parsedNumber) || !Number.isInteger(parsedNumber)) {
    throw new ValidationError('Floor number must be an integer');
  }

  const existing = await prisma.floor.findFirst({
    where: { hotelId, number: parsedNumber },
  });

  if (existing) {
    throw new ConflictError('Floor already exists');
  }

  const floor = await prisma.floor.create({
    data: {
      hotelId,
      number: parsedNumber,
      name: data.name?.trim() || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: 'FLOOR_CREATED',
      entity: 'floor',
      entityId: floor.id,
      details: { floorNumber: floor.number },
    },
  });

  logger.info(`Floor ${floor.number} created`, { service: 'hotelos-api' });

  return floor;
}
