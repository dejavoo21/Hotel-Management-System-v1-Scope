import api from './api';

export type TimelineSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

export type TimelineEvent = {
  id: string;
  timestamp: string;
  hotelId: string;
  module: string;
  eventType: string;
  severity: TimelineSeverity;
  actor?: {
    userId?: string;
    name?: string;
    type?: string;
  };
  department?: string;
  location?: string;
  linkedEntity?: {
    type: string;
    id?: string;
  };
  status?: string;
  summary: string;
  icon: string;
  sourceEventId: string;
  correlationId: string;
};

export type TimelineFilters = {
  module?: string;
  severity?: TimelineSeverity;
  department?: string;
  time?: '1h' | '6h' | '24h' | '7d';
  limit?: number;
};

export type TimelineResponse = {
  events: TimelineEvent[];
  filters: {
    modules: string[];
    severities: TimelineSeverity[];
    departments: string[];
  };
};

const timelineService = {
  async list(filters: TimelineFilters = {}) {
    const response = await api.get<{ success: boolean; data: TimelineResponse }>('/timeline', {
      params: filters,
    });
    return response.data.data;
  },
};

export default timelineService;
