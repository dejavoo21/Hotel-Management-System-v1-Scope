import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { sendEmail } from '../services/email.service.js';
import { sendSms } from '../services/sms.service.js';
import { renderLafloEmail, escapeEmailText } from '../utils/emailTemplates.js';

async function notifySupportOnHandoff(params: {
  hotelName: string;
  requesterName: string;
  requesterEmail: string;
  title: string;
  details?: string | null;
  priority: string;
  requestId: string;
}) {
  const emails =
    config.supportNotifyEmails.length > 0
      ? config.supportNotifyEmails
      : config.accessRequestNotifyEmails;
  const phones = config.supportNotifyPhones;

  if (emails.length === 0 && phones.length === 0) {
    return;
  }

  const conciergeUrl = `${config.appUrl}/concierge`;
  const summary = (params.details || '').slice(0, 500);

  if (emails.length > 0) {
    const { html, text } = renderLafloEmail({
      preheader: 'New chatbot handoff requires human support follow-up.',
      title: 'New chatbot handoff request',
      intro: 'A user escalated a chatbot conversation to human support.',
      meta: [
        { label: 'Hotel', value: params.hotelName },
        { label: 'Requester', value: `${params.requesterName} (${params.requesterEmail})` },
        { label: 'Priority', value: params.priority },
        { label: 'Request ID', value: params.requestId },
        { label: 'Title', value: params.title },
      ],
      bodyHtml: summary
        ? `<p style="margin:0;"><strong>Issue summary:</strong></p><p style="margin:6px 0 0;">${escapeEmailText(summary)}</p>`
        : undefined,
      cta: { label: 'Open Concierge', url: conciergeUrl },
      footerNote: 'This alert was generated from chatbot-to-human escalation.',
    });

    await sendEmail({
      to: emails.join(','),
      subject: `[LaFlo] Chatbot handoff: ${params.title}`,
      html,
      text,
    });
  }

  if (phones.length > 0) {
    const smsMessage = `LaFlo support alert: ${params.title} (${params.priority}). Open ${conciergeUrl}`;
    await Promise.all(phones.map((to) => sendSms({ to, message: smsMessage })));
  }
}

export async function listConciergeRequests(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { status } = req.query;

    const requests = await prisma.conciergeRequest.findMany({
      where: {
        hotelId,
        ...(status ? { status: String(status) } : {}),
      },
      include: {
        guest: { select: { firstName: true, lastName: true } },
        room: { select: { number: true } },
        booking: { select: { bookingRef: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
}

export async function createConciergeRequest(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const request = await prisma.conciergeRequest.create({
      data: {
        hotelId,
        guestId: req.body.guestId || null,
        roomId: req.body.roomId || null,
        bookingId: req.body.bookingId || null,
        assignedToId: req.body.assignedToId || null,
        title: req.body.title,
        details: req.body.details || null,
        status: req.body.status ?? 'PENDING',
        priority: req.body.priority ?? 'MEDIUM',
        dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
      },
    });

    const shouldNotifySupport =
      req.body.notifySupport === true ||
      String(req.body.source || '').toUpperCase() === 'CHATBOT' ||
      request.title.toLowerCase().includes('chatbot handoff');

    if (shouldNotifySupport) {
      try {
        const hotel = await prisma.hotel.findUnique({
          where: { id: hotelId },
          select: { name: true },
        });

        const requesterName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || 'Unknown user';

        await notifySupportOnHandoff({
          hotelName: hotel?.name || 'Unknown hotel',
          requesterName,
          requesterEmail: req.user?.email || '-',
          title: request.title,
          details: request.details,
          priority: request.priority,
          requestId: request.id,
        });
      } catch (notifyError) {
        logger.error('Failed to send concierge handoff notifications', { error: notifyError });
      }
    }

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
}

export async function updateConciergeRequest(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const existing = await prisma.conciergeRequest.findFirst({ where: { id, hotelId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Concierge request not found' });
      return;
    }

    const updated = await prisma.conciergeRequest.update({
      where: { id },
      data: {
        title: req.body.title ?? existing.title,
        details: req.body.details ?? existing.details,
        status: req.body.status ?? existing.status,
        priority: req.body.priority ?? existing.priority,
        assignedToId: req.body.assignedToId ?? existing.assignedToId,
        dueAt: req.body.dueAt ? new Date(req.body.dueAt) : existing.dueAt,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}
