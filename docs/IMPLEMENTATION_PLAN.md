# Implementation Plan

## Scope
This document captures the implementation plan for hardening the Hotel Management web app for production readiness across authentication, security/RBAC, audit logging, integrations, calling/video, and UI/UX.

## Stack Detected
- Frontend: React + Vite (`packages/web`)
- Styling: Tailwind CSS + CSS variables theme tokens (`packages/web/src/index.css`, `packages/web/tailwind.config.js`)
- Backend: Express + Prisma (`packages/api`)
- Database: PostgreSQL via Prisma (`packages/api/prisma/schema.prisma`)

## Key Paths Mapped
- Auth/login + temp password flow:
  - `packages/web/src/pages/auth/LoginPage.tsx`
  - `packages/web/src/stores/authStore.ts`
  - `packages/web/src/services/auth.ts`
  - `packages/api/src/controllers/auth.controller.ts`
  - `packages/api/src/services/auth.service.ts`
- Users/admin + profile editing:
  - `packages/web/src/pages/UsersPage.tsx`
  - `packages/web/src/pages/SettingsPage.tsx`
  - `packages/api/src/controllers/user.controller.ts`
- Sidebar/nav (Financials dropdown):
  - `packages/web/src/components/layouts/DashboardLayout.tsx`
- Dashboard/KPI widgets:
  - `packages/web/src/pages/DashboardPage.tsx`
- Calls/dialer + video:
  - `packages/web/src/pages/CallsPage.tsx`
  - `packages/web/src/pages/MessagesPage.tsx`
  - `packages/web/src/components/calls/*`
  - `packages/api/src/controllers/call.controller.ts`
  - `packages/api/src/routes/call.routes.ts`
- Calendar:
  - `packages/web/src/pages/CalendarPage.tsx`
  - `packages/api/src/controllers/calendar.controller.ts`
- Inventory:
  - `packages/web/src/pages/InventoryPage.tsx`
  - `packages/api/src/controllers/inventory.controller.ts`
- Hotel settings details:
  - `packages/web/src/pages/SettingsPage.tsx`
  - `packages/api/src/controllers/hotel.controller.ts`
- Audit logging (current state):
  - `packages/web/src/utils/auditLog.ts` (frontend/local)
  - `packages/web/src/pages/SettingsPage.tsx` (Audit Trail tab UI)
  - `packages/api/src/controllers/user.controller.ts` (partial `activityLog` writes)

## Prioritized Task List

### Phase 1 — Critical Auth Fixes (Highest Priority)
1. Fix temp password login flow root cause
2. Enforce must-change-password flow (frontend + backend)
3. Add resilient auth guard/profile loading error states
4. Add required audit events:
   - `TEMP_PASSWORD_LOGIN`
   - `PASSWORD_CHANGE_REQUIRED`
   - `PASSWORD_CHANGED`

#### Acceptance Criteria
- User logging in with temporary password is not left in a broken/partial-auth state.
- User is redirected to password change screen immediately.
- Protected routes are blocked until password is changed.
- Backend APIs reject access (except allowed password-change endpoints) while `mustChangePassword=true`.
- Audit events are recorded for temp-password login and password change flow.

---

### Phase 2 — API Integration Layer + Generic Integrations Module
1. Introduce/normalize centralized API client (`src/lib/api` or repo-idiomatic equivalent)
2. Create backend integrations endpoints (safe stubs if external systems not ready)
3. Add frontend Integrations UI/page with status cards and connect/disconnect actions
4. Audit integration state changes

#### Acceptance Criteria
- Frontend calls integrations APIs through shared client (auth headers + error handling).
- Endpoints exist:
  - `GET /api/integrations`
  - `POST /api/integrations/:provider/connect`
  - `POST /api/integrations/:provider/disconnect`
  - `GET /api/integrations/:provider/status`
- No provider secrets are stored in frontend state/localStorage.
- Audit events logged for connect/disconnect/config changes.

---

### Phase 3 — Security, RBAC, Dashboard/KPI Restrictions
1. Restrict Financials to authorized roles only (sidebar + route + backend)
2. Restrict KPI/dashboard widget visibility by role
3. Step-up auth for profile edits (password confirmation or re-auth token)
4. Fix profile filter/edit state applying immediately (invalidate/refetch)
5. Audit events for access denials, updates, role changes, KPI visibility changes

#### Acceptance Criteria
- Unauthorized users do not see Financials menu.
- Unauthorized users cannot access Financials routes/API even by direct URL.
- KPI widgets render according to role policy.
- Profile changes require re-auth and are blocked server-side without it.
- UI updates reflect profile changes immediately after save.

---

### Phase 4 — Robust Audit Trail (Backend-Driven)
1. Define/extend audit event schema and persistence strategy
2. Add request correlation/user metadata capture
3. Log high-risk actions across auth, users, settings, inventory, integrations, calls/video
4. Build restricted Audit Log page with filters + pagination

