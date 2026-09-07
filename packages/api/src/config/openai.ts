import OpenAI from 'openai';

export function getOpenAIClient(): OpenAI | null {
  const provider = process.env.ASSISTANT_PROVIDER?.toLowerCase();
  if (provider === 'none') return null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export const openai = getOpenAIClient();

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
export const OPENAI_COMPLEX_MODEL = process.env.OPENAI_COMPLEX_MODEL || 'gpt-5';

console.log(
  '[AI]',
  openai
    ? `OpenAI enabled (default=${OPENAI_MODEL}, complex=${OPENAI_COMPLEX_MODEL})`
    : 'OpenAI disabled - check ASSISTANT_PROVIDER and OPENAI_API_KEY'
);
