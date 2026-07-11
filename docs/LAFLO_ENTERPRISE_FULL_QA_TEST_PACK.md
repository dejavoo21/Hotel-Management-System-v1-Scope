# Full End-to-End QA Test Pack

## LaFlo Enterprise Hotel Operations Platform

Date: 2026-07-11  
Version: 1.0  
Status: Draft for QA Execution, UAT, Regression, and Stakeholder Sign-Off

## 1. QA Test Pack Overview

This QA Test Pack validates the full LaFlo Enterprise Hotel Operations Platform against the full-system BRD. It covers functional testing, end-to-end process testing, role-based access testing, integration workflow testing, AI governance testing, Enterprise Search validation, audit validation, notification validation, regression testing, and UAT.

The pack is designed for manual QA testers and business users. Automated tests may be created later from these scenarios.

## 2. Test Scope

### Platform Core

- Event Bus
- Task Engine
- Notification Engine
- Audit Engine
- Integration Hub

### Core Business Modules

- Dashboard
- Reservations
- Guests
- Rooms
- Housekeeping
- Inventory
- Calendar
- Financials
- Reviews
- Concierge
- Messages
- Calls
- User Management

### Operations Modules

- Operations Center
- Security Center
- Smart Building
- Maintenance Center
- Incident Center

### AI Modules

- AI Context Engine
- Daily GM Briefing
- Department Intelligence
- AI Recommendation Governance
- AI Copilot
- Operations Concierge
- Hotel Brain

### Smart Building Modules

- Device Management
- CCTV
- Sensors
- Doors
- Energy
- HVAC
- Assets

### Integration Layer

- Integration Manager
- CCTV Integrations
- Smart Lock Integrations
- Sensor Integrations
- HVAC Integrations
- Energy Meter Integrations
- Weather Integrations
- Payment Integrations
- Booking Channel Integrations
- Microsoft 365 Integration
- OpenAI / AI Provider Integrations
- Other Provider Integrations

### Intelligence and Search

- Enterprise Search
- Hotel Brain

## 3. Out of Scope

- Physical installation of hotel hardware.
- Production certification for every vendor API.
- Production payment certification unless separately agreed.
- Production booking channel certification unless separately agreed.
- Real CCTV/NVR validation without hardware.
- Real smart building validation without hardware/API access.
- Full mobile app testing where no mobile app exists.
- Guest-facing mobile app testing where no guest app exists.
- High-impact autonomous AI action execution without human approval.

## 4. Test Assumptions

- Test users exist for all required roles.
- Test hotel, room, guest, booking, and operational data exists.
- The test environment is connected to a test database.
- Required migrations have been applied.
- Mock/simulated integrations are clearly labelled.
- Hardware-dependent tests may be marked blocked where hardware/API access is unavailable.
- AI responses are limited to available authorised platform data.
- Audit, Event Bus, Notification Engine, and Task Engine are enabled.

## 5. Test Dependencies

- Stable test environment.
- Browser access.
- Test login credentials for each role.
- Seed/test data.
- CCTV/NVR device or simulation mode.
- Smart building device/API access or simulation mode.
- Email/SMS/push provider access where notification channels are tested.
- AI provider configuration where generative AI paths are tested.
- Search index generated or rebuilt.
- Defect tracking system.

## 6. Test Environment Requirements

- Latest deployed web application.
- Latest deployed API.
- Database migrated to current schema.
- Prisma client generated.
- Test data loaded.
- Browser developer console available for runtime error checks.
- Network tab available for API validation.
- Test accounts for Admin, Manager, Front Desk, Housekeeping, Maintenance, Security, Finance, Concierge, Auditor, AI Governance Reviewer, and Integration Administrator.

Recommended technical readiness checks:

```bash
npm run check
npm --prefix packages/api run db:migrate:prod
```

## 7. Test Data Requirements

Required test data:

- At least one hotel.
- Multiple rooms and room types.
- Clean, dirty, inspected, occupied, available, and out-of-service room states.
- Guests with reservations, stay history, messages, calls, and reviews.
- Reservations for arrivals, departures, in-house, cancelled, and checked-out states.
- Housekeeping tasks.
- Maintenance tasks/faults.
- Incidents across severity levels.
- Inventory items with normal and low-stock levels.
- Financial records/invoices/payments where authorised.
- CCTV camera integration records.
- Smart building devices across online, offline, fault, and low-battery states.
- Audit logs.
- Notifications.
- Search index records.
- AI recommendations and Hotel Brain query context.

## 8. User Roles Required for Testing

- General Manager
- Operations Manager
- Front Desk Staff
- Housekeeping Manager
- Housekeeping Staff
- Maintenance Manager
- Maintenance Staff
- Security Manager
- Security Staff
- Finance User
- Concierge Staff
- IT Administrator
- System Administrator
- Auditor
- AI Governance Reviewer
- Integration Administrator

## 9. Test Execution Guidelines

- Record actual result for every test case.
- Mark tests as Blocked only when the environment, data, role, vendor API, or hardware is unavailable.
- Capture screenshots or screen recordings for every failure.
- Record browser console errors and failed API responses.
- Validate both UI outcome and backend side effects where possible.
- Validate audit logs for sensitive workflows.
- Validate notifications where applicable.
- Validate role restrictions using at least one authorised and one unauthorised user.
- Do not accept simulated integration results as production hardware validation.

## 10. Defect Severity and Priority Definitions

### Severity

- Critical: Platform unavailable, data corruption, severe security leak, or critical operational flow blocked.
- High: Major module or end-to-end workflow blocked with no practical workaround.
- Medium: Important functionality fails but workaround exists.
- Low: Minor defect, cosmetic issue, wording issue, or non-blocking inconsistency.

### Priority

- P1: Must fix before release/sign-off.
- P2: Should fix before release unless accepted by product owner.
- P3: Can be scheduled for near-term backlog.
- P4: Cosmetic or future improvement.

## 11. Test Case Naming Convention

Use:

