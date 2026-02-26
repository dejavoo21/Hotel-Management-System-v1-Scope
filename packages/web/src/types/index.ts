// Presence types
export type PresenceStatus = 'AVAILABLE' | 'BUSY' | 'DND' | 'AWAY' | 'APPEAR_OFFLINE';
export type EffectiveStatus = 'AVAILABLE' | 'BUSY' | 'DND' | 'AWAY' | 'OFFLINE';

export interface PresenceUpdate {
  userId: string;
  email: string;
  isOnline: boolean;
  presenceStatus: PresenceStatus;
  effectiveStatus: EffectiveStatus;
  lastSeenAt: string | null;
}

// User types
export type ModulePermission =
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

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPING';
  hotelId: string;
  hotel: {
    id: string;
    name: string;
    address?: string;
    addressLine1?: string | null;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
    website?: string | null;
    currency?: string;
    timezone?: string;
    latitude?: number | null;
    longitude?: number | null;
    locationUpdatedAt?: string | null;
  };
  modulePermissions?: ModulePermission[];
  twoFactorEnabled?: boolean;
  isActive: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string;
  presenceStatus?: PresenceStatus;
  lastSeenAt?: string | null;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  twoFactorCode?: string;
  trustedDeviceToken?: string;
}

export interface LoginResponse {
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  requiresTwoFactor?: boolean;
  requiresPasswordChange?: boolean;
  requiresOtpRevalidation?: boolean;
  trustedDeviceToken?: string;
}

// Room types
export interface RoomType {
  id: string;
  name: string;
  description?: string;
  baseRate: number;
  maxGuests: number;
  amenities: string[];
  isActive: boolean;
}

export interface Room {
  id: string;
  number: string;
  floor: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'OUT_OF_SERVICE';
  housekeepingStatus: 'CLEAN' | 'DIRTY' | 'INSPECTION' | 'OUT_OF_SERVICE';
  roomType: RoomType;
  notes?: string;
  currentGuest?: Guest;
  currentBooking?: Booking;
  isActive: boolean;
}

export interface Floor {
  id: string;
  number: number;
  name?: string | null;
}

// Guest types
export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  idType?: string;
  idNumber?: string;
  nationality?: string;
  vipStatus: boolean;
  notes?: string;
  manualStays?: number;
  preferredRoomTypeId?: string;
  totalStays: number;
  totalSpent: number;
}

// Booking types
export interface Booking {
  id: string;
  bookingRef: string;
  guest: Guest;
  room?: Room;
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn?: string;
  actualCheckOut?: string;
  numberOfAdults: number;
  numberOfChildren: number;
  status: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
  source: 'DIRECT' | 'BOOKING_COM' | 'EXPEDIA' | 'AIRBNB' | 'WALK_IN' | 'PHONE' | 'CORPORATE' | 'WEBSITE';
  paymentMethod?: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'STRIPE' | 'CHECK' | 'OTHER';
  paymentConfirmed: boolean;
  specialRequests?: string;
  internalNotes?: string;
  roomRate: number;
  totalAmount: number;
  paidAmount: number;
  charges?: Charge[];
  payments?: Payment[];
  invoices?: Invoice[];
}

export interface Charge {
  id: string;
  description: string;
  category: string;
  amount: number;
  quantity: number;
  unitPrice: number;
  date: string;
  isVoided: boolean;
}

export interface Payment {
  id: string;
  amount: number;
  method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'STRIPE' | 'CHECK' | 'OTHER';
  reference?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  processedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  subtotal: number;
  tax: number;
  total: number;
  status: 'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'VOIDED';
  pdfUrl?: string;
  issuedAt: string;
}

// Inventory types
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantityOnHand: number;
  reorderPoint: number;
  cost: number;
  location?: string;
  isActive: boolean;
}

// Calendar types
export interface CalendarEvent {
  id: string;
  title: string;
  type: 'BOOKING' | 'MAINTENANCE' | 'HOUSEKEEPING' | 'EVENT' | 'OTHER';
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startAt: string;
  endAt: string;
  room?: { id: string; number: string };
  booking?: { id: string; bookingRef: string };
  notes?: string;
}

