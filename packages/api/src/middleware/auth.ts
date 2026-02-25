import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest, TokenPayload, ApiResponse } from '../types/index.js';
import { logger } from '../config/logger.js';

// Module permission IDs that can be assigned to users
export type ModulePermission =
  | 'dashboard'
  | 'bookings'
  | 'rooms'
  | 'messages'
  | 'housekeeping'
  | 'inventory'
  | 'calendar'
  | 'guests'
  | 'financials'
  | 'reviews'
  | 'concierge'
  | 'users'
  | 'settings';

// Note: No default permissions by role - permissions must be explicitly granted by admin
// ADMIN role users are treated as super admins in the frontend

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
          modulePermissions: true,
        },
      });

      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: 'User not found or inactive',
        });
        return;
      }

      // Use EXPLICIT permissions only - no role defaults
      // Admin controls access via user management page, ADMIN role = super admin (checked in frontend)
      const effectivePermissions = (user.modulePermissions || []) as ModulePermission[];

      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hotelId: user.hotelId,
        mustChangePassword: user.mustChangePassword,
        modulePermissions: effectivePermissions,
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
 * Middleware to require access to specific module(s)
 * Checks user's modulePermissions array
 */
export function requireModuleAccess(...modules: ModulePermission[]) {
  return (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const userPermissions = req.user.modulePermissions || [];
    
    // Check if user has access to at least one of the required modules
    const hasAccess = modules.some(module => userPermissions.includes(module));
    
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: `Access denied. Required module access: ${modules.join(' or ')}`,
      });
      return;
    }

    next();
  };
}

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
        modulePermissions: true,
      },
    });

    if (user && user.isActive) {
      // Use EXPLICIT permissions only - no role defaults
      const effectivePermissions = (user.modulePermissions || []) as ModulePermission[];
        
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hotelId: user.hotelId,
        mustChangePassword: user.mustChangePassword,
        modulePermissions: effectivePermissions,
      };
    }
  } catch {
    // Ignore token errors for optional auth
  }

  next();
}