#### Acceptance Criteria
- Audit records include: actor, role, action, target, timestamp, result, request metadata.
- High-risk actions are logged consistently.
- Audit log page is available only to Senior Manager/Admin (or configured equivalent).
- Filters and pagination function against backend data.

---

### Phase 5 — Calling/Video/Presence (High Priority subset first)
1. Dial pad UI cleanup (remove provider references, remove toggle/helper text)
2. Long-press `0` => `+` behavior (desktop/mobile, no double insert)
3. Provider-agnostic `/api/calls` interface stabilization
4. Video availability gating consistency + clear disabled reasons
5. Screen sharing start/stop + error handling
6. Presence heartbeat/timeout + logout clearing + backend status persistence

#### Acceptance Criteria
- Calls UI has a single “Call” action and no provider branding.
- Long-press `0` works consistently.
- Presence shows `Offline` when logged out or heartbeat timed out.
- Online users can set `Available/Busy/DND/Away`.
- Video controls and screen share behave consistently and fail gracefully.

---

### Phase 6 — UI/UX Improvements
1. Theme token polish + add required themes in Appearance settings
2. Bold heading typography consistency
3. Calendar category/status color system (readable contrast)
4. Sidebar Financials horizontal flyout + alignment fix
5. Move support pane right -> left (responsive-safe)

#### Acceptance Criteria
- Theme selection persists and applies across app.
- Headings are consistent across pages.
- Calendar uses distinct readable category/status colors.
- Financials flyout opens horizontally, keyboard accessible, and role-gated.
- Support pane placement does not overlap sidebar/content on common breakpoints.

---

### Phase 7 — Feature Additions (Implement as much as possible safely)
1. Hotel details: Square Footage field (UI + persistence + migration if needed)
2. Inventory “Select all” (filters/pagination semantics documented)
3. Guest request categories + WiFi code send flow + audit
4. Guest portal scaffolding/token flow (minimal viable)
5. Travel Booking + Airport Transfer module scaffolds (Beta/Coming soon if not complete)

#### Acceptance Criteria
- New fields/actions persist correctly and do not break existing workflows.
- Inventory select-all behavior is predictable and documented.
- Guest request and WiFi send actions are auditable.
- Travel/Airport modules appear in nav only when intended and are safely stubbed.

---

### Phase 8 — AI Integration Checklist (Documentation Only)
1. Create `/docs/AI_INTEGRATION_CHECKLIST.md`
2. Cover workflow, privacy/RBAC, auditability, evaluation/rollback
3. Include researcher-identification process only (no names)

#### Acceptance Criteria
- Checklist exists and is actionable.
- No fabricated names included.

## Risks and Assumptions
- **Role model gap**: Current Prisma `Role` enum may not include `SENIOR_MANAGER`; policy mapping may require enum migration or role-permission overlay.
- **Audit model limitations**: Existing `ActivityLog` schema may not store all required fields (`before/after`, `requestId`, `result`) and may need migration or parallel audit table.
- **Temp password UX flow**: Current system uses password reset flow for forced change; implementing a true “Change temp password” screen may require backend token/step-up endpoint changes.
- **Integrations module**: External provider APIs may not be available; stubs must be clearly marked and safely validated.
- **Calling/video provider readiness**: Frontend can be provider-agnostic, but production call/video behavior depends on backend provider implementation and env configuration.
- **Presence accuracy**: Reliable online/offline requires backend heartbeat timestamp + timeout logic; frontend-only indicators are insufficient.
- **Scope size**: Full Phase 1–7 may require multiple iterations to avoid regressions; priority execution will follow Phases 1–4 first.

## Local Run & Verification

### Run locally
1. Install dependencies (repo root):
   - `npm install`
2. Start backend:
   - `cd packages/api && npm run dev`
3. Start frontend:
   - `cd packages/web && npm run dev`
4. Ensure `.env` values are present for API, DB, auth, mail/SMS/video as applicable.

### Verify changes (high-level)
- Auth:
  - Login with temp-password user -> forced password change path
  - Confirm backend blocks app access until password changed
- RBAC:
  - Login with receptionist/housekeeping -> no Financials menu, no Financials route access
  - Login with manager/admin -> appropriate access
- Audit:
  - Trigger auth/user/settings/integration actions -> confirm audit entries appear
- Calls/Presence:
  - Dial pad `0` long-press inserts `+`
  - Presence changes while online; logout clears presence
  - Calls route uses `/api/calls` backend contract only
- UI:
  - Theme changes persist
  - Financials flyout alignment/interaction works
  - Calendar colors readable
- Features:
  - Inventory select-all honors current filtering behavior
  - Square footage persists on hotel settings

## Execution Order (Implementation)
1. Phase 1 (auth/temp password + guard hardening)
2. Phase 4 foundations (audit schema + logging utility/middleware), then Phase 2/3 features log into it
3. Phase 2 (integrations API + page)
4. Phase 3 (RBAC/KPI restrictions + step-up auth)
5. Phase 5 high-priority fixes (presence, dial pad cleanup, call contract consistency, video gating)
6. Phase 6 UI/UX improvements
7. Phase 7 feature additions (safe subsets first)
8. Phase 8 documentation + README updates
# Weather Signals Integration (OpenWeatherMap) — Scoped Plan

