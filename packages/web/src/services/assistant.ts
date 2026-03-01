import api from './api';

export const assistantService = {
  async ops(message: string): Promise<string> {
    const response = await api.post('/assistant/ops', { message });
    return response.data?.data?.reply ?? '';
  },
};

export default assistantService;