- DASH-TC-001
- RES-TC-001
- GUEST-TC-001
- ROOM-TC-001
- HK-TC-001
- INV-TC-001
- CAL-TC-001
- FIN-TC-001
- REV-TC-001
- CON-TC-001
- MSG-TC-001
- CALL-TC-001
- USER-TC-001
- OPS-TC-001
- SEC-TC-001
- SB-TC-001
- MAINT-TC-001
- INC-TC-001
- INT-TC-001
- CCTV-TC-001
- SEARCH-TC-001
- AI-TC-001
- E2E-TC-001
- RBAC-TC-001
- AUDIT-TC-001
- NOTIF-TC-001
- EVENT-TC-001
- NEG-TC-001
- REG-TC-001
- UAT-TC-001

## 12. Functional Test Cases by Module

Each test case uses this execution record:

| Field | Value |
| --- | --- |
| Actual Result |  |
| Status | Not Run |
| Defect ID |  |
| Comments |  |

### Dashboard

| Test Case ID | Test Area / Module | Test Title | Requirement Reference | Priority | Test Type | Preconditions | Test Data | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DASH-TC-001 | Dashboard | Dashboard loads successfully | DASH-FR-001 | Must | Functional | User logged in | Dashboard data exists | Open Dashboard | Dashboard loads without error and no console runtime failure. |
| DASH-TC-002 | Dashboard | KPI cards display operational data | DASH-FR-001 | Must | Functional | User has dashboard access | KPI data exists | Open Dashboard and inspect KPI cards | KPI cards show arrivals, departures, occupancy, and room readiness. |
| DASH-TC-003 | Dashboard | Today's arrivals display | DASH-FR-001 | Must | Functional | Arrivals exist | Arrival booking | Open Dashboard | Today's arrivals list is visible and accurate. |
| DASH-TC-004 | Dashboard | Today's departures display | DASH-FR-001 | Must | Functional | Departures exist | Departure booking | Open Dashboard | Today's departures list is visible and accurate. |
| DASH-TC-005 | Dashboard | Room readiness summary displays | DASH-FR-001 | Must | Functional | Rooms exist | Mixed room statuses | Open Dashboard | Room readiness summary reflects room status data. |
| DASH-TC-006 | Dashboard | Housekeeping summary displays | DASH-FR-001 | Must | Functional | Housekeeping records exist | Cleaning tasks | Open Dashboard | Housekeeping summary displays clean/dirty/inspection counts. |
| DASH-TC-007 | Dashboard | Maintenance issues display | DASH-FR-001 | Must | Functional | Maintenance records exist | Open fault | Open Dashboard | Maintenance issues are displayed. |
| DASH-TC-008 | Dashboard | Open incidents display | DASH-FR-001 | Must | Functional | Incidents exist | Open incident | Open Dashboard | Open incidents are visible. |
| DASH-TC-009 | Dashboard | Guest experience alerts display | DASH-FR-001 | Should | Functional | Guest issues exist | Complaint/review | Open Dashboard | Guest experience alerts are visible. |
| DASH-TC-010 | Dashboard | Integration, CCTV, and Smart Building health display | DASH-FR-001 | Must | Functional | Integration/device records exist | CCTV/device health | Open Dashboard | Integration, CCTV, and Smart Building health widgets display. |
| DASH-TC-011 | Dashboard | Enterprise Search shortcut works | DASH-FR-001 | Must | Functional | User has access | None | Click Enterprise Search shortcut | User navigates to Enterprise Search page. |
| DASH-TC-012 | Dashboard | Hotel Brain shortcut works | DASH-FR-001 | Must | Functional | User has AI access | None | Click Hotel Brain shortcut | User navigates to Hotel Brain page. |
| DASH-TC-013 | Dashboard | Role-based dashboard visibility works | RBAC | Must | RBAC | Multiple roles available | Restricted financial data | Login as restricted user and open Dashboard | Restricted widgets/data are hidden or filtered. |

### Reservations

| Test Case ID | Test Area / Module | Test Title | Requirement Reference | Priority | Test Type | Preconditions | Test Data | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RES-TC-001 | Reservations | Create reservation | RES-FR-001 | Must | Functional | User has booking access | Guest/room type | Create a new reservation | Reservation is created and visible. |
| RES-TC-002 | Reservations | View reservation | RES-FR-001 | Must | Functional | Reservation exists | Reservation | Open reservation detail | Reservation details display correctly. |
| RES-TC-003 | Reservations | Update reservation | RES-FR-001 | Must | Functional | Reservation exists | New dates/notes | Edit reservation and save | Reservation updates persist. |
| RES-TC-004 | Reservations | Cancel reservation | RES-FR-001 | Must | Functional | Reservation exists | Active reservation | Cancel reservation | Reservation status becomes cancelled. |
| RES-TC-005 | Reservations | Assign room | RES-FR-001 | Must | Functional | Room available | Room | Assign room to booking | Room is linked to reservation. |
| RES-TC-006 | Reservations | Link guest to reservation | RES-FR-001 | Must | Functional | Guest exists | Guest/reservation | Link guest | Reservation shows linked guest. |
| RES-TC-007 | Reservations | Add special request | RES-FR-001 | Should | Functional | Reservation exists | Special request text | Add request and save | Special request persists. |
| RES-TC-008 | Reservations | Check-in guest | RES-FR-001 | Must | Functional/E2E | Reservation ready | Arrival reservation | Check in guest | Booking status updates and dashboard reflects in-house guest. |
| RES-TC-009 | Reservations | Check-out guest | RES-FR-001 | Must | Functional/E2E | In-house booking | Booking | Check out guest | Booking checked out and room turnover starts where configured. |
| RES-TC-010 | Reservations | Reservation appears on calendar | CAL-FR-001 | Should | Integration | Reservation exists | Reservation dates | Open Calendar | Reservation appears on correct dates. |
| RES-TC-011 | Reservations | Reservation updates dashboard | DASH-FR-001 | Must | Integration | Booking changed | Arrival/departure booking | Update booking and open Dashboard | Dashboard reflects change. |
| RES-TC-012 | Reservations | Reservation change creates audit log | AUDIT | Must | Audit | Audit access | Reservation update | Update reservation then review audit | Audit entry exists. |

### Guests

