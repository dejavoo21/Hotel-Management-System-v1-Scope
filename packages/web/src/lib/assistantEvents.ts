import type { AssistantMode } from '@/services/assistant';

export const OPEN_LAFLO_ASSISTANT_EVENT = 'laflo:open-assistant';

export type OpenLafloAssistantDetail = {
  prompt?: string;
  mode?: AssistantMode;
  context?: Record<string, unknown>;
};

export function openLafloAssistant(detail: OpenLafloAssistantDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenLafloAssistantDetail>(OPEN_LAFLO_ASSISTANT_EVENT, { detail }));
}
