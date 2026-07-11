# Phase 4 Platform Stabilisation Report

Date: 2026-07-11

## Scope

This pass stabilised the Phase 4 work around Integration Manager, CCTV setup, Smart Building hardware setup, Enterprise Search, Hotel Brain, and related dashboard/navigation touchpoints. No new business module was added and no module UI was redesigned.

## Validated

- Prisma client generation completed successfully.
- API TypeScript validation completed successfully.
- Enterprise Search API route is mounted at `/api/enterprise-search`.
- Enterprise Search frontend routes are mounted at `/operations-center/search` and `/ai/hotel-brain`.
- Global header search can combine navigation targets with indexed Enterprise Search results.
- Dashboard shortcuts link to Enterprise Search, Hotel Brain, critical issues, and Integration Manager.
- CCTV setup routes include camera list/create/test, discovery, NVR test, playback metadata, and preview test.
- Integration Manager links into CCTV and Smart Building setup without exposing raw credential values.
- Security Center and Smart Building can surface the shared hardware setup panel in module context.

## Fixes Applied

- Restricted Enterprise Search index rebuild to Admin, Manager, or users with settings/users access.
- Added explicit `enterpriseSearch.permissionDenied` event publishing for restricted search attempts and denied rebuild attempts.
- Added audit records for restricted Enterprise Search results omitted from a user's response.
- Added `hotelBrain.summary.generated` event publishing after Hotel Brain answers.
- Added `hotelBrain.action.suggested` event publishing and audit records when Hotel Brain proposes actions.
- Kept Hotel Brain and Enterprise Search responses permission-filtered through indexed record access scopes.

## Current Simulated or Local-Only Areas

- CCTV network discovery uses `CCTV_DISCOVERY_SIMULATION=true` for demo data. Without it, the API returns a clear "Discovery service is not configured" state.
- CCTV NVR/channel discovery is simulated from submitted NVR metadata until a provider SDK or ONVIF gateway is installed.
- Camera preview testing validates configuration shape and protocol expectations; production RTSP playback still requires a media gateway.
- Saved Enterprise Search entries in the current UI are local browser state.
- Hotel Brain answers are deterministic over indexed platform data and do not execute sensitive actions directly.

## Real Hardware or API Requirements

- ONVIF discovery service or gateway for real IP camera discovery.
- RTSP-to-HLS/WebRTC media gateway for browser-safe camera streaming.
- Vendor integrations for Hikvision, Dahua, Axis, Verkada, Eagle Eye, Rhombus, TTLock, SALTO, BACnet, MQTT, and Modbus.
- Production credential vaulting or KMS-backed encryption for hardware and provider secrets.
- Real OpenAI configuration if generative AI responses are enabled beyond deterministic indexed-data answers.

## Remaining Risks

- The current permission model has no dedicated `operations_center` permission. Some Operations Center Phase 4 nav entries still reuse an existing permission and should be normalised in a future permission migration.
- Incremental Enterprise Search indexing is event-driven for the registered Event Bus groups, but full entity-level coverage depends on all modules publishing consistent events.
- Audit Engine failures are still handled by normal request error flow in some paths; future hardening should make audit failures observable without breaking non-sensitive reads.
- Full browser E2E verification with an authenticated production-like user was not completed in this pass.
- Bundle size warnings remain on the web build and should be handled with route-level code splitting later.

## Suggested Next Stabilisation Steps

1. Run `npm run check` from repo root in CI/Railway before deployment.
2. Apply database migrations with `npm --prefix packages/api run db:migrate:prod` in production.
3. Rebuild the Enterprise Search index after migration from an Admin or Manager session.
4. Add a dedicated `operations_center` permission across API, frontend access utilities, and user settings.
5. Add Playwright authenticated route smoke tests for the Phase 4 pages.
6. Wire a real CCTV/ONVIF media gateway before advertising live security-camera streaming as production-ready.
