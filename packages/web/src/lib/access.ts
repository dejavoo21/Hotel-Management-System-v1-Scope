/**
 * Central access control helpers for module permissions
 * This file provides utilities for checking user access to modules and routes
 */

import type { PermissionId, UserRole } from '@/utils/userAccess';
import { getExplicitPermissions, isSuperAdminUser } from '@/utils/userAccess';

// Module to route mapping
export const MODULE_ROUTES: Record<PermissionId, string> = {
  dashboard: '/',
  bookings: '/bookings',
  rooms: '/rooms',
  messages: '/messages',
  housekeeping: '/housekeeping',
  inventory: '/inventory',
  calendar: '/calendar',
  guests: '/guests',
  financials: '/financials',
  reviews: '/reviews',
  concierge: '/concierge',
  users: '/users',
  settings: '/settings',
};

// Route to module mapping (reverse lookup)
export const ROUTE_MODULES: Record<string, PermissionId> = Object.entries(MODULE_ROUTES).reduce(
  (acc, [module, route]) => ({ ...acc, [route]: module as PermissionId }),
  {} as Record<string, PermissionId>
);

// Priority order for determining first allowed route
const MODULE_PRIORITY: PermissionId[] = [
  'dashboard',
  'bookings',
  'rooms',
  'housekeeping',
  'messages',
  'guests',
  'calendar',
  'inventory',
  'financials',
  'reviews',
  'concierge',
  'users',
  'settings',
];

export interface AccessUser {
  id?: string;
  role?: string;
  modulePermissions?: string[];
}

/**
 * Check if a user can access a specific module
 */
export function canAccess(user: AccessUser | null, moduleKey: PermissionId): boolean {
  if (!user) return false;
  
  // Super admins (ADMIN role) can access everything
  if (isSuperAdminUser(user.id, user.role as UserRole | undefined)) {
    return true;
  }
  
  // Check explicit permissions
  const permissions = getExplicitPermissions(
    user.id, 
    user.modulePermissions as PermissionId[] | undefined
  );
  
  return permissions.includes(moduleKey);
}

/**
 * Check if user can access a specific route
 */
export function canAccessRoute(user: AccessUser | null, route: string): boolean {
  if (!user) return false;
  
  // Extract base route (first path segment)
  const basePath = '/' + (route.split('/')[1] || '');
  if (basePath === '/settings') return true;
  const module = ROUTE_MODULES[basePath];
  
  // If no module mapping exists, allow access (public route)
  if (!module) return true;
  
  return canAccess(user, module);
}

/**
 * Get the first allowed route for a user based on their permissions
 */
export function firstAllowedRoute(user: AccessUser | null): string {
  if (!user) return '/login';
  
  // Super admins go to dashboard
  if (isSuperAdminUser(user.id, user.role as UserRole | undefined)) {
    return '/';
  }
  
  const permissions = getExplicitPermissions(
    user.id, 
    user.modulePermissions as PermissionId[] | undefined
  );
  
  // Find first allowed module in priority order
  for (const module of MODULE_PRIORITY) {
    if (permissions.includes(module)) {
      return MODULE_ROUTES[module];
    }
  }
  
  // No permissions - show not authorized
  return '/not-authorized';
}

/**
 * Get all allowed routes for a user
 */
export function getAllowedRoutes(user: AccessUser | null): string[] {
  if (!user) return [];
  
  // Super admins can access everything
  if (isSuperAdminUser(user.id, user.role as UserRole | undefined)) {
    return Object.values(MODULE_ROUTES);
  }
  
  const permissions = getExplicitPermissions(
    user.id, 
    user.modulePermissions as PermissionId[] | undefined
  );
  
  return permissions.map(module => MODULE_ROUTES[module]).filter(Boolean);
}

/**
 * Check if user has financials access (for hiding revenue widgets)
 */
export function canViewFinancials(user: AccessUser | null): boolean {
  return canAccess(user, 'financials');
}

/**
 * Check if user has dashboard access
 */
export function canViewDashboard(user: AccessUser | null): boolean {
  return canAccess(user, 'dashboard');
}

/**
 * Get module permission from route path
 */
export function getModuleFromRoute(route: string): PermissionId | null {
  const basePath = '/' + (route.split('/')[1] || '');
  return ROUTE_MODULES[basePath] || null;
}
