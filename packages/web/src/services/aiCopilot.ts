import api from './api';

export type AICopilotContextSection =
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
  | 'financialSummary';

export type AICopilotSuggestedAction = {
  title: string;
  description: string;
  category: string;
  department: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  rationale: string;
  supportsRecommendation: boolean;
};

export type AICopilotResponse = {
  answer: string;
  confidence: number;
  citedContextSections: AICopilotContextSection[];
  suggestedActions: AICopilotSuggestedAction[];
  safetyWarnings: string[];
  generatedAt: string;
  createdRecommendationIds?: string[];
};

export type AICopilotAskPayload = {
  question: string;
  contextScope?: AICopilotContextSection[];
  linkedEntityType?: string;
  linkedEntityId?: string;
  saveAsRecommendation?: boolean;
};

const aiCopilotService = {
  async ask(payload: AICopilotAskPayload): Promise<AICopilotResponse> {
    const response = await api.post('/ai/copilot/ask', payload);
    return response.data.data as AICopilotResponse;
  },
};

export default aiCopilotService;