This section documents the implementation plan and acceptance criteria for the first backend integration step: weather signals stored in Postgres and aggregated by hotel-local date.

## Architecture Detection (Confirmed)

- Frontend: React + Vite (`packages/web`)
- Backend: Express API (`packages/api`)
- Database: PostgreSQL via Prisma (`packages/api/prisma/schema.prisma`)
- Hotel settings source-of-truth is persisted in the `Hotel` model and exposed via `/api/hotels/me`

## Prioritized Tasks

### 1. Database schema updates (Hotel + ExternalSignal)
Priority: Critical

Tasks:
- Add location fields to `Hotel`:
  - `address_line1`
  - `latitude`
  - `longitude`
  - `location_updated_at`
- Add `external_signals` table for normalized third-party signals
- Add uniqueness and lookup indexes for weather signal upsert/query

Acceptance Criteria:
- Prisma schema includes `ExternalSignal` model and `Hotel` relation
- Migration SQL exists and targets Postgres
- Can upsert one weather row per hotel/date/source/type

Risks / Assumptions:
- Existing hotel IDs in this repo are string/cuid, not UUID. `external_signals.hotel_id` must match existing `Hotel.id` type.

### 2. Backend OpenWeather connector service
Priority: Critical

Tasks:
- Add `OPENWEATHER_API_KEY` backend env support
- Geocode city/country if coordinates are missing
- Fetch forecast from OpenWeatherMap 5-day endpoint
- Convert forecast timestamps to hotel-local date via IANA timezone
- Aggregate 3-hour entries into daily metrics
- Upsert records into `external_signals`

Acceptance Criteria:
- Weather sync returns lat/lon and `daysStored`
- Aggregated metrics are persisted for local dates
- No OpenWeather calls from frontend

Risks / Assumptions:
- Node runtime supports `fetch` and `Intl` timezone formatting
- OpenWeather API key present in runtime env

### 3. Weather API endpoints (status/latest/sync)
Priority: Critical

Tasks:
- Implement:
  - `POST /api/signals/weather/sync`
  - `GET /api/signals/weather/status`
  - `GET /api/signals/weather/latest`
- Validate `hotelId` query (optional; fallback to authenticated user hotel)
- Enforce auth + manager/admin access

Acceptance Criteria:
- Endpoints mounted in Express app
- `sync` performs geocode/fetch/aggregate/upsert pipeline
- `status` and `latest` return expected shape

Risks / Assumptions:
- Existing auth middleware attaches `req.user.hotelId`

### 4. Audit events for weather sync
Priority: High

Tasks:
- Log:
  - `WEATHER_SYNC_START`
  - `WEATHER_SYNC_SUCCESS`
  - `WEATHER_SYNC_FAIL`
- Capture provider, hotelId, success/failure details

Acceptance Criteria:
- Weather sync requests generate activity logs when authenticated user is present

Risks / Assumptions:
- Current `ActivityLog` schema requires a `userId`; “system-only” events are not supported without schema change

### 5. Settings > Hotel Info admin weather card
Priority: High

Tasks:
- Add hotel fields in UI:
  - City (required for sync)
  - Country
  - Address / Address Line 1
- Show coordinates if geocoded
- Admin-only Weather Signals card:
  - last sync time
  - days available
  - coordinates
  - sync button
  - friendly missing-city/country/timezone message

Acceptance Criteria:
- Admin can save city/country/timezone and trigger sync
- Weather status loads from backend
- Sync button disabled when required fields are missing

Risks / Assumptions:
- Existing hotel update schema rejects empty strings (`min(1)`), so frontend should omit blank optional fields

### 6. Docs + manual testing
Priority: Medium

Tasks:
- Add `docs/WEATHER_SIGNALS.md`
- Document env vars, provider limits, timezone grouping, and test checklist

Acceptance Criteria:
- Team can set up and verify weather sync without reading code

## How To Run Locally (Weather Integration)

Backend (`packages/api`):
- Set `DATABASE_URL` (Postgres)
- Set `OPENWEATHER_API_KEY`
- Run Prisma migration / schema sync and generate client
- Start API server

Frontend (`packages/web`):
- Start the web app
- Log in as Admin/Manager
- Open `Settings > Hotel Info`
- Enter City, Country, Timezone and click `Sync Weather Now`

## Verification Checklist (Quick)

- [ ] Backend is not in demo mode (if production-like test is required)
- [ ] `OPENWEATHER_API_KEY` is present
- [ ] Hotel has `city`, `country`, `timezone`
- [ ] `/api/signals/weather/status` returns data
- [ ] `/api/signals/weather/sync` stores rows
- [ ] `/api/signals/weather/latest` returns ordered local dates
- [ ] Weather sync audit events appear in activity log

