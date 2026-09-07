import { describe, expect, it } from 'vitest';
import { currencyForCountry } from './countryCurrency.js';

describe('currencyForCountry', () => {
  it.each([
    ['South Africa', 'ZAR'],
    ['ZA', 'ZAR'],
    ['Nigeria', 'NGN'],
    ['United States', 'USD'],
    ['United Kingdom', 'GBP'],
  ])('maps %s to %s', (country, currency) => {
    expect(currencyForCountry(country)).toBe(currency);
  });

  it('returns null for an unknown country', () => {
    expect(currencyForCountry('Unknown')).toBeNull();
  });
});
