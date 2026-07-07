import api from './api';

export type AIRecommendationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'TASK_CREATED' | 'EXPIRED';
export type AIRecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AIRecommendationSource = 'DAILY_GM_BRIEFING' | 'DEPARTMENT_INTELLIGENCE' | 'AI_COPILOT';

export type AIRecommendation = {
  id: string;
  hotelId: string;
  sourceType: AIRecommendationSource;
  sourceId: string;
  title: string;
  description: string;
  category: string;
  department: string;
  priority: AIRecommendationPriority;
  confidence: number;
  rationale: string;
  status: AIRecommendationStatus;
  createdTaskId?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  createdTask?: {
    id: string;
    status: string;
    priority: string;
    department: string;
    conversationId: string;
  } | null;
  reviewedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

const aiRecommendationsService = {
  async list(status?: AIRecommendationStatus): Promise<AIRecommendation[]> {
    const response = await api.get('/ai/recommendations', {
      params: {
        status,
        limit: 100,
        _ts: Date.now(),
      },
    });
    return response.data.data as AIRecommendation[];
  },

  async approve(id: string): Promise<AIRecommendation> {
    const response = await api.post(`/ai/recommendations/${id}/approve`);
    return response.data.data as AIRecommendation;
  },

  async reject(id: string, rejectionReason: string): Promise<AIRecommendation> {
    const response = await api.post(`/ai/recommendations/${id}/reject`, { rejectionReason });
    return response.data.data as AIRecommendation;
  },

  async createTask(id: string): Promise<AIRecommendation> {
    const response = await api.post(`/ai/recommendations/${id}/execute`, { actionType: 'CREATE_TASK' });
    return response.data.data as AIRecommendation;
  },

  async expire(id: string): Promise<AIRecommendation> {
    const response = await api.post(`/ai/recommendations/${id}/expire`);
    return response.data.data as AIRecommendation;
  },
};

export default aiRecommendationsService;
