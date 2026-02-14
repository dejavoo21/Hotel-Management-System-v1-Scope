const STORAGE_KEY = 'laflo:accessRequestAck:v1';
const EVENT_NAME = 'laflo:accessRequestAckChanged';

export type AccessRequestAckMap = Record<string, number>;

export function loadAccessRequestAckMap(): AccessRequestAckMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as AccessRequestAckMap;
  } catch {
    return {};
  }
}

export function saveAccessRequestAckMap(map: AccessRequestAckMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota/blocked storage
  }
}

export function isAccessRequestAcked(map: AccessRequestAckMap, requestId: string) {
  return Boolean(map[requestId]);
}

export function ackAccessRequest(requestId: string) {
  const map = loadAccessRequestAckMap();
  map[requestId] = Date.now();
  saveAccessRequestAckMap(map);
  try {
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    // ignore
  }
}

export function ackAccessRequests(requestIds: string[]) {
  if (!requestIds.length) return;
  const map = loadAccessRequestAckMap();
  let changed = false;
  const now = Date.now();
  for (const id of requestIds) {
    if (!map[id]) {
      map[id] = now;
      changed = true;
    }
  }
  if (!changed) return;
  saveAccessRequestAckMap(map);
  try {
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    // ignore
  }
}

export function onAccessRequestAckChanged(handler: () => void) {
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

