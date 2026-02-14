import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { sendEmail } from '../services/email.service.js';
import { config } from '../config/index.js';
import { Role } from '@prisma/client';
import { createPasswordResetToken, hashPassword } from '../services/auth.service.js';
import { scanAttachment } from '../services/virusScan.service.js';
import { renderLafloEmail, escapeEmailText } from '../utils/emailTemplates.js';

type AccessRequestUpdateAction = 'APPROVED' | 'REJECTED' | 'NEEDS_INFO';

function parseName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || 'User',
    lastName: parts.slice(1).join(' ') || 'User',
  };
}

function normalizeRole(role?: string | null): Role {
  if (!role) return Role.RECEPTIONIST;
  const value = role.trim().toUpperCase().replace(/\s+/g, '_');
  if (value in Role) {
    return Role[value as keyof typeof Role];
  }
  return Role.RECEPTIONIST;
}

async function sendRequesterUpdate(
  email: string,
  fullName: string,
  action: AccessRequestUpdateAction,
  requestId: string,
  notes?: string | null
) {
  const loginUrl = `${config.appUrl}/login`;
  let subject = `Access request update [AR-${requestId}]`;
  let intro = 'Your access request has been updated.';
  let title = 'Access request update';

  if (action === 'APPROVED') {
    subject = `Your LaFlo access is approved [AR-${requestId}]`;
    intro = 'Your access request has been approved.';
    title = 'Access approved';
  } else if (action === 'REJECTED') {
    subject = `Your LaFlo access request was rejected [AR-${requestId}]`;
    intro = 'Your access request was not approved.';
    title = 'Access request rejected';
  } else if (action === 'NEEDS_INFO') {
    subject = `Additional information needed for your access request [AR-${requestId}]`;
    intro = 'We need a bit more information to complete your access request.';
    title = 'More information needed';
  }

  const { html, text } = renderLafloEmail({
    preheader: intro,
    title,
    greeting: `Hello ${fullName},`,
    intro,
    meta: [{ label: 'Reference', value: `AR-${requestId}` }],
    bodyHtml: notes
      ? `<p style="margin:0 0 10px; color:#334155;"><strong>Notes:</strong> ${escapeEmailText(
          notes
        )}</p>`
      : undefined,
    cta: { label: 'Go to login', url: loginUrl },
  });

  await sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}

export async function createAccessRequest(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { fullName, email, company, role, message } = req.body;

    const request = await prisma.accessRequest.create({
      data: {
        fullName,
        email: email.toLowerCase(),
        company,
        role,
        message,
      },
    });

    const notifyRecipients = config.accessRequestNotifyEmails.length
      ? config.accessRequestNotifyEmails
      : [config.email.fromAddress];

    const adminUrl = `${config.appUrl}/settings?tab=access-requests`;
    const adminEmail = renderLafloEmail({
      preheader: `New access request from ${fullName}.`,
      title: 'New access request',
      greeting: 'Hello,',
      intro: 'A new access request was submitted. Review and take action in the admin console.',
      meta: [
        { label: 'Name', value: fullName },
        { label: 'Email', value: email },
        { label: 'Company', value: company || '-' },
        { label: 'Role', value: role || '-' },
        { label: 'Message', value: message || '-' },
      ],
      cta: { label: 'Open access requests', url: adminUrl },
      footerNote: `Reference: AR-${request.id}`,
    });

    await sendEmail({
      to: notifyRecipients.join(','),
      subject: 'New access request',
      html: adminEmail.html,
      text: adminEmail.text,
    });

    const requesterEmail = renderLafloEmail({
      preheader: `We received your access request. Reference AR-${request.id}.`,
      title: `We received your access request`,
      greeting: `Hello ${fullName},`,
      intro:
        'Thanks for requesting access to LaFlo. Our team will review your request and reach out with access details.',
      meta: [
        { label: 'Company', value: company || '-' },
        { label: 'Role', value: role || '-' },
        { label: 'Reference', value: `AR-${request.id}` },
      ],
      cta: { label: 'Go to login', url: `${config.appUrl}/login` },
      footerNote: 'If you did not request access, you can ignore this email.',
    });

    await sendEmail({
      to: email,
      subject: `We received your access request [AR-${request.id}]`,
      html: requesterEmail.html,
      text: requesterEmail.text,
    });

    res.status(201).json({ success: true, data: request, message: 'Request submitted' });
  } catch (error) {
    next(error);
  }
}

