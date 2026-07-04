import { Role } from '@prisma/client';
import type { Response, NextFunction } from 'express';
import { generateDepartmentBriefing, type DepartmentIntelligenceDepartment } from '../ai/department-intelligence/index.js';
import type { AuthenticatedRequest, ModulePermission } from '../types/index.js';

const DEPARTMENT_PERMISSIONS: Record<DepartmentIntelligenceDepartment, ModulePermission[]> = {
  'front-desk': ['bookings', 'guests'],
  housekeeping: ['housekeeping', 'rooms'],
  maintenance: ['maintenance_center'],
  security: ['security_center'],
  revenue: ['financials'],
  'guest-experience': ['messages', 'guests', 'reviews', 'concierge'],
};

function normalizeDepartment(value: string): DepartmentIntelligenceDepartment | null {
  const normalized = value.toLowerCase().replace(/_/g, '-').trim() as DepartmentIntelligenceDepartment;
  return Object.prototype.hasOwnProperty.call(DEPARTMENT_PERMISSIONS, normalized) ? normalized : null;
}

function hasDepartmentAccess(req: AuthenticatedRequest, department: DepartmentIntelligenceDepartment): boolean {
  if (!req.user) return false;
  if (req.user.role === Role.ADMIN) return true;
  const permissions = req.user.modulePermissions || [];
  return DEPARTMENT_PERMISSIONS[department].some((permission) => permissions.includes(permission));
}

export async function getDepartmentBriefing(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const department = normalizeDepartment(req.params.department || '');
    if (!department) {
      res.status(400).json({ success: false, error: 'Unsupported department' });
      return;
    }
    if (!hasDepartmentAccess(req, department)) {
      res.status(403).json({ success: false, error: `Access denied for ${department} intelligence` });
      return;
    }

    const briefing = await generateDepartmentBriefing(req.user!.hotelId, department, {
      forceRuleBased: req.query.mode === 'rules',
      actor: {
        userId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      },
    });
    res.json({ success: true, data: briefing });
  } catch (error) {
    next(error);
  }
}
