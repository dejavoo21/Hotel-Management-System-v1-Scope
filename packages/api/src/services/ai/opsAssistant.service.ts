import { generateAIRecommendation } from '../../ai/ai.service.js';

type OpsAssistantParams = {
  hotelId: string;
  userId: string;
  message: string;
};

function buildInstructions(): string {
  return [
    'You are the hotel Operations Assistant.',
    'Be concise, practical, and action-oriented.',
    'Use the structured hotel context before making recommendations.',
    'When recommending an action, use short bullet points.',
    'Do not mention AI, model names, or internal implementation details.',
  ].join(' ');
}

export async function runOpsAssistant(params: OpsAssistantParams): Promise<string> {
  if (process.env.ASSISTANT_PROVIDER === 'none' || !process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const recommendation = await generateAIRecommendation({
    hotelId: params.hotelId,
    userId: params.userId,
    prompt: params.message,
    systemPrompt: buildInstructions(),
    contextOptions: {},
  });

  return recommendation.content;
}
