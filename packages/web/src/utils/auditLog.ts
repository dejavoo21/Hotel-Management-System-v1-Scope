export interface AuditLogEntry {
  id: string;
  action: string;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetLabel?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditSettings {
  retentionDays: number;
  forwardingEnabled: boolean;
  forwardingUrl?: string;
  forwardingApiKey?: string;
}

const LOG_KEY = 'laflo:auditLog';
const SETTINGS_KEY = 'laflo:auditSettings';

const loadStorage = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const saveStorage = <T>(key: string, value: T) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

export const getAuditSettings = (): AuditSettings =>
  loadStorage<AuditSettings>(SETTINGS_KEY, {
    retentionDays: 90,
    forwardingEnabled: false,
    forwardingUrl: '',
    forwardingApiKey: '',
  });

export const saveAuditSettings = (settings: AuditSettings) => {
  saveStorage(SETTINGS_KEY, settings);
};

export const getAuditLogs = (): AuditLogEntry[] =>
  loadStorage<AuditLogEntry[]>(LOG_KEY, []);

export const appendAuditLog = (entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => {
  const settings = getAuditSettings();
  const existing = getAuditLogs();
  const withEntry: AuditLogEntry[] = [
    {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    },
    ...existing,
  ];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - settings.retentionDays);

  const filtered = withEntry.filter((log) => new Date(log.createdAt) >= cutoff);
  saveStorage(LOG_KEY, filtered);
};
