import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { sendEmail } from '../services/email.service.js';
import { config } from '../config/index.js';
import { Role } from '@prisma/client';
import { createPasswordResetToken, hashPassword } from '../services/auth.service.js';
import { scanAttachment } from '../services/virusScan.service.js';

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

  if (action === 'APPROVED') {
    subject = `Your LaFlo access is approved [AR-${requestId}]`;
    intro = 'Your access request has been approved.';
  } else if (action === 'REJECTED') {
    subject = `Your LaFlo access request was rejected [AR-${requestId}]`;
    intro = 'Your access request was not approved.';
  } else if (action === 'NEEDS_INFO') {
    subject = `Additional information needed for your access request [AR-${requestId}]`;
    intro = 'We need a bit more information to complete your access request.';
  }

  await sendEmail({
    to: email,
    subject,
    html: `
      <p>Hello ${fullName},</p>
      <p>${intro}</p>
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
      <p><strong>Reference:</strong> AR-${requestId}</p>
      <p>
        <a href="${loginUrl}">Go to login</a>
      </p>
    `,
    text: `${intro}${notes ? ` Notes: ${notes}` : ''} Reference: AR-${requestId}. Login: ${loginUrl}`,
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

    await sendEmail({
      to: notifyRecipients.join(','),
      subject: 'New access request',
      html: `
        <p>New access request received:</p>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company || '-'}</p>
        <p><strong>Role:</strong> ${role || '-'}</p>
        <p><strong>Message:</strong> ${message || '-'}</p>
      `,
      text: `New access request from ${fullName} (${email})`,
    });

    await sendEmail({
      to: email,
      subject: `We received your access request [AR-${request.id}]`,
      html: `
        <p>Hello ${fullName},</p>
        <p>Thanks for requesting access to LaFlo. Our team will review your request and reach out with access details.</p>
        <p><strong>Company:</strong> ${company || '-'}</p>
        <p><strong>Role:</strong> ${role || '-'}</p>
        <p><strong>Reference:</strong> AR-${request.id}</p>
        <p>If you already have an account, you can sign in using your work email.</p>
        <p>
          <a href="${config.appUrl}/login">Go to login</a>
        </p>
      `,
      text: `Hello ${fullName}, we received your access request. Reference: AR-${request.id}. Login: ${config.appUrl}/login`,
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

    await sendEmail({
      to: request.email,
      subject: `Your LaFlo access is approved [AR-${request.id}]`,
      html: `
        <p>Hello ${firstName},</p>
        <p>Your access request has been approved. Set your password using the link below:</p>
        <p><a href="${inviteUrl}">Set your password</a></p>
        <p><strong>Reference:</strong> AR-${request.id}</p>
        <p>After setting your password, you can sign in at <a href="${config.appUrl}/login">${config.appUrl}/login</a>.</p>
      `,
      text: `Set your password: ${inviteUrl} Reference: AR-${request.id}`,
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