| Test Case ID | Module | Test Title | Requirement Reference | Priority | Test Type | Preconditions | Test Data | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GUEST-TC-001 | Guests | Create guest profile | GUEST-FR-001 | Must | Functional | User has guest access | Guest details | Create guest | Guest profile is saved. |
| GUEST-TC-002 | Guests | Update guest profile | GUEST-FR-001 | Must | Functional | Guest exists | New details | Edit guest | Changes persist. |
| GUEST-TC-003 | Guests | View guest profile | GUEST-FR-001 | Must | Functional | Guest exists | Guest | Open profile | Profile displays. |
| GUEST-TC-004 | Guests | Link guest to reservation | GUEST-FR-001 | Must | Integration | Guest and reservation exist | Guest/reservation | Link records | Guest profile shows reservation. |
| GUEST-TC-005 | Guests | Add guest preference | GUEST-FR-001 | Should | Functional | Guest exists | Preference | Add preference | Preference persists. |
| GUEST-TC-006 | Guests | Add guest complaint | GUEST-FR-001 | Must | Functional | Guest exists | Complaint | Add complaint | Complaint is saved and visible. |
| GUEST-TC-007 | Guests | View stay history | GUEST-FR-001 | Should | Functional | Guest has stays | Past bookings | Open profile | Stay history displays. |
| GUEST-TC-008 | Guests | View linked messages/calls/reviews | GUEST-FR-001 | Should | Integration | Linked records exist | Messages/calls/reviews | Open profile | Linked records display. |
| GUEST-TC-009 | Guests | Privacy permissions respected | RBAC | Must | RBAC | Restricted user exists | Guest data | Login as restricted user | Restricted guest data is hidden/denied. |
| GUEST-TC-010 | Guests | Guest update creates audit log | AUDIT | Must | Audit | Audit access | Guest update | Update guest and inspect audit | Audit entry exists. |

### Rooms

| Test Case ID | Module | Test Title | Requirement Reference | Priority | Test Type | Preconditions | Test Data | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ROOM-TC-001 | Rooms | View room list | ROOM-FR-001 | Must | Functional | Rooms exist | Rooms | Open Rooms | Room list displays. |
| ROOM-TC-002 | Rooms | View room detail | ROOM-FR-001 | Must | Functional | Room exists | Room | Open room detail | Room details display. |
| ROOM-TC-003 | Rooms | Update room status | ROOM-FR-001 | Must | Functional | Room exists | New status | Change status | Status persists. |
| ROOM-TC-004 | Rooms | Mark room clean | ROOM-FR-001 | Must | Functional | Room dirty | Room | Mark clean | Room housekeeping status is clean. |
| ROOM-TC-005 | Rooms | Mark room dirty | ROOM-FR-001 | Must | Functional | Room clean | Room | Mark dirty | Room housekeeping status is dirty. |
| ROOM-TC-006 | Rooms | Mark room inspected | ROOM-FR-001 | Must | Functional | Room clean | Room | Mark inspected | Room status is inspected/ready. |
| ROOM-TC-007 | Rooms | Mark room out of service | ROOM-FR-001 | Must | Functional | Room active | Room | Mark out of service | Room unavailable. |
| ROOM-TC-008 | Rooms | Link room to housekeeping task | HK-FR-001 | Must | Integration | Room/task exist | Task | Link task | Task appears against room. |
| ROOM-TC-009 | Rooms | Link room to maintenance task | MAINT-FR-001 | Must | Integration | Room/task exist | Task | Link task | Task appears against room. |
| ROOM-TC-010 | Rooms | Link room to incident | INC-FR-001 | Should | Integration | Incident exists | Incident | Link incident | Incident appears against room. |
| ROOM-TC-011 | Rooms | View linked smart building devices | SB-FR-001 | Should | Integration | Device mapped | Device | Open room detail | Device appears. |
| ROOM-TC-012 | Rooms | Room status updates dashboard | DASH-FR-001 | Must | Integration | Dashboard access | Room status | Change room status | Dashboard summary updates. |

### Housekeeping

| Test Case ID | Module | Test Title | Requirement Reference | Priority | Test Type | Preconditions | Test Data | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HK-TC-001 | Housekeeping | Create housekeeping task | HK-FR-001 | Must | Functional | User has access | Room | Create task | Task is created. |
| HK-TC-002 | Housekeeping | Assign housekeeping staff | HK-FR-001 | Must | Functional | Staff exists | Task/staff | Assign staff | Assignee saved. |
| HK-TC-003 | Housekeeping | Update cleaning status | HK-FR-001 | Must | Functional | Task exists | Status | Update status | Status persists. |
| HK-TC-004 | Housekeeping | Mark room cleaned | HK-FR-001 | Must | Functional | Dirty room | Room/task | Complete cleaning | Room becomes clean or inspection. |
| HK-TC-005 | Housekeeping | Mark room inspected | HK-FR-001 | Must | Functional | Clean room | Room/task | Complete inspection | Room becomes ready. |
| HK-TC-006 | Housekeeping | Escalate blocker | HK-FR-001 | Should | Functional | Blocker exists | Task | Escalate blocker | Alert/task escalation visible. |
| HK-TC-007 | Housekeeping | Link task to room/reservation | HK-FR-001 | Must | Integration | Room/reservation exist | Task | Link records | Links display. |
| HK-TC-008 | Housekeeping | Update affects room readiness | ROOM-FR-001 | Must | Integration | Task linked to room | Status update | Complete task | Room readiness updates. |
| HK-TC-009 | Housekeeping | Delay triggers notification | NOTIF | Should | Notification | Delayed task | Task | Mark overdue/delayed | Notification is created/sent. |

### Inventory

| Test Case ID | Module | Test Title | Requirement Reference | Priority | Test Type | Preconditions | Test Data | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INV-TC-001 | Inventory | Create inventory item | INV-FR-001 | Should | Functional | User has access | Item details | Create item | Item is saved. |
| INV-TC-002 | Inventory | Update inventory item | INV-FR-001 | Should | Functional | Item exists | Updated details | Edit item | Changes persist. |
| INV-TC-003 | Inventory | Adjust stock level | INV-FR-001 | Should | Functional | Item exists | Quantity | Adjust stock | Stock level updates. |
| INV-TC-004 | Inventory | Record stock movement | INV-FR-001 | Could | Functional | Item exists | Movement | Record movement | Movement logged. |
| INV-TC-005 | Inventory | Set reorder threshold | INV-FR-001 | Should | Functional | Item exists | Threshold | Set threshold | Threshold persists. |
| INV-TC-006 | Inventory | Trigger low-stock alert | NOTIF | Should | Notification | Threshold set | Low stock | Reduce stock below threshold | Low-stock alert displays/sends. |
| INV-TC-007 | Inventory | Link inventory to department/supplier | INV-FR-001 | Could | Functional | Department/supplier exists | Link data | Add links | Links display. |
| INV-TC-008 | Inventory | Inventory change creates audit log | AUDIT | Should | Audit | Audit access | Item update | Update item | Audit entry exists. |

