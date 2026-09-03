import { describe, expect, it } from 'vitest';
import {
  PLATFORM_INTERFACES,
  findPlatformInterface,
  findPlatformInterfaceByRoute,
  getPlatformInterfaceGuidance,
} from './platformKnowledge.js';

describe('LaFlo platform knowledge catalogue', () => {
  it('provides detailed, interactive guidance for every registered interface', () => {
    for (const item of PLATFORM_INTERFACES) {
      const guidance = getPlatformInterfaceGuidance(item);
      expect(guidance.summary.length, item.id).toBeGreaterThan(60);
      expect(guidance.keyAreas.length, item.id).toBeGreaterThanOrEqual(3);
      expect(guidance.priorities.length, item.id).toBeGreaterThanOrEqual(2);
      expect(guidance.followUpPrompts.length, item.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('matches interface questions and the most specific current route', () => {
    expect(findPlatformInterface('Explain the dashboard page')?.id).toBe('dashboard');
    expect(findPlatformInterface('How do I configure an ONVIF camera?')?.id).toBe('cctv');
    expect(findPlatformInterfaceByRoute('/security-center/cctv')?.id).toBe('cctv');
    expect(findPlatformInterfaceByRoute('/settings')?.id).toBe('settings');
    expect(findPlatformInterfaceByRoute('/settings?tab=integrations')?.id).toBe('integrations');
  });

  it('does not contain duplicate interface identifiers', () => {
    const ids = PLATFORM_INTERFACES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('describes Hotel Brain as Ask LaFlo intelligence instead of a competing assistant', () => {
    const hotelBrain = PLATFORM_INTERFACES.find((item) => item.id === 'hotel-brain');
    expect(hotelBrain?.purpose).toContain('powering Ask LaFlo');
    const guidance = hotelBrain ? getPlatformInterfaceGuidance(hotelBrain) : null;
    expect(guidance?.summary).toContain('behind Ask LaFlo');
    expect(guidance?.followUpPrompts.join(' ')).not.toContain('ask Hotel Brain');
  });
});
