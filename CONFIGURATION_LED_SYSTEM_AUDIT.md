# LaFlo Enterprise Hotel Operations Platform

## Configuration-led system audit

**Audit date:** 26 July 2026
**Method:** Static inspection of the current frontend and backend configuration, routes, guards, services, Prisma schema, seed files, integration registries, environment examples, and dashboard data sources.
**Purpose:** Establish what is actually registered and implemented before producing a targeted QA plan. This is not a generic QA execution report.

### Primary sources inspected

- `packages/web/src/App.tsx`
- `packages/web/src/components/layouts/navigation/navConfig.ts`
- `packages/web/src/components/layouts/DashboardLayoutNew.tsx`
- `packages/web/src/utils/userAccess.ts`
- `packages/web/src/components/dashboard/DashboardCommandCenter.tsx`
- `packages/web/src/data/dashboardDemoData.ts`
- `packages/web/src/utils/auditLog.ts`
- `packages/api/src/app.ts`
- `packages/api/src/config.ts`
- `packages/api/src/middleware/auth.middleware.ts`
- `packages/api/src/routes/*.ts`
- `packages/api/src/services/*.ts`
- `packages/api/src/modules/**`
- `packages/api/prisma/schema.prisma`
- `packages/api/prisma/seed.ts`
- `.env.example` and package environment examples

---

## 1. Configuration-led audit summary

LaFlo is a broad, substantially implemented application rather than a shell. The frontend registers all requested primary module pages, and the API registers real database-backed routes for most hotel operations. The strongest areas are bookings, guests, rooms, inventory, calendar, messaging, maintenance, incidents, security, smart-building telemetry, notifications, and the authentication/access-request lifecycle.

The application is not yet ready to use its configuration as a reliable enterprise control plane:

1. **Navigation is incomplete.** Bookings, Rooms, Housekeeping, Inventory, and Calendar have protected routes and APIs but no current sidebar item.
2. **RBAC has two competing sources of truth.** `userAccess.ts` defines role defaults, but `ModuleRoute` and navigation use explicit `modulePermissions`. Role defaults therefore do not govern actual access. An empty server permission set may also fall back to local storage.
3. **The role model is too small for the product.** Only `ADMIN`, `MANAGER`, `RECEPTIONIST`, and `HOUSEKEEPING` exist. Finance, Security, Maintenance, General Manager, and Auditor are represented only indirectly through module permissions. Dashboard code contains checks for role names that cannot exist in the Prisma enum.
4. **Dashboard authorization is unsafe.** Revenue and ADR are rendered for any user with dashboard access. Several shortcut cards link to modules the viewer may not be allowed to open.
5. **Demo disclosure is inconsistent.** Revenue charts, booking-channel graphics, tasks, and parts of guest review data are hardcoded demo data. The page-level demo label is not guaranteed to appear when only an individual widget falls back.
6. **Calls are a placeholder.** The call API generates a queued identifier but has no persisted call-log model or provider lifecycle.
7. **Reports are computed, not managed.** Report endpoints are real, but there is no saved-report, scheduled-report, export-history, or report-definition persistence model.
8. **Integration state is fragmented.** Hardware integrations are persisted, while many marketplace provider statuses and connect/disconnect actions are environment-driven or in memory.
9. **AI permission enforcement is inconsistent.** Enterprise Search filters indexed records by `accessScope`, but several AI recommendation/action endpoints require authentication without module or action-level authorization.
10. **Environment documentation is inconsistent.** The API defaults to port `4010`, while examples use `3001`; the web example base URL omits `/api`. Some production-sensitive integration variables are undocumented.
11. **Global call controls are correctly scoped now.** The app shell does not render the collaboration toolbar. Call controls live inside the active Calls session; Messages and Calls are excluded from the global chatbot overlay.

**Overall configuration status:** **Partial / remediation required before targeted E2E testing.**

---

## 2. Actual module inventory

