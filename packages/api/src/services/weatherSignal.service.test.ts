import { describe, expect, it } from 'vitest';
import { normalizeCountryForOpenWeather } from './weatherSignal.service.js';

describe('normalizeCountryForOpenWeather', () => {
  it('uses the ISO country code for South Africa', () => {
    expect(normalizeCountryForOpenWeather('South Africa')).toBe('ZA');
  });

  it('preserves existing two-letter country codes', () => {
    expect(normalizeCountryForOpenWeather('za')).toBe('ZA');
  });
});
