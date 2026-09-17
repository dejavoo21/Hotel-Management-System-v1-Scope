import type { PermissionId } from '@/utils/userAccess';

export type ReportCatalogueItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  access: PermissionId;
  route: string;
  formats: Array<'CSV' | 'PDF'>;
  source: 'Live module data' | 'Prepared view';
};

export const REPORT_CATALOGUE: ReportCatalogueItem[] = [
  { id: 'executive', name: 'Executive summary', description: 'Occupancy, revenue, readiness, guest experience, and operational exceptions.', category: 'Management', access: 'dashboard', route: '/', formats: ['CSV', 'PDF'], source: 'Prepared view' },
  { id: 'occupancy', name: 'Occupancy report', description: 'Room utilisation, arrivals, departures, and occupancy movement.', category: 'Rooms', access: 'rooms', route: '/rooms', formats: ['CSV', 'PDF'], source: 'Live module data' },
  { id: 'reservations', name: 'Reservations report', description: 'Booking volume, status, source, stay dates, and outstanding balances.', category: 'Operations', access: 'bookings', route: '/bookings', formats: ['CSV'], source: 'Live module data' },
  { id: 'housekeeping', name: 'Housekeeping report', description: 'Room readiness, cleaning workload, inspections, and blocked rooms.', category: 'Housekeeping', access: 'housekeeping', route: '/housekeeping', formats: ['CSV', 'PDF'], source: 'Live module data' },
  { id: 'maintenance', name: 'Maintenance report', description: 'Open work, overdue tasks, room blockers, faults, and resolution status.', category: 'Maintenance', access: 'maintenance_center', route: '/maintenance-center', formats: ['CSV', 'PDF'], source: 'Live module data' },
  { id: 'incidents', name: 'Incident report', description: 'Incident volume, severity, ownership, guest impact, and closure status.', category: 'Operations', access: 'incident_management', route: '/incidents', formats: ['CSV', 'PDF'], source: 'Live module data' },
  { id: 'security', name: 'Security and CCTV health', description: 'Security alerts, camera health, access activity, and escalations.', category: 'Security', access: 'security_center', route: '/security-center', formats: ['CSV', 'PDF'], source: 'Live module data' },
  { id: 'building', name: 'Smart Building report', description: 'Device health, offline assets, sensor alerts, HVAC, and energy status.', category: 'Smart Building', access: 'smart_building', route: '/operations/smart-building', formats: ['CSV', 'PDF'], source: 'Live module data' },
  { id: 'experience', name: 'Guest experience report', description: 'Reviews, service requests, sentiment, and unresolved follow-up.', category: 'Guest Experience', access: 'reviews', route: '/reviews', formats: ['CSV', 'PDF'], source: 'Live module data' },
  { id: 'inventory', name: 'Inventory report', description: 'Stock position, reorder exposure, categories, and purchase orders.', category: 'Inventory', access: 'inventory', route: '/inventory', formats: ['CSV'], source: 'Live module data' },
  { id: 'financial', name: 'Financial performance', description: 'Revenue, occupancy, booking sources, room types, and daily performance.', category: 'Finance', access: 'financials', route: '/financials', formats: ['CSV', 'PDF'], source: 'Live module data' },
  { id: 'audit', name: 'Audit and access report', description: 'Recorded operational actions and controlled administration activity.', category: 'Audit', access: 'users', route: '/users', formats: ['CSV'], source: 'Prepared view' },
  { id: 'ai', name: 'Hotel Insights recommendations', description: 'Authorised operational recommendations and management insights.', category: 'AI / Hotel Insights', access: 'bookings', route: '/ai/hotel-brain', formats: ['PDF'], source: 'Prepared view' },
  { id: 'integrations', name: 'Integration health report', description: 'Provider connectivity, CCTV and building integration readiness.', category: 'Integrations', access: 'settings', route: '/settings?tab=integrations', formats: ['CSV', 'PDF'], source: 'Prepared view' },
];