| Module | Navigation | Frontend route/page | Backend support | Protection | Data status | Assessment |
|---|---|---|---|---|---|---|
| Dashboard | Yes | `/`, `DashboardPage` | `/api/dashboard` plus cross-module summaries | `dashboard` | Mixed live and demo fallback | Partial |
| Enterprise Command Center | Yes | `/enterprise-command-center` | Dashboard/operations APIs | `dashboard` | Mixed | Partial |
| Bookings / Reservations | **No** | `/bookings`, `/bookings/:id`; `/reservations` redirects | `/api/bookings` | `bookings`; action roles on API | Real Prisma data | Built, navigation gap |
| Guests | Yes | `/guests` | `/api/guests` | `guests`; receptionist/manager API actions | Real Prisma data | Built |
| Rooms | **No** | `/rooms` | `/api/rooms`, `/api/room-types`, `/api/floors` | `rooms` | Real Prisma data | Built, navigation gap |
| Housekeeping | **No** | `/housekeeping` | `/api/housekeeping` | `housekeeping` | Real room/log data; no dedicated task model | Partial, navigation gap |
| Inventory | **No** | `/inventory` | `/api/inventory`, `/api/purchase-orders` | `inventory` | Real Prisma data | Built, navigation gap |
| Calendar | **No** | `/calendar` | `/api/calendar` | `calendar` | Real Prisma data | Built, navigation gap |
| Financials | Yes | `/financials`, `/invoices`, `/expenses` | invoices, payments, reports | `financials`; some API actions require manager/receptionist | Real with presentation gaps | Partial |
| Reports | Yes | `/reports` | `/api/reports` | Frontend `dashboard`; backend `financials` + manager | Real computed reports | **Permission mismatch** |
| Reviews | Yes, manager/admin role filter | `/reviews` | `/api/reviews` | `reviews`; nav also limits roles | Real Prisma data | Built, nav/route mismatch |
| Concierge | Yes, manager/admin role filter | `/concierge` | `/api/concierge` | `concierge`; nav also limits roles | Real Prisma data | Built, nav/route mismatch |
| Messages | Yes | `/messages` | `/api/messages`, tickets, presence, transcripts | `messages` | Real persisted conversations/messages | Built |
| Calls | Yes | `/calls` | `/api/calls`, voice token functions | `messages` | Provider/DB lifecycle placeholder | Partial |
| User Management | Yes | `/users` | `/api/users` | `users`; API manager/admin actions | Real Prisma users | Built |
| Operations Center | Yes | `/operations-center` and child routes | `/api/operations`, market, jobs, tickets, assistant | Mainly `bookings`; revenue uses `financials` | Mixed real/rule-based | Partial |
| Maintenance Center | Yes | `/maintenance-center/:tab` | `/api/maintenance-center` | `maintenance_center` | Real Prisma data | Built core |
| Incident Center | Yes | `/incidents` | `/api/incidents` | `incident_management` | Real Prisma data | Built core |
| Security Center | Yes | `/security-center/:tab` | `/api/security-center`, CCTV/hardware APIs | `security_center` | Real persisted events plus integrations | Partial adapters |
| Smart Building | Yes | `/operations/smart-building/*` | `/api/smart-building`, hardware APIs | `smart_building` | Real persisted devices/readings; adapters partial | Partial |
| Integration Manager | Settings tab, not standalone nav | `/settings` | `/api/integration-manager`, `/api/integrations`, hardware/CCTV | `settings` in UI; APIs accept several module permissions | Mixed persistent/env/in-memory | Partial |
| Enterprise Search | Nested under Operations | `/operations-center/search` | `/api/enterprise-search` | Frontend `bookings`; backend authenticated + record filtering | Real SearchIndex; freshness partial | Partial |
| Hotel Brain | Nested under Operations | `/ai/hotel-brain` | Enterprise Search/AI context services | Frontend `bookings`; backend record filtering | Indexed/rule-based; optional AI provider elsewhere | Partial |
| AI modules | Operations and dashboard surfaces | Several embedded/child surfaces | `/api/ai/*`, `/api/assistant`, operations assistant | Inconsistent; some authenticate-only | Rule/OpenAI hybrid | Partial/risky |

---

## 3. Route and navigation audit

