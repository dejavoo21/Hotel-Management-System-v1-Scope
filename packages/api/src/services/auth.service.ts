import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { sendEmail } from './email.service.js';
import { sendSms } from './sms.service.js';
import { renderLafloEmail, renderOtpEmail } from '../utils/emailTemplates.js';
import { TokenPayload, RefreshTokenPayload } from '../types/index.js';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';

interface LoginResult {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    hotelId: string;
    hotel: {
      id: string;
      name: string;
    };
  };
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  requiresTwoFactor?: boolean;
  requiresPasswordChange?: boolean;
  requiresOtpRevalidation?: boolean;
  trustedDeviceToken?: string;
}

const REVALIDATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const TRUSTED_DEVICE_EXPIRES_IN = '30d';

/**
 * Login user with email and password
 */
export async function login(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string,
  twoFactorCode?: string,
  trustedDeviceToken?: string
): Promise<LoginResult> {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      hotel: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    logger.warn(`Login attempt with unknown email: ${email}`);
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    logger.warn(`Login attempt for inactive user: ${email}`);
    throw new UnauthorizedError('Account is disabled');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    logger.warn(`Invalid password attempt for user: ${email}`);
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.mustChangePassword) {
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      hotelId: user.hotelId,
    });

    const refreshToken = await generateRefreshToken(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await prisma.activityLog.createMany({
      data: [
        {
          userId: user.id,
          action: 'TEMP_PASSWORD_LOGIN',
          entity: 'user',
          entityId: user.id,
          details: { ipAddress, userAgent },
          ipAddress,
          userAgent,
        },
        {
          userId: user.id,
          action: 'PASSWORD_CHANGE_REQUIRED',
          entity: 'user',
          entityId: user.id,
          details: { reason: 'mustChangePassword', ipAddress, userAgent },
          ipAddress,
          userAgent,
        },
      ],
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hotelId: user.hotelId,
        hotel: user.hotel,
      },
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
      requiresPasswordChange: true,
    };
  }

  if (user.twoFactorEnabled) {
    if (!twoFactorCode) {
      return { requiresTwoFactor: true };
    }

    if (!user.twoFactorSecret) {
      throw new UnauthorizedError('2FA is not configured');
    }

    const isValidCode = authenticator.verify({
      token: twoFactorCode,
      secret: user.twoFactorSecret,
    });

    if (!isValidCode) {
      throw new UnauthorizedError('Invalid 2FA code');
    }
  }

  const trustedForUser = trustedDeviceToken
    ? verifyTrustedDeviceToken(trustedDeviceToken, user.id)
    : false;
  const needsRevalidation =
    !trustedForUser && (await isOtpRevalidationRequired(user.id, user.lastLoginAt));
  if (needsRevalidation) {
    return { requiresOtpRevalidation: true };
  }

  // Generate tokens
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    hotelId: user.hotelId,
  });

  const refreshToken = await generateRefreshToken(user.id);

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      entity: 'user',
      entityId: user.id,
      details: { ipAddress, userAgent },
      ipAddress,
      userAgent,
    },
  });

  logger.info(`User logged in: ${email}`);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      hotelId: user.hotelId,
      hotel: user.hotel,
    },
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn,
  };
}

/**
 * Logout user by invalidating refresh token
 */
export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { token: refreshToken },
  });
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}> {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as RefreshTokenPayload;

    // Check if refresh token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            hotelId: true,
            isActive: true,
          },
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new UnauthorizedError('Refresh token expired');
    }

    if (!storedToken.user.isActive) {
      throw new UnauthorizedError('Account is disabled');
    }

    // Delete old refresh token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Generate new tokens
    const accessToken = generateAccessToken({
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
      hotelId: storedToken.user.hotelId,
    });

    const newRefreshToken = await generateRefreshToken(storedToken.user.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: config.jwt.expiresIn,
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    throw error;
  }
}

export async function setup2FA(userId: string, email: string) {
  const secret = authenticator.generateSecret();
  const issuer = 'LaFlo HotelOS';
  const otpauth = authenticator.keyuri(email, issuer, secret);
  const qrCode = await qrcode.toDataURL(otpauth);

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: secret,
      twoFactorEnabled: false,
    },
  });

  return { secret, qrCode };
}

export async function verify2FA(userId: string, code: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true },
  });

  if (!user?.twoFactorSecret) {
    throw new UnauthorizedError('2FA is not configured');
  }

  const isValidCode = authenticator.verify({
    token: code,
    secret: user.twoFactorSecret,
  });

  if (!isValidCode) {
    throw new UnauthorizedError('Invalid 2FA code');
  }

  const backupCodes = await generateBackupCodes(userId);
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true },
  });

  return { backupCodes };
}

export async function disable2FA(userId: string, code: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!user?.twoFactorSecret || !user.twoFactorEnabled) {
    throw new UnauthorizedError('2FA is not enabled');
  }

  const isValidCode = authenticator.verify({
    token: code,
    secret: user.twoFactorSecret,
  });

  if (!isValidCode) {
    throw new UnauthorizedError('Invalid 2FA code');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
  });
}

