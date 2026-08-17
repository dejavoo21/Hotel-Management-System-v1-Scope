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
    groups: [
      {
        id: 'operations-center',
        label: 'Operations Center',
        href: '/operations-center',
        permission: 'bookings',
        icon: 'gauge',
        badge: 'NEW',
        items: [
          { id: 'operations-tasks', label: 'Tasks & Advisories', href: '/operations/tasks-advisories', permission: 'bookings', icon: 'calendar-check' },
          { id: 'operations-ai', label: 'AI Governance', href: '/operations/ai-governance', permission: 'bookings', icon: 'admin' },
          { id: 'hotel-brain', label: 'Hotel Brain Console', href: '/operations/hotel-brain-console', permission: 'bookings', icon: 'sparkles' },
          { id: 'enterprise-search', label: 'Enterprise Search', href: '/operations/enterprise-search', permission: 'bookings', icon: 'search' },
        ],
      },
      {
        id: 'operational-intelligence',
        label: 'Operational Intelligence',
        permission: 'bookings',
        icon: 'chart',
        items: [
          { id: 'operations-weather', label: 'Weather & Forecast', href: '/operations/operational-intelligence/weather-forecast', permission: 'bookings', icon: 'calendar' },
          { id: 'operations-market-intelligence', label: 'Market Intelligence', href: '/operations/operational-intelligence/market-intelligence', permission: 'bookings', icon: 'gauge' },
          { id: 'operations-revenue', label: 'Revenue Guidance', href: '/operations/operational-intelligence/revenue-guidance', permission: 'financials', icon: 'chart' },
        ],
      },
      {
        id: 'security-center',
        label: 'Security Center',
        href: '/security-center',
        permission: 'security_center',
        icon: 'admin',
        items: [
          { id: 'security-cctv', label: 'CCTV', href: '/security-center/cctv', permission: 'security_center', icon: 'dashboard' },
          { id: 'security-access-logs', label: 'Access Logs', href: '/security-center/access-logs', permission: 'security_center', icon: 'receipt' },
          { id: 'security-visitors', label: 'Visitors', href: '/security-center/visitors', permission: 'security_center', icon: 'users' },
          { id: 'security-alerts', label: 'Alerts', href: '/security-center/alerts', permission: 'security_center', icon: 'admin' },
        ],
      },
      {
        id: 'incident-center',
        label: 'Incident Center',
        href: '/incidents',
        permission: 'incident_management',
        icon: 'admin',
        items: [
          { id: 'incident-active', label: 'Active Incidents', href: '/incidents', permission: 'incident_management', icon: 'admin' },
          { id: 'incident-critical', label: 'Critical', href: '/incidents?view=critical', permission: 'incident_management', icon: 'admin' },
          { id: 'incident-assigned', label: 'Assigned to Me', href: '/incidents?view=assigned_to_me', permission: 'incident_management', icon: 'users' },
          { id: 'incident-resolved', label: 'Resolved', href: '/incidents?view=resolved', permission: 'incident_management', icon: 'calendar-check' },
        ],
      },
      {
        id: 'smart-building',
        label: 'Smart Building',
        href: '/operations/smart-building',
        permission: 'smart_building',
        icon: 'building',
        items: [
          { id: 'smart-building-doors', label: 'Doors', href: '/operations/smart-building/doors', permission: 'smart_building', icon: 'door' },
          { id: 'smart-building-sensors', label: 'Sensors', href: '/operations/smart-building/sensors', permission: 'smart_building', icon: 'gauge' },
          { id: 'smart-building-devices', label: 'Devices', href: '/operations/smart-building', permission: 'smart_building', icon: 'package' },
        ],
      },
      {
        id: 'maintenance',
        label: 'Maintenance Center',
        href: '/maintenance-center',
        permission: 'maintenance_center',
        icon: 'sparkles',
        items: [
          { id: 'maintenance-work-orders', label: 'Work Orders', href: '/maintenance-center/work-orders', permission: 'maintenance_center', icon: 'calendar-check' },
          { id: 'maintenance-faults', label: 'Faults', href: '/maintenance-center/faults', permission: 'maintenance_center', icon: 'admin' },
          { id: 'maintenance-repairs', label: 'Repairs', href: '/maintenance-center/repairs', permission: 'maintenance_center', icon: 'settings' },
          { id: 'maintenance-preventive', label: 'Preventive Maintenance', href: '/maintenance-center/preventive-maintenance', permission: 'maintenance_center', icon: 'calendar' },
          { id: 'maintenance-assets', label: 'Assets', href: '/maintenance-center/assets', permission: 'maintenance_center', icon: 'package' },
        ],
      },
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
