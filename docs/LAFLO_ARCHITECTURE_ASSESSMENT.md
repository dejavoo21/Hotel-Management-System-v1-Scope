# LaFlo Hotel Platform Architecture Assessment

Date: 2026-06-27

Scope reviewed:

- Frontend: `packages/web`
- Backend: `packages/api`
- Shared workspace: `packages/shared`
- Database schema: `packages/api/prisma/schema.prisma`

No application code was changed for this assessment.

## Executive Summary

LaFlo is a functional monorepo with a React/Vite frontend, Express/Prisma backend, PostgreSQL database, Socket.IO realtime layer, and growing product modules for Operations Center, Security Center, Smart Building, and Maintenance Center.

The platform is strongest in:

- Hotel-scoped core data model
- Clear route/controller/service pattern in newer modules
- React Query-based server state
- Explicit module permissions
- Working Operations Center data flow
- Initial IoT ingestion foundation

The main architectural risks are:

- Large centralized frontend routing and layout files
- Duplicate permission logic across frontend, backend, navigation config, and utilities
- Large page components doing too much
- Single-process Socket.IO and background jobs
- No formal API contract/OpenAPI layer
- Early-stage IoT ingestion that is not yet production vendor-ready
- Database indexes and retention strategy need improvement before high-volume scale

## 1. Frontend Architecture

The frontend structure is workable but still page-centric rather than domain-centric. The current structure uses `src/pages`, `src/services`, `src/components`, and `src/stores`, which is clear for a smaller app. The platform has now grown enough that major areas should move toward feature-owned folders.

Good patterns:

- React Query is used for server state.
- Zustand is appropriate for auth, presence, and UI state.
- API calls are mostly isolated in `services/*`.
- Operations navigation is centralized in `components/layouts/navigation/navConfig.ts`.
- `OperationsCenterPage` reuses working components for AI, Revenue, Weather, Tasks, and Market Intelligence.

Architectural issues:

- `App.tsx` owns too much route and permission logic.
- `DashboardLayoutNew.tsx` is very large and mixes navigation, search, user menu, presence, notifications, and layout behavior.
- `SecurityCenterPage`, `SmartBuildingPage`, and `MaintenanceCenterPage` contain many embedded panels, forms, utility functions, and presentation concerns.
- Smart Building child routes still point to placeholder pages for Doors, Sensors, Energy, HVAC, and Assets.
- Permission logic is duplicated across route guards, navigation config, backend middleware, and access utilities.
- Legacy variants still exist, such as older layout and message page files, which increases confusion.

Recommended frontend direction:

```text
src/features/operations-center
src/features/security-center
src/features/smart-building
src/features/maintenance-center
src/features/reservations
src/features/messages
```

Each feature should own:

- routes
- page shells
- API service
- types
- hooks
- components
- empty states

## 2. Backend Architecture

The backend follows a conventional Express structure:

```text
src/routes
src/controllers
src/services
src/middleware
src/config
src/socket
```

Good patterns:

- Newer modules use route/controller/service layering.
- Zod validation is used for newer endpoint payloads.
- `requireModuleAccess()` provides clear module-level protection.
- New Smart Building, Security Center, and Maintenance services apply hotel-scoped queries.
- Global error handling exists.
- Socket.IO uses hotel rooms for scoped broadcasts.

Architectural issues:

- `app.ts` imports and mounts every route directly.
- Some older routes contain business logic directly in route files.
- Validation is not fully consistent across modules.
- `packages/api` does not have a real TypeScript production build; it runs through `tsx`.
- Background work such as IMAP polling runs inside the API process.
- Socket.IO uses in-memory rooms only and is not ready for multi-instance deployment.
- There is no OpenAPI or shared API contract layer.

Recommended backend direction:

Keep the monolith for now, but modularize internally:

```text
src/modules/operations
src/modules/security-center
src/modules/smart-building
src/modules/maintenance-center
src/modules/reservations
```

Each module should own:

- routes
- controller
- service
- validation schemas
- DTO types
- tests

## 3. Database Design

Confirmed major models include:

- Core: `Hotel`, `User`, `Room`, `RoomType`, `Floor`, `Guest`, `Booking`, `Invoice`, `Payment`, `InventoryItem`, `CalendarEvent`
- Messaging/support: `Conversation`, `Message`, `Ticket`, `SLAPolicy`, `Notification`
- Operations: `ExternalSignal`, `PricingSnapshot`, `CompetitorHotel`, `CompetitorRateSnapshot`
- Smart Building: `IoTDevice`, `CameraFeed`, `DoorAccessEvent`, `DoorStatus`, `SensorReading`, `SecurityAlert`
- Security Center: `Visitor`
- Maintenance Center: `MaintenanceWorkOrder`, `MaintenanceFault`, `MaintenanceRepair`, `PreventiveMaintenanceSchedule`, `AssetMaintenanceRecord`
- Audit/activity: `ActivityLog`

Good patterns:

