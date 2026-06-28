import api from './api';
import type { SmartBuildingWorkflowTask } from './smartBuilding';

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type WorkOrderStatus = 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type FaultSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
export type FaultStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type RepairStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'COMPLETED' | 'CANCELLED';

export type MaintenanceActivity = {
  id: string;
  type: 'WORK_ORDER' | 'FAULT' | 'REPAIR' | 'SMART_BUILDING_TASK';
  title: string;
  detail?: string | null;
  status: string;
  occurredAt: string;
  sourceModule?: string | null;
};

export type MaintenanceOverview = {
  workOrders: { open: number };
  faults: { urgent: number };
  repairs: { inProgress: number };
  preventiveMaintenance: { overdue: number };
  assets: { dueInspection: number };
  completed: { today: number };
  smartBuildingTasks?: { maintenance: number; security: number; criticalOpen: number };
  recentActivity: MaintenanceActivity[];
};

export type MaintenanceWorkOrder = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  assetName?: string | null;
  assetExternalId?: string | null;
  priority: MaintenancePriority;
  status: WorkOrderStatus;
  assignedTo?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceFault = {
  id: string;
  workOrderId?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  assetName?: string | null;
  severity: FaultSeverity;
  status: FaultStatus;
  reportedAt: string;
  resolvedAt?: string | null;
};

export type MaintenanceRepair = {
  id: string;
  workOrderId?: string | null;
  faultId?: string | null;
  title: string;
  description?: string | null;
  technician?: string | null;
  status: RepairStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  cost?: string | number | null;
};

export type PreventiveMaintenanceSchedule = {
  id: string;
  title: string;
  assetName: string;
  assetExternalId?: string | null;
  frequency: string;
  nextDueAt: string;
  lastCompletedAt?: string | null;
  status: string;
  notes?: string | null;
};

export type AssetMaintenanceRecord = {
  id: string;
  assetName: string;
  assetExternalId?: string | null;
  location?: string | null;
  inspectionStatus: string;
  lastInspectionAt?: string | null;
  nextInspectionAt?: string | null;
  notes?: string | null;
  device?: { externalId: string; deviceType: string; status: string } | null;
};

export type CreateWorkOrderPayload = Partial<MaintenanceWorkOrder> & { title: string };
export type CreateFaultPayload = Partial<MaintenanceFault> & { title: string };
export type CreateRepairPayload = Partial<MaintenanceRepair> & { title: string };

export const maintenanceCenterService = {
  async getOverview(): Promise<MaintenanceOverview> {
    const response = await api.get('/maintenance-center/overview');
    return response.data.data;
  },

  async listWorkOrders(): Promise<MaintenanceWorkOrder[]> {
    const response = await api.get('/maintenance-center/work-orders');
    return response.data.data;
  },

  async createWorkOrder(payload: CreateWorkOrderPayload): Promise<MaintenanceWorkOrder> {
    const response = await api.post('/maintenance-center/work-orders', payload);
    return response.data.data;
  },

  async updateWorkOrder(id: string, payload: Partial<CreateWorkOrderPayload>): Promise<MaintenanceWorkOrder> {
    const response = await api.patch(`/maintenance-center/work-orders/${encodeURIComponent(id)}`, payload);
    return response.data.data;
  },

  async listFaults(): Promise<MaintenanceFault[]> {
    const response = await api.get('/maintenance-center/faults');
    return response.data.data;
  },

  async createFault(payload: CreateFaultPayload): Promise<MaintenanceFault> {
    const response = await api.post('/maintenance-center/faults', payload);
    return response.data.data;
  },

  async listRepairs(): Promise<MaintenanceRepair[]> {
    const response = await api.get('/maintenance-center/repairs');
    return response.data.data;
  },

  async createRepair(payload: CreateRepairPayload): Promise<MaintenanceRepair> {
    const response = await api.post('/maintenance-center/repairs', payload);
    return response.data.data;
  },

  async listPreventiveMaintenance(): Promise<PreventiveMaintenanceSchedule[]> {
    const response = await api.get('/maintenance-center/preventive-maintenance');
    return response.data.data;
  },

  async listAssets(): Promise<AssetMaintenanceRecord[]> {
    const response = await api.get('/maintenance-center/assets');
    return response.data.data;
  },

  async listSmartBuildingTasks(): Promise<SmartBuildingWorkflowTask[]> {
    const response = await api.get('/maintenance-center/smart-building-tasks');
    return response.data.data;
  },
};

export default maintenanceCenterService;