// Review types
export interface Review {
  id: string;
  rating: number;
  source: 'DIRECT' | 'BOOKING_COM' | 'EXPEDIA' | 'AIRBNB' | 'GOOGLE' | 'TRIPADVISOR' | 'OTHER';
  comment?: string;
  response?: string;
  respondedAt?: string;
  createdAt: string;
  guest?: { firstName: string; lastName: string };
  booking?: { bookingRef: string };
}

// Concierge types
export interface ConciergeRequest {
  id: string;
  title: string;
  details?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt?: string;
  createdAt: string;
  guest?: { firstName: string; lastName: string };
  room?: { number: string };
  booking?: { bookingRef: string };
  assignedTo?: { firstName: string; lastName: string };
}

export interface WeatherSignalStatus {
  hotelId: string;
  lastSyncTime: string | null;
  daysAvailable: number;
  hasCity: boolean;
  hasLatLon: boolean;
  city?: string | null;
  country?: string | null;
  timezone?: string | null;
  lat?: number | null;
  lon?: number | null;
}

export interface WeatherSignalDaily {
  id: string;
  hotelId: string;
  type: 'WEATHER' | string;
  dateLocal: string;
  timezone: string;
  metrics: Record<string, unknown>;
  source: string;
  fetchedAtUtc: string;
  rawJson?: Record<string, unknown> | null;
}

export interface MessageItem {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
  user?: { firstName: string; lastName: string; role: string };
  bookingRef?: string;
}

export interface ConversationMessage {
  id: string;
  body: string;
  senderType: 'GUEST' | 'STAFF' | 'SYSTEM';
  createdAt: string;
  senderUser?: { id?: string; firstName: string; lastName: string; role: string };
  guest?: { firstName: string; lastName: string };
}

export interface MessageThreadSummary {
  id: string;
  subject: string;
  status: 'OPEN' | 'RESOLVED' | 'ARCHIVED';
  guest?: { firstName: string; lastName: string; email?: string; phone?: string };
  booking?: { bookingRef: string; checkInDate: string; checkOutDate: string };
  lastMessageAt: string;
  lastMessage: ConversationMessage | null;
  assignedSupport?: {
    userId: string;
    firstName: string;
    lastName: string;
    role: string;
    assignedAt: string;
    assignedById?: string;
  };
}

export interface SupportVoiceToken {
  token: string;
  identity: string;
  fromPhone?: string;
  enabled: boolean;
}

export interface SupportVideoToken {
  token: string;
  identity: string;
  room: string;
  enabled: boolean;
}

export interface MessageThreadDetail extends MessageThreadSummary {
  messages: ConversationMessage[];
}

export interface SupportAgent {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  online: boolean;
  lastSeenAt?: string;
}

export interface PurchaseOrderItem {
  id: string;
  inventoryItemId?: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  vendorName: string;
  vendorEmail?: string;
  status: string;
  notes?: string;
  totalCost: number;
  items: PurchaseOrderItem[];
  createdAt: string;
}

export interface AccessRequest {
  id: string;
  fullName: string;
  email: string;
  mobileNumber?: string;
  company?: string;
  role?: string;
  message?: string;
  adminNotes?: string;
  status: string;
  createdAt: string;
}

export interface AccessRequestAttachment {
  filename: string;
  contentType?: string;
  size?: number;
  hasContent?: boolean;
}

export interface AccessRequestReply {
  id: string;
  accessRequestId: string;
  fromEmail: string;
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  attachments?: AccessRequestAttachment[] | null;
  receivedAt: string;
  createdAt: string;
}

// Report types
export interface RevenueBreakdownItem {
  date: string;
  revenue: number;
  bookings: number;
}

export interface OccupancyBreakdownItem {
  date: string;
  occupied: number;
  total: number;
  rate: number;
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
  todayRevenue: number;
  monthRevenue: number;
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

export interface PriorityAlert {
  id: string;
  level: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionLabel: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: { field: string; message: string }[];
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
