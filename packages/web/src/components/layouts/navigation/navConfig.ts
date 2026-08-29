import type { PermissionId, UserRole } from '@/utils/userAccess';

export type NavItem = {
  id: string;
  label: string;
  href: string;
  permission?: PermissionId;
  roles?: UserRole[];
  icon: string; // Icon name to render
  badge?: string;
};

export type NavGroup = {
  id: string;
  label: string;
  href?: string;
  permission?: PermissionId;
  roles?: UserRole[];
  icon: string;
  badge?: string;
  items: NavItem[];
};

export type NavSection = {
  id: string;
  label: string;
  icon: string;
  items?: NavItem[];
  groups?: NavGroup[];
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
      { id: 'enterprise-command-center', label: 'Command Center', href: '/enterprise-command-center', permission: 'dashboard', icon: 'gauge' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: 'operations',
    items: [
      { id: 'operations-center', label: 'Operations Center', href: '/operations-center', permission: 'bookings', icon: 'gauge', badge: 'NEW' },
      { id: 'operations-tasks', label: 'Tasks & Advisories', href: '/operations/tasks-advisories', permission: 'bookings', icon: 'calendar-check' },
      { id: 'operational-intelligence', label: 'Operational Intelligence', href: '/operations/operational-intelligence/weather-forecast', permission: 'bookings', icon: 'chart' },
      { id: 'security-center', label: 'Security Center', href: '/security-center', permission: 'security_center', icon: 'admin' },
      { id: 'incident-center', label: 'Incident Center', href: '/incidents?tab=overview', permission: 'incident_management', icon: 'admin' },
      { id: 'smart-building', label: 'Smart Building', href: '/operations/smart-building?tab=overview', permission: 'smart_building', icon: 'building' },
      { id: 'operations-ai', label: 'AI Recommendations', href: '/operations/ai-governance', permission: 'bookings', icon: 'admin' },
      { id: 'hotel-brain', label: 'Hotel Insights', href: '/operations/hotel-brain-console', permission: 'bookings', icon: 'sparkles' },
      { id: 'enterprise-search', label: 'Enterprise Search', href: '/operations/enterprise-search', permission: 'bookings', icon: 'search' },
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
      { id: 'financials', label: 'Financials', href: '/financials', permission: 'financials', icon: 'chart' },
      { id: 'reports', label: 'Reports', href: '/reports', permission: 'financials', icon: 'chart' },
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
