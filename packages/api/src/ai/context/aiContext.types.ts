export type AIContextSection =
  | 'hotelProfile'
  | 'occupancy'
  | 'revenue'
  | 'weather'
  | 'bookings'
  | 'guests'
  | 'housekeeping'
  | 'maintenance'
  | 'security'
  | 'smartBuilding'
  | 'incidents'
  | 'tasks'
  | 'reviews'
  | 'messages'
  | 'financialSummary'
  | 'guest'
  | 'room'
  | 'incident';

export type AIContextOptions = {
  from?: Date | string;
  to?: Date | string;
  sections?: AIContextSection[];
  excludeSections?: AIContextSection[];
  limit?: number;
};

export type AIContextMetadata = {
  generatedAt: string;
  hotelId: string;
  contextVersion: 'hotel-brain-v1';
  sectionsIncluded: AIContextSection[];
  warnings: string[];
  dataFreshness: Record<string, string>;
  range: {
    from: string;
    to: string;
  };
};

export type AIHotelContext = {
  metadata: AIContextMetadata;
  hotelProfile?: {
    name: string;
    city: string;
    country: string;
    timezone: string;
    currency: string;
    checkInTime: string;
    checkOutTime: string;
  };
  occupancy?: Record<string, unknown>;
  revenue?: Record<string, unknown>;
  weather?: Record<string, unknown>;
  bookings?: Record<string, unknown>;
  guests?: Record<string, unknown>;
  housekeeping?: Record<string, unknown>;
  maintenance?: Record<string, unknown>;
  security?: Record<string, unknown>;
  smartBuilding?: Record<string, unknown>;
  incidents?: Record<string, unknown>;
  tasks?: Record<string, unknown>;
  reviews?: Record<string, unknown>;
  messages?: Record<string, unknown>;
  financialSummary?: Record<string, unknown>;
};

export type AIOperationalContext = AIHotelContext;

export type AIGuestContext = AIHotelContext & {
  guest?: Record<string, unknown>;
};

export type AIRoomContext = AIHotelContext & {
  room?: Record<string, unknown>;
};

export type AIIncidentContext = AIHotelContext & {
  incident?: Record<string, unknown>;
};
