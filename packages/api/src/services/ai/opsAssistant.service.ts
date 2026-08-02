import { generateAIRecommendation } from '../../ai/ai.service.js';

type OpsAssistantParams = {
  hotelId: string;
  userId: string;
  message: string;
  context?: Record<string, unknown> | null;
};

function buildInstructions(): string {
  return [
    'You are LaFlo Assistant, the in-product guide for the LaFlo hotel operations platform.',
    'Be concise, practical, and action-oriented.',
    'Answer free-form questions about using LaFlo and about the authorised hotel context supplied to you.',
    'Use the current application page when it helps explain where the user should go or what they can do next.',
    'Use only the structured context provided. If required data is missing or restricted, say so without implying that a restricted record exists.',
    'Never expose credentials, secrets, two-factor codes, raw payment card data, or internal implementation details.',
    'Do not claim that an action was completed. Explain the steps or ask the user to open the relevant authorised module.',
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
    context: params.context ?? null,
  });

  return recommendation.content;
}
