import type { AccessUser } from '@/lib/access';
import { getAskLafloPageKnowledge } from './knowledgeMap';
import { resolveAskLafloAction } from './actionRegistry';
import type { AskLafloRuntimeContext } from './types';

const FILTER_KEYS = ['filter', 'status', 'priority', 'department', 'source', 'query', 'search', 'severity', 'category'];

export function buildAskLafloContext(route: string, user: AccessUser | null, launchContext: Record<string, unknown> | null): AskLafloRuntimeContext {
  const knowledge = getAskLafloPageKnowledge(route);
  const query = new URLSearchParams(route.split('?')[1] || '');
  const visibleFilters = Object.fromEntries([...query.entries()].filter(([key]) => FILTER_KEYS.includes(key)));
  const resolvedActions = knowledge.actions.map((id) => resolveAskLafloAction(id, user)).filter((item) => item !== null);
  const selectedRecord = launchContext && Object.keys(launchContext).some((key) => /id$/i.test(key)) ? launchContext : null;
  const sourceState = ['live', 'stale', 'unavailable', 'restricted'].includes(String(launchContext?.sourceState))
    ? launchContext?.sourceState as AskLafloRuntimeContext['sourceState']
    : 'unknown';
  return {
    page: typeof launchContext?.page === 'string' ? launchContext.page : knowledge.name,
    route,
    activeTab: typeof launchContext?.tab === 'string' ? launchContext.tab : query.get('tab') || query.get('status'),
    selectedRecord,
    visibleFilters: { ...visibleFilters, ...((launchContext?.visibleFilters as Record<string, unknown> | undefined) || {}) },
    availableActions: resolvedActions.filter((item) => item.status !== 'restricted'),
    restrictedActions: resolvedActions.filter((item) => item.status === 'restricted'),
    sourceState,
    lastUpdated: typeof launchContext?.lastUpdated === 'string' ? launchContext.lastUpdated : null,
  };
}