### Calendar, Financials, Reviews, Concierge, Messages, Calls, User Management

| Test Case ID | Module | Test Title | Requirement Reference | Priority | Test Type | Preconditions | Test Data | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CAL-TC-001 | Calendar | View reservation calendar | CAL-FR-001 | Should | Functional | Reservations exist | Bookings | Open Calendar | Bookings display. |
| CAL-TC-002 | Calendar | Create/update/delete calendar event | CAL-FR-001 | Should | Functional | User has access | Event details | Create, edit, delete event | Calendar reflects changes. |
| CAL-TC-003 | Calendar | Calendar reflects reservation/task scheduling | CAL-FR-001 | Should | Integration | Reservation/task exists | Schedule data | Open Calendar | Related schedule items display. |
| FIN-TC-001 | Financials | View financial summary | FIN-FR-001 | Must | Functional/RBAC | Finance user | Financial records | Open Financials | Summary displays for authorised user. |
| FIN-TC-002 | Financials | View/update payment record | FIN-FR-001 | Must | Functional | Payment exists | Payment update | Open and update payment | Status persists and audit exists. |
| FIN-TC-003 | Financials | Restrict financial access by role | RBAC | Must | RBAC | Restricted user | Financial records | Login as restricted user | Financial data hidden/denied. |
| REV-TC-001 | Reviews | Create/import and view review | REV-FR-001 | Should | Functional | Review access | Review data | Add/open review | Review displays. |
| REV-TC-002 | Reviews | Link review and escalate negative review | REV-FR-001 | Should | Integration | Guest/reservation exists | Negative review | Link and escalate | Operations alert created. |
| CON-TC-001 | Concierge | Create/assign/update/close request | CON-FR-001 | Should | Functional | Concierge access | Request data | Create, assign, update, close | Request lifecycle works. |
| CON-TC-002 | Concierge | Escalate request and audit update | CON-FR-001 | Should | Audit/Integration | Request exists | Escalation | Escalate request | Escalation and audit exist. |
| MSG-TC-001 | Messages | Create/view/link message thread | MSG-FR-001 | Must | Functional | Message access | Message data | Create/open/link thread | Thread and links display. |
| MSG-TC-002 | Messages | Escalate message to task/incident | MSG-FR-001 | Should | Integration | Message exists | Escalation | Escalate | Task/incident created. |
| CALL-TC-001 | Calls | Create call log and notes | CALL-FR-001 | Should | Functional | Call access | Call data | Create call log | Call log saved. |
| CALL-TC-002 | Calls | Link call and escalate follow-up | CALL-FR-001 | Should | Integration | Call exists | Guest/reservation | Link and escalate | Linked record/follow-up exists. |
| USER-TC-001 | User Management | Create/update/disable user | USER-FR-001 | Must | Functional/RBAC | Admin user | User data | Create, edit, disable user | User lifecycle works. |
| USER-TC-002 | User Management | Assign role, permissions, department | USER-FR-001 | Must | RBAC | Admin user | Role/permission data | Update access | Access changes apply. |
| USER-TC-003 | User Management | User management audit log | AUDIT | Must | Audit | Audit access | User update | Update user and inspect audit | Audit entry exists. |

### Operations, Security, Smart Building, Maintenance, Incident Center

| Test Case ID | Module | Test Title | Requirement Reference | Priority | Test Type | Preconditions | Test Data | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OPS-TC-001 | Operations Center | View cross-department alerts and blockers | OPS-FR-001 | Must | Functional | Alerts/blockers exist | Operational records | Open Operations Center | Alerts/blockers display. |
| OPS-TC-002 | Operations Center | Assign/escalate/close operational task | OPS-FR-001 | Must | Functional | Task exists | Task | Assign, escalate, close | Task lifecycle works. |
| OPS-TC-003 | Operations Center | Reflect updates from source modules | OPS-FR-001 | Must | Integration | Updates exist | HK/maintenance/incidents/reviews/device | Update source module | Operations Center reflects update. |
| SEC-TC-001 | Security Center | View CCTV overview and camera status | SEC-FR-001 | Must | Functional | CCTV records exist | Cameras | Open Security Center | Active/offline camera states display. |
| SEC-TC-002 | Security Center | View security/access/door events | SEC-FR-001 | Must | Functional | Events exist | Security events | Open Security Center | Events display. |
| SEC-TC-003 | Security Center | Escalate security alert to incident | SEC-FR-001 | Must | Integration | Security alert exists | Alert | Escalate | Incident created/linked. |
| SB-TC-001 | Smart Building | View device inventory/health | SB-FR-001 | Must | Functional | Devices exist | Device states | Open Smart Building | Device inventory/health displays. |
| SB-TC-002 | Smart Building | View sensors, doors, energy, HVAC, assets | SB-FR-001 | Must | Functional | Data exists | Device categories | Open each section | Section displays relevant data/state. |
| SB-TC-003 | Smart Building | Map device and route alerts | SB-FR-001 | Must | Integration | Device exists | Device/fault | Map and trigger alert | Alert routes to correct module. |
| MAINT-TC-001 | Maintenance Center | Create/assign/update/close maintenance task | MAINT-FR-001 | Must | Functional | Maintenance access | Task data | Create, assign, update, close | Task lifecycle works. |
| MAINT-TC-002 | Maintenance Center | Link maintenance to room/device | MAINT-FR-001 | Must | Integration | Room/device exists | Work order | Link records | Links display. |
| MAINT-TC-003 | Maintenance Center | Device fault creates task and dashboard alert | MAINT-FR-001 | Must | Integration | Device fault event | Device | Trigger fault | Task and dashboard alert appear. |
| INC-TC-001 | Incident Center | Create/classify/assign incident | INC-FR-001 | Must | Functional | Incident access | Incident data | Create and assign incident | Incident saved with severity/status. |
| INC-TC-002 | Incident Center | Link incident to guest/room/device/security event | INC-FR-001 | Must | Integration | Linked records exist | Incident links | Add links | Links display. |
| INC-TC-003 | Incident Center | Escalate/close incident and audit update | INC-FR-001 | Must | Audit | Incident exists | Incident update | Escalate and close | Status updates and audit exists. |

