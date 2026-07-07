import type { AuditActor } from '../../platform/audit/auditEngine.service.js';

export type AIEvaluationRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AIEvaluationCriterion =
  | 'relevance'
  | 'safety'
  | 'correctness'
  | 'actionability'
  | 'duplicate_task_risk'
  | 'sensitive_data_leakage'
  | 'role_permission_awareness';

export type AIEvaluationCase = {
  id: string;
  name: string;
  scenario: string;
  inputContext: Record<string, unknown>;
  expectedOutput: {
    requiredKeywords: string[];
    forbiddenKeywords?: string[];
    expectedDepartments?: string[];
    expectedSeverity?: AIEvaluationRiskLevel;
    expectedActions?: string[];
    duplicateTaskRisk?: boolean;
    requiresRoleAwareness?: boolean;
  };
  evaluationCriteria: AIEvaluationCriterion[];
  riskLevel: AIEvaluationRiskLevel;
  department: string;
  tags: string[];
};

export type AIEvaluationCheck = {
  criterion: AIEvaluationCriterion;
  passed: boolean;
  score: number;
  message: string;
};

export type AIEvaluationResult = {
  caseId: string;
  name: string;
  passed: boolean;
  score: number;
  riskLevel: AIEvaluationRiskLevel;
  department: string;
  generatedOutput: {
    summary: string;
    recommendedActions: string[];
    departments: string[];
    severity: AIEvaluationRiskLevel;
  };
  checks: AIEvaluationCheck[];
  generatedAt: string;
};

export type AIEvaluationRunOptions = {
  actor?: AuditActor;
  hotelId?: string;
};

export type AIEvaluationRunAllResult = {
  total: number;
  passed: number;
  failed: number;
  averageScore: number;
  results: AIEvaluationResult[];
};
