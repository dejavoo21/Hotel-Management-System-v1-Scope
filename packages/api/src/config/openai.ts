import OpenAI from 'openai';

export function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export const openai = getOpenAIClient();

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5';
