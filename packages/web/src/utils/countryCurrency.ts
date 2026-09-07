const COUNTRY_CURRENCY: Record<string, string> = {
  ZA: 'ZAR',
  'SOUTH AFRICA': 'ZAR',
  NG: 'NGN',
  NIGERIA: 'NGN',
  US: 'USD',
  USA: 'USD',
  'UNITED STATES': 'USD',
  'UNITED STATES OF AMERICA': 'USD',
  GB: 'GBP',
  UK: 'GBP',
  'UNITED KINGDOM': 'GBP',
  GH: 'GHS',
  GHANA: 'GHS',
  KE: 'KES',
  KENYA: 'KES',
  AE: 'AED',
  'UNITED ARAB EMIRATES': 'AED',
  SA: 'SAR',
  'SAUDI ARABIA': 'SAR',
  IN: 'INR',
  INDIA: 'INR',
  PK: 'PKR',
  PAKISTAN: 'PKR',
  AU: 'AUD',
  AUSTRALIA: 'AUD',
  CA: 'CAD',
  CANADA: 'CAD',
  JP: 'JPY',
  JAPAN: 'JPY',
  CN: 'CNY',
  CHINA: 'CNY',
};

export function currencyForCountry(country?: string | null): string | null {
  const key = String(country || '').trim().replace(/\s+/g, ' ').toUpperCase();
  return COUNTRY_CURRENCY[key] || null;
}
