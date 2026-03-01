import { openai, OPENAI_MODEL } from '../../config/openai.js';
import { runTool, tools } from './tools.js';

const MAX_TOOL_ROUNDS = 3;

type OpsAssistantParams = {
  hotelId: string;
  userId: string;
  message: string;
};

function buildInstructions(): string {
  return [
    'You are the hotel Operations Assistant.',
    'Be concise, practical, and action-oriented.',
    'Call tools when live data or actions are needed; do not guess.',
    'When recommending an action, use short bullet points.',
    'Do not mention AI, model names, or internal implementation details.',
  ].join(' ');
}

export async function runOpsAssistant(params: OpsAssistantParams): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const { hotelId, userId, message } = params;
  const baseInput: Array<Record<string, unknown>> = [
    { role: 'system', content: buildInstructions() },
    { role: 'user', content: `hotelId=${hotelId}\n\n${message}` },
  ];
  let previousResponseId: string | undefined;
  let pendingInput: Array<Record<string, unknown>> = baseInput;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: pendingInput,
      tools: tools as any,
      previous_response_id: previousResponseId,
    });

    const functionCalls = (response.output ?? []).filter(
      (item: any) => item.type === 'function_call'
    );

    if (!functionCalls.length) {
      return extractText(response);
    }

    const toolOutputs: Array<Record<string, string>> = [];
    for (const call of functionCalls) {
      const callArgs = safeJsonParse(call.arguments ?? '{}');
      callArgs.__userId = userId;
      const result = await runTool(call.name, callArgs);
      toolOutputs.push({
        type: 'function_call_output',
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }

    previousResponseId = response.id;
    pendingInput = toolOutputs;
  }

  return 'Unable to complete that request right now. Please try again.';
}

function extractText(response: any): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part.type === 'output_text' && typeof part.text === 'string') {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join('\n').trim() || 'Done.';
}

function safeJsonParse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
