export type AskLafloAgentMode = 'guide' | 'explain' | 'action' | 'troubleshoot' | 'context';

export type AskLafloPageKnowledge = {
  id: string;
  name: string;
  description: string;
  routes: string[];
  tabs: string[];
  actions: string[];
  prompts: string[];
  workflows: string[];
  permission?: string;
  commonErrors: string[];
};

export type AskLafloActionDefinition = {
  id: string;
  displayName: string;
  description: string;
  route: string;
  permission?: string;
  requiredParameters: string[];
  execution: 'navigate' | 'open-surface' | 'guided-only' | 'unavailable';
  surface?: 'page' | 'drawer' | 'modal' | 'filter';
  aliases: string[];
  fallback: string;
};

export type AskLafloActionResolution = AskLafloActionDefinition & {
  status: 'ready' | 'guided-only' | 'unavailable' | 'restricted';
};

export type AskLafloWalkthroughStep = {
  title: string;
  instruction: string;
  route: string;
  target?: string;
  actionRequired: string;
  completionCondition: string;
};

export type AskLafloWalkthrough = {
  id: string;
  title: string;
  purpose: string;
  permission?: string;
  aliases: string[];
  steps: AskLafloWalkthroughStep[];
};

export type AskLafloRuntimeContext = {
  page: string;
  route: string;
  activeTab: string | null;
  selectedRecord: Record<string, unknown> | null;
  visibleFilters: Record<string, unknown>;
  availableActions: AskLafloActionResolution[];
  restrictedActions: AskLafloActionResolution[];
  sourceState: 'live' | 'stale' | 'unavailable' | 'restricted' | 'unknown';
  lastUpdated: string | null;
};
