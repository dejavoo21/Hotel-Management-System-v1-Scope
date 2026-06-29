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
  security_center: '/security-center',
  incident_management: '/incidents',
  maintenance_center: '/maintenance-center',
  smart_building: '/operations/smart-building',
  users: '/users',
  settings: '/settings',
};

// Route to module mapping (reverse lookup)
export const ROUTE_MODULES: Record<string, PermissionId> = Object.entries(MODULE_ROUTES).reduce(
  (acc, [module, route]) => ({ ...acc, [route]: module as PermissionId }),
  {} as Record<string, PermissionId>
);

// Operations Center is temporarily mapped to bookings until a dedicated operations module exists.
ROUTE_MODULES['/operations'] = 'bookings';
ROUTE_MODULES['/dashboard'] = 'dashboard';
ROUTE_MODULES['/reservations'] = 'bookings';
ROUTE_MODULES['/financials'] = 'financials';
ROUTE_MODULES['/operations/ai'] = 'bookings';
ROUTE_MODULES['/operations/revenue'] = 'financials';
ROUTE_MODULES['/operations/weather'] = 'bookings';
ROUTE_MODULES['/operations/tasks'] = 'bookings';
ROUTE_MODULES['/operations/market-intelligence'] = 'bookings';
ROUTE_MODULES['/security-center'] = 'security_center';
ROUTE_MODULES['/security-center/cctv'] = 'security_center';
ROUTE_MODULES['/security-center/access-logs'] = 'security_center';
ROUTE_MODULES['/security-center/visitors'] = 'security_center';
ROUTE_MODULES['/security-center/alerts'] = 'security_center';
ROUTE_MODULES['/incidents'] = 'incident_management';
ROUTE_MODULES['/operations/security/cctv'] = 'security_center';
ROUTE_MODULES['/operations/security/access-logs'] = 'security_center';
ROUTE_MODULES['/operations/security/visitors'] = 'security_center';
ROUTE_MODULES['/operations/security/alerts'] = 'security_center';
ROUTE_MODULES['/operations/smart-building'] = 'smart_building';
ROUTE_MODULES['/smart-building'] = 'smart_building';
ROUTE_MODULES['/operations/smart-building/doors'] = 'smart_building';
ROUTE_MODULES['/operations/smart-building/sensors'] = 'smart_building';
ROUTE_MODULES['/operations/smart-building/energy'] = 'smart_building';
ROUTE_MODULES['/operations/smart-building/hvac'] = 'smart_building';
ROUTE_MODULES['/operations/smart-building/assets'] = 'smart_building';
ROUTE_MODULES['/maintenance-center'] = 'maintenance_center';
ROUTE_MODULES['/maintenance-center/work-orders'] = 'maintenance_center';
ROUTE_MODULES['/maintenance-center/faults'] = 'maintenance_center';
ROUTE_MODULES['/maintenance-center/repairs'] = 'maintenance_center';
ROUTE_MODULES['/maintenance-center/preventive-maintenance'] = 'maintenance_center';
ROUTE_MODULES['/maintenance-center/assets'] = 'maintenance_center';
ROUTE_MODULES['/operations/maintenance/work-orders'] = 'maintenance_center';
ROUTE_MODULES['/operations/maintenance/faults'] = 'maintenance_center';
ROUTE_MODULES['/operations/maintenance/repairs'] = 'maintenance_center';
// Calls is part of messaging workflow.
ROUTE_MODULES['/calls'] = 'messages';

function getRouteModule(route: string): PermissionId | undefined {
  const normalizedRoute = route.split('?')[0].replace(/\/+$/, '') || '/';
  const matches = Object.entries(ROUTE_MODULES)
    .filter(([path]) => normalizedRoute === path || normalizedRoute.startsWith(`${path}/`))
    .sort((a, b) => b[0].length - a[0].length);

  return matches[0]?.[1];
}


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
  'security_center',
  'incident_management',
  'maintenance_center',
  'smart_building',
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
  
  if (route.startsWith('/settings')) return true;
  const module = getRouteModule(route);
  
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
  return getRouteModule(route) || null;
}
