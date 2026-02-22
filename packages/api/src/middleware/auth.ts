import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest, TokenPayload, ApiResponse } from '../types/index.js';
import { logger } from '../config/logger.js';

function isPasswordChangeAllowedRoute(req: AuthenticatedRequest): boolean {
  const base = req.baseUrl || '';
  const path = req.path || '';
  if (!base.endsWith('/auth')) return false;
  return path === '/password' || path === '/logout' || path === '/me';
}

/**
 * Middleware to verify JWT token and attach user to request
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;

      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          hotelId: true,
          isActive: true,
          mustChangePassword: true,
        },
      });

      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: 'User not found or inactive',
        });
        return;
      }

      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hotelId: user.hotelId,
        mustChangePassword: user.mustChangePassword,
      };

      if (user.mustChangePassword && !isPasswordChangeAllowedRoute(req)) {
        res.status(403).json({
          success: false,
          error: 'Password change required',
        });
        return;
      }

      next();
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          error: 'Token expired',
        });
        return;
      }

      if (jwtError instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          error: 'Invalid token',
        });
        return;
      }

      throw jwtError;
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Middleware to require specific roles
 */
export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole(Role.ADMIN);

/**
 * Middleware to require manager or admin role
 */
export const requireManager = requireRole(Role.ADMIN, Role.MANAGER);

/**
 * Middleware to require at least receptionist role
 */
export const requireReceptionist = requireRole(Role.ADMIN, Role.MANAGER, Role.RECEPTIONIST);

/**
 * Optional authentication - attaches user if token present, continues otherwise
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        hotelId: true,
        isActive: true,
        mustChangePassword: true,
      },
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hotelId: user.hotelId,
        mustChangePassword: user.mustChangePassword,
      };
    }
  } catch {
    // Ignore token errors for optional auth
  }

  next();
}
