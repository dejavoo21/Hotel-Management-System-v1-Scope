import type { PermissionId, UserRole } from '@/utils/userAccess';

export type NavItem = {
  id: string;
  label: string;
  href: string;
  permission?: PermissionId;
  roles?: UserRole[];
  icon: string; // Icon name to render
};

export type NavSection = {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
  permission?: PermissionId;
  roles?: UserRole[];
};

export const navSections: NavSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    items: [
      { id: 'dashboard-home', label: 'Overview', href: '/', permission: 'dashboard', icon: 'dashboard' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: 'operations',
    items: [
      { id: 'operations-center', label: 'Operations Center', href: '/operations', permission: 'dashboard', icon: 'operations' },
      { id: 'reservation', label: 'Reservation', href: '/bookings', permission: 'bookings', icon: 'calendar-check' },
      { id: 'rooms', label: 'Rooms', href: '/rooms', permission: 'rooms', icon: 'door' },
      { id: 'housekeeping', label: 'Housekeeping', href: '/housekeeping', permission: 'housekeeping', icon: 'sparkles' },
      { id: 'inventory', label: 'Inventory', href: '/inventory', permission: 'inventory', icon: 'package' },
      { id: 'calendar', label: 'Calendar', href: '/calendar', permission: 'calendar', icon: 'calendar' },
    ],
  },
  {
    id: 'guest',
    label: 'Guest',
    icon: 'guest',
    items: [
      { id: 'messages', label: 'Messages', href: '/messages', permission: 'messages', icon: 'message' },
      { id: 'calls', label: 'Calls', href: '/calls', permission: 'messages', icon: 'phone' },
      { id: 'guests', label: 'Guests', href: '/guests', permission: 'guests', icon: 'users' },
    ],
  },
  {
    id: 'backoffice',
    label: 'Back Office',
    icon: 'backoffice',
    items: [
      { id: 'financials', label: 'Financials', href: '/reports', permission: 'financials', icon: 'chart' },
      { id: 'invoicing', label: 'Invoicing', href: '/invoices', permission: 'financials', icon: 'receipt' },
      { id: 'expenses', label: 'Expenses', href: '/expenses', permission: 'financials', icon: 'wallet' },
    ],
  },
  {
    id: 'experience',
    label: 'Experience',
    icon: 'experience',
    items: [
      { id: 'reviews', label: 'Reviews', href: '/reviews', permission: 'reviews', roles: ['ADMIN', 'MANAGER'], icon: 'star' },
      { id: 'concierge', label: 'Concierge', href: '/concierge', permission: 'concierge', roles: ['ADMIN', 'MANAGER'], icon: 'concierge' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: 'admin',
    items: [
      { id: 'users', label: 'Users', href: '/users', permission: 'users', icon: 'user-cog' },
      { id: 'settings', label: 'Settings', href: '/settings', permission: 'settings', icon: 'settings' },
    ],
  },
];

// Icons mapping - these render SVG icons
export const navIcons: Record<string, JSX.Element> = {};

// Get icon by name - dynamically rendered in components
export const getNavIconName = (iconName: string): string => iconName;