| Module | Navigation item | Route | Component | Permission required | Status | Issue |
|---|---|---|---|---|---|---|
| Dashboard | Overview | `/` | `DashboardPage` | `dashboard` | Valid | Mixed live/demo widgets |
| Command Center | Command Center | `/enterprise-command-center` | `EnterpriseCommandCenterPage` | `dashboard` | Valid | Overlaps dashboard/operations concepts |
| Bookings | Missing | `/bookings`, `/bookings/:id` | `BookingsPage`, `BookingDetailPage` | `bookings` | Route valid | Primary module inaccessible from sidebar |
| Reservations alias | Missing | `/reservations` → `/bookings` | Redirect | Protected after redirect | Valid alias | Naming differs across UI/config |
| Guests | Guests | `/guests` | `GuestsPage` | `guests` | Valid | None material |
| Rooms | Missing | `/rooms` | `RoomsPage` | `rooms` | Route valid | Primary module inaccessible from sidebar |
| Housekeeping | Missing | `/housekeeping` | `HousekeepingPage` | `housekeeping` | Route valid | Primary module inaccessible from sidebar |
| Inventory | Missing | `/inventory` | `InventoryPage` | `inventory` | Route valid | Primary module inaccessible from sidebar |
| Calendar | Missing | `/calendar` | `CalendarPage` | `calendar` | Route valid | Primary module inaccessible from sidebar |
| Messages | Messages | `/messages` | `MessagesPageRedesigned` | `messages` | Valid | Correctly excludes session toolbar/global chatbot |
| Calls | Calls | `/calls` | `CallsPage` | `messages` | Valid | Calls lacks its own permission; provider lifecycle incomplete |
| Operations Center | Operations Center + children | `/operations-center/*` | `OperationsCenterPage` | Mostly `bookings`; revenue `financials` | Valid | One component serves multiple child routes; broad bookings permission |
| Enterprise Search | Enterprise Search | `/operations-center/search` | `EnterpriseSearchPage` | `bookings` | Valid | Search should have a dedicated permission or multi-module entry policy |
| Hotel Brain | Hotel Brain | `/ai/hotel-brain` | `HotelBrainPage` | `bookings` | Valid | Dedicated AI permission absent |
| Incident Center | Incident Center | `/incidents` | `IncidentCenterPage` | `incident_management` | Valid | Query-string child nav rather than route config |
| Security Center | Security Center + children | `/security-center/:tab` | `SecurityCenterPage` | `security_center` | Valid | Legacy redirects are valid |
| Smart Building | Smart Building + children | `/operations/smart-building/*` | `SmartBuildingPage` | `smart_building` | Valid | Canonical root differs from display name |
| Maintenance Center | Maintenance Center + children | `/maintenance-center/:tab` | `MaintenanceCenterPage` | `maintenance_center` | Valid | Legacy redirects only cover three old child paths |
| Financials | Financials | `/financials` | `FinancialsPage` | `financials` | Valid | Dashboard links do not consistently target this route |
| Reports | Reports | `/reports` | `ReportsPage` | **`dashboard`** | Route valid | API requires manager + financials; frontend guard is incorrect |
| Invoicing | Invoicing | `/invoices` | `InvoicesPage` | `financials` | Valid | None material |
| Expenses | Expenses | `/expenses` | `ExpensesPage` | `financials` | Valid | Financial-record model is not generalized |
| Reviews | Reviews | `/reviews` | `ReviewsPage` | `reviews`; nav ADMIN/MANAGER | Valid | Explicitly permitted receptionist can open direct URL but cannot see nav |
| Concierge | Concierge | `/concierge` | `ConciergePage` | `concierge`; nav ADMIN/MANAGER | Valid | Same nav/route mismatch |
| Users | Users | `/users` | `UsersPage` | `users` | Valid | API actions are more restrictive than route |
| Settings / Integration Manager | Settings | `/settings` | `SettingsPage` | `settings` | Valid | Integration Manager has no independent route/permission |

### Route-control findings

- All configured sidebar targets resolve to valid routes or valid redirects.
- The wildcard route redirects to `/`; `ModuleRoute` then evaluates dashboard access.
- `MODULE_ROUTE_PRIORITY` does not include several valid modules, including financials, reviews, concierge, users, and settings. A signed-in user whose only permission is one of those modules can be sent to `/not-authorized` by fallback navigation.
- Authentication and `mustChangePassword` redirects are centralized in `ProtectedRoute`.
- Admin and settings pages are module-protected, with action-level admin checks on much of the users API.
- `DashboardLayoutNew` does **not** render `CollaborationToolbar`. The active call controls are rendered within `CallsPage` only when a call room/session exists.
- A global `AppChatbot` remains on ordinary pages, but is explicitly excluded on Calls, Messages, and Operations routes. This is a separate assistant surface, not the call/chat session toolbar.

---

## 4. Backend/API audit

