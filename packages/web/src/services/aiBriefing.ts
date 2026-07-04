import api from './api';

export type DailyBriefingItem = {
  title: string;
  detail: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  department?: string;
};

export type DailyRecommendedAction = {
  title: string;
  owner: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rationale: string;
};

export type DailyGMBriefing = {
  hotelHealthScore: number;
  executiveSummary: string;
  todayPriorities: DailyBriefingItem[];
  operationalRisks: DailyBriefingItem[];
  guestExperienceRisks: DailyBriefingItem[];
  revenueOpportunities: DailyBriefingItem[];
  weatherImpacts: DailyBriefingItem[];
  maintenanceConcerns: DailyBriefingItem[];
  securityConcerns: DailyBriefingItem[];
  smartBuildingConcerns: DailyBriefingItem[];
  staffingSuggestions: DailyBriefingItem[];
  recommendedActions: DailyRecommendedAction[];
  generatedAt: string;
  contextVersion: string;
  source: 'AI' | 'RULES';
};

export const aiBriefingService = {
  async getDailyBriefing(): Promise<DailyGMBriefing> {
    const response = await api.get('/ai/briefing/daily', {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      params: { _ts: Date.now() },
    });
    return response.data.data as DailyGMBriefing;
  },
};

export default aiBriefingService;
