# Weather Signals (OpenWeatherMap)

This document describes the first external signals integration step: weather forecast signals fetched server-side from OpenWeatherMap and stored in Postgres per hotel.

## Scope

- Backend-only OpenWeatherMap integration
- Timezone-correct aggregation using the hotel's IANA timezone
- Persist daily weather signals in Postgres (`external_signals`)
- Minimal admin UI in `Settings > Hotel Info` to view status and trigger sync

## Required Hotel Fields

Weather sync uses hotel settings as source-of-truth.

Required:
- `city`
- `country`
- `timezone` (IANA, e.g. `Africa/Lagos`, `America/New_York`)

Optional but stored/used when available:
- `address`
- `address_line1`
- `latitude`
- `longitude`

Notes:
- If `latitude`/`longitude` are missing, the backend geocodes using OpenWeatherMap geocoding API and stores the coordinates on the hotel record.

## Environment Variables

Required on backend:

- `OPENWEATHER_API_KEY`

Existing backend DB/auth variables still apply (`DATABASE_URL`, JWT/session vars, etc.).

## Database Changes

### `hotels` table additions

- `city` (already existed in this repo and is used by sync)
- `address_line1` (`TEXT NULL`)
- `latitude` (`DOUBLE PRECISION NULL`)
- `longitude` (`DOUBLE PRECISION NULL`)
- `location_updated_at` (`TIMESTAMP NULL`)

### `external_signals` table

Stores normalized external provider data (initial use: weather).

Key columns:
- `hotel_id`
- `type` = `WEATHER`
- `date_local` (hotel-local date)
- `timezone`
- `metrics_json` (aggregated daily metrics)
- `source` = `openweathermap`
- `fetched_at_utc`
- `raw_json` (optional summarized raw payload)

Uniqueness:
- `(hotel_id, type, date_local, source)`

## Provider Endpoints Used (Server Side)

### Geocoding (if coordinates missing)

`GET https://api.openweathermap.org/geo/1.0/direct`

Query:
- `q={city},{country}`
- `limit=1`
- `appid={OPENWEATHER_API_KEY}`

### Forecast (5-day / 3-hour)

`GET https://api.openweathermap.org/data/2.5/forecast`

Query:
- `lat`
- `lon`
- `units=metric`
- `appid={OPENWEATHER_API_KEY}`

## Timezone Conversion Logic

OpenWeather returns forecast entries in UTC timestamps (`dt`).

The backend converts each forecast timestamp into the hotel's local date using:
- `Intl.DateTimeFormat(..., { timeZone: hotel.timezone })`

Then it groups 3-hour forecast entries into daily buckets by `date_local`.

This avoids browser timezone issues and ensures all dashboards/services use the same hotel-local date.

## Daily Metrics Stored (`metrics_json`)

Each daily weather signal stores:

- `tempMin`
- `tempMax`
- `humidityAvg`
- `windSpeedAvg`
- `precipitationProbMax` (derived from `pop`, converted to percentage if present)
- `weatherMain` (most frequent main condition)
- `weatherDesc` (most frequent description)

## API Endpoints (Backend)

### `POST /api/signals/weather/sync?hotelId=...`

Validates hotel configuration, geocodes if needed, fetches forecast, aggregates, and upserts daily signals.

Response:

```json
{
  "hotelId": "hotel_123",
  "city": "Lagos",
  "country": "Nigeria",
  "timezone": "Africa/Lagos",
  "lat": 6.5244,
  "lon": 3.3792,
  "daysStored": 5,
  "fetchedAtUtc": "2026-02-23T12:00:00.000Z"
}
```

### `GET /api/signals/weather/status?hotelId=...`

Returns sync status summary:
- `lastSyncTime`
- `daysAvailable`
- `hasCity`
- `hasLatLon`
- `city`, `country`, `timezone`
- `lat`, `lon`

### `GET /api/signals/weather/latest?hotelId=...`

Returns daily weather signals ordered by `date_local ASC`.

## Audit Trail Events

Weather sync emits the following audit events (when an authenticated user triggers sync):

- `WEATHER_SYNC_START`
- `WEATHER_SYNC_SUCCESS`
- `WEATHER_SYNC_FAIL`

Tracked details include:
- provider (`openweathermap`)
- hotelId
- daysStored (success)
- fetchedAtUtc (success)
- error (failure)

## Provider Limitations (OpenWeather Free Forecast)

- Forecast endpoint provides approximately 5 days ahead in 3-hour intervals
- Not historical weather (this integration stores forward-looking forecast snapshots)
- API rate limits apply (avoid excessive manual sync spam)

## Manual Test Checklist

### Backend + DB

1. Ensure backend is running against Postgres (not demo SQLite)
2. Set `OPENWEATHER_API_KEY` in backend env
3. Apply Prisma migration / schema sync and regenerate client
4. Confirm `/health` returns `200`

### Hotel Settings

1. Open `Settings > Hotel Info`
2. Set/confirm:
   - City
   - Country
   - Timezone
3. Save changes

### Weather Sync

1. In `Weather Signals` card, click `Sync Weather Now`
2. Verify success response / toast (if UI shows)
3. Confirm status updates:
   - Last Sync time
   - Days Available > 0
   - Coordinates populated after first geocode (if previously empty)

### API Verification

1. `GET /api/signals/weather/status?hotelId=...`
2. `GET /api/signals/weather/latest?hotelId=...`
3. Confirm records are ordered by local date and contain aggregated metrics

### Timezone Correctness

1. Use a hotel with a non-UTC timezone (e.g. `America/New_York`, `Africa/Lagos`)
2. Confirm `date_local` grouping reflects the hotel timezone, not browser timezone

## Security Notes

- API key is backend-only (`OPENWEATHER_API_KEY`)
- Browser must never call OpenWeatherMap directly
- Hotel geolocation and external signals are stored server-side
