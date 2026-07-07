import type { Role } from '@prisma/client';
import type { AIContextSection, AIHotelContext } from '../context/index.js';
import type { AuditActor } from '../../platform/audit/auditEngine.service.js';

export type AICopilotPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AICopilotContextScope = AIContextSection;

export type AICopilotUser = {
  id: string;
  role: Role | string;
  modulePermissions: string[];
};

export type AICopilotSuggestedAction = {
  title: string;
  description: string;
  category: string;
  department: string;
  priority: AICopilotPriority;
  confidence: number;
  rationale: string;
  supportsRecommendation: boolean;
};

export type AICopilotAskOptions = {
  contextScope?: AICopilotContextScope[];
  linkedEntityType?: string;
  linkedEntityId?: string;
  saveAsRecommendation?: boolean;
  actor?: AuditActor;
  overrideUser?: AICopilotUser;
  overrideContext?: AIHotelContext;
  skipAudit?: boolean;
};

export type AICopilotResponse = {
  answer: string;
  confidence: number;
  citedContextSections: AIContextSection[];
  suggestedActions: AICopilotSuggestedAction[];
  safetyWarnings: string[];
  generatedAt: string;
  createdRecommendationIds?: string[];
};
