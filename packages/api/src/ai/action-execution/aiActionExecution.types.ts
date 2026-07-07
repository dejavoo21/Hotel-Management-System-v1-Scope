import type { AuditActor } from '../../platform/audit/auditEngine.service.js';

export type AIExecutableActionType = 'CREATE_TASK';

export type AIActionExecutionInput = {
  hotelId: string;
  recommendationId: string;
  actionType?: AIExecutableActionType;
  actor?: AuditActor;
};

export type AIActionExecutionPreview = {
  recommendationId: string;
  actionType: AIExecutableActionType;
  approved: boolean;
  executable: boolean;
  reason?: string;
  existingTaskId?: string | null;
};
