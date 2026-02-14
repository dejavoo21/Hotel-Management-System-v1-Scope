import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { prisma } from '../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../middleware/errorHandler.js';
import { createPasswordResetToken, hashPassword } from '../services/auth.service.js';
import { sendEmail } from '../services/email.service.js';
import { config } from '../config/index.js';
import { renderLafloEmail } from '../utils/emailTemplates.js';

export async function getAllUsers(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;

    const users = await prisma.user.findMany({
      where: { hotelId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { lastName: 'asc' },
    });

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}

export async function getUserById(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, hotelId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundError('User');
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function createUser(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { email, password, firstName, lastName, role, sendInvite } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictError('Email already in use');

    const rawPassword = password || cryptoRandomPassword();
    const passwordHash = await hashPassword(rawPassword);

    const user = await prisma.user.create({
      data: {
        hotelId,
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        role,
        mustChangePassword: sendInvite ? true : false,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (sendInvite) {
      const token = await createPasswordResetToken(user.id);
      const inviteUrl = `${config.appUrl}/reset-password?token=${token}`;
      const { html, text } = renderLafloEmail({
        preheader: 'Your LaFlo account is ready. Set your password to get started.',
        title: 'You are invited to LaFlo',
        greeting: `Hello ${user.firstName},`,
        intro: 'Your LaFlo account is ready. Set your password using the button below.',
        cta: { label: 'Set your password', url: inviteUrl },
        footerNote: 'This link is personal to you. Do not share it.',
      });
      await sendEmail({
        to: user.email,
        subject: 'You are invited to LaFlo',
        html,
        text,
      });
    }

    res.status(201).json({ success: true, data: user, message: 'User created' });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const currentUserId = req.user!.id;
    const { id } = req.params;

    const user = await prisma.user.findFirst({ where: { id, hotelId } });
    if (!user) throw new NotFoundError('User');

    // Prevent self-deactivation
    if (id === currentUserId && req.body.isActive === false) {
      throw new ForbiddenError('Cannot deactivate your own account');
    }

    // Check email uniqueness if changing
    if (req.body.email && req.body.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
      if (existing) throw new ConflictError('Email already in use');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: req.body,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json({ success: true, data: updated, message: 'User updated' });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const currentUserId = req.user!.id;
    const { id } = req.params;

    if (id === currentUserId) {
      throw new ForbiddenError('Cannot delete your own account');
    }

    const user = await prisma.user.findFirst({ where: { id, hotelId } });
    if (!user) throw new NotFoundError('User');

      const { reason } = req.body as { reason?: string };

      if (user.isActive) {
        await prisma.user.update({
          where: { id },
          data: { isActive: false },
        });
        if (reason) {
          await prisma.activityLog.create({
            data: {
              userId: currentUserId,
              action: 'user.deactivated',
              entity: 'user',
              entityId: id,
              details: { reason },
            },
          });
        }
        res.json({ success: true, message: 'User deactivated' });
        return;
      }

      await prisma.$transaction([
        ...(reason
          ? [
              prisma.activityLog.create({
                data: {
                  userId: currentUserId,
                  action: 'user.deleted',
                  entity: 'user',
                  entityId: id,
                  details: { reason },
                },
              }),
            ]
          : []),
        prisma.activityLog.deleteMany({ where: { userId: id } }),
        prisma.housekeepingLog.deleteMany({ where: { userId: id } }),
        prisma.refreshToken.deleteMany({ where: { userId: id } }),
        prisma.passwordResetToken.deleteMany({ where: { userId: id } }),
        prisma.emailOtp.deleteMany({ where: { userId: id } }),
        prisma.user.delete({ where: { id } }),
      ]);

      res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
}

export async function resetUserPassword(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const hotelId = req.user!.hotelId;
    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await prisma.user.findFirst({ where: { id, hotelId } });
    if (!user) throw new NotFoundError('User');

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId: id } });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
}

function cryptoRandomPassword() {
  return `Temp${Math.random().toString(36).slice(2, 10)}A1`;
}
