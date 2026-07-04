import type { AIContextOptions, AIHotelContext } from '../context/index.js';
import type { AuditActor } from '../../platform/audit/auditEngine.service.js';

export type DepartmentIntelligenceDepartment =
  | 'front-desk'
  | 'housekeeping'
  | 'maintenance'
  | 'security'
  | 'revenue'
  | 'guest-experience';

export type DepartmentBriefingOptions = {
  contextOptions?: AIContextOptions;
  actor?: AuditActor;
  forceRuleBased?: boolean;
};

export type DepartmentBriefingItem = {
  title: string;
  detail: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
};

export type DepartmentRecommendedAction = {
  title: string;
  detail: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ownerDepartment: string;
  supportsTask: boolean;
};

export type DepartmentWorkloadIndicators = Record<string, number | string | null>;

export type DepartmentBriefing = {
  department: DepartmentIntelligenceDepartment;
  summary: string;
  currentStatus: 'STABLE' | 'WATCH' | 'BUSY' | 'AT_RISK' | 'CRITICAL';
  topRisks: DepartmentBriefingItem[];
  topPriorities: DepartmentBriefingItem[];
  recommendedActions: DepartmentRecommendedAction[];
  workloadIndicators: DepartmentWorkloadIndicators;
  escalationItems: DepartmentBriefingItem[];
  generatedAt: string;
  contextVersion: string;
  source: 'AI' | 'RULES';
  contextMetadata: AIHotelContext['metadata'];
};