export async function approveAccessRequest(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;
    const { role } = req.body as { role?: string };

    const request = await prisma.accessRequest.findFirst({ where: { id } });
    if (!request) {
      res.status(404).json({ success: false, error: 'Access request not found' });
      return;
    }

    const normalizedRole = normalizeRole(role || request.role);
    const { firstName, lastName } = parseName(request.fullName);

    let user = await prisma.user.findUnique({ where: { email: request.email } });
    if (!user) {
      const passwordHash = await hashPassword(`Temp${Math.random().toString(36).slice(2, 10)}A1`);
      user = await prisma.user.create({
        data: {
          hotelId,
          email: request.email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          role: normalizedRole,
          mustChangePassword: true,
        },
      });
    }

    await prisma.accessRequest.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    const token = await createPasswordResetToken(user.id);
    const inviteUrl = `${config.appUrl}/reset-password?token=${token}`;

    const inviteEmail = renderLafloEmail({
      preheader: `Your access is approved. Set your password to get started. Reference AR-${request.id}.`,
      title: 'Access approved',
      greeting: `Hello ${firstName},`,
      intro: 'Your access request has been approved. Set your password using the button below.',
      meta: [{ label: 'Reference', value: `AR-${request.id}` }],
      cta: { label: 'Set your password', url: inviteUrl },
      footerNote: 'This link is personal to you. Do not share it.',
    });

    await sendEmail({
      to: request.email,
      subject: `Your LaFlo access is approved [AR-${request.id}]`,
      html: inviteEmail.html,
      text: inviteEmail.text,
    });

    res.json({ success: true, message: 'Access approved and invite sent' });
  } catch (error) {
    next(error);
  }
}

export async function rejectAccessRequest(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { notes } = req.body as { notes?: string };

    const request = await prisma.accessRequest.findFirst({ where: { id } });
    if (!request) {
      res.status(404).json({ success: false, error: 'Access request not found' });
      return;
    }

    await prisma.accessRequest.update({
      where: { id },
      data: { status: 'REJECTED', adminNotes: notes || null },
    });

    await sendRequesterUpdate(request.email, request.fullName, 'REJECTED', request.id, notes);

    res.json({ success: true, message: 'Access request rejected' });
  } catch (error) {
    next(error);
  }
}

export async function requestAccessInfo(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { notes } = req.body as { notes?: string };

    const request = await prisma.accessRequest.findFirst({ where: { id } });
    if (!request) {
      res.status(404).json({ success: false, error: 'Access request not found' });
      return;
    }

    await prisma.accessRequest.update({
      where: { id },
      data: { status: 'NEEDS_INFO', adminNotes: notes || null },
    });

    await sendRequesterUpdate(request.email, request.fullName, 'NEEDS_INFO', request.id, notes);

    res.json({ success: true, message: 'Requested additional information' });
  } catch (error) {
    next(error);
  }
}

export async function deleteAccessRequest(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const request = await prisma.accessRequest.findFirst({ where: { id } });
    if (!request) {
      res.status(404).json({ success: false, error: 'Access request not found' });
      return;
    }

    await prisma.accessRequest.delete({ where: { id } });
    res.json({ success: true, message: 'Access request deleted' });
  } catch (error) {
    next(error);
  }
}

export async function listAccessRequests(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const requests = await prisma.accessRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
}

export async function listAccessRequestReplies(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const request = await prisma.accessRequest.findFirst({ where: { id } });
    if (!request) {
      res.status(404).json({ success: false, error: 'Access request not found' });
      return;
    }

    const replies = await prisma.accessRequestReply.findMany({
      where: { accessRequestId: id },
      orderBy: { receivedAt: 'desc' },
    });

    const sanitizedReplies = replies.map((reply) => {
      if (!reply.attachments) return reply;
      const attachments = Array.isArray(reply.attachments)
        ? reply.attachments.map((attachment) => {
            if (typeof attachment !== 'object' || attachment === null) return attachment;
            const { contentBase64, ...rest } = attachment as Record<string, unknown>;
            return {
              ...rest,
              hasContent: Boolean(contentBase64),
            };
          })
        : reply.attachments;
      return { ...reply, attachments };
    });

    res.json({ success: true, data: sanitizedReplies });
  } catch (error) {
    next(error);
  }
}

export async function downloadAccessRequestAttachment(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id, replyId, index } = req.params;
    const attachmentIndex = Number(index);

    if (Number.isNaN(attachmentIndex)) {
      res.status(400).json({ success: false, error: 'Invalid attachment index' });
      return;
    }

    const reply = await prisma.accessRequestReply.findFirst({
      where: { id: replyId, accessRequestId: id },
    });
    if (!reply || !reply.attachments || !Array.isArray(reply.attachments)) {
      res.status(404).json({ success: false, error: 'Attachment not found' });
      return;
    }

    const attachment = reply.attachments[attachmentIndex] as Record<string, unknown> | undefined;
    if (!attachment) {
      res.status(404).json({ success: false, error: 'Attachment not found' });
      return;
    }

    const filename = (attachment.filename as string) || 'attachment';
    const contentType = (attachment.contentType as string) || 'application/octet-stream';
    const contentBase64 = attachment.contentBase64 as string | null;

    if (!contentBase64) {
      res.status(404).json({ success: false, error: 'Attachment content not available' });
      return;
    }

    const buffer = Buffer.from(contentBase64, 'base64');
    const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';

    const scanResult = await scanAttachment(buffer, filename);
    if (scanResult.status === 'infected') {
      res.status(422).json({ success: false, error: 'Attachment blocked by malware scan.' });
      return;
    }
    if (scanResult.status === 'error') {
      const status = scanResult.output.includes('size limit') ? 413 : 503;
      res
        .status(status)
        .json({ success: false, error: 'Attachment scan unavailable. Please try again later.' });
      return;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}
