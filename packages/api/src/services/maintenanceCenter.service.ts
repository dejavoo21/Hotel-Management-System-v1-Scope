import {
  AssetInspectionStatus,
  MaintenanceCenterPriority,
  MaintenanceFaultSeverity,
  MaintenanceFaultStatus,
  MaintenanceRepairStatus,
  MaintenanceWorkOrderStatus,
  PreventiveMaintenanceStatus,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../config/database.js';
import { getSmartBuildingWorkflowTaskSummary, listSmartBuildingWorkflowTasks } from './smartBuildingTask.service.js';

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function getMaintenanceCenterOverview(hotelId: string) {
  const now = new Date();
  const [
    openWorkOrders,
    urgentFaults,
    repairsInProgress,
    overdueMaintenance,
    assetsDueInspection,
    completedWorkOrdersToday,
    completedRepairsToday,
    completedSchedulesToday,
    recentWorkOrders,
    recentFaults,
    recentRepairs,
    smartBuildingTasks,
    smartBuildingTaskSummary,
  ] = await Promise.all([
    prisma.maintenanceWorkOrder.count({
      where: { hotelId, status: { in: [MaintenanceWorkOrderStatus.OPEN, MaintenanceWorkOrderStatus.IN_PROGRESS, MaintenanceWorkOrderStatus.ON_HOLD] } },
    }),
    prisma.maintenanceFault.count({
      where: {
        hotelId,
        severity: { in: [MaintenanceFaultSeverity.URGENT, MaintenanceFaultSeverity.CRITICAL] },
        status: { in: [MaintenanceFaultStatus.OPEN, MaintenanceFaultStatus.IN_PROGRESS] },
      },
    }),
    prisma.maintenanceRepair.count({ where: { hotelId, status: MaintenanceRepairStatus.IN_PROGRESS } }),
    prisma.preventiveMaintenanceSchedule.count({
      where: {
        hotelId,
        status: { in: [PreventiveMaintenanceStatus.ACTIVE, PreventiveMaintenanceStatus.OVERDUE] },
        nextDueAt: { lt: now },
      },
    }),
    prisma.assetMaintenanceRecord.count({
      where: {
        hotelId,
        OR: [
          { inspectionStatus: { in: [AssetInspectionStatus.DUE, AssetInspectionStatus.OVERDUE, AssetInspectionStatus.NEEDS_REPAIR] } },
          { nextInspectionAt: { lte: now } },
        ],
      },
    }),
    prisma.maintenanceWorkOrder.count({ where: { hotelId, status: MaintenanceWorkOrderStatus.COMPLETED, completedAt: { gte: todayStart() } } }),
    prisma.maintenanceRepair.count({ where: { hotelId, status: MaintenanceRepairStatus.COMPLETED, completedAt: { gte: todayStart() } } }),
    prisma.preventiveMaintenanceSchedule.count({ where: { hotelId, lastCompletedAt: { gte: todayStart() } } }),
    prisma.maintenanceWorkOrder.findMany({ where: { hotelId }, orderBy: { updatedAt: 'desc' }, take: 5 }),
    prisma.maintenanceFault.findMany({ where: { hotelId }, orderBy: { reportedAt: 'desc' }, take: 5 }),
    prisma.maintenanceRepair.findMany({ where: { hotelId }, orderBy: { updatedAt: 'desc' }, take: 5 }),
    listSmartBuildingWorkflowTasks(hotelId, 'maintenance'),
    getSmartBuildingWorkflowTaskSummary(hotelId),
  ]);

  const recentActivity = [
    ...recentWorkOrders.map((item) => ({
      id: `work-order:${item.id}`,
      type: 'WORK_ORDER',
      title: item.title,
      detail: item.location || item.assetName || item.category,
      status: item.status,
      occurredAt: item.updatedAt,
    })),
    ...recentFaults.map((item) => ({
      id: `fault:${item.id}`,
      type: 'FAULT',
      title: item.title,
      detail: item.location || item.assetName || item.severity,
      status: item.status,
      occurredAt: item.reportedAt,
    })),
    ...recentRepairs.map((item) => ({
      id: `repair:${item.id}`,
      type: 'REPAIR',
      title: item.title,
      detail: item.technician || item.description,
      status: item.status,
      occurredAt: item.updatedAt,
    })),
    ...smartBuildingTasks.slice(0, 5).map((item) => ({
      id: `smart-building-task:${item.id}`,
      type: 'SMART_BUILDING_TASK',
      title: item.title,
      detail: [
        item.incidentNumber ? `Incident ${item.incidentNumber}` : null,
        item.location || item.deviceExternalId || item.sourceSignal || item.sourceModule,
      ]
        .filter(Boolean)
        .join(' / '),
      status: item.status,
      occurredAt: item.updatedAt,
      sourceModule: item.sourceModule,
    })),
  ]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, 10);

  return {
    workOrders: { open: openWorkOrders },
    faults: { urgent: urgentFaults },
    repairs: { inProgress: repairsInProgress },
    preventiveMaintenance: { overdue: overdueMaintenance },
    assets: { dueInspection: assetsDueInspection },
    completed: { today: completedWorkOrdersToday + completedRepairsToday + completedSchedulesToday },
    smartBuildingTasks: smartBuildingTaskSummary,
    recentActivity,
  };
}