## 13. End-to-End Test Scenarios

| Test Case ID | Test Area / Module | Test Title | Requirement Reference | Priority | Test Type | Preconditions | Test Data | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E2E-TC-001 | Reservation to Check-In | Full reservation arrival flow | RES-FR-001 | Must | E2E | User has booking/room access | Guest, room, arrival booking | Create reservation, link guest, assign room, confirm readiness, check blockers, check in, verify dashboard, verify audit | Guest is checked in; linked records, dashboard, and audit are updated. |
| E2E-TC-002 | Check-Out to Room Turnover | Checkout creates room turnover workflow | HK-FR-001 | Must | E2E | In-house guest exists | Booking/room | Check out, verify room dirty, create/assign HK task, clean, inspect, mark ready, verify dashboard/calendar/availability | Room becomes ready and availability updates. |
| E2E-TC-003 | Guest Complaint to Resolution | Complaint routes through operations | OPS-FR-001 | Must | E2E | Guest exists | Message/call/review/concierge complaint | Log complaint, verify Ops alert, create task/incident, assign owner, resolve, update guest profile, verify dashboard and Hotel Brain visibility | Complaint is tracked to resolution. |
| E2E-TC-004 | Maintenance Fault to Closure | Fault lifecycle | MAINT-FR-001 | Must | E2E | Room/device exists | Fault | Report fault manually or via device, create task, assign priority/technician, complete work, update status, close, verify audit | Fault is closed and linked status updated. |
| E2E-TC-005 | Security Alert to Incident Closure | Security incident lifecycle | SEC-FR-001 | Must | E2E | Security event exists | Door/CCTV/access event | Trigger alert, create incident, add notes, update status, close, verify audit | Security incident is resolved and audited. |
| E2E-TC-006 | CCTV Integration to Security Center Display | Camera setup appears in Security | CCTV-FR-001 | Must | E2E/Integration | Admin/security access | Camera/NVR details | Configure CCTV, test, import, map, open Security Center, verify health/events/audit | Camera appears in Security Center with health state. |
| E2E-TC-007 | Smart Building Device Integration to Alert Routing | Device fault routes correctly | SB-FR-001 | Must | E2E/Integration | Smart Building access | Device/fault | Configure/import/map device, simulate offline/low battery/fault, verify Maintenance/Security/Incident routing, notification, audit | Alert routes correctly and is logged. |
| E2E-TC-008 | Inventory Low Stock to Notification | Stock threshold alert | INV-FR-001 | Should | E2E | Inventory item exists | Low stock item | Reduce stock below threshold, verify notification/Ops issue/audit | Low stock alert created. |
| E2E-TC-009 | Review Escalation to Operations | Negative review escalation | REV-FR-001 | Should | E2E | Guest/reservation exists | Negative review | Add review, link records, escalate, assign follow-up, update status | Operations/guest experience summary updated. |
| E2E-TC-010 | Enterprise Search Investigation | Search investigation flow | SEARCH-FR-001 | Must | E2E/Search | Search index exists | Mixed records | Search room/guest/device/incident/task, verify groups, permission filtering, preview, source open, audit | Search works with permissions and audit. |
| E2E-TC-011 | Hotel Brain Daily Briefing | AI daily briefing flow | AI-FR-001 | Must | E2E/AI | AI access/context data | Operational data | Ask daily GM briefing, verify context, summary, evidence, suggested actions, audit/governance | Evidence-backed briefing appears. |
| E2E-TC-012 | Role-Based Access Restriction | Restricted search and AI flow | RBAC | Must | E2E/RBAC | Limited role exists | Restricted records | Login as limited role, search restricted data, ask Hotel Brain restricted question, verify audit | Restricted data hidden/refused. |

## 14. Role-Based Access Control Test Cases

For each role below, execute login/access, module visibility, create/read/update/delete or archive permission, Search visibility, Hotel Brain answer visibility, Dashboard visibility, and Audit Log visibility checks.

| Test Case ID | Role | Modules to Verify | Expected Result |
| --- | --- | --- | --- |
| RBAC-TC-001 | General Manager | Dashboard, Operations, Incidents, Financials, AI, Search | Broad management visibility; restricted admin actions hidden unless granted. |
| RBAC-TC-002 | Operations Manager | Operations, Tasks, Housekeeping, Maintenance, Incidents | Operational actions available; admin/security/financial restricted unless granted. |
| RBAC-TC-003 | Front Desk Staff | Reservations, Guests, Rooms, Messages, Calls | Guest/reservation actions available; financial/security/admin restricted. |
| RBAC-TC-004 | Housekeeping Manager | Housekeeping, Rooms, Tasks | Housekeeping management available; unrelated sensitive modules restricted. |
| RBAC-TC-005 | Housekeeping Staff | Assigned housekeeping work | Limited read/update for assigned work only where applicable. |
| RBAC-TC-006 | Maintenance Manager | Maintenance, Smart Building, Rooms | Maintenance actions available; security/financial/admin restricted. |
| RBAC-TC-007 | Maintenance Staff | Assigned maintenance work | Limited maintenance execution access. |
| RBAC-TC-008 | Security Manager | Security, CCTV, Incidents | Security actions available; unrelated sensitive modules restricted. |
| RBAC-TC-009 | Security Staff | Security/CCTV monitoring | View/update assigned security work; admin/financial restricted. |
| RBAC-TC-010 | Finance User | Financials, Reservations/Guests references | Financial data visible; security/admin restricted. |
| RBAC-TC-011 | Concierge Staff | Concierge, Guests, Messages | Concierge actions available; financial/security/admin restricted. |
| RBAC-TC-012 | IT Administrator | Settings, Integrations, Users where granted | Integration and setup access available. |
| RBAC-TC-013 | System Administrator | All modules | Full access available and audited. |
| RBAC-TC-014 | Auditor | Audit/reporting | Audit read access only; operational writes restricted. |
| RBAC-TC-015 | AI Governance Reviewer | AI recommendations, audit | AI review actions available; unrelated operations restricted. |
| RBAC-TC-016 | Integration Administrator | Settings > Integrations | Integration configure/test/disable available; module data limited by role. |

