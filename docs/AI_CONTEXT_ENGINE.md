# AI Context Engine

The AI Context Engine is the single backend service responsible for collecting structured hotel context before an AI request is generated.

## Architecture

```text
Module
  -> AI Context Engine
  -> AI Service
  -> Recommendation / Response
```

Modules should not call OpenAI directly. Modules request AI output through the AI service, which loads or receives structured context from the context engine.

## Files

```text
packages/api/src/ai/context/aiContext.types.ts
packages/api/src/ai/context/aiContext.service.ts
packages/api/src/ai/context/index.ts
packages/api/src/ai/ai.service.ts
```

Existing assistant paths now route through this boundary:

```text
packages/api/src/services/ai/opsAssistant.service.ts
packages/api/src/services/assistant/unifiedAssistant.service.ts
packages/api/src/routes/operations.routes.ts
packages/api/src/services/ai/tools.ts
```

## Context Schema

The context engine returns one structured object:

```ts
type AIHotelContext = {
  metadata: {
    generatedAt: string;
    hotelId: string;
    contextVersion: 'hotel-brain-v1';
    sectionsIncluded: AIContextSection[];
    warnings: string[];
    dataFreshness: Record<string, string>;
    range: { from: string; to: string };
  };
  hotelProfile?: object;
  occupancy?: object;
  revenue?: object;
  weather?: object;
  bookings?: object;
  guests?: object;
  housekeeping?: object;
  maintenance?: object;
  security?: object;
  smartBuilding?: object;
  tasks?: object;
  incidents?: object;
  reviews?: object;
  concierge?: object;
  messages?: object;
  calls?: object;
  financialSummary?: object;
};
```

Supported scopes:

```text
hotelProfile
weather
occupancy
revenue
bookings
guests
housekeeping
maintenance
security
smartBuilding
tasks
incidents
reviews
concierge
messages
calls
financialSummary
```

Public service methods:

```ts
buildHotelContext(hotelId, options)
buildOperationalContext(hotelId, options)
buildGuestContext(hotelId, guestId, options)
buildRoomContext(hotelId, roomId, options)
buildIncidentContext(hotelId, incidentId, options)
```

Test endpoint:

```text
GET /api/ai/context/hotel
```

## Safety Boundaries

- Queries are hotel-scoped.
- Samples are bounded.
- The context object is summarized rather than dumping entire tables.
- Call telemetry is marked unavailable until persisted call events exist.

## Future Extension Points

- Add provider-specific adapters inside `packages/api/src/ai/`.
- Add context redaction policies for PII-sensitive use cases.
- Add cache support for low-volatility scopes such as rooms, assets, and pricing snapshots.
- Add vector/RAG context as a separate scope after document storage is formalized.
- Add Event Bus triggers so major module changes can invalidate cached AI context.
