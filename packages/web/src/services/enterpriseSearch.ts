import api from './api';

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

export type EnterpriseSearchParams = {
  q?: string;
  categories?: string[];
  sourceModules?: string[];
  status?: string;
  priority?: string;
  severity?: string;
  ownerId?: string;
  department?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;

const enterpriseSearchService = {
  async search(params: EnterpriseSearchParams): Promise<EnterpriseSearchResponse> {
    const response = await api.get('/enterprise-search', {
      params: {
        ...params,
        categories: params.categories?.join(','),
        sourceModules: params.sourceModules?.join(','),
      },
    });
    return unwrap(response);
  },
  async rebuild(): Promise<{ indexedRecords: number; indexedAt: string }> {
    const response = await api.post('/enterprise-search/rebuild');
    return unwrap(response);
  },
  async askHotelBrain(question: string): Promise<HotelBrainAnswer> {
    const response = await api.post('/enterprise-search/hotel-brain/ask', { question });
    return unwrap(response);
  },
};

export default enterpriseSearchService;