## 15. Integration Test Cases

### Integration Manager

| Test Case ID | Test Title | Priority | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| INT-TC-001 | Open Settings > Integrations | Must | Login as Integration Admin; open Settings; select Integrations | Integration Manager loads. |
| INT-TC-002 | View integration categories | Must | Open Integration Manager | Categories display. |
| INT-TC-003 | Configure integration | Must | Select provider; enter details; save | Integration saved with masked credentials/reference. |
| INT-TC-004 | Test connection | Must | Click Test Connection | Success/failure state shown and audit logged. |
| INT-TC-005 | View health and logs | Should | Open integration health/log area | Health and logs display. |
| INT-TC-006 | Disable integration | Should | Disable integration | Status updates and audit logged. |

### CCTV Integration

| Test Case ID | Test Title | Priority | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| CCTV-TC-001 | Manual RTSP camera setup | Must | Select Manual Camera, RTSP, enter details, test, save | Configuration saved or clear RTSP gateway limitation shown. |
| CCTV-TC-002 | HLS camera setup | Must | Select HLS, enter URL/details, test, save | HLS camera saved/tested. |
| CCTV-TC-003 | MJPEG camera setup | Must | Select MJPEG, enter URL/details, test, save | MJPEG camera saved/tested. |
| CCTV-TC-004 | Snapshot URL setup | Should | Select Snapshot, enter URL/details, test, save | Snapshot camera saved/tested. |
| CCTV-TC-005 | ONVIF manual camera setup | Should | Select ONVIF, enter details, test | ONVIF setup supported or not-configured state shown. |
| CCTV-TC-006 | Local USB/browser camera preview | Must | Select USB/Local Camera, grant permission | Local preview appears and is labelled non-permanent CCTV. |
| CCTV-TC-007 | IP camera discovery workflow | Must | Enter subnet, start discovery | Scanning/results/not-configured state appears. |
| CCTV-TC-008 | NVR connection workflow | Must | Enter provider/host/channel count, test | Channels or failure shown. |
| CCTV-TC-009 | NVR channel import and mapping | Must | Select channels, import, map area | Cameras appear in Security Center. |
| CCTV-TC-010 | Failed stream test shows error | Must | Enter invalid stream details, test | Clear error state; no raw secret displayed. |

### Smart Building Integration

| Test Case ID | Test Title | Priority | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| INT-SB-TC-001 | Smart lock provider setup | Must | Select smart lock provider/protocol, enter details, test | Setup saved or clear provider limitation shown. |
| INT-SB-TC-002 | Sensor provider setup | Must | Configure sensor provider | Sensor integration saved/tested. |
| INT-SB-TC-003 | HVAC provider setup | Should | Configure HVAC provider | HVAC integration saved/tested or planned state shown. |
| INT-SB-TC-004 | Energy meter provider setup | Should | Configure energy meter provider | Energy integration saved/tested or planned state shown. |
| INT-SB-TC-005 | Manual device creation/import | Must | Add/import device and map location | Device appears in Smart Building. |
| INT-SB-TC-006 | Gateway/webhook setup | Should | Configure gateway/webhook | Connection state shown; credentials masked. |
| INT-SB-TC-007 | Device health and alert routing | Must | Trigger offline/fault/low battery event | Health updates and alert routes to correct module. |

## 16. Event Bus Test Cases

| Test Case ID | Event Area | Trigger | Expected Event |
| --- | --- | --- | --- |
| EVENT-TC-001 | Reservation | Create/update/cancel reservation | reservation.created/updated/cancelled |
| EVENT-TC-002 | Guest | Create/update guest | guest.created/updated |
| EVENT-TC-003 | Room | Change room status | room.status.changed |
| EVENT-TC-004 | Housekeeping | Create/update task | housekeeping.task.created/updated |
| EVENT-TC-005 | Maintenance | Create/update/close task | maintenance.task.created/updated/closed |
| EVENT-TC-006 | Incident | Create/update/close incident | incident.created/updated/closed |
| EVENT-TC-007 | CCTV | Import camera/status change | cctv.camera.imported/statusChanged |
| EVENT-TC-008 | Smart Building | Import/status change device | smartBuilding.device.imported/statusChanged |
| EVENT-TC-009 | Integration | Create/update/failure | integration.created/updated/connection.failed |
| EVENT-TC-010 | Search | Submit query | enterpriseSearch.query.submitted |
| EVENT-TC-011 | Hotel Brain | Generate answer | hotelBrain.answer.generated |
| EVENT-TC-012 | Notification | Create notification | notification.created/sent |
| EVENT-TC-013 | Audit | Create audit log | audit.recorded |

## 17. Audit Logging Test Cases

| Test Case ID | Audit Area | Action | Expected Result |
| --- | --- | --- | --- |
| AUDIT-TC-001 | Record creation | Create guest/reservation/task | Audit record exists. |
| AUDIT-TC-002 | Record update | Update guest/room/incident | Audit record exists. |
| AUDIT-TC-003 | Record delete/archive | Archive supported record | Audit record exists. |
| AUDIT-TC-004 | Reservation status | Check in/out/cancel | Audit record exists. |
| AUDIT-TC-005 | Housekeeping/Maintenance/Incident | Update statuses | Audit record exists. |
| AUDIT-TC-006 | Integration setup/test/device import | Configure/test/import | Audit record exists. |
| AUDIT-TC-007 | CCTV stream test | Test camera stream | Audit record exists. |
| AUDIT-TC-008 | Search query/restricted attempt | Search and restricted search | Audit record exists. |
| AUDIT-TC-009 | Hotel Brain query/answer/action | Ask question and suggested action | Audit record exists. |
| AUDIT-TC-010 | Sensitive action confirm/reject | Confirm/reject governed action | Audit record exists. |

## 18. Notification Test Cases

