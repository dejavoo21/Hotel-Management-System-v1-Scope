import { describe, expect, it } from 'vitest';
import { askLafloWalkthroughs, findAskLafloWalkthrough } from './walkthroughs';

describe('Ask LaFlo walkthroughs', () => {
  it('defines progress and completion information for every step', () => {
    expect(askLafloWalkthroughs.length).toBeGreaterThanOrEqual(12);
    for (const walkthrough of askLafloWalkthroughs) {
      expect(walkthrough.steps.length).toBeGreaterThan(1);
      expect(walkthrough.steps.every((step) => step.route && step.actionRequired && step.completionCondition)).toBe(true);
    }
  });

  it('resolves required platform workflows from hotel-friendly requests', () => {
    expect(findAskLafloWalkthrough('Show me how to create a task')?.id).toBe('create-task-from-advisory');
    expect(findAskLafloWalkthrough('Help me connect CCTV')?.id).toBe('connect-cctv-provider');
    expect(findAskLafloWalkthrough('How do I resolve an incident?')?.id).toBe('resolve-incident');
  });
});