| API area | Route file / registration | Service or controller layer | Database model(s) | Status | Issue |
|---|---|---|---|---|---|
| Auth | `auth.routes.ts` | `auth.service.ts`, auth controllers | User, RefreshToken, PasswordResetToken, EmailOtp | Built | Production default-secret validation needs hardening |
| Access requests | `accessRequest.routes.ts` | Access-request controller | AccessRequest, AccessRequestReply | Built | Admin workflow exists |
| Users | `user.routes.ts` | User controller | User | Built | Role is enum, permissions are string array |
| Bookings | `booking.routes.ts` | `booking.service.ts` | Booking, Charge, Payment | Built | Good action-role separation |
| Guests | `guest.routes.ts` | Guest controller, `guestJourney.service.ts` | Guest, GuestJourney, GuestJourneyEvent | Built | Core flow present |
| Rooms | room, room-type, floor routes | `room.service.ts`, `floor.service.ts` | Room, RoomType, Floor | Built | Core flow present |
| Housekeeping | `housekeeping.routes.ts` | Housekeeping controller | HousekeepingLog, Room | Partial | No dedicated housekeeping task/assignment entity |
| Inventory | inventory and purchase-order routes | Controllers | InventoryItem, PurchaseOrder, PurchaseOrderItem | Built core | Procurement depth is limited |
| Calendar | `calendar.routes.ts` | Controller | CalendarEvent | Built core | Basic event model |
| Financials | invoice, payment, report routes | Controllers/services | Charge, Payment, Invoice | Built core | No generalized ledger/expense model |
| Reports | `report.routes.ts` | Report controller | Computed from Booking/Payment/etc. | Partial | No saved/scheduled report or export-history model |
| Reviews | `review.routes.ts` | Review controller | Review | Built core | Basic workflow |
| Concierge | `concierge.routes.ts` | Concierge controller | ConciergeRequest | Built core | Basic workflow |
| Messages | message, ticket, presence, transcript routes | Message controllers; ticket/transcript/presence services | Conversation, Message, Ticket | Built | Transcript route uses `bookings`, not `messages`, permission |
| Calls | `call.routes.ts` | Call controller | **None** | Placeholder | Generated queued call only; provider and lifecycle are TODO |
| Notifications | `notification.routes.ts` | `notification.service.ts` | Notification | Built | Core persistence present |
| Audit logs | Audit engine/event writes; no dedicated public route | Platform audit code | ActivityLog | Backend-only/partial | Settings UI uses a separate local-storage demo audit log |
| Operations Center | operations, market, job, ticket, assistant routes | Operations context, weather, pricing and ticket services | Tickets, external signals, snapshots, recommendations | Partial | Mixture of real, rules, jobs and optional providers |
| Maintenance Center | `maintenanceCenter.routes.ts` | `maintenanceCenter.service.ts` | MaintenanceIssue, WorkOrder, Fault, Repair, Preventive, Asset | Built core | Module-level mutation permission is broad |
| Incident Center | registered `/api/incidents` | Incident module routes/controllers/services | Incident, IncidentTask, Comment, Attachment, SLAPolicy | Built core | Module-level mutation permission is broad |
| Security Center | `securityCenter.routes.ts` | `securityCenter.service.ts` | DoorAccessEvent, DoorStatus, SecurityAlert, Visitor, CameraFeed | Built core | Vendor adapters partial |
| Smart Building | `smartBuilding.routes.ts` | Smart-building services | IoTDevice, SensorReading, DoorStatus | Built core | External ingestion still needs vendor/HMAC authentication |
| Integration Manager | manager, marketplace, hardware routes | Integration manager/hub/hardware services | HardwareIntegration, IntegrationCredentialReference | Partial | Marketplace state is environment/in-memory; not one persisted registry |
| CCTV | `cctv.routes.ts` | Camera/hardware services | CameraFeed, HardwareIntegration | Partial | Discovery simulation and reference-only NVR channels |
| Enterprise Search | `enterpriseSearch.routes.ts` | Enterprise search module/service | SearchIndex | Real but partial | Authenticate-only route; record filtering is good, incremental freshness is incomplete |
| Hotel Brain | Enterprise Search endpoint/module | Search + Hotel Brain logic | SearchIndex, AIRecommendation | Partial | Indexed/rule-based response; no dedicated conversation/answer persistence |
| AI | Multiple `/api/ai/*`, assistant routes | AI hooks, briefing, governance, copilot, assistant services | AIRecommendation plus operational entities | Partial/risky | Several mutation/governance endpoints are authenticate-only |

---

## 5. Data model audit