| Test Case ID | Notification Trigger | Recipient | Expected Result |
| --- | --- | --- | --- |
| NOTIF-TC-001 | Housekeeping delay | Housekeeping Manager/Ops | Notification created/sent. |
| NOTIF-TC-002 | Maintenance fault | Maintenance Team | Notification created/sent. |
| NOTIF-TC-003 | Incident escalation | Manager/Department Lead | Notification created/sent. |
| NOTIF-TC-004 | Security alert | Security/Manager | Notification created/sent. |
| NOTIF-TC-005 | CCTV offline | Security/IT | Notification created/sent. |
| NOTIF-TC-006 | Device offline/low battery | Maintenance/Smart Building | Notification created/sent. |
| NOTIF-TC-007 | Water leak/smoke/fire | Maintenance/Security/Manager | Critical notification created/sent. |
| NOTIF-TC-008 | Inventory low stock | Inventory/Ops | Notification created/sent. |
| NOTIF-TC-009 | Integration failure | IT/Admin | Notification created/sent. |
| NOTIF-TC-010 | Guest complaint | Operations/Guest Experience | Notification created/sent. |
| NOTIF-TC-011 | Hotel Brain attention item | Manager/Department Lead | Notification created/sent where applicable. |

## 19. Enterprise Search Test Cases

| Test Case ID | Test Title | Priority | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| SEARCH-TC-001 | Global search | Must | Use header search | Authorised results appear. |
| SEARCH-TC-002 | Advanced search | Must | Open Enterprise Search page and search | Results grouped and filterable. |
| SEARCH-TC-003 | Search by guest/room/reservation | Must | Search known records | Matching records appear. |
| SEARCH-TC-004 | Search by incident/maintenance task | Must | Search known incident/task | Matching records appear. |
| SEARCH-TC-005 | Search by CCTV camera/device | Must | Search camera/device | Matching authorised records appear. |
| SEARCH-TC-006 | Search by message/call/review/financial/user/integration/audit | Should | Search known records | Results appear only if authorised. |
| SEARCH-TC-007 | Category grouping and filters | Must | Apply category/status/severity filters | Results update correctly. |
| SEARCH-TC-008 | Result preview/source open | Must | Open preview and source | Preview/source navigation works. |
| SEARCH-TC-009 | Saved/recent searches | Should | Save search and revisit | Saved/recent searches display. |
| SEARCH-TC-010 | Permission filtering | Must | Search restricted data as limited user | Restricted records hidden and attempt logged. |
| SEARCH-TC-011 | No result state | Must | Search nonsense term | Clear no-result state appears. |
| SEARCH-TC-012 | Error state | Must | Simulate search API failure | Clear error state appears. |

## 20. Hotel Brain and AI Governance Test Cases

| Test Case ID | Test Title | Priority | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| AI-TC-001 | Ask daily GM briefing | Must | Ask for daily briefing | Summary, risks, priorities, evidence display. |
| AI-TC-002 | Ask what happened overnight | Must | Ask overnight question | Answer uses authorised records. |
| AI-TC-003 | Ask rooms not ready | Must | Ask room readiness question | Answer cites room/housekeeping records. |
| AI-TC-004 | Ask unresolved incidents | Must | Ask incident question | Answer cites authorised incidents. |
| AI-TC-005 | Ask offline devices/CCTV health/smart building risks | Must | Ask device/security questions | Answer cites authorised device/camera records. |
| AI-TC-006 | Ask overdue maintenance | Must | Ask maintenance question | Answer cites maintenance records. |
| AI-TC-007 | Ask guest complaints in last 7 days | Should | Ask complaint question | Answer cites authorised guest issue records. |
| AI-TC-008 | Restricted financial/security request | Must | Ask restricted question as unauthorised user | Restricted data is not exposed. |
| AI-TC-009 | Evidence/source records | Must | Ask question with supporting records | Evidence/source records display. |
| AI-TC-010 | Insufficient data response | Must | Ask question with no data | Safe insufficient-data response appears. |
| AI-TC-011 | Suggested action and confirmation | Must | Ask risk/action question | Suggested action shown; sensitive action requires confirmation/governance. |
| AI-TC-012 | AI audit/governance metadata | Must | Ask question and inspect audit/governance | AI query, answer, and suggested action are logged. |

## 21. Error Handling and Negative Test Cases

| Test Case ID | Negative Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| NEG-TC-001 | Required field missing | Submit form without required fields | Field validation errors display. |
| NEG-TC-002 | Invalid date | Enter invalid booking/calendar date | Validation error displays. |
| NEG-TC-003 | Invalid room selection | Select unavailable/invalid room | Error or blocked action appears. |
| NEG-TC-004 | Duplicate guest where applicable | Create duplicate guest | Duplicate handling or warning appears. |
| NEG-TC-005 | Invalid reservation status change | Attempt invalid transition | Action blocked with message. |
| NEG-TC-006 | Unauthorised access | Open restricted route/action | Access denied/restricted state appears. |
| NEG-TC-007 | Failed save/update | Simulate API failure | Error message appears and no false success shown. |
| NEG-TC-008 | Failed integration/invalid credentials/expired credentials | Test invalid provider details | Clear failure message and audit/log entry. |
| NEG-TC-009 | Failed camera stream/no cameras discovered | Test invalid camera/discovery | Clear error/no cameras state. |
| NEG-TC-010 | Device discovery failed | Trigger failed discovery | Clear failed discovery state. |
| NEG-TC-011 | Search unavailable/no results | Simulate search failure or no result | Error or no-result state appears. |
| NEG-TC-012 | Hotel Brain unavailable/restricted request | Simulate AI failure or restricted question | Safe error/refusal; no restricted data. |
| NEG-TC-013 | Event Bus failure | Simulate publish failure | User-facing flow handles gracefully and logs issue where possible. |
| NEG-TC-014 | Audit/notification failure | Simulate audit/notification failure | Failure is observable; core data integrity preserved where appropriate. |

## 22. Regression Test Suite

