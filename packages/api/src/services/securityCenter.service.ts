import {
  CameraStatus,
  SecurityAlertStatus,
  VisitorStatus,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../config/database.js';
import {
  acknowledgeSecurityAlert,
  resolveSecurityAlert,
} from './smartBuilding.service.js';
import { getSmartBuildingWorkflowTaskSummary, listSmartBuildingWorkflowTasks } from './smartBuildingTask.service.js';

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function getSecurityCenterOverview(hotelId: string) {
  const [
    totalCameras,
    onlineCameras,
    offlineCameras,
    accessEventsToday,
    visitorsOnsite,
    openAlerts,
    recentAccessEvents,
    recentAlerts,
    recentVisitors,
    smartBuildingTasks,
    smartBuildingTaskSummary,
  ] = await Promise.all([
    prisma.cameraFeed.count({ where: { hotelId } }),
    prisma.cameraFeed.count({ where: { hotelId, status: CameraStatus.ONLINE } }),
    prisma.cameraFeed.count({ where: { hotelId, status: CameraStatus.OFFLINE } }),
    prisma.doorAccessEvent.count({ where: { hotelId, occurredAt: { gte: todayStart() } } }),
    prisma.visitor.count({ where: { hotelId, status: VisitorStatus.CHECKED_IN } }),
    prisma.securityAlert.count({ where: { hotelId, status: { in: [SecurityAlertStatus.ACTIVE, SecurityAlertStatus.ACKNOWLEDGED] } } }),
    prisma.doorAccessEvent.findMany({
      where: { hotelId },
      orderBy: { occurredAt: 'desc' },
      take: 5,
    }),
    prisma.securityAlert.findMany({
      where: { hotelId },
      orderBy: { occurredAt: 'desc' },
      take: 5,
    }),
    prisma.visitor.findMany({
      where: { hotelId },
      orderBy: { checkInAt: 'desc' },
      take: 5,
    }),
    listSmartBuildingWorkflowTasks(hotelId, 'security'),
    getSmartBuildingWorkflowTaskSummary(hotelId),
  ]);

  const recentActivity = [
    ...recentAlerts.map((alert) => ({
      id: `alert:${alert.id}`,
      type: 'ALERT',
      title: alert.title,
      detail: alert.location || alert.alertType,
      status: alert.status,
      occurredAt: alert.occurredAt,
    })),
    ...recentAccessEvents.map((event) => ({
      id: `access:${event.id}`,
      type: 'ACCESS',
      title: event.doorName || event.doorExternalId || 'Door access event',
      detail: event.actorName || event.actorType,
      status: event.result,
      occurredAt: event.occurredAt,
    })),
    ...recentVisitors.map((visitor) => ({
      id: `visitor:${visitor.id}`,
      type: 'VISITOR',
      title: visitor.fullName,
      detail: visitor.company || visitor.purpose || visitor.hostName || 'Visitor',
      status: visitor.status,
      occurredAt: visitor.checkInAt,
    })),
    ...smartBuildingTasks.slice(0, 5).map((task) => ({
      id: `smart-building-task:${task.id}`,
      type: 'SMART_BUILDING_TASK',
      title: task.title,
      detail: [
        task.incidentNumber ? `Incident ${task.incidentNumber}` : null,
        task.location || task.deviceExternalId || task.sourceSignal || task.sourceModule,
      ]
        .filter(Boolean)
        .join(' / '),
      status: task.status,
      occurredAt: task.updatedAt,
      sourceModule: task.sourceModule,
    })),
  ]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, 10);

  return {
    cctv: { total: totalCameras, online: onlineCameras, offline: offlineCameras },
    accessEvents: { today: accessEventsToday },
    visitors: { onsite: visitorsOnsite },
    alerts: { open: openAlerts },
    smartBuildingTasks: smartBuildingTaskSummary,
    recentActivity,
  };
}

export async function listCctv(hotelId: string) {
  return prisma.cameraFeed.findMany({
    where: { hotelId },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    take: 250,
  });
}

export async function listAccessLogs(hotelId: string) {
  return prisma.doorAccessEvent.findMany({
    where: { hotelId },
    orderBy: { occurredAt: 'desc' },
    take: 250,
  });
}

export async function listVisitors(hotelId: string) {
  return prisma.visitor.findMany({
    where: { hotelId },
    orderBy: [{ status: 'asc' }, { checkInAt: 'desc' }],
    take: 250,
  });
}

export async function createVisitor(
  hotelId: string,
  data: Pick<Prisma.VisitorCreateInput, 'fullName' | 'company' | 'phone' | 'email' | 'purpose' | 'hostName' | 'notes'> & {
    status?: VisitorStatus;
  }
) {
  return prisma.visitor.create({
    data: {
      hotel: { connect: { id: hotelId } },
      fullName: data.fullName,
      company: data.company,
      phone: data.phone,
      email: data.email,
      purpose: data.purpose,
      hostName: data.hostName,
      notes: data.notes,
      status: data.status || VisitorStatus.CHECKED_IN,
      checkOutAt: data.status === VisitorStatus.CHECKED_OUT || data.status === VisitorStatus.DENIED ? new Date() : undefined,
    },
  });
}

export async function checkoutVisitor(hotelId: string, visitorId: string) {
  const visitor = await prisma.visitor.findFirst({
    where: { id: visitorId, hotelId },
    select: { id: true },
  });
  if (!visitor) throw new Error('Visitor not found');

  return prisma.visitor.update({
    where: { id: visitor.id },
    data: {
      status: VisitorStatus.CHECKED_OUT,
      checkOutAt: new Date(),
    },
  });
}

export async function listAlerts(hotelId: string) {
  return prisma.securityAlert.findMany({
    where: { hotelId },
    orderBy: [{ status: 'asc' }, { occurredAt: 'desc' }],
    take: 250,
  });
}

export function listSmartBuildingSecurityTasks(hotelId: string) {
  return listSmartBuildingWorkflowTasks(hotelId, 'security');
}

export { acknowledgeSecurityAlert, resolveSecurityAlert };