| Entity | Model exists | Frontend use | Backend use | Status | Gap |
|---|---|---|---|---|---|
| User | Yes: `User` | Auth/users/profile | Auth/RBAC/users | Built | None material |
| Role / permissions | Partial: `Role` enum + `modulePermissions[]` | Route/nav checks | Middleware checks | Partial | No Role/Permission/Action model or policy records |
| Access request | Yes | Request access/admin flow | Approval/rejection/setup | Built | None material |
| Guest | Yes | Guests/bookings | Guest APIs/journey | Built | None material |
| Booking / reservation | Yes: `Booking` | Booking pages/dashboard | Booking service | Built | Terminology varies |
| Room | Yes: Room/RoomType/Floor | Rooms/dashboard/housekeeping | Room APIs | Built | None material |
| Housekeeping task | **No dedicated model** | Housekeeping UI | Logs and room state | Partial | Use/extend Ticket or add proper assignment/task entity |
| Maintenance task | Yes, multiple models | Maintenance Center | Maintenance service | Built core | Model family may be more complex than needed |
| Incident | Yes, with child models | Incident Center | Incident module | Built core | None material |
| Inventory item | Yes | Inventory | Inventory API | Built core | None material |
| Calendar event | Yes | Calendar | Calendar API | Built core | None material |
| Financial record | Partial | Financials/invoices | Charge, Payment, Invoice | Partial | No ledger, expense, refund, adjustment entity |
| Report | **No persisted report model** | Report catalogue/results | Computed endpoints | Partial | No save/schedule/share/export history |
| Review | Yes | Reviews/dashboard | Review API | Built core | None material |
| Concierge request | Yes | Concierge | Concierge API | Built core | None material |
| Message | Yes | Messages | Messaging/transcripts | Built | None material |
| Call log | **No** | Calls UI | Placeholder API | Missing backend | Cannot persist call state/history |
| Integration | Partial | Settings/Integration Manager | HardwareIntegration + runtime registry | Partial | No single generic persisted provider/config model |
| Credential reference | Yes | Masked references | IntegrationCredentialReference + encrypted secret | Built core | Secret-key fallback must be hardened |
| CCTV camera | Yes by function: `CameraFeed` | Security/CCTV UI | CCTV services | Partial | Adapters/streams incomplete |
| Smart-building device | Yes: `IoTDevice` | Smart Building | Device services | Built core | Adapters partial |
| Sensor reading | Yes | Smart Building | Telemetry service | Built core | Ingestion auth hardening needed |
| Notification | Yes | Notification UI | Notification service | Built | None material |
| Audit/activity log | Yes: `ActivityLog` | Not consistently used | Audit engine | Partial | Frontend Settings still uses local demo audit source |
| Search index | Yes: `SearchIndex` | Enterprise Search/Hotel Brain | Search service | Partial | Event handler does not fully maintain fresh records |
| Hotel Brain / AI recommendation | `AIRecommendation`; no Brain conversation model | AI surfaces | AI services | Partial | No durable answer/thread/citation lifecycle |

---

## 6. Permission/RBAC audit

### Actual roles

The Prisma and frontend role types contain only:

- `ADMIN`
- `MANAGER`
- `RECEPTIONIST`
- `HOUSEKEEPING`

There are no distinct Finance, Security, Maintenance, General Manager, or Auditor roles.

| Role | Effective allowed modules | Restricted modules | Action behavior | Risks / issues |
|---|---|---|---|---|
| ADMIN | All modules through explicit superuser bypass | None | Admin/manager/receptionist actions | High privilege is intentional; audit and credential controls still required |
| MANAGER | Only server-supplied/local explicit permissions in actual route/nav guards | Any module not explicitly assigned | Manager and receptionist API actions where permitted | Documented frontend role defaults are not applied; access varies by stored array |
| RECEPTIONIST | Only explicit permissions | Any module not explicitly assigned | Receptionist API actions where permitted | Frontend defaults include financials, but report API requires manager; potential UI/API 403 mismatch |
| HOUSEKEEPING | Only explicit permissions | Any module not explicitly assigned | Module-level actions only | No dedicated task/action policy; default permission set is dormant |

### Module and action findings

- `userAccess.ts` defines role-default module lists, but both `ModuleRoute` and sidebar filtering use explicit permissions. The defaults are descriptive, not authoritative.
- When the server returns an empty permissions array, frontend resolution can fall back to local-storage permissions. Server denial should be authoritative.
- Frontend protection is module-level. Create/read/update/delete/approve/export/configure policies are not centrally modeled.
- Backend action roles are strongest in Bookings, Guests, Users, Invoices and Reports.
- Reports are incorrectly guarded by `dashboard` in the frontend but by `financials` plus manager on the backend.
- Reviews and Concierge navigation applies a role filter not present on the direct route. A user with explicit permission can deep-link but cannot navigate.
- Settings permission allows broad integration operations; hardware routes also accept security/smart-building/settings holders. Configure/delete privileges should be separated from view/operate.
- Maintenance, Incident, Security, and Smart Building mutations are generally module-permission based, without action-level policy.
- Enterprise Search filters each record against `accessScope`; restricted records are omitted and the access is audited. This is the strongest sensitive-data control in the AI/search area.
- Enterprise Search and Hotel Brain frontend entry is tied to `bookings`, which is neither a dedicated AI permission nor a complete expression of who should search.
- AI recommendation governance and several AI hook/coplay endpoints are authenticate-only. Creating tasks or approving/executing recommendations needs explicit module and action policies.
- Dashboard Total Revenue and ADR are visible to any dashboard user, bypassing the intended financials boundary.

### Frontend/backend alignment verdict

**Not aligned.** The system needs one server-owned policy source with module and action grants, then a frontend projection of that source. Local role defaults and local-storage fallbacks should not decide access.

---

## 7. Demo, mock, placeholder, and simulation audit

