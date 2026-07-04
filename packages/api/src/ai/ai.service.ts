import { openai, OPENAI_MODEL } from '../config/openai.js';
import { buildHotelContext, type AIContextOptions, type AIHotelContext } from './context/index.js';

export type AIRecommendationRequest = {
  hotelId: string;
  userId: string;
  prompt: string;
  systemPrompt?: string;
  context?: AIHotelContext | Record<string, unknown> | null;
  contextOptions?: AIContextOptions;
  temperature?: number;
};

export type AIRecommendationResult = {
  content: string;
  model: string;
  context: AIHotelContext | Record<string, unknown> | null;
  generatedAtUtc: string;
};

export async function generateAIRecommendation(input: AIRecommendationRequest): Promise<AIRecommendationResult> {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const context =
    input.context === undefined
      ? await buildHotelContext(input.hotelId, input.contextOptions)
      : input.context;

  const systemPrompt = [
    input.systemPrompt || 'You are LaFlo hotel intelligence. Be concise, practical, and action-oriented.',
    'Use only the supplied structured context and tool outputs.',
    'Do not invent operational facts, rates, incidents, or guest details.',
    'Do not mention AI, model names, training, or internal implementation details.',
  ].join('\n');

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL || 'gpt-4.1-nano',
    temperature: input.temperature ?? 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: `Structured hotel context:\n${JSON.stringify(context).slice(0, 12000)}` },
      { role: 'user', content: input.prompt },
    ],
  });

  return {
    content: response.choices?.[0]?.message?.content?.trim() || 'No recommendation generated.',
    model: OPENAI_MODEL || 'gpt-4.1-nano',
    context,
    generatedAtUtc: new Date().toISOString(),
  };
}

export const AIService = {
  generateRecommendation: generateAIRecommendation,
};
