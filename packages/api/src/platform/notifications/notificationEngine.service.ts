import type { NotificationType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { sendEmail } from '../../services/email.service.js';
import { sendSms } from '../../services/sms.service.js';
import * as notificationService from '../../services/notification.service.js';
import { eventBus } from '../event-bus/eventBus.service.js';

export type NotificationChannel = 'DASHBOARD' | 'EMAIL' | 'SMS' | 'PUSH' | 'TEAMS';

export type NotifyUserInput = {
  hotelId: string;
  userId: string;
  channels: NotificationChannel[];
  type?: NotificationType;
  title: string;
  body: string;
  email?: {
    to: string;
    subject?: string;
    html?: string;
  };
  sms?: {
    to: string;
    message?: string;
  };
  ticketId?: string;
  conversationId?: string;
  source?: string;
  correlationId?: string;
  idempotencyKey?: string;
};

export type NotifyRoleInput = Omit<NotifyUserInput, 'userId' | 'email' | 'sms'> & {
  roles: string[];
};

function splitRoleTargets(targets: string[]) {
  const roles: string[] = [];
  const modulePermissions: string[] = [];

  for (const target of targets) {
    if (target.startsWith('MODULE:')) {
      const permission = target.slice('MODULE:'.length).trim();
      if (permission) modulePermissions.push(permission);
    } else {
      roles.push(target);
    }
  }

  return { roles, modulePermissions };
}

export async function notifyUser(input: NotifyUserInput) {
  const deliveries: Array<{ channel: NotificationChannel; status: 'SENT' | 'SKIPPED' | 'FAILED'; detail?: string }> = [];

  for (const channel of input.channels) {
    try {
      if (channel === 'DASHBOARD') {
        await notificationService.createNotification({
          userId: input.userId,
          hotelId: input.hotelId,
          type: input.type || 'SYSTEM',
          title: input.title,
          body: input.body,
          ticketId: input.ticketId,
          conversationId: input.conversationId,
        });
        deliveries.push({ channel, status: 'SENT' });
        continue;
      }

      if (channel === 'EMAIL') {
        if (!input.email?.to) {
          deliveries.push({ channel, status: 'SKIPPED', detail: 'missing_email_recipient' });
          continue;
        }
        await sendEmail({
          to: input.email.to,
          subject: input.email.subject || input.title,
          html: input.email.html || `<p>${input.body}</p>`,
          text: input.body,
        });
        deliveries.push({ channel, status: 'SENT' });
        continue;
      }

      if (channel === 'SMS') {
        if (!input.sms?.to) {
          deliveries.push({ channel, status: 'SKIPPED', detail: 'missing_sms_recipient' });
          continue;
        }
        await sendSms({ to: input.sms.to, message: input.sms.message || input.body });
        deliveries.push({ channel, status: 'SENT' });
        continue;
      }

      deliveries.push({ channel, status: 'SKIPPED', detail: 'channel_not_configured_yet' });
    } catch (error) {
      logger.error('Notification delivery failed', {
        channel,
        hotelId: input.hotelId,
        userId: input.userId,
        error,
      });
      deliveries.push({
        channel,
        status: 'FAILED',
        detail: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  }

  await eventBus.publish({
    eventType: 'notification.dispatched',
    hotelId: input.hotelId,
    source: input.source || 'notification-engine',
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    userId: input.userId,
    payload: {
      userId: input.userId,
      title: input.title,
      channels: input.channels,
      deliveries,
    },
  });

  return deliveries;
}

export async function notifyRoles(input: NotifyRoleInput) {
  const { roles, modulePermissions } = splitRoleTargets(input.roles);
  const users = await prisma.user.findMany({
    where: {
      hotelId: input.hotelId,
      isActive: true,
      OR: [
        ...(roles.length > 0 ? [{ role: { in: roles as any } }] : []),
        ...(modulePermissions.length > 0 ? [{ modulePermissions: { hasSome: modulePermissions } }] : []),
      ],
    },
    select: { id: true },
  });

  const results: Array<Awaited<ReturnType<typeof notifyUser>>> = [];
  const uniqueUsers = Array.from(new Map(users.map((user) => [user.id, user])).values());
  for (const user of uniqueUsers) {
    results.push(
      await notifyUser({
        ...input,
        userId: user.id,
      })
    );
  }

  return { usersNotified: uniqueUsers.length, results };
}
