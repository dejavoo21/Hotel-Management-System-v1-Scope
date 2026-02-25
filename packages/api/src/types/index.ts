import { Request } from 'express';
import { Role } from '@prisma/client';

// Extend Express Request with user info
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
    hotelId: string;
    firstName: string;
    lastName: string;
    mustChangePassword?: boolean;
  };
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Query parameters
export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRangeQuery {
  startDate?: string;
  endDate?: string;
}

// Dashboard types
export interface DashboardSummary {
  todayArrivals: number;
  todayDepartures: number;
  currentOccupancy: number;
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  outOfServiceRooms: number;
  inHouseGuests: number;
  todayRevenue?: number;      // Only for ADMIN/MANAGER
  monthRevenue?: number;      // Only for ADMIN/MANAGER
}

// Role-filtered dashboard response (financial data stripped for non-managers)
export interface DashboardSummaryFiltered {
  todayArrivals: number;
  todayDepartures: number;
  currentOccupancy: number;
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  outOfServiceRooms: number;
  inHouseGuests: number;
}

export interface DashboardArrival {
  id: string;
  time: string;
  guestName: string;
  roomType: string;
  roomNumber?: string;
  status: string;
  bookingRef: string;
}

export interface DashboardDeparture {
  id: string;
  time: string;
  guestName: string;
  roomType: string;
  roomNumber: string;
  status: string;
  balanceDue: number;
}

export interface HousekeepingSummary {
  clean: number;
  dirty: number;
  inspection: number;
  outOfService: number;
  priorityRooms: PriorityRoom[];
}

export interface PriorityRoom {
  roomNumber: string;
  floor: number;
  status: string;
  reason: string;
  neededBy?: string;
}

// Socket event types
export interface SocketEvents {
  // Room events
  'room:statusUpdate': { roomId: string; status: string; housekeepingStatus: string };
  'room:assigned': { roomId: string; bookingId: string };

  // Booking events
  'booking:created': { bookingId: string };
  'booking:updated': { bookingId: string };
  'booking:checkedIn': { bookingId: string; roomId: string };
  'booking:checkedOut': { bookingId: string };

  // Housekeeping events
  'housekeeping:updated': { roomId: string; status: string };

  // Notification events
  'notification': { type: string; title: string; message: string };
}

// Token payload
export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  hotelId: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}