| Feature | Real / demo / simulation | Where defined | UI label present? | Risk |
|---|---|---|---|---|
| API demo mode | Disabled/hardcoded false | API config/app registration | N/A | Dormant demo routes/files remain and can confuse maintenance |
| Prisma seed | Synthetic persisted data | `prisma/seed.ts` | Environment-dependent | Seed data looks real once loaded; production seeding controls must be explicit |
| Dashboard summary | Real with demo fallback | dashboard query + `dashboardDemoData.ts` | Page label only when summary fallback triggers | Individual fallbacks can be silently demo |
| Dashboard revenue chart | Demo | `dashboardDemoData.ts` / dashboard component | Not reliably widget-labelled | Financial trend can be mistaken for live data |
| Booking platform chart | Demo | dashboard demo data | No clear widget label | Channel performance can be mistaken for live |
| Dashboard tasks | Demo | dashboard demo data | No clear widget label | Operational actions can appear actionable |
| Guest review categories/count fallback | Mixed | reviews query + demo/hardcoded values | No per-widget label | Mixed provenance is unclear |
| Dashboard booking list | Real arrivals with demo fallback | dashboard component/demo data | No per-table disclosure | Seed/demo bookings may look live |
| Frontend audit log | Demo/local storage | `packages/web/src/utils/auditLog.ts` | Not a production-warning surface | Can be mistaken for authoritative backend audit |
| CCTV discovery | Simulation when flag enabled | CCTV discovery service/env | Simulated device is labelled | Acceptable for demo; must be disabled by default in production |
| NVR/channel setup | Reference-only simulation | CCTV/hardware service | Partially described | No media gateway/live validation |
| Local camera preview | Real browser-local device only | CCTV UI | Yes: not CCTV/not saved | Low if label remains |
| Cloud camera providers | Coming soon | Integration provider registry | Yes | Low |
| Smart-building devices | Real persisted model; adapter-dependent | Prisma/services | Provider status varies | Demo/seed devices can be confused with live telemetry |
| Hardware integrations | Persisted configuration; several adapters future | Hardware integration service/registry | Provider notes/status | “Available” can overstate actual adapter depth |
| Enterprise Search | Real persisted index | SearchIndex/search service | Presented as live | Index freshness is not fully event-maintained |
| Hotel Brain | Indexed/rule-based; not necessarily generative AI | Hotel Brain/search services | Not clearly distinguished | Users may assume live LLM reasoning |
| AI assistant | Optional provider with rule-based fallback | assistant/AI services and env | Needs verification per surface | Provider-off fallback can be mistaken for full AI |
| Calls | Placeholder | call controller | Not prominent | Queued state implies a provider/lifecycle that does not exist |
| Reports | Real computed results | report API | Yes by report type | No persistence/scheduling, but not demo |
| Financial records | Real Prisma records | invoice/payment/booking APIs | Yes | Dashboard financial visualization remains demo |

---

## 8. Dashboard widget audit

| Widget | Data source | Real / demo | Role visibility | Issue |
|---|---|---|---|---|
| Enterprise Search shortcut | Route shortcut | Real destination | All dashboard users | Links users without guaranteed `bookings` access |
| Hotel Brain shortcut | Route shortcut | Real/partial destination | All dashboard users | Same permission mismatch |
| Attention | Incident/alert summaries with fallback | Mixed | All dashboard users | Links to restricted Incident Center |
| Integration Health | Integration overview | Real with fallback | All dashboard users | Links to Settings without checking `settings` |
| New Bookings | Dashboard summary | Real with fallback | All dashboard users | Acceptable if demo state is explicit |
| Check-In | Dashboard summary | Real with fallback | All dashboard users | Acceptable if demo state is explicit |
| Check-Out | Dashboard summary | Real with fallback | All dashboard users | Acceptable if demo state is explicit |
| Total Revenue | Dashboard summary | Real with fallback | **All dashboard users** | Financial data leakage; should require `financials` |
| Occupancy | Dashboard summary | Real with fallback | All dashboard users | Appropriate for broad operations roles |
| ADR | Dashboard summary | Real with fallback | **All dashboard users** | Financial data leakage |
| Room Readiness | Dashboard/housekeeping summary | Mixed | All dashboard users | Permission/data provenance and zero-total calculation need hardening |
| Revenue chart | Hardcoded dashboard demo series | Demo | All dashboard users | Unlabelled and financially sensitive |
| Guest Reviews | Review summary + demo categories/counts | Mixed | All dashboard users | Should require `reviews` or expose only an approved aggregate |
| Reservations chart | Demo dashboard series | Demo | All dashboard users | No widget-specific demo disclosure |
| Security health | Security API + fallback | Mixed | Query is permission-gated | Widget visibility/fallback still needs strict permission treatment |
| Smart Building health | Smart API + fallback | Mixed | Query is permission-gated | Same issue |
| Booking by Platform | Hardcoded demo | Demo | All dashboard users | Not backed by current report/API result |
| Booking List | Live arrivals or demo bookings | Mixed | All dashboard users | Demo disclosure not local to table |
| Tasks | Hardcoded demo tasks | Demo | All dashboard users | Appears operational but is non-persistent |
| Recent Activity | Timeline API | Real, may be empty/fallback | Broad dashboard surface | Should respect record/module scopes |

