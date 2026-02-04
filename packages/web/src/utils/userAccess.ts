export type UserRole = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPING';

export type PermissionId =
  | 'dashboard'
  | 'bookings'
  | 'rooms'
  | 'messages'
  | 'housekeeping'
  | 'inventory'
  | 'calendar'
  | 'guests'
  | 'financials'
  | 'reviews'
  | 'concierge'
  | 'users'
  | 'settings';

const PERMISSIONS_KEY = 'laflo:userPermissions';
const SUPER_ADMIN_KEY = 'laflo:superAdmins';
const USER_TITLES_KEY = 'laflo:userTitles';

const permissionOptions: { id: PermissionId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'bookings', label: 'Reservations' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'messages', label: 'Messages' },
  { id: 'housekeeping', label: 'Housekeeping' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'guests', label: 'Guests' },
  { id: 'financials', label: 'Financials' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'concierge', label: 'Concierge' },
  { id: 'users', label: 'Users' },
  { id: 'settings', label: 'Settings' },
];

const defaultPermissions: Record<UserRole, PermissionId[]> = {
  ADMIN: permissionOptions.map((option) => option.id),
  MANAGER: [
    'dashboard',
    'bookings',
    'rooms',
    'messages',
    'housekeeping',
    'inventory',
    'calendar',
    'guests',
    'financials',
    'reviews',
    'concierge',
    'settings',
  ],
  RECEPTIONIST: [
    'dashboard',
    'bookings',
    'rooms',
    'messages',
    'calendar',
    'guests',
    'financials',
  ],
  HOUSEKEEPING: ['dashboard', 'rooms', 'housekeeping', 'calendar', 'messages'],
};

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

export const getPermissionOptions = () => permissionOptions;

export const getUserPermissions = (userId?: string, role?: UserRole): PermissionId[] => {
  if (!userId) return role ? defaultPermissions[role] : [];
  const stored = loadStorage<Record<string, PermissionId[]>>(PERMISSIONS_KEY, {});
  return stored[userId] || (role ? defaultPermissions[role] : []);
};

export const setUserPermissions = (userId: string, permissions: PermissionId[]) => {
  const stored = loadStorage<Record<string, PermissionId[]>>(PERMISSIONS_KEY, {});
  stored[userId] = permissions;
  saveStorage(PERMISSIONS_KEY, stored);
};

export const getUserTitles = (): Record<string, string> =>
  loadStorage<Record<string, string>>(USER_TITLES_KEY, {});

export const setUserTitle = (userId: string, title: string) => {
  const titles = loadStorage<Record<string, string>>(USER_TITLES_KEY, {});
  if (title.trim()) {
    titles[userId] = title.trim();
  } else {
    delete titles[userId];
  }
  saveStorage(USER_TITLES_KEY, titles);
};

export const getSuperAdminIds = (): string[] =>
  loadStorage<string[]>(SUPER_ADMIN_KEY, []);

export const setSuperAdmin = (userId: string, enabled: boolean) => {
  const ids = new Set(getSuperAdminIds());
  if (enabled) {
    ids.add(userId);
  } else {
    ids.delete(userId);
  }
  saveStorage(SUPER_ADMIN_KEY, Array.from(ids));
};

export const isSuperAdminUser = (userId?: string) => {
  if (!userId) return false;
  return getSuperAdminIds().includes(userId);
};
