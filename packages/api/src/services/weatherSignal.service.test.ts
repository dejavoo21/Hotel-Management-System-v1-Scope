import { describe, expect, it } from 'vitest';
import { aggregateForecastByHotelDate, normalizeCountryForOpenWeather } from './weatherSignal.service.js';

describe('normalizeCountryForOpenWeather', () => {
  it('uses the ISO country code for South Africa', () => {
    expect(normalizeCountryForOpenWeather('South Africa')).toBe('ZA');
  });

  it('preserves existing two-letter country codes', () => {
    expect(normalizeCountryForOpenWeather('za')).toBe('ZA');
  });
});

describe('aggregateForecastByHotelDate', () => {
  it('preserves provider hourly temperature and precipitation observations', () => {
    const result = aggregateForecastByHotelDate({
      list: [{
        dt: Date.parse('2026-09-17T12:00:00Z') / 1000,
        main: { temp: 21.4, temp_min: 20, temp_max: 22, humidity: 62 },
        pop: 0.35,
        wind: { speed: 3.4 },
        weather: [{ main: 'Rain', description: 'light rain' }],
      }],
    }, 'Europe/London');

    expect(result).toHaveLength(1);
    expect(result[0]?.rawJson.hourly).toEqual([{
      forecastAtUtc: '2026-09-17T12:00:00.000Z',
      temperatureC: 21.4,
      precipitationProbabilityPct: 35,
      summary: 'light rain',
    }]);
  });
});
