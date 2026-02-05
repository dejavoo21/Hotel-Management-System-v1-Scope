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

// Mock audit log data for demo purposes
const generateMockAuditLogs = (): AuditLogEntry[] => {
  const now = new Date();
  const logs: AuditLogEntry[] = [];

  const actions = [
    { action: 'User Login', actorName: 'Admin User', targetLabel: 'System', details: { ip: '192.168.1.45', browser: 'Chrome 120' } },
    { action: 'Booking Created', actorName: 'Front Desk', targetLabel: 'Booking #BK-2024-0156', details: { guest: 'John Smith', room: '301', nights: 3 } },
    { action: 'Guest Checked In', actorName: 'Front Desk', targetLabel: 'Guest: Sarah Johnson', details: { room: '205', booking: 'BK-2024-0148' } },
    { action: 'Room Status Changed', actorName: 'Housekeeping', targetLabel: 'Room 412', details: { from: 'DIRTY', to: 'CLEAN' } },
    { action: 'Payment Received', actorName: 'Manager User', targetLabel: 'Invoice #INV-2024-0089', details: { amount: 450.00, method: 'Credit Card' } },
    { action: 'User Created', actorName: 'Admin User', targetLabel: 'User: reception@demo.hotel', details: { role: 'RECEPTIONIST' } },
    { action: 'Booking Cancelled', actorName: 'Manager User', targetLabel: 'Booking #BK-2024-0142', details: { reason: 'Guest request', refund: true } },
    { action: 'Guest Checked Out', actorName: 'Front Desk', targetLabel: 'Guest: Michael Brown', details: { room: '118', totalCharge: 890.50 } },
    { action: 'Settings Updated', actorName: 'Admin User', targetLabel: 'Hotel Settings', details: { field: 'Check-in Time', value: '3:00 PM' } },
    { action: 'Rate Updated', actorName: 'Manager User', targetLabel: 'Deluxe Suite', details: { oldRate: 199, newRate: 229, season: 'Peak' } },
    { action: 'Maintenance Request', actorName: 'Front Desk', targetLabel: 'Room 307', details: { issue: 'AC not working', priority: 'HIGH' } },
    { action: 'Concierge Request', actorName: 'Front Desk', targetLabel: 'Guest: Emily Davis', details: { type: 'Restaurant Reservation', status: 'Completed' } },
    { action: '2FA Enabled', actorName: 'Admin User', targetLabel: 'Account Security', details: { method: 'TOTP' } },
    { action: 'Password Reset', actorName: 'System', targetLabel: 'User: manager@demo.hotel', details: { triggered: 'Email request' } },
    { action: 'Report Generated', actorName: 'Manager User', targetLabel: 'Monthly Revenue Report', details: { period: 'January 2026', format: 'PDF' } },
  ];

  // Generate logs for the past 7 days
  for (let i = 0; i < 25; i++) {
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);

    const logDate = new Date(now);
    logDate.setDate(logDate.getDate() - daysAgo);
    logDate.setHours(logDate.getHours() - hoursAgo);
    logDate.setMinutes(logDate.getMinutes() - minutesAgo);

    const actionData = actions[Math.floor(Math.random() * actions.length)];

    logs.push({
      id: `log-demo-${i}-${Math.random().toString(36).slice(2, 8)}`,
      action: actionData.action,
      actorId: `user-${Math.floor(Math.random() * 3) + 1}`,
      actorName: actionData.actorName,
      targetId: `target-${i}`,
      targetLabel: actionData.targetLabel,
      details: actionData.details,
      createdAt: logDate.toISOString(),
    });
  }

  // Sort by date descending
  return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

const INIT_KEY = 'laflo:auditLogInitialized';

export const getAuditLogs = (): AuditLogEntry[] => {
  const logs = loadStorage<AuditLogEntry[]>(LOG_KEY, []);

  // If no logs exist and we haven't initialized before, seed with demo data
  if (logs.length === 0 && typeof window !== 'undefined') {
    const initialized = window.localStorage.getItem(INIT_KEY);
    if (!initialized) {
      const mockLogs = generateMockAuditLogs();
      saveStorage(LOG_KEY, mockLogs);
      window.localStorage.setItem(INIT_KEY, 'true');
      return mockLogs;
    }
  }

  return logs;
};

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

// Clear all audit logs (for admin use)
export const clearAuditLogs = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LOG_KEY);
    window.localStorage.removeItem(INIT_KEY);
  }
};

// Reset and regenerate demo audit logs
export const resetDemoAuditLogs = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(INIT_KEY);
    window.localStorage.removeItem(LOG_KEY);
    return getAuditLogs(); // This will regenerate demo data
  }
  return [];
};