export function listWorkOrders(hotelId: string) {
  return prisma.maintenanceWorkOrder.findMany({
    where: { hotelId },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueAt: 'asc' }],
    take: 250,
  });
}

export function createWorkOrder(hotelId: string, data: Omit<Prisma.MaintenanceWorkOrderUncheckedCreateInput, 'id' | 'hotelId' | 'createdAt' | 'updatedAt'>) {
  return prisma.maintenanceWorkOrder.create({
    data: {
      hotelId,
      ...data,
      completedAt: data.status === MaintenanceWorkOrderStatus.COMPLETED ? data.completedAt || new Date() : data.completedAt,
    },
  });
}

export async function updateWorkOrder(
  hotelId: string,
  workOrderId: string,
  data: Partial<Omit<Prisma.MaintenanceWorkOrderUncheckedUpdateInput, 'id' | 'hotelId' | 'createdAt' | 'updatedAt'>>
) {
  const workOrder = await prisma.maintenanceWorkOrder.findFirst({ where: { id: workOrderId, hotelId }, select: { id: true } });
  if (!workOrder) throw new Error('Maintenance work order not found');

  return prisma.maintenanceWorkOrder.update({
    where: { id: workOrder.id },
    data: {
      ...data,
      completedAt: data.status === MaintenanceWorkOrderStatus.COMPLETED ? data.completedAt || new Date() : data.completedAt,
    },
  });
}

export function listFaults(hotelId: string) {
  return prisma.maintenanceFault.findMany({
    where: { hotelId },
    orderBy: [{ status: 'asc' }, { severity: 'desc' }, { reportedAt: 'desc' }],
    take: 250,
  });
}

export function createFault(hotelId: string, data: Omit<Prisma.MaintenanceFaultUncheckedCreateInput, 'id' | 'hotelId' | 'createdAt' | 'updatedAt'>) {
  return prisma.maintenanceFault.create({
    data: {
      hotelId,
      ...data,
      resolvedAt:
        data.status === MaintenanceFaultStatus.RESOLVED || data.status === MaintenanceFaultStatus.CLOSED
          ? data.resolvedAt || new Date()
          : data.resolvedAt,
    },
  });
}

export function listRepairs(hotelId: string) {
  return prisma.maintenanceRepair.findMany({
    where: { hotelId },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 250,
  });
}

export function createRepair(hotelId: string, data: Omit<Prisma.MaintenanceRepairUncheckedCreateInput, 'id' | 'hotelId' | 'createdAt' | 'updatedAt'>) {
  return prisma.maintenanceRepair.create({
    data: {
      hotelId,
      ...data,
      startedAt: data.status === MaintenanceRepairStatus.IN_PROGRESS ? data.startedAt || new Date() : data.startedAt,
      completedAt: data.status === MaintenanceRepairStatus.COMPLETED ? data.completedAt || new Date() : data.completedAt,
    },
  });
}

export function listPreventiveMaintenance(hotelId: string) {
  return prisma.preventiveMaintenanceSchedule.findMany({
    where: { hotelId },
    orderBy: [{ status: 'asc' }, { nextDueAt: 'asc' }],
    take: 250,
  });
}

export function listAssets(hotelId: string) {
  return prisma.assetMaintenanceRecord.findMany({
    where: { hotelId },
    include: { device: { select: { externalId: true, deviceType: true, status: true } } },
    orderBy: [{ inspectionStatus: 'desc' }, { nextInspectionAt: 'asc' }],
    take: 250,
  });
}

export function listSmartBuildingMaintenanceTasks(hotelId: string) {
  return listSmartBuildingWorkflowTasks(hotelId, 'maintenance');
}