Dashboard code also checks role strings such as `FINANCE`, `SECURITY`, `MAINTENANCE`, and `FRONT_DESK`; those roles do not exist in the current Prisma enum. Those branches cannot provide reliable role-aware behavior.

---

## 9. Integration Manager audit

| Integration category | Provider | Route/API | UI exists | State | Issue |
|---|---|---|---|---|---|
| CCTV / Local Camera | Browser USB/local camera | CCTV + Integration Manager | Yes | Available, local-only | Correctly labelled; not persisted CCTV |
| IP Camera Discovery | ONVIF | `/api/cctv`, hardware integration | Yes | Available + optional simulation | Real discovery depends on network/adapter; simulation flag |
| NVR | Generic/Hikvision/Dahua | CCTV/hardware APIs | Yes | Partial | Channels are reference-only; no media gateway |
| Manual Camera | RTSP/HLS/MJPEG/manual ONVIF | Hardware integration API | Yes | Partial/available config | Live stream validation depth is limited |
| Cloud Cameras | Verkada, Eagle Eye, Rhombus | Registry only | Yes | Coming soon | Correctly future-labelled |
| Smart Locks | Generic, TTLock, SALTO | Hardware + marketplace APIs | Yes | Generic available; vendor adapters partial/future | Environment “configured” may overstate usable integration |
| Sensors | Motion, door, temperature, occupancy, generic IoT | Hardware/smart-building APIs | Yes | Available config; adapter-dependent | Device telemetry authenticity needs production controls |
| HVAC | Generic HVAC | Hardware/smart-building APIs | Yes | Available config; adapter-dependent | Adapter depth unclear |
| Energy meters | Generic energy | Hardware/smart-building APIs | Yes | Available config; adapter-dependent | Adapter depth unclear |
| Fire/smoke | Generic | Registry | Yes | Coming soon | Correctly future-labelled |
| Weather | OpenWeather | Marketplace/operations APIs | Yes through merged provider cards | Environment-configured | No unified persisted integration record |
| Payments | Stripe | Marketplace/payment APIs | Yes through merged provider cards | Environment-configured | Disconnect is not a persisted credential revocation workflow |
| Booking channels | Booking.com, Expedia | Marketplace registry | Yes | Future | No channel manager adapter |
| Microsoft 365 | Microsoft 365 | Marketplace registry | Yes | Configured/future notes | Status can imply integration before real adapter exists |
| Google Workspace | Google | Marketplace registry | Yes | Configured/future notes | Same issue |
| Collaboration | Slack, Teams | Marketplace registry | Yes | Environment-configured/partial | Connect/test state is in-memory |
| AI provider | OpenAI | Marketplace/AI config | Yes | Environment-configured/optional | Rule fallback and provider state need clear UI disclosure |

### Credential and integration-state risks

- Persisted `HardwareIntegration` records remove `secretCiphertext` from public responses and expose masked/reference metadata, which is the correct pattern.
- `host` and `streamPath` remain public fields. A UI claim that raw RTSP details are never returned is therefore too strong; these values may be sufficient to reconstruct a stream URL.
- Hardware encryption can fall back from `HARDWARE_SECRET_KEY` to JWT/default values. Production must require a dedicated strong key.
- Marketplace connect, disconnect, and test behavior is largely runtime/in-memory or environment-based. It should not be represented as a durable connection lifecycle.
- Provider registry status mixes “credentials found,” “configuration available,” and “adapter functional.” These must become separate states.

---

## 10. Gap analysis

### Built and substantially working

- Authentication, password setup/reset, access requests
- Users and explicit module permissions
- Bookings, guests, rooms, room types and floors
- Inventory and purchase orders
- Calendar
- Messages, tickets, presence and transcripts
- Notifications
- Maintenance, incidents, security and smart-building core persistence
- Enterprise Search record-level scope filtering

### Built but needs UI/configuration improvement

- Navigation for Bookings, Rooms, Housekeeping, Inventory and Calendar
- Dashboard widget authorization and demo disclosure
- Reports route permission
- Reviews/Concierge nav-role consistency
- Integration provider state vocabulary
- Canonical route naming for Reservations/Bookings and Smart Building