| Test Case ID | Regression Area | Expected Result |
| --- | --- | --- |
| REG-TC-001 | Login/access where applicable | User can access allowed modules only. |
| REG-TC-002 | Dashboard load | Dashboard loads without runtime errors. |
| REG-TC-003 | Reservation creation | Reservation can be created. |
| REG-TC-004 | Guest creation | Guest can be created. |
| REG-TC-005 | Room status update | Room status persists. |
| REG-TC-006 | Housekeeping status update | Housekeeping update affects room readiness. |
| REG-TC-007 | Maintenance task creation | Maintenance task created. |
| REG-TC-008 | Incident creation | Incident created. |
| REG-TC-009 | Integration Manager load | Integration Manager loads. |
| REG-TC-010 | CCTV integration setup | Basic CCTV setup flow renders and validates. |
| REG-TC-011 | Smart Building device display | Devices display. |
| REG-TC-012 | Enterprise Search query | Search returns authorised results/no-result state. |
| REG-TC-013 | Hotel Brain query | Hotel Brain returns safe answer/error state. |
| REG-TC-014 | Audit log creation | Critical action creates audit log. |
| REG-TC-015 | Notification creation | Trigger creates notification. |
| REG-TC-016 | Role-based restriction | Restricted user cannot access restricted data. |

## 23. UAT Test Suite

| Test Case ID | Business Scenario | User Role | Steps | Expected Business Outcome | Pass/Fail | Comments |
| --- | --- | --- | --- | --- | --- | --- |
| UAT-TC-001 | Review morning hotel status | General Manager | Open Dashboard, Operations Center, Hotel Brain briefing | GM sees key risks, room readiness, incidents, and priorities. |  |  |
| UAT-TC-002 | Process arriving guest | Front Desk Staff | Create reservation, assign room, check in guest | Guest is checked in with accurate room/guest records. |  |  |
| UAT-TC-003 | Manage room turnover | Housekeeping Manager | Review dirty rooms, assign tasks, inspect rooms | Rooms become ready for sale/arrival. |  |  |
| UAT-TC-004 | Resolve maintenance issue | Maintenance Manager | Create/assign/close maintenance fault | Fault is resolved and room/device status updated. |  |  |
| UAT-TC-005 | Respond to security incident | Security Manager | Review alert, create/close incident | Security event is investigated and closed. |  |  |
| UAT-TC-006 | Configure CCTV integration | IT/Integration Administrator | Configure/test/import/map camera | Camera appears in Security Center with health. |  |  |
| UAT-TC-007 | Review financial position | Finance User | Open Financials and review payment/revenue records | Finance user sees authorised financial data. |  |  |
| UAT-TC-008 | Coordinate operations | Operations Manager | Review Operations Center, assign/escalate tasks | Blockers are visible and actionable. |  |  |

## 24. Test Execution Summary Template

| Field | Value |
| --- | --- |
| Test Cycle |  |
| Date |  |
| Tester |  |
| Environment |  |
| Total Test Cases |  |
| Passed |  |
| Failed |  |
| Blocked |  |
| Not Run |  |
| Pass Percentage |  |
| Open Critical Defects |  |
| Open High Defects |  |
| Key Risks |  |
| Recommendation |  |
| Sign-Off Status |  |

## 25. Defect Log Template

| Field | Value |
| --- | --- |
| Defect ID |  |
| Date Raised |  |
| Raised By |  |
| Test Case ID |  |
| Module |  |
| Defect Title |  |
| Description |  |
| Steps to Reproduce |  |
| Expected Result |  |
| Actual Result |  |
| Severity |  |
| Priority |  |
| Screenshots/Evidence |  |
| Assigned To |  |
| Status |  |
| Retest Date |  |
| Retest Result |  |
| Closure Comments |  |

## 26. Sign-Off Checklist

- [ ] Test environment confirmed.
- [ ] Test data confirmed.
- [ ] User roles confirmed.
- [ ] Smoke/regression tests completed.
- [ ] Functional module tests completed.
- [ ] E2E tests completed.
- [ ] RBAC tests completed.
- [ ] Integration workflow tests completed.
- [ ] Enterprise Search tests completed.
- [ ] Hotel Brain and AI governance tests completed.
- [ ] Audit tests completed.
- [ ] Notification tests completed.
- [ ] Critical defects resolved.
- [ ] High defects resolved or accepted.
- [ ] Blocked hardware/API tests documented.
- [ ] Product owner review completed.
- [ ] Stakeholder sign-off completed.

## Test Pack Completion Summary

This QA Test Pack covers the full LaFlo Enterprise Hotel Operations Platform across Platform Core, core business modules, operations modules, Smart Building, integrations, Enterprise Search, Hotel Brain, AI governance, RBAC, audit, notifications, negative testing, regression, UAT, and end-to-end workflows.

It is ready for manual test case execution and can be used as the basis for future automated regression tests.

## Key Test Assumptions

- QA has access to seeded data and all role-based test accounts.
- Required migrations have been applied.
- Search index is available or rebuildable.
- Hardware/API-dependent tests may require simulation or vendor access.
- AI responses are evaluated against available authorised data only.

## Key Dependencies

- Test environment stability.
- Database migration and seed data.
- Integration Manager availability.
- Event Bus, Task Engine, Notification Engine, Audit Engine, and Integration Hub availability.
- Hardware/API access for real CCTV and Smart Building validation.
- AI provider configuration where generative AI paths are tested.

## Recommended Execution Order

1. Environment readiness and smoke checks.
2. RBAC baseline checks.
3. Core business module functional tests.
4. Operations module functional tests.
5. Integration Manager, CCTV, and Smart Building setup tests.
6. Event Bus, audit, and notification validation.
7. Enterprise Search tests.
8. Hotel Brain and AI governance tests.
9. End-to-end scenarios.
10. Regression suite.
11. UAT scenarios.
12. Defect retest and sign-off.

## Defect Triage Recommendation

- Triage Critical and High defects daily during test execution.
- Block release/sign-off for Critical defects.
- Block sign-off for High defects unless explicitly accepted by product owner.
- Group Medium defects by module and assign to the next stabilization sprint.
- Track Low defects as polish or backlog items.
- Separately tag defects blocked by real hardware/API access.

## Final Sign-Off Checklist

- [ ] All Must-priority tests executed.
- [ ] All E2E tests executed or blocked with accepted reason.
- [ ] RBAC and restricted data tests passed.
- [ ] Enterprise Search permission filtering passed.
- [ ] Hotel Brain restricted data handling passed.
- [ ] Audit logging validated for critical actions.
- [ ] Notification workflows validated.
- [ ] Integration limitations documented.
- [ ] Product owner accepts remaining risks.
- [ ] QA recommends release/UAT sign-off.