export async function generateBackupCodes(userId: string) {
  const codes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  const hashed = await Promise.all(
    codes.map(async (code) => bcrypt.hash(code, 10))
  );

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorBackupCodes: hashed },
  });

  return codes;
}

export async function loginWithBackupCode(
  email: string,
  backupCode: string,
  ipAddress?: string,
  userAgent?: string
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      hotel: { select: { id: true, name: true } },
    },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid email or backup code');
  }

  const matchIndex = await findMatchingBackupCode(user.twoFactorBackupCodes, backupCode);
  if (matchIndex < 0) {
    throw new UnauthorizedError('Invalid email or backup code');
  }

  const remaining = user.twoFactorBackupCodes.filter((_, index) => index !== matchIndex);
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorBackupCodes: remaining, lastLoginAt: new Date() },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN_BACKUP_CODE',
      entity: 'user',
      entityId: user.id,
      details: { ipAddress, userAgent },
      ipAddress,
      userAgent,
    },
  });

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    hotelId: user.hotelId,
  });
  const refreshToken = await generateRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      hotelId: user.hotelId,
      hotel: user.hotel,
    },
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn,
  };
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, firstName: true, email: true },
  });

  if (!user) {
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetUrl = `${config.appUrl}/reset-password?token=${token}`;
  const { html, text } = renderLafloEmail({
    preheader: 'Use this link to reset your password (expires in 60 minutes).',
    title: 'Reset your password',
    greeting: `Hello ${user.firstName},`,
    intro: 'Use the button below to reset your password. This link expires in 60 minutes.',
    cta: { label: 'Reset password', url: resetUrl },
    footerNote: 'If you did not request a password reset, you can ignore this email.',
  });
  await sendEmail({
    to: user.email,
    subject: 'Reset your LaFlo password',
    html,
    text,
  });
}

export async function requestPasswordResetOtp(token: string) {
  const tokenHash = hashToken(token);
  const stored = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gte: new Date() },
    },
    include: { user: true },
  });

  if (!stored) {
    throw new ForbiddenError('Reset link is invalid or expired');
  }

  await requestEmailOtp(stored.user.email, 'PASSWORD_RESET', 'EMAIL');
}

export async function getPasswordResetContext(token: string) {
  const tokenHash = hashToken(token);
  const stored = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gte: new Date() },
    },
    include: { user: { select: { email: true } } },
  });

  if (!stored) {
    throw new ForbiddenError('Reset link is invalid or expired');
  }

  return { email: stored.user.email };
}

export async function resetPassword(token: string, newPassword: string, otpCode: string) {
  const tokenHash = hashToken(token);

  const stored = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gte: new Date() },
    },
    include: { user: true },
  });

  if (!stored) {
    throw new ForbiddenError('Reset link is invalid or expired');
  }

  const otp = await prisma.emailOtp.findFirst({
    where: {
      email: stored.user.email.toLowerCase(),
      purpose: 'PASSWORD_RESET',
      usedAt: null,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    throw new ForbiddenError('Verification code is invalid or expired');
  }

  const isValidOtp = await bcrypt.compare(otpCode, otp.codeHash);
  if (!isValidOtp) {
    throw new ForbiddenError('Verification code is invalid or expired');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: stored.userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    }),
    prisma.emailOtp.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: stored.userId } }),
  ]);

  logger.info(`Password reset for user: ${stored.user.email}`);
}

export async function loginWithEmailOtp(
  email: string,
  code: string,
  purpose: string,
  rememberDevice: boolean = false
) {
  const otp = await prisma.emailOtp.findFirst({
    where: {
      email: email.toLowerCase(),
      purpose,
      usedAt: null,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  });

  if (!otp || !otp.user) {
    throw new UnauthorizedError('Invalid verification code');
  }

  const isValid = await bcrypt.compare(code, otp.codeHash);
  if (!isValid) {
    throw new UnauthorizedError('Invalid verification code');
  }

  await prisma.emailOtp.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  });

  if (!otp.user.isActive) {
    throw new UnauthorizedError('Account is disabled');
  }

  const accessToken = generateAccessToken({
    userId: otp.user.id,
    email: otp.user.email,
    role: otp.user.role,
    hotelId: otp.user.hotelId,
  });

  const refreshToken = await generateRefreshToken(otp.user.id);

  await prisma.user.update({
    where: { id: otp.user.id },
    data: { lastLoginAt: new Date() },
  });

  if (purpose === 'ACCESS_REVALIDATION') {
    await prisma.activityLog.create({
      data: {
        userId: otp.user.id,
        action: 'ACCESS_REVALIDATED',
        entity: 'user',
        entityId: otp.user.id,
      },
    });
  }

  const trustedDeviceToken =
    purpose === 'ACCESS_REVALIDATION' && rememberDevice
      ? generateTrustedDeviceToken(otp.user.id, otp.user.email)
      : undefined;

  return {
    user: {
      id: otp.user.id,
      email: otp.user.email,
      firstName: otp.user.firstName,
      lastName: otp.user.lastName,
      role: otp.user.role,
      hotelId: otp.user.hotelId,
      hotel: otp.user.hotel as any,
    },
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn,
    trustedDeviceToken,
  };
}

