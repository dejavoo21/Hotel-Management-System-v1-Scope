import { describe, expect, it } from 'vitest';
import { buildDirectWeatherReply } from './unifiedAssistant.service.js';

describe('buildDirectWeatherReply', () => {
  it('answers with location and temperature before offering deeper navigation', () => {
    const reply = buildDirectWeatherReply('What is the current city and temperature?', {
      hotelProfile: { city: 'London', country: 'United Kingdom' },
      weather: {
        currentWeather: {
          city: 'London',
          country: 'United Kingdom',
          isFresh: true,
          stale: false,
          next24h: {
            summary: 'Overcast clouds',
            lowC: 18,
            highC: 23,
            rainRisk: 'low',
          },
        },
      },
    });

    expect(reply).toContain('London, United Kingdom');
    expect(reply).toContain('18–23°C');
    expect(reply).toContain('overcast clouds');
    expect(reply?.indexOf('London')).toBeLessThan(reply?.indexOf('Open Weather') ?? 0);
  });

  it('states when the city is known but weather data is unavailable', () => {
    const reply = buildDirectWeatherReply('Tell me the weather now', {
      hotelProfile: { city: 'Cape Town', country: 'South Africa' },
      weather: { currentWeather: null },
    });

    expect(reply).toContain('Cape Town, South Africa');
    expect(reply).toContain('current temperature is not available');
  });

  it('does not intercept unrelated platform questions', () => {
    expect(buildDirectWeatherReply('Explain the Rooms page', null)).toBeNull();
  });
});
