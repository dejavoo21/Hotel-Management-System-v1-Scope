# Operations Center

## Purpose
Operations Center is the hotel's live operational intelligence hub. It combines:
- operational demand context (arrivals, departures, in-house count),
- forecast weather signals,
- advisory routing (department + priority),
- task creation (Ticket creation),
- and pricing guidance (snapshot-based revenue signal).

The goal is to turn raw signals into actionable operations tasks and pricing guidance.

## Key Screens
### /operations
Displays:
1. Ops status bar (high-level current context)
2. Signals grid (weather sync + signal health)
3. Advisories (recommended operational actions by department)
4. Assistant dock (future AI/chat integration point)
5. Pricing intelligence (snapshot-driven or fallback generated)

## Data Sources (Source of Truth)
### Weather Signals
- Sync endpoint: `POST /api/signals/weather/sync`
- Storage: `ExternalSignal` table (`external_signals`)
- Context provider: `getWeatherContextForHotel(hotelId)`
- Freshness: weather context exposes `syncedAtUtc`, `isFresh`, `stale`, `staleHours`

### Operational Context (Bookings)
Operational stats are derived from bookings:
- `arrivalsNext24h`
- `departuresNext24h`
- `inhouseNow`
- windows (`windowStartUtc`, `windowEndUtc`)

Core function:
- `getOpsContextForHotel(hotelId)`

## Main Backend Endpoint
### GET /api/operations/context
This endpoint returns a single payload for Operations Center UI.

It merges:
- weather context
- ops context (booking-derived)
- advisories (weather + ops logic)
- created-ticket linkage (which advisories have been converted into Tickets)
- pricingForecast (snapshot preferred)

## Advisories Logic
### getWeatherOpsActions(weather, ops)
Generates 3-5 operational advisories based on:
- rain risk
- storm/wind keywords
- temperature extremes
- weather freshness
- optional ops context (arrivals/departures/inhouse)

Each advisory produces:
- title
- reason
- priority
- optional category

### Routing to Department
Advisories are routed via:
- `routeOpsAdvisory({ title, reason, priority })`

Output determines:
- `department` (`FRONT_DESK`, `HOUSEKEEPING`, `MAINTENANCE`, `CONCIERGE`, `BILLING`, `MANAGEMENT`)
- normalized priority

## Ticket Creation (Task creation)
Each advisory can create a Ticket:
- Ticket requires Conversation (`conversationId` is unique and mandatory)
- Ticket metadata is stored in `Ticket.details` as JSON

Ticket.details schema (example):
- `source`: `WEATHER_ACTIONS`
- `actionId`
- `title`
- `reason`
- `weatherSyncedAtUtc`
- `aiGeneratedAtUtc`
- `createdByUserId`
- `createdAtUtc`

This allows:
- deduping (avoid creating duplicate tasks)
- audit trail
- traceability from advisory -> ticket

## Pricing Forecast (B-first, A fallback)
Operations Center shows pricing guidance based on:
- internal bookings pace and occupancy outlook
- arrivals vs departures
- optional weather modifier

### Snapshot strategy
Preferred mode (B):
- use latest stored `PricingSnapshot` row (per hotel)
- considered stale if older than ~90 minutes

Fallback mode (A):
- compute live using `generatePricingForecastSnapshot(hotelId)`
- optionally persist that computed snapshot

Returned in payload:
- `pricingForecast.mode`: `SNAPSHOT` | `LIVE_FALLBACK`
- `pricingForecast.summary`: `demandTrend`, `opportunityPct`, `confidence`, `reasons`
- `pricingForecast.calendar`: per-night guidance for next N days

## Future: Competitive Pricing
Competitive pricing is stored per-night:
- `CompetitorHotel`
- `CompetitorRateSnapshot` (`nightDateUtc`, `rate`)

Later the pricing engine will compute:
- marketMedian per date
- your position vs market
- factor that into adjustment suggestions

## Permissions
Operations Center is module-guarded:
- Frontend route: `<ModuleRoute requiredModule="bookings">`
- Backend: `requireModuleAccess('bookings')`

If users cannot see Ops Center, they likely do not have `bookings` module permission.

## File Locations
Backend:
- `/packages/api/src/services/weatherSignal.service.ts` (weather sync + persistence)
- `/packages/api/src/services/weatherContext.provider.ts` (weather context)
- `/packages/api/src/services/aiHooks.service.ts` (advisories generator pieces)
- `/packages/api/src/services/operationsContext.service.ts` (Operations Center payload)
- `/packages/api/src/services/pricingForecast.service.ts` (pricing calendar generator)
- `/packages/api/src/services/pricingSnapshot.job.ts` (hourly snapshot job)
- `/packages/api/src/routes/operations.routes.ts` (ops endpoint)
- `/packages/api/src/routes/aiHooks.routes.ts` (ticket creation / AI hooks)

Frontend:
- `/packages/web/src/pages/OperationsCenterPage.tsx`
- `/packages/web/src/services/operations.ts`
- `/packages/web/src/components/operations/*` (status bar, grid, advisories, assistant)
- Pricing UI: `/packages/web/src/components/operations/PricingSignalCard.tsx`

## Expected Behaviors
1. Weather sync updates:
- coordinates (via geocode if missing)
- `external_signals` rows
- Operations Center reflects updated weather context

2. Advisories:
- show 3-5 items
- routed to department
- "Create task" creates a Ticket and marks advisory as created

3. Pricing:
- shows the latest snapshot time
- shows demand trend and suggested adjustment %
- if snapshots are missing, fallback compute still shows guidance