- Most business entities include `hotelId`.
- Many entities have basic indexes.
- New IoT/Security/Maintenance models are tied to `Hotel`.
- Important external records use hotel-scoped unique constraints, such as `@@unique([hotelId, externalId])`.

Database risks:

- Many indexes are single-column rather than composite tenant indexes.
- High-volume tables will grow quickly: `SensorReading`, `DoorAccessEvent`, `SecurityAlert`, `Message`, and `ActivityLog`.
- IoT/event data needs retention and archival policies.
- Sensor readings may eventually need partitioning or a time-series storage strategy.
- Multi-hotel isolation is enforced in application queries, not at the database policy layer.
- Maintenance records are not yet deeply connected to full room, asset, and device lifecycle workflows.

Recommended indexes to review:

- `(hotelId, status)`
- `(hotelId, createdAt)`
- `(hotelId, occurredAt)`
- `(hotelId, status, occurredAt)`
- `(hotelId, deviceType, status)`
- `(hotelId, checkInDate, status)`
- `(hotelId, roomId, checkInDate)`

## 4. Product Architecture

The product modules are mostly separated correctly:

- Dashboard
- Operations Center
- Security Center
- Smart Building
- Maintenance Center
- Reservations
- Rooms
- Housekeeping
- Inventory
- Calendar
- Guests
- Messages
- Calls
- Financials
- Reviews
- Concierge

Operations Center is now correctly focused on:

- AI
- Revenue
- Weather
- Tasks
- Market Intelligence

Security Center is the correct conceptual home for:

- CCTV
- Access Logs
- Visitors
- Alerts

Smart Building is correctly focused on:

- Doors
- Sensors
- Energy
- HVAC
- Assets

Maintenance Center is correctly focused on:

- Work Orders
- Faults
- Repairs
- Preventive Maintenance
- Assets

Important product boundary:

Security Center should be an operational security interface. Smart Building should be the device and telemetry infrastructure. They can share data, but they should not become the same module.

## 5. AI Architecture

Current AI capabilities include:

- Operations Concierge / Operations AI
- Unified assistant service
- Operations context assembly
- Weather-driven advisories
- Pricing guidance
- Ticket creation from recommendations
- Transcript and email support

Good patterns:

- AI has access to structured operations context.
- There are fallbacks when OpenAI is not configured.
- Recommendations can create tickets/tasks.
- Operations AI is scoped around hotel-specific signals.

Risks:

- AI logic is split across multiple assistant routes/services.
- Prompt, tool, and action governance is not centralized enough.
- There is no visible AI evaluation suite.
- There is no formal approval workflow for AI-generated operational changes.
- Some context is passed as JSON blobs rather than through a controlled context builder.

Recommended AI platform layer:

```text
aiContextService
aiPolicyService
aiToolRegistry
aiAuditLog
aiEvaluationCases
```

Future AI opportunities:

- Revenue optimization assistant
- Staffing forecast
- Guest sentiment summarization
- Maintenance fault triage
- Smart Building anomaly detection
- Security alert summarization
- Night audit assistant
- Daily GM briefing
- Multi-hotel portfolio benchmarking

## 6. IoT Readiness

The platform is ready for early IoT testing, but not yet production-grade vendor integration.

Already present:

- `IoTDevice`
- `CameraFeed`
- `DoorAccessEvent`
- `DoorStatus`
- `SensorReading`
- `SecurityAlert`
- `POST /api/smart-building/events`

Supported event types:

- `DEVICE_STATUS`
- `CAMERA_STATUS`
- `DOOR_ACCESS`
- `DOOR_STATUS`
- `SENSOR_READING`
- `SECURITY_ALERT`

Socket events:

- `smart-building:update`
- `smart-building:alert`

Missing for production IoT:

- Vendor API key/HMAC authentication
- Device provisioning workflow
- Vendor registry
- Idempotency keys for event ingestion
- MQTT bridge
- BACnet gateway strategy
- ONVIF/NVR integration model
- Dead-letter queue
- Backpressure handling
- Event replay
- Device heartbeat monitoring
- Time-series retention
- Protocol-specific adapters
- Per-vendor payload mapping

Readiness by integration type:

- Smart Locks: foundation ready; needs vendor auth and lock-provider adapter.
- CCTV: data model ready; ONVIF/NVR stream management is not ready.
- Access Control: basic event model ready; credential/person mapping is needed.
- Sensors: ingestion ready; time-series strategy is needed.
- HVAC: model foundation exists; BACnet/Modbus integration is not ready.
- Energy: event model can accept readings; analytics layer is missing.
- MQTT: not implemented.
- BACnet: not implemented.
- ONVIF: not implemented.

## 7. Security

Good patterns:

- JWT authentication exists.
- Refresh tokens exist.
- 2FA exists.
- OTP login/reset paths exist.
- Trusted device support exists.
- Password change enforcement exists.
- Module permissions exist.
- Helmet and rate limiting are configured.
- Backend module checks exist for newer centers.
- Hotel-scoped Socket.IO rooms exist.

Risks:

- Frontend stores access and refresh tokens in persisted Zustand/localStorage.
- ADMIN backend bypass is intentional, but should be audited carefully.
- Permission rules are duplicated across frontend and backend.
- Some assistant/status routes are authenticated but not always module-protected at the top level.
- Multi-hotel isolation is application-enforced, not database-enforced.
- Audit coverage is not uniform for every sensitive action.
- IoT ingestion currently uses user auth only, not vendor auth.
- CORS is custom-coded and should be reviewed for production exactness.

Recommended security work:

- Keep backend as the source of truth for authorization.
- Add authorization integration tests per module.
- Add audit coverage for login, permission changes, exports, AI-created tasks, alert resolution, visitor checkout, and IoT ingestion.
- Consider httpOnly secure cookies or hardened token storage if the product threat model requires it.
- Add HMAC/API-key authentication for machine/vendor endpoints.

## 8. Scalability

### 10 Hotels

The current architecture should handle this with proper Railway/Postgres sizing.

### 100 Hotels

Needed improvements:

- Composite indexes
- Background workers
- Redis-backed Socket.IO
- Query pagination
- Monitoring and alerting
- API contract tests
- Stricter module boundaries

### 1000 Hotels

The current architecture will need significant evolution:

- Event queue for IoT and email ingestion
- Separate worker processes
- Redis Socket.IO adapter
- Database partitioning or archival
- Read replicas
- Cached dashboard aggregates
- Tenant-aware observability
- API versioning
- Dedicated ingestion service for IoT/vendor traffic

Likely bottlenecks:

- Sensor/event table growth
- Message/conversation volume
- Dashboard aggregate queries
- Socket.IO memory rooms
- IMAP polling in API process
- AI latency and cost
- Central monolith deployment if background work remains inside the API process

## 9. Technical Debt

Duplicated or overlapping areas:

- `DashboardLayout.tsx` and `DashboardLayoutNew.tsx`
- `MessagesPage.tsx` and `MessagesPageRedesigned.tsx`
- Multiple assistant/operations assistant route paths
- Permission checks in several places
- Placeholder and real module routes mixed together
- Large page files with internal components/forms

Over-engineering risks:

- Some newly added center models may be ahead of current UI workflows.
- Maintenance has many models before the full lifecycle UX is defined.
- Security and Smart Building share data, but the boundary is not yet formally modeled.

Missing abstractions:

- Feature module structure
- Shared typed API contracts
- Query key factories
- Central permission registry
- Central event bus abstraction
- AI tool/action registry
- IoT vendor adapter interface
- Audit logging service

Should be separated:

- Socket/event broadcast logic from service logic
- Background jobs from API server
- Assistant prompt/tool orchestration from routes
- Large layout/menu/search/notification components

Should be unified:

- Assistant route variants
- Operations AI and unified assistant entrypoints
- Permission definitions across frontend/backend
- Navigation route metadata and route guard metadata

## 10. Recommended Roadmap

### 1. Stabilize Permissions and Tenant Isolation

- Create one canonical permission registry.
- Use it in frontend navigation, frontend route guards, and backend middleware.
- Add tests proving users cannot access another hotel's records.

### 2. Refactor Frontend Module Boundaries

- Convert Operations, Security, Smart Building, and Maintenance into feature folders.
- Split `DashboardLayoutNew.tsx`.
- Split large center pages into panels, hooks, and reusable components.

### 3. Finish Operations Center Cleanly

- Keep current working data.
- Make each sub-area its own page component while sharing the same context hook.
- Add clear empty states for missing market, pricing, or weather data.

### 4. Productionize Security Center

- Complete visitor workflow.
- Add CCTV status workflow.
- Add alert lifecycle.
- Add security audit trail.
- Add realtime updates from Smart Building alerts.

### 5. Productionize Smart Building

- Build real child pages for Doors, Sensors, Energy, HVAC, and Assets.
- Add vendor authentication.
- Add MQTT bridge/test harness.
- Add idempotency and event retention.

### 6. Productionize Maintenance Center

- Link faults to rooms, assets, and devices.
- Convert security/sensor alerts into maintenance faults/work orders.
- Add assignees, SLA, parts, cost tracking, and completion evidence.

### 7. Harden AI

- Add AI audit logs.
- Add approved action workflow.
- Add evaluation cases.
- Add context governance.
- Add role/permission-aware tools.

### 8. Prepare for 100+ Hotels

- Add Redis Socket.IO adapter.
- Add worker process for jobs.
- Add composite indexes.
- Add pagination everywhere.
- Add observability dashboard.
- Enforce API build/typecheck.

### 9. Prepare for 1000 Hotels

- Add event bus.
- Add dedicated IoT ingestion service.
- Partition event storage.
- Add read replicas.
- Add tenant-aware rate limits.
- Build vendor integration marketplace.

## Bottom Line

The platform has a strong foundation and the current module architecture is directionally correct. It is ready for continued product buildout at a pilot or small-deployment level.

Before scaling or adding many new features, the next architectural priority should be consolidation: central permissions, feature-folder frontend structure, backend module boundaries, stronger hotel isolation tests, and production-grade realtime/job infrastructure.
