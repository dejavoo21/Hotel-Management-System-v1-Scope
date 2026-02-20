import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  twoFactorCode: z.string().length(6).optional(), // Optional 2FA code
  trustedDeviceToken: z.string().min(1).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
});

const verify2FASchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

const verifyBackupCodeSchema = z.object({
  backupCode: z.string().min(1, 'Backup code is required'),
});

const requestResetSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  otpCode: z.string().length(6, 'Verification code must be 6 digits'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
});

const requestResetOtpSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
});

const requestOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
  purpose: z.enum(['LOGIN', 'ACCESS_REVALIDATION', 'PASSWORD_RESET']).optional(),
  channel: z.enum(['EMAIL', 'SMS']).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9()\-\s]{7,20}$/, 'Invalid phone number')
    .optional(),
});

const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'Code must be 6 digits'),
  purpose: z.enum(['LOGIN', 'ACCESS_REVALIDATION', 'PASSWORD_RESET']).optional(),
  rememberDevice: z.boolean().optional(),
});

// Routes
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', validate(refreshSchema), authController.refreshToken);
router.get('/me', authenticate, authController.getCurrentUser);
router.patch('/password', authenticate, validate(changePasswordSchema), authController.changePassword);

// Password reset
router.post('/password/request', validate(requestResetSchema), authController.requestPasswordReset);
router.post('/password/otp', validate(requestResetOtpSchema), authController.requestPasswordResetOtp);
router.post('/password/reset', validate(resetPasswordSchema), authController.resetPassword);

// 2FA Routes
router.post('/2fa/setup', authenticate, authController.setup2FA);
router.post('/2fa/verify', authenticate, validate(verify2FASchema), authController.verify2FA);
router.post('/2fa/disable', authenticate, validate(verify2FASchema), authController.disable2FA);
router.post('/2fa/backup-codes', authenticate, authController.generateBackupCodes);
router.post('/2fa/verify-backup', validate(verifyBackupCodeSchema), authController.verifyBackupCode);

// Email OTP login
router.post('/otp/request', validate(requestOtpSchema), authController.requestEmailOtp);
router.post('/otp/verify', validate(verifyOtpSchema), authController.verifyEmailOtp);

export default router;
