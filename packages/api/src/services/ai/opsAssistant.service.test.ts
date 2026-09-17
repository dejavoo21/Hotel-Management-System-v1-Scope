import { describe, expect, it } from 'vitest';
import { selectOpsAssistantModel } from './opsAssistant.service.js';

describe('selectOpsAssistantModel', () => {
  it('uses the efficient model for ordinary product questions', () => {
    expect(selectOpsAssistantModel('Which rooms are ready today?')).toBe('gpt-5-mini');
  });

  it.each([
    'Investigate the root cause of the service delays.',
    'Create an executive briefing for today.',
    'Compare the operational risks and recommend an action plan.',
  ])('uses the advanced model for complex work: %s', (message) => {
    expect(selectOpsAssistantModel(message)).toBe('gpt-5');
  });

  it('uses the advanced model for long, multi-part requests', () => {
    expect(selectOpsAssistantModel('Review this operational context. '.repeat(20))).toBe('gpt-5');
  });
});
