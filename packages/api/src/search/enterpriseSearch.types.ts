export type EnterpriseSearchActor = {
  userId: string;
  role: string;
  modulePermissions: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type EnterpriseSearchFilters = {
  query?: string;
  categories?: string[];
  sourceModules?: string[];
  status?: string;
  priority?: string;
  severity?: string;
  ownerId?: string;
  department?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
};

export type EnterpriseSearchResult = {
  id: string;
  searchId: string;
  entityId: string;
  entityType: string;
  category: string;
  sourceModule: string;
  title: string;
  summary?: string | null;
  snippet: string;
  status?: string | null;
  priority?: string | null;
  severity?: string | null;
  hotelArea?: string | null;
  roomNumber?: string | null;
  ownerId?: string | null;
  sourceUrl?: string | null;
  indexedAt: string;
  updatedAt: string;
  metadata?: unknown;
};

export type EnterpriseSearchResponse = {
  query: string;
  results: EnterpriseSearchResult[];
  groups: Array<{ category: string; count: number; results: EnterpriseSearchResult[] }>;
  total: number;
  restrictedCount: number;
  generatedAt: string;
};

export type SearchIndexRecordInput = {
  entityId: string;
  entityType: string;
  sourceModule: string;
  title: string;
  summary?: string | null;
  searchableText: string;
  tags?: string[];
  status?: string | null;
  priority?: string | null;
  severity?: string | null;
  hotelArea?: string | null;
  roomNumber?: string | null;
  guestId?: string | null;
  reservationId?: string | null;
  ownerId?: string | null;
  accessScope: string[];
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
  sourceCreatedAt?: Date | null;
  sourceUpdatedAt?: Date | null;
};

export type HotelBrainAnswer = {
  answer: string;
  confidence: number;
  supportingRecords: EnterpriseSearchResult[];
  citedContextSections: string[];
  suggestedActions: Array<{
    title: string;
    description: string;
    department: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    requiresConfirmation: boolean;
  }>;
  safetyWarnings: string[];
  generatedAt: string;
};