export async function requestEmailOtp(
  email: string,
  purpose: string,
  channel: 'EMAIL' | 'SMS' = 'EMAIL',
  phone?: string
) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, firstName: true, email: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid email');
  }

  const code = `${Math.floor(100000 + Math.random() * 900000)}`;
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.emailOtp.create({
    data: {
      userId: user.id,
      email: user.email,
      purpose,
      codeHash,
      expiresAt,
    },
  });

  if (channel === 'SMS') {
    if (!phone) {
      throw new ForbiddenError('Phone number is required for SMS OTP');
    }
    const smsText =
      purpose === 'ACCESS_REVALIDATION'
        ? `Your LaFlo access revalidation code is ${code}. It expires in 10 minutes.`
        : purpose === 'PASSWORD_RESET'
          ? `Your LaFlo password reset verification code is ${code}. It expires in 10 minutes.`
          : `Your LaFlo verification code is ${code}. It expires in 10 minutes.`;
    await sendSms({
      to: phone,
      message: smsText,
    });
  }

  const { html, text } = renderOtpEmail({ firstName: user.firstName, code });
  await sendEmail({
    to: user.email,
    subject:
      purpose === 'ACCESS_REVALIDATION'
        ? 'Your LaFlo access revalidation code'
        : purpose === 'PASSWORD_RESET'
          ? 'Your LaFlo password reset verification code'
          : 'Your LaFlo verification code',
    html,
    text,
  });
}

async function isOtpRevalidationRequired(userId: string, lastLoginAt?: Date | null) {
  const lastRevalidation = await prisma.activityLog.findFirst({
    where: { userId, action: 'ACCESS_REVALIDATED' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  const referenceDate = lastRevalidation?.createdAt || lastLoginAt;
  if (!referenceDate) return true;

  return Date.now() - referenceDate.getTime() >= REVALIDATION_WINDOW_MS;
}

function generateTrustedDeviceToken(userId: string, email: string) {
  return jwt.sign(
    {
      userId,
      email,
      scope: 'TRUSTED_DEVICE',
    },
    config.jwt.refreshSecret,
    { expiresIn: TRUSTED_DEVICE_EXPIRES_IN }
  );
}

function verifyTrustedDeviceToken(token: string, userId: string) {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret) as {
      userId?: string;
      scope?: string;
    };
    return decoded.userId === userId && decoded.scope === 'TRUSTED_DEVICE';
  } catch {
    return false;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      hotelId: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
      modulePermissions: true,
      presenceStatus: true,
      lastSeenAt: true,
      hotel: {
        select: {
          id: true,
          name: true,
          address: true,
          addressLine1: true,
          city: true,
          country: true,
          phone: true,
          email: true,
          website: true,
          currency: true,
          timezone: true,
          latitude: true,
          longitude: true,
          locationUpdatedAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  // Return user with EXPLICIT modulePermissions only - no role defaults
  // Admin controls what each user can access via the user management page
  // ADMIN role users are super admins and get all access via frontend check
  return {
    ...user,
    modulePermissions: user.modulePermissions || [],
  };
}

/**
 * Change user password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, email: true },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValidPassword) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash, mustChangePassword: false },
  });

  // Invalidate all refresh tokens for security
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId,
      action: 'PASSWORD_CHANGED',
      entity: 'user',
      entityId: userId,
    },
  });

  logger.info(`Password changed for user: ${user.email}`);
}

/**
 * Generate access token
 */
function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Generate and store refresh token
 */
async function generateRefreshToken(userId: string): Promise<string> {
  const tokenId = uuidv4();

  // Calculate expiry
  const expiresIn = config.jwt.refreshExpiresIn;
  const expiresInMs = parseExpiry(expiresIn);
  const expiresAt = new Date(Date.now() + expiresInMs);

  const token = jwt.sign(
    { userId, tokenId } as RefreshTokenPayload,
    config.jwt.refreshSecret,
    { expiresIn }
  );

  // Store in database
  await prisma.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  // Clean up old tokens (keep last 5)
  const tokens = await prisma.refreshToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: 5,
  });

  if (tokens.length > 0) {
    await prisma.refreshToken.deleteMany({
      where: {
        id: { in: tokens.map((t) => t.id) },
      },
    });
  }

  return token;
}

/**
 * Parse expiry string to milliseconds
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000; // Default to 7 days
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

async function findMatchingBackupCode(hashedCodes: string[], code: string) {
  for (let index = 0; index < hashedCodes.length; index += 1) {
    const matches = await bcrypt.compare(code, hashedCodes[index]);
    if (matches) {
      return index;
    }
  }
  return -1;
}

export async function createPasswordResetToken(userId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return token;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Hash password for user creation
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
