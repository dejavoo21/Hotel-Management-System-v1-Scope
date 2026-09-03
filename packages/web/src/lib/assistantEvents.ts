import type { AssistantMode } from '@/services/assistant';

export const OPEN_LAFLO_ASSISTANT_EVENT = 'laflo:open-assistant';
export const SET_LAFLO_ASSISTANT_CONTEXT_EVENT = 'laflo:set-assistant-context';

export type OpenLafloAssistantDetail = {
  prompt?: string;
  mode?: AssistantMode;
  context?: Record<string, unknown>;
};

export function openLafloAssistant(detail: OpenLafloAssistantDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenLafloAssistantDetail>(OPEN_LAFLO_ASSISTANT_EVENT, { detail }));
}

export function setLafloAssistantContext(context: Record<string, unknown> | null) {
  window.dispatchEvent(new CustomEvent<Record<string, unknown> | null>(SET_LAFLO_ASSISTANT_CONTEXT_EVENT, { detail: context }));
}
