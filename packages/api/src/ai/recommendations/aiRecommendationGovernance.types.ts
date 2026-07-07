import type { AuditActor } from '../../platform/audit/auditEngine.service.js';

export type AIRecommendationSeed = {
  title: string;
  description: string;
  category: string;
  department: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence?: number;
  rationale: string;
};

export type PersistAIRecommendationsInput = {
  hotelId: string;
  sourceType: 'DAILY_GM_BRIEFING' | 'DEPARTMENT_INTELLIGENCE' | 'AI_COPILOT';
  sourceId: string;
  recommendations: AIRecommendationSeed[];
  actor?: AuditActor;
};

export type RecommendationActionInput = {
  hotelId: string;
  recommendationId: string;
  actor?: AuditActor;
  rejectionReason?: string;
};
