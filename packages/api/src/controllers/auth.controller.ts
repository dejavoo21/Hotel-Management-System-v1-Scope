import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import * as authService from '../services/auth.service.js';
import { logger } from '../config/logger.js';

/**
 * Login user and return tokens
 */
export async function login(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, twoFactorCode, trustedDeviceToken } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(
      email,
      password,
      ipAddress,
      userAgent,
      twoFactorCode,
      trustedDeviceToken
    );

    res.json({
      success: true,
      data: result,
      message: result.requiresTwoFactor ? '2FA required' : 'Login successful',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Logout user and invalidate refresh token
 */
export async function logout(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = req.body.refreshToken;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body;

    const result = await authService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    const user = await authService.getUserById(req.user.id);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change user password
 */
export async function changePassword(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(req.user.id, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Setup 2FA - generate secret and QR code
 */
export async function setup2FA(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const result = await authService.setup2FA(req.user.id, req.user.email);

    res.json({
      success: true,
      data: result,
      message: 'Scan QR code with your authenticator app',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify 2FA code and enable 2FA
 */
export async function verify2FA(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { code } = req.body;
    const result = await authService.verify2FA(req.user.id, code);

    res.json({
      success: true,
      data: result,
      message: '2FA enabled successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Disable 2FA
 */
export async function disable2FA(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { code } = req.body;
    await authService.disable2FA(req.user.id, code);

    res.json({
      success: true,
      message: '2FA disabled successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generate new backup codes
 */
export async function generateBackupCodes(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const codes = await authService.generateBackupCodes(req.user.id);

    res.json({
      success: true,
      data: { backupCodes: codes },
      message: 'Save these backup codes in a secure location',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify backup code for login
 */
export async function verifyBackupCode(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { email, backupCode } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.loginWithBackupCode(email, backupCode, ipAddress, userAgent);

    res.json({
      success: true,
      data: result,
      message: 'Login successful with backup code',
    });
  } catch (error) {
    next(error);
  }
}

export async function requestPasswordReset(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body;
    await authService.requestPasswordReset(email);
    res.json({ success: true, message: 'Password reset email sent' });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { token, newPassword, otpCode } = req.body;
    await authService.resetPassword(token, newPassword, otpCode);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function requestPasswordResetOtp(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { token } = req.body;
    await authService.requestPasswordResetOtp(token);
    res.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    next(error);
  }
}

export async function requestEmailOtp(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { email, purpose, channel, phone } = req.body as {
      email: string;
      purpose?: 'LOGIN' | 'ACCESS_REVALIDATION' | 'PASSWORD_RESET';
      channel?: 'EMAIL' | 'SMS';
      phone?: string;
    };
    await authService.requestEmailOtp(email, purpose || 'LOGIN', channel || 'EMAIL', phone);
    res.json({ success: true, message: 'OTP sent' });
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailOtp(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { email, code, purpose, rememberDevice } = req.body as {
      email: string;
      code: string;
      purpose?: 'LOGIN' | 'ACCESS_REVALIDATION' | 'PASSWORD_RESET';
      rememberDevice?: boolean;
    };
    const result = await authService.loginWithEmailOtp(
      email,
      code,
      purpose || 'LOGIN',
      Boolean(rememberDevice)
    );
    res.json({ success: true, data: result, message: 'Login successful' });
  } catch (error) {
    next(error);
  }
}
