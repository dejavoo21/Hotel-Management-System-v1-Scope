import api from './api';

export type DepartmentIntelligenceDepartment =
  | 'front-desk'
  | 'housekeeping'
  | 'maintenance'
  | 'security'
  | 'revenue'
  | 'guest-experience';

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

export type DepartmentBriefing = {
  department: DepartmentIntelligenceDepartment;
  summary: string;
  currentStatus: 'STABLE' | 'WATCH' | 'BUSY' | 'AT_RISK' | 'CRITICAL';
  topRisks: DepartmentBriefingItem[];
  topPriorities: DepartmentBriefingItem[];
  recommendedActions: DepartmentRecommendedAction[];
  workloadIndicators: Record<string, number | string | null>;
  escalationItems: DepartmentBriefingItem[];
  generatedAt: string;
  contextVersion: string;
  source: 'AI' | 'RULES';
};

export const departmentIntelligenceService = {
  async getDepartmentBriefing(department: DepartmentIntelligenceDepartment): Promise<DepartmentBriefing> {
    const response = await api.get(`/ai/department/${department}/briefing`, {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      params: { _ts: Date.now() },
    });
    return response.data.data as DepartmentBriefing;
  },
};

export default departmentIntelligenceService;
