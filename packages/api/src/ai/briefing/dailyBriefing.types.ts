import type { AIContextOptions, AIHotelContext } from '../context/index.js';
import type { AuditActor } from '../../platform/audit/auditEngine.service.js';

export type DailyBriefingOptions = {
  contextOptions?: AIContextOptions;
  actor?: AuditActor;
  forceRuleBased?: boolean;
};

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
  contextMetadata: AIHotelContext['metadata'];
};
