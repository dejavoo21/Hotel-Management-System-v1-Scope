import axios from 'axios';

const SERPAPI_KEY = process.env.SERPAPI_KEY;

export type MarketRateRow = {
  name: string;
  rate: number;
  currency?: string | null;
  providerHotelRef?: string | null;
};

export async function fetchGoogleHotelsRates(params: {
  city: string;
  country?: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
}): Promise<MarketRateRow[]> {
  if (!SERPAPI_KEY) return [];

  const q = params.country
    ? `Hotels in ${params.city}, ${params.country}`
    : `Hotels in ${params.city}`;

  const res = await axios.get('https://serpapi.com/search.json', {
    params: {
      engine: 'google_hotels',
      q,
      check_in_date: params.checkInDate,
      check_out_date: params.checkOutDate,
      api_key: SERPAPI_KEY,
    },
    timeout: 15000,
  });

  const props = res.data?.properties || res.data?.hotel_results || [];
  const rows: MarketRateRow[] = [];

  for (const p of props) {
    const name = p?.name as string | undefined;
    const rate =
      p?.rate_per_night?.lowest ??
      p?.rate_per_night?.extracted_lowest ??
      p?.total_rate?.lowest ??
      p?.price?.extracted;

    if (!name || typeof rate !== 'number') continue;

    rows.push({
      name,
      rate,
      currency: p?.rate_per_night?.currency ?? p?.currency ?? null,
      providerHotelRef: p?.property_token ?? p?.id ?? null,
    });
  }

  return rows.slice(0, 12);
}