### Built but backend incomplete

- Calls
- Housekeeping task/assignment lifecycle
- Saved/scheduled reports and export history
- Expense/ledger/refund financial domain
- CCTV/NVR media and vendor adapters
- Smart-building vendor ingestion/authentication
- Hotel Brain durable conversation/citation lifecycle
- Integration connection persistence

### Frontend only or frontend-led

- Local-storage audit-log view
- Several dashboard financial/booking/task charts
- Some quick actions that only display UI feedback
- Report catalogue metadata

### Backend only or insufficiently surfaced

- Authoritative `ActivityLog`
- Some event/audit and AI evaluation capabilities
- Search access auditing
- Several operational models and integration credential references

### Demo/simulation only

- Dashboard revenue trend
- Booking platform distribution
- Dashboard tasks
- Portions of reviews/reservations graphics
- CCTV discovery when simulation flag is enabled
- NVR reference channels

### Missing completely

- CallLog/call-session persistence
- Central Role/Permission/Action policy model
- SavedReport/ScheduledReport/ExportHistory
- General financial ledger/expense/refund model
- Dedicated HousekeepingTask model
- Durable Hotel Brain conversation/answer model

### Broken or risky

- Dashboard financial data visible outside `financials`
- Reports frontend/backend authorization mismatch
- Dormant role defaults and local-storage permission fallback
- Missing sidebar items for five primary modules
- Authenticate-only AI governance/action endpoints
- Dead role checks for roles absent from the enum
- Incomplete search-index incremental refresh
- Insecure integration-secret fallback possibility
- API port/base-URL mismatch in environment examples
- Audit UI may be mistaken for authoritative audit

---

## 11. Priority remediation roadmap

### P0 — Authorization and data exposure

1. Make backend-issued permissions authoritative. Remove local-storage fallback when the authenticated server user has an empty permission array.
2. Replace role-default ambiguity with a single server-owned policy source.
3. Hide and stop querying Revenue, ADR, financial charts, invoices and financial report links unless the user has `financials`.
4. Change `/reports` frontend protection to `financials` and align any manager/action requirement visibly.
5. Add explicit authorization to AI recommendation approval, rejection, execution, ticket creation, and other action endpoints.
6. Require a dedicated production `HARDWARE_SECRET_KEY`; reject insecure defaults.
7. Replace the local-storage audit screen with the backend `ActivityLog` API and restrict it to an audit/admin permission.

### P1 — Configuration integrity

8. Add Bookings, Rooms, Housekeeping, Inventory and Calendar to navigation with their existing permission IDs.
9. Expand `MODULE_ROUTE_PRIORITY` to every routable permission or use the first server-approved navigation destination.
10. Remove impossible role checks or introduce properly governed roles for Finance, Security, Maintenance, General Manager and Auditor.
11. Introduce action grants such as `read`, `create`, `update`, `delete`, `approve`, `export`, and `configure`; use them consistently in API middleware and frontend controls.
12. Give Calls, Enterprise Search, Hotel Brain and Integration Manager explicit permission identities instead of borrowing `messages`, `bookings`, or `settings`.
13. Align Reviews and Concierge navigation filters with route/API permissions.

### P2 — Data provenance and module completeness

14. Add a widget-level provenance state: Live, Seed, Demo, Simulation, Unavailable. Never silently substitute demo operational or financial values.
15. Replace or remove dashboard demo revenue, channel, task, reservation and review-category widgets until backed by API data.
16. Persist call sessions/logs and integrate a provider before presenting queued calls as operational.
17. Add a housekeeping task/assignment model or formally standardize it on Ticket with department-specific fields.
18. Add saved reports, schedules and export history if Reports is intended as a managed module.
19. Complete expense/refund/adjustment/ledger modeling before treating Financials as a full accounting surface.

### P3 — Integrations, search and AI hardening

20. Separate integration states into: credentials detected, configured, tested, connected, healthy, simulated and coming soon.
21. Persist marketplace connection lifecycle and test history; do not rely on process memory.
22. Do not return reconstructible stream connection details unless an authorized operation requires them.
23. Complete vendor/HMAC authentication for smart-building ingestion and real media validation for CCTV/NVR.
24. Implement incremental SearchIndex upsert/delete handlers and monitor index freshness.
25. Identify Hotel Brain responses as indexed/rule-based or provider-generated, and persist answer/citation history if it is an auditable enterprise assistant.
26. Correct environment examples so API port and web API base path agree; document all production-required flags and secrets.

### Readiness recommendation

**Not ready for full BRD/E2E testing.** Complete P0 and P1 first. After that, create a targeted QA plan from the corrected module/navigation/policy registry, with separate suites for live, seeded, simulated and unavailable capabilities.
