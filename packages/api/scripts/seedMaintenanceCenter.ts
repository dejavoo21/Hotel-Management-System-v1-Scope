import {
  AssetInspectionStatus,
  MaintenanceCenterPriority,
  MaintenanceFaultSeverity,
  MaintenanceFaultStatus,
  MaintenanceRepairStatus,
  MaintenanceWorkOrderStatus,
  PreventiveMaintenanceFrequency,
  PreventiveMaintenanceStatus,
  PrismaClient,
} from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, '../../../.env') });
dotenv.config({ path: path.resolve(scriptDir, '../.env'), override: true });

const prisma = new PrismaClient();
const now = new Date();
const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60_000);
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60_000);
const DEMO_PREFIX = 'maintenance-center-demo';

async function main() {
  const hotel = await prisma.hotel.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!hotel) {
    throw new Error('No hotel found. Create a hotel first, then rerun the Maintenance Center seed.');
  }

  await prisma.assetMaintenanceRecord.deleteMany({ where: { hotelId: hotel.id, assetExternalId: { startsWith: DEMO_PREFIX } } });
  await prisma.preventiveMaintenanceSchedule.deleteMany({ where: { hotelId: hotel.id, assetExternalId: { startsWith: DEMO_PREFIX } } });
  await prisma.maintenanceRepair.deleteMany({ where: { hotelId: hotel.id, title: { startsWith: '[Demo]' } } });
  await prisma.maintenanceFault.deleteMany({ where: { hotelId: hotel.id, title: { startsWith: '[Demo]' } } });
  await prisma.maintenanceWorkOrder.deleteMany({ where: { hotelId: hotel.id, title: { startsWith: '[Demo]' } } });

  const workOrder = await prisma.maintenanceWorkOrder.create({
    data: {
      hotelId: hotel.id,
      title: '[Demo] Replace lobby HVAC filter',
      description: 'Scheduled filter replacement for the lobby air handler.',
      category: 'HVAC',
      location: 'Lobby',
      assetName: 'Lobby Air Handler',
      assetExternalId: `${DEMO_PREFIX}-lobby-air-handler`,
      priority: MaintenanceCenterPriority.HIGH,
      status: MaintenanceWorkOrderStatus.IN_PROGRESS,
      assignedTo: 'Maintenance Team',
      dueAt: daysFromNow(1),
    },
  });

  const fault = await prisma.maintenanceFault.create({
    data: {
      hotelId: hotel.id,
      workOrderId: workOrder.id,
      title: '[Demo] Basement pump vibration',
      description: 'Pump is vibrating above the normal operating range.',
      location: 'Basement Plant Room',
      assetName: 'Basement Pump 2',
      severity: MaintenanceFaultSeverity.URGENT,
      status: MaintenanceFaultStatus.OPEN,
      reportedAt: hoursAgo(3),
    },
  });

  await prisma.maintenanceRepair.create({
    data: {
      hotelId: hotel.id,
      workOrderId: workOrder.id,
      faultId: fault.id,
      title: '[Demo] Inspect pump bearings',
      description: 'Technician assigned to inspect and repair bearing assembly.',
      technician: 'Alex Rivera',
      status: MaintenanceRepairStatus.IN_PROGRESS,
      startedAt: hoursAgo(1),
    },
  });

  await prisma.preventiveMaintenanceSchedule.createMany({
    data: [
      {
        hotelId: hotel.id,
        title: 'Monthly generator test',
        assetName: 'Emergency Generator',
        assetExternalId: `${DEMO_PREFIX}-emergency-generator`,
        frequency: PreventiveMaintenanceFrequency.MONTHLY,
        nextDueAt: daysFromNow(-2),
        lastCompletedAt: daysFromNow(-32),
        status: PreventiveMaintenanceStatus.OVERDUE,
        notes: 'Run load test and record voltage stability.',
      },
      {
        hotelId: hotel.id,
        title: 'Quarterly lift inspection',
        assetName: 'Guest Lift A',
        assetExternalId: `${DEMO_PREFIX}-guest-lift-a`,
        frequency: PreventiveMaintenanceFrequency.QUARTERLY,
        nextDueAt: daysFromNow(12),
        lastCompletedAt: daysFromNow(-78),
        status: PreventiveMaintenanceStatus.ACTIVE,
        notes: 'Vendor inspection window confirmed.',
      },
    ],
  });

  await prisma.assetMaintenanceRecord.createMany({
    data: [
      {
        hotelId: hotel.id,
        assetName: 'Emergency Generator',
        assetExternalId: `${DEMO_PREFIX}-emergency-generator`,
        location: 'Basement Plant Room',
        inspectionStatus: AssetInspectionStatus.OVERDUE,
        lastInspectionAt: daysFromNow(-34),
        nextInspectionAt: daysFromNow(-2),
        notes: 'Linked to monthly generator preventive schedule.',
      },
      {
        hotelId: hotel.id,
        assetName: 'Pool Heater',
        assetExternalId: `${DEMO_PREFIX}-pool-heater`,
        location: 'Pool Area',
        inspectionStatus: AssetInspectionStatus.DUE,
        lastInspectionAt: daysFromNow(-85),
        nextInspectionAt: daysFromNow(2),
        notes: 'Inspection due before weekend occupancy peak.',
      },
    ],
  });

  console.log(`Seeded Maintenance Center demo data for ${hotel.name} (${hotel.id}).`);
  console.log('Work orders: 1');
  console.log('Faults: 1');
  console.log('Repairs: 1');
  console.log('Preventive maintenance schedules: 2');
  console.log('Asset maintenance records: 2');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
