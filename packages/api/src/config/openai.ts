import OpenAI from 'openai';

export function getOpenAIClient(): OpenAI | null {
  const provider = process.env.ASSISTANT_PROVIDER?.toLowerCase();
  if (provider === 'none') return null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export const openai = getOpenAIClient();

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano';

console.log(
  '[AI]',
  openai
    ? `OpenAI enabled (model=${OPENAI_MODEL})`
    : 'OpenAI disabled - check ASSISTANT_PROVIDER and OPENAI_API_KEY'
);
