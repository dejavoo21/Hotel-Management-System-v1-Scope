# Business Requirements Document

## LaFlo Enterprise Hotel Operations Platform

Date: 2026-07-11  
Version: 1.0  
Status: Draft for QA, Product Owner Review, Developer Handover, and Stakeholder Sign-Off

## 1. Document Control

| Field | Value |
| --- | --- |
| Document Name | LaFlo Enterprise Hotel Operations Platform BRD |
| Platform Name | LaFlo Enterprise Hotel Operations Platform |
| Version | 1.0 |
| Date | 2026-07-11 |
| Prepared By | Product / Implementation Team |
| Reviewed By | TBD |
| Approved By | TBD |

### Change History

| Version | Date | Author | Description |
| --- | --- | --- | --- |
| 1.0 | 2026-07-11 | Product / Implementation Team | Initial full-system BRD covering core hotel operations, operations modules, integrations, search, AI, QA scope, and sign-off criteria. |

## 2. Executive Summary

LaFlo Enterprise Hotel Operations Platform is an enterprise-grade hotel operations system designed to centralise and automate hotel workflows across guest management, reservations, rooms, housekeeping, maintenance, inventory, financials, security, smart building operations, incident management, communications, reviews, integrations, and AI-powered operational intelligence.

The platform is built around a shared Platform Core consisting of an Event Bus, Task Engine, Notification Engine, Audit Engine, and Integration Hub. These shared services ensure that modules communicate consistently, integrations are governed centrally, actions are auditable, tasks are reusable across departments, and AI consumes approved operational context.

This BRD defines the full business scope, functional and non-functional requirements, data requirements, integration requirements, acceptance criteria, and end-to-end testing scope needed to validate the platform before full regression, QA, UAT, and stakeholder sign-off.

## 3. Business Background

Hotel operations often depend on fragmented tools, manual communication, disconnected devices, siloed departments, and inconsistent reporting. Front desk teams need accurate room readiness, housekeeping needs clear turnover priorities, maintenance needs fast fault routing, security needs unified visibility, managers need operational summaries, and executives need reliable KPIs.

LaFlo addresses this by providing a unified operational platform that connects core PMS workflows, department execution, smart building data, physical security, communications, AI intelligence, and enterprise search into one permission-aware system.

## 4. Business Objectives

- Centralise hotel operational workflows.
- Improve visibility across hotel departments.
- Improve guest experience and service response.
- Reduce manual coordination between front desk, housekeeping, maintenance, security, and management.
- Improve room readiness tracking.
- Improve incident and maintenance response.
- Improve security monitoring and CCTV visibility.
- Improve smart building device visibility.
- Improve integration governance.
- Provide AI-assisted decision support.
- Enable enterprise-wide search and investigation.
- Improve auditability, accountability, and operational traceability.
- Support future multi-property enterprise growth.

## 5. Current Problem / Business Need

The business needs a platform that reduces:

- Fragmented operational data.
- Lack of central visibility.
- Manual room readiness coordination.
- Disconnected housekeeping, maintenance, and guest service workflows.
- Limited smart building and CCTV integration.
- Limited operational intelligence.
- Difficulty searching across records.
- Limited audit trail across operational actions.
- Risk of scattered credentials and integrations.
- Slow response to guest complaints and operational incidents.
- Inconsistent escalation and notification handling.

## 6. Proposed Solution

LaFlo will serve as an integrated enterprise hotel operations platform with:

- Central dashboard.
- Core business modules.
- Operations Center.
- Security Center.
- Smart Building Center.
- Maintenance Center.
- Incident Center.
- Integration Manager.
- Enterprise Search.
- Hotel Brain.
- AI Context Engine.
- Event-driven platform architecture.

All modules should use shared Platform Core services where appropriate:

- Event Bus for cross-module event communication.
- Task Engine for operational task generation and lifecycle management.
- Notification Engine for alerts and department communication.
- Audit Engine for traceability.
- Integration Hub for external systems and hardware providers.

## 7. Platform Scope

### 7.1 Platform Core

The Platform Core provides the shared foundation for all modules:

- Event Bus
- Task Engine
- Notification Engine
- Audit Engine
- Integration Hub

Development principles:

- Do not redesign existing modules unnecessarily.
- Use enterprise architecture consistently.
- No direct module-to-module communication where Event Bus should be used.
- Integration setup should go through Integration Manager.
- Raw credentials should not be stored in module state.
- Audit Engine should log important user and system actions.
- Notification Engine should handle relevant alerts.
- Task Engine should handle generated operational tasks.
- AI should consume approved context through AI Context Engine.
- Role-based access control should apply across the platform.
- Enterprise Search and Hotel Brain must not expose restricted data.

### 7.2 Dashboard

Dashboard should provide a high-level operational view including:

- Today's arrivals.
- Today's departures.
- Occupancy.
- Room readiness.
- Housekeeping status.
- Maintenance issues.
- Open incidents.
- Guest experience alerts.
- Financial summary where authorised.
- Integration health.
- Smart building health.
- CCTV health.
- Hotel Brain shortcut.
- Enterprise Search shortcut.

### 7.3 Reservations

Reservations should support:

- Create reservation.
- View reservation.
- Update reservation.
- Cancel reservation.
- Check-in workflow.
- Check-out workflow.
- Reservation status.
- Room assignment.
- Guest link.
- Payment/financial link where applicable.
- Notes and special requests.
- Calendar visibility.

### 7.4 Guests

Guests should support:

- Guest profile creation.
- Guest profile update.
- Contact details.
- Stay history.
- Preferences.
- Complaints/issues.
- Messages/calls link.
- Reservation link.
- Review link.
- Privacy and access controls.

### 7.5 Rooms

Rooms should support:

- Room inventory.
- Room type.
- Room status.
- Occupancy status.
- Clean/dirty/inspected status.
- Out of service status.
- Linked housekeeping tasks.
- Linked maintenance tasks.
- Linked incidents.
- Linked smart building devices where applicable.

### 7.6 Housekeeping

Housekeeping should support:

- Housekeeping task creation.
- Room cleaning status.
- Room inspection status.
- Staff assignment.
- Priority handling.
- Turnover workflow.
- Status updates.
- Escalation of blockers.
- Link to rooms, reservations, maintenance, and incidents.

### 7.7 Inventory

Inventory should support:

- Item records.
- Stock levels.
- Reorder thresholds.
- Department ownership.
- Supplier information.
- Stock movements.
- Low-stock alerts.
- Maintenance/housekeeping supply links.

### 7.8 Calendar

Calendar should support:

- Reservation calendar.
- Housekeeping schedule.
- Maintenance schedule.
- Events.
- Staff/department activities where applicable.
- Operational planning.

### 7.9 Financials

Financials should support:

- Invoice/payment records where applicable.
- Revenue summary.
- Charges.
- Refunds where applicable.
- Payment status.
- Financial dashboard where authorised.
- Links to reservations and guests.

### 7.10 Reviews

Reviews should support:

- Guest review records.
- Review source.
- Rating.
- Sentiment.
- Response status.
- Linked guest/reservation where applicable.
- Escalation to Operations Center or Incident Center where required.

### 7.11 Concierge

Concierge should support:

- Guest requests.
- Request categories.
- Assignment.
- Status tracking.
- Priority.
- Notes.
- Escalation to relevant department.

### 7.12 Messages

Messages should support:

- Guest/staff messages.
- Message history.
- Linked guest/reservation/room where applicable.
- Status and follow-up.
- Escalation where required.

### 7.13 Calls

Calls should support:

- Call log.
- Caller details.
- Call notes.
- Linked guest/reservation/room where applicable.
- Follow-up actions.
- Escalation where required.

### 7.14 User Management

User Management should support:

- User creation.
- User update.
- Roles.
- Permissions.
- Department assignment.
- Account status.
- Access control.
- Audit history where applicable.

### 7.15 Operations Center

Operations Center should provide:

- Cross-department operational view.
- Alerts.
- Tasks.
- Blockers.
- Escalations.
- Guest experience issues.
- Daily operational status.
- Department workload.
- Overnight summary.
- Critical attention items.

### 7.16 Security Center

Security Center should provide:

- CCTV camera overview.
- Security alerts.
- Access events.
- Door events.
- Restricted area events.
- CCTV health status.
- Smart lock/security sensor events.
- Incident escalation.

### 7.17 Smart Building

Smart Building should provide:

- Device inventory.
- Device health.
- Sensors.
- Doors.
- Energy.
- HVAC.
- Assets.
- Smart lock status.
- Building health score.
- Room/floor/device mapping.

### 7.18 Maintenance Center

Maintenance Center should provide:

- Maintenance task management.
- Fault tracking.
- Preventive maintenance where applicable.
- Device fault alerts.
- Room maintenance issues.
- Assignment.
- Status tracking.
- Escalation.

### 7.19 Incident Center

Incident Center should provide:

- Incident creation.
- Incident classification.
- Severity.
- Status.
- Assignment.
- Investigation notes.
- Linked records.
- Security incidents.
- Safety incidents.
- Guest experience incidents.
- Smart building incidents.
- Escalation and closure.

### 7.20 Integration Manager

Integration Manager should provide central setup and monitoring for:

- CCTV.
- Smart Locks.
- Sensors.
- HVAC.
- Energy Meters.
- Weather.
- Payments.
- Booking Channels.
- Microsoft 365.
- OpenAI / AI Providers.
- Other Providers.

### 7.21 Enterprise Search

Enterprise Search should provide:

- Global search.
- Advanced search.
- Category filters.
- Result preview.
- Saved searches.
- Recent searches.
- Permission-filtered results.

### 7.22 Hotel Brain

Hotel Brain should provide:

- Natural language operational questions.
- Evidence-based answers.
- Suggested actions.
- Daily/department summaries.
- Operational risk summary.
- Restricted-data protection.
- AI governance logging.

## 8. Out of Scope

- Physical installation of hotel hardware.
- Guaranteed support for all vendor APIs without credentials/API access.
- Production payment certification unless separately agreed.
- Production booking channel certification unless separately agreed.
- Advanced autonomous AI decisions without human approval.
- Real CCTV/NVR testing without hardware.
- Real smart building testing without hardware/API access.
- Full mobile app if not currently implemented.
- Guest-facing mobile app if not currently implemented.
- Production RTSP browser streaming without a media gateway.
- Legal/compliance certification beyond platform requirements unless separately agreed.

## 9. User Roles and Stakeholders

| Role | Primary Responsibilities | Typical Modules | Typical Actions | Access Restrictions |
| --- | --- | --- | --- | --- |
| General Manager | Overall hotel performance and risk oversight | Dashboard, Operations Center, Incident Center, Financials, Hotel Brain | Review daily briefing, monitor KPIs, approve actions | Financial/security access based on permissions |
| Operations Manager | Cross-department execution | Operations Center, Tasks, Housekeeping, Maintenance, Incidents | Assign work, resolve blockers, review priorities | Limited user/admin settings unless granted |
| Front Desk Staff | Guest arrival, departure, reservations | Reservations, Guests, Rooms, Messages, Calls | Create booking, check in/out, answer guest issues | Restricted financial/admin/security data |
| Housekeeping Manager | Room turnover and staff coordination | Housekeeping, Rooms, Tasks, Operations Center | Assign rooms, inspect rooms, escalate blockers | Restricted financial/security/admin data |
| Housekeeping Staff | Cleaning and inspection execution | Housekeeping, Rooms | Update room status, complete tasks | Limited guest/admin/financial access |
| Maintenance Manager | Maintenance team execution | Maintenance Center, Smart Building, Incidents | Assign repairs, resolve faults, monitor devices | Restricted financial/admin data |
| Maintenance Staff | Repair and inspection execution | Maintenance Center, Rooms, Smart Building | Update work orders, complete repairs | Limited guest/financial/security access |
| Security Manager | Security monitoring and incident response | Security Center, CCTV, Incidents, Smart Building | Review alerts, investigate incidents, manage cameras | Restricted admin/financial data unless granted |
| Security Staff | CCTV and access event monitoring | Security Center, CCTV, Incidents | View cameras, acknowledge alerts | Limited admin/financial data |
| Finance User | Revenue, invoices, payments | Financials, Reservations, Guests | Review revenue, payments, balances | Restricted security/admin data |
| Concierge Staff | Guest service fulfilment | Concierge, Guests, Messages, Tasks | Create requests, update status | Restricted financial/security data |
| IT Administrator | Integrations, users, system health | Settings, Integrations, User Management, Audit Logs | Configure integrations, manage access | Requires elevated access |
| System Administrator | Full platform administration | All modules | Configure system, users, integrations | Highest access, audited |
| Auditor | Audit and compliance review | Audit Logs, Reports | Review actions and access history | Read-only where possible |
| AI Governance Reviewer | AI recommendation oversight | Operations Center, AI Governance, Audit Logs | Approve/reject recommendations | Restricted to governed AI actions |
| Integration Administrator | Provider setup and monitoring | Settings > Integrations | Configure/test providers | No raw secret exposure after save |
| Department Manager | Department performance | Relevant department modules | Assign tasks, monitor team | Module-limited access |

## 10. Business Process Overview

Main business processes:

1. Reservation to check-in.
2. Check-in to room readiness.
3. Housekeeping room turnover.
4. Guest request handling.
5. Maintenance issue handling.
6. Incident reporting and escalation.
7. Security alert handling.
8. Smart building fault handling.
9. Inventory low stock handling.
10. Guest review handling.
11. Payment/financial record handling.
12. Integration setup and monitoring.
13. Enterprise search and investigation.
14. Hotel Brain operational briefing.
15. Daily GM briefing.

## 11. End-to-End User Journeys

### Journey 1: Reservation to Check-In

1. Reservation is created.
2. Guest profile is linked or created.
3. Room is assigned or selected later.
4. Room readiness is checked.
5. Housekeeping status is confirmed.
6. Maintenance blockers are checked.
7. Guest is checked in.
8. Dashboard updates.
9. Audit log is created.

### Journey 2: Room Turnover

1. Guest checks out.
2. Room status changes.
3. Housekeeping task is created.
4. Housekeeping completes cleaning.
5. Inspection is completed.
6. Room becomes ready.
7. Dashboard updates.
8. Reservation availability updates.

### Journey 3: Guest Complaint to Resolution

1. Complaint is logged through Messages, Calls, Reviews, or Concierge.
2. Operations Center receives alert.
3. Task or incident is created.
4. Owner is assigned.
5. Resolution is tracked.
6. Guest profile is updated.
7. Dashboard and Hotel Brain can surface the issue.

### Journey 4: Maintenance Fault

1. Fault is reported manually or from smart building device.
2. Maintenance task is created.
3. Priority is assigned.
4. Technician is assigned.
5. Status is updated.
6. Room/device status updates.
7. Resolution is logged.
8. Audit trail is created.

### Journey 5: Security Event

1. Door forced open, access denied, or CCTV issue occurs.
2. Security Center receives alert.
3. Incident is created if required.
4. Security user investigates.
5. Incident is updated/closed.
6. Audit log is created.

### Journey 6: CCTV Integration Setup

1. Admin opens Settings > Integrations > CCTV.
2. Admin selects connection method.
3. Admin tests connection.
4. Cameras or NVR channels are imported.
5. Cameras are mapped to areas.
6. Security Center displays cameras.
7. Health status is monitored.

### Journey 7: Smart Building Device Setup

1. Admin opens Settings > Integrations > Smart Building.
2. Admin selects device category/provider.
3. Admin tests connection.
4. Devices are discovered/imported.
5. Devices are mapped to rooms/floors/areas.
6. Devices appear in Smart Building.
7. Alerts route to Maintenance/Security/Incident Center.

### Journey 8: Enterprise Search Investigation

1. User searches for room, guest, incident, device, camera, or task.
2. Results are filtered by permission.
3. User opens result preview.
4. User opens source record.
5. Audit log is created where appropriate.

### Journey 9: Hotel Brain Operational Question

1. User asks operational question.
2. Hotel Brain uses authorised platform context.
3. Answer includes evidence.
4. Suggested actions are shown.
5. Sensitive actions require confirmation.
6. AI governance/audit log is created.

### Journey 10: Daily GM Briefing

1. AI Context Engine gathers authorised operational context.
2. Hotel Brain/Daily GM Briefing summarises key issues.
3. GM sees rooms not ready, open incidents, maintenance blockers, guest alerts, device issues, and integration health.
4. Suggested priorities are shown.

## 12. Functional Requirements

| ID | Requirement | Priority | Source Module | User Role | Acceptance Reference |
| --- | --- | --- | --- | --- | --- |
| DASH-FR-001 | Display arrivals, departures, occupancy, room readiness, incidents, integration health, smart building health, and shortcuts. | Must | Dashboard | Manager, GM | AC-DASH-001 |
| RES-FR-001 | Support reservation creation, update, cancellation, room assignment, check-in, and check-out. | Must | Reservations | Front Desk | AC-RES-001 |
| GUEST-FR-001 | Support guest profile, contact details, preferences, stay history, and linked records. | Must | Guests | Front Desk | AC-GUEST-001 |
| ROOM-FR-001 | Track room type, occupancy, housekeeping status, maintenance status, and linked tasks/incidents. | Must | Rooms | Front Desk, Housekeeping | AC-ROOM-001 |
| HK-FR-001 | Support room cleaning, inspection, assignment, priority, and turnover workflow. | Must | Housekeeping | Housekeeping | AC-HK-001 |
| INV-FR-001 | Track item records, stock levels, reorder thresholds, and low-stock alerts. | Should | Inventory | Operations | AC-INV-001 |
| CAL-FR-001 | Provide calendar visibility for reservations and operational schedules. | Should | Calendar | Operations | AC-CAL-001 |
| FIN-FR-001 | Provide authorised revenue, invoice, charge, refund, and payment status visibility. | Must | Financials | Finance, Manager | AC-FIN-001 |
| REV-FR-001 | Track reviews, ratings, sentiment, response status, and escalation. | Should | Reviews | Manager, Guest Experience | AC-REV-001 |
| CON-FR-001 | Track concierge requests, categories, assignment, status, and escalation. | Should | Concierge | Concierge | AC-CON-001 |
| MSG-FR-001 | Track messages and support conversations linked to guest/reservation/room where applicable. | Must | Messages | Front Desk, Support | AC-MSG-001 |
| CALL-FR-001 | Track calls, call notes, linked records, and follow-up actions. | Should | Calls | Front Desk, Support | AC-CALL-001 |
| USER-FR-001 | Support user creation, roles, permissions, account status, and access control. | Must | User Management | Admin | AC-USER-001 |
| OPS-FR-001 | Provide cross-department operational visibility, blockers, escalations, and priorities. | Must | Operations Center | Manager | AC-OPS-001 |
| SEC-FR-001 | Display CCTV, access/security alerts, door events, and incident escalation. | Must | Security Center | Security | AC-SEC-001 |
| SB-FR-001 | Display smart building devices, health, sensors, doors, energy, HVAC, and mapping. | Must | Smart Building | Maintenance, Security | AC-SB-001 |
| MAINT-FR-001 | Track work orders, faults, repairs, assignment, priority, and closure. | Must | Maintenance Center | Maintenance | AC-MAINT-001 |
| INC-FR-001 | Support incident classification, severity, assignment, notes, linked records, and closure. | Must | Incident Center | Manager, Security | AC-INC-001 |
| INT-FR-001 | Provide central provider setup, connection testing, device import, mapping, health, and logs. | Must | Integration Manager | Admin, IT | AC-INT-001 |
| CCTV-FR-001 | Support local camera, discovery, NVR, manual camera, and cloud camera setup patterns. | Must | CCTV Integration | Admin, Security | AC-CCTV-001 |
| SEARCH-FR-001 | Provide global and advanced permission-filtered search across platform records. | Must | Enterprise Search | All authorised users | AC-SEARCH-001 |
| AI-FR-001 | Provide AI context, briefings, department intelligence, governed recommendations, Copilot, Operations Concierge, and Hotel Brain. | Must | AI | Manager, Department Leads | AC-AI-001 |

## 13. Non-Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| NFR-001 | Core pages should load within acceptable enterprise application response times under normal hotel data volumes. | Must |
| NFR-002 | The platform should support growth from one hotel to multi-property enterprise operation. | Must |
| NFR-003 | All hotel-scoped records must remain isolated by hotel where applicable. | Must |
| NFR-004 | Role-based access control must apply consistently across frontend navigation and backend endpoints. | Must |
| NFR-005 | Raw credentials, tokens, API keys, and secrets must not be exposed to the frontend. | Must |
| NFR-006 | Audit logs must capture important user and system actions. | Must |
| NFR-007 | Event Bus workflows should degrade safely if downstream consumers are unavailable. | Should |
| NFR-008 | The UI should include loading, empty, error, success, and restricted states. | Must |
| NFR-009 | The platform should be usable on modern desktop and tablet browsers. | Must |
| NFR-010 | Responsive design should be maintained where practical. | Should |
| NFR-011 | Accessibility should follow WCAG 2.0-aligned practices where practical. | Should |
| NFR-012 | AI outputs must include governance controls and avoid exposing restricted data. | Must |
| NFR-013 | Integrations should provide clear health and failure states. | Must |
| NFR-014 | Search indexing should be maintainable and avoid blocking operational workflows. | Should |
| NFR-015 | The application should build without TypeScript or import errors before release. | Must |

## 14. Data Requirements

| Entity | Description | Key Fields | Source Module | Related Entities | Access Restrictions |
| --- | --- | --- | --- | --- | --- |
| Guest | Hotel guest profile | id, name, contact, preferences, status | Guests | Reservations, Messages, Reviews | Guest data permission |
| Reservation | Booking/stay record | id, dates, status, room, guest, rate | Reservations | Guest, Room, Financials | Reservations permission |
| Room | Physical hotel room | id, number, type, status, housekeepingStatus | Rooms | Reservation, Housekeeping, Maintenance | Rooms permission |
| Housekeeping Task | Cleaning/inspection task | id, roomId, status, assignee, priority | Housekeeping | Room, Reservation | Housekeeping permission |
| Maintenance Task | Work order/fault/repair task | id, title, status, priority, room/device | Maintenance | Room, Device, Incident | Maintenance permission |
| Incident | Cross-module incident record | id, number, severity, status, category | Incident Center | Tasks, Alerts, Devices | Incident permission |
| Inventory Item | Stock item | id, name, quantity, threshold, supplier | Inventory | Departments, Tasks | Inventory permission |
| Calendar Event | Scheduled activity | id, title, date, type, module | Calendar | Reservations, Tasks | Calendar permission |
| Financial Record | Invoice/payment/revenue record | id, amount, status, guest, reservation | Financials | Reservation, Guest | Financial permission |
| Review | Guest review | id, source, rating, sentiment, responseStatus | Reviews | Guest, Reservation | Reviews permission |
| Concierge Request | Guest service request | id, category, status, assignee, priority | Concierge | Guest, Reservation | Concierge permission |
| Message | Conversation/message | id, thread, sender, status, linkedEntity | Messages | Guest, Ticket | Messages permission |
| Call Log | Call record | id, caller, notes, linkedEntity, followUp | Calls | Guest, Reservation | Messages/Calls permission |
| User | Staff user | id, email, role, permissions, status | User Management | Audit Logs, Tasks | Admin/users permission |
| Role | User role | id/name, access level | User Management | User, Permission | Admin/users permission |
| Permission | Module permission | id, module | User Management | User | Admin/users permission |
| Integration | Provider connection record | id, category, provider, status, health | Integration Manager | Devices, Logs | Settings/integration permission |
| Credential Reference | Reference to stored secret | id/ref, masked label | Integration Manager | Integration | Never raw exposed |
| CCTV Camera | Camera record | id, name, provider, protocol, location, status | CCTV | Security Center | Security permission |
| NVR Channel | NVR channel/camera mapping | id, nvrId, channel, cameraName | CCTV | CCTV Camera | Security permission |
| Smart Building Device | IoT device | id, type, status, health, location | Smart Building | Sensor Readings, Incidents | Smart Building permission |
| Sensor Reading | Device telemetry | id, deviceId, metric, value, timestamp | Smart Building | Device | Smart Building permission |
| Energy Reading | Energy telemetry | id, meter, value, timestamp | Smart Building | Device | Smart Building permission |
| HVAC Reading | HVAC telemetry | id, unit, status, temperature | Smart Building | Device | Smart Building permission |
| Door Event | Door/access event | id, doorId, eventType, timestamp | Security/Smart Building | Device, Security Alert | Security permission |
| Security Event | Security alert/event | id, type, severity, status | Security Center | Incident, Device | Security permission |
| Audit Log | Action history | id, actor, action, entity, timestamp | Audit Engine | User, Entity | Admin/auditor restricted |
| Notification | Notification record | id, recipient, channel, priority, status | Notification Engine | User, Task, Incident | Recipient/admin |
| Task | Shared operational task | id, title, department, status, priority | Task Engine | Module records | Department permission |
| Search Index Record | Indexed searchable record | searchId, entityId, sourceModule, accessScope | Enterprise Search | Source records | Permission filtered |
| AI Recommendation | Governed AI action | id, source, title, status, confidence | AI Governance | Tasks, Audit | Manager/AI governance |
| Hotel Brain Query | User AI query | id, userId, question, timestamp | Hotel Brain | Answer, Audit | User/admin restricted |
| Hotel Brain Answer | AI response | id, queryId, answer, evidence, confidence | Hotel Brain | Query, Records | Permission filtered |

## 15. Integration Requirements

| Integration | Business Purpose | Provider Examples | Connection Method | Data Exchanged | Trigger Events | Error Handling | Security Requirements | Current Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CCTV | Camera monitoring and security visibility | Hikvision, Dahua, Axis | RTSP, HLS, MJPEG, ONVIF, NVR, Cloud | Camera metadata, health, stream status | camera imported, test, offline | Clear connection/stream failures | No raw credentials or RTSP URLs exposed | Implemented with simulated/placeholder provider behavior |
| NVR | Multi-channel camera import | Hikvision, Dahua, Axis | Host/port/user/password/channel count | Channel metadata, health | nvr connected, channel imported | Failed test/channel import states | Masked credentials | Simulated until hardware/API available |
| Local Camera | Staff device camera preview | Browser webcam | Browser getUserMedia | Local stream only | local preview started/stopped | Permission denied states | Not stored as CCTV | Implemented as local preview |
| Smart Locks | Door lock/access visibility | TTLock, SALTO | Vendor API, MQTT, Webhook | Lock status, events | lock event, forced open | Device offline/fault states | Credential reference | Planned/provider-dependent |
| Sensors | Operational telemetry | Generic IoT | MQTT, REST, Webhook | Sensor readings | reading received, fault | Offline/fault states | Credential reference | Partially implemented patterns |
| HVAC | Environmental control/monitoring | BACnet/Modbus vendors | BACnet, Modbus, REST | Temperature, mode, fault | hvac fault/status | Connection/fault state | Credential reference | Planned |
| Energy Meters | Energy monitoring | Modbus meters | Modbus, MQTT, REST | Energy readings | threshold exceeded | Device/reading failure | Credential reference | Planned |
| Weather | Operational planning | OpenWeather | REST API | Current weather, forecast, alerts | forecast refreshed | API unavailable/stale state | API key masked | Implemented/partially integrated |
| Payments | Payment processing | Stripe, PayPal, gateways | API | Payment status, transaction refs | payment confirmed/failed | Payment failure states | PCI-safe, no raw card storage | Partially implemented/payment-provider agnostic |
| Booking Channels | OTA/channel sync | Booking.com, Expedia | API | Bookings, availability, rates | booking sync | Sync failure | API credentials masked | Planned |
| Microsoft 365 | Productivity integration | Outlook, Teams | OAuth/API | Calendar/email/team events | sync events | Token expired | OAuth secure storage | Planned |
| OpenAI / AI Providers | AI intelligence | OpenAI | API | Prompts/context/answers | AI generated | Fallback/no config state | No secrets exposed | Partially implemented |
| Generic REST API | Future provider integration | Any provider | REST | Provider-specific | provider event | Connection failure | Credential reference | Planned |
| Webhooks | Inbound events | Vendor webhooks | HTTP POST | Events/status | webhook received | Signature/validation failure | HMAC/API key planned | Planned/partial |
| MQTT | IoT messaging | MQTT brokers | MQTT | Telemetry/events | message received | broker unavailable | Secure credentials | Planned |
| BACnet | Building automation | BACnet devices | Gateway | HVAC/building data | status event | gateway failure | Network isolation | Planned |
| Modbus | Energy/HVAC telemetry | Modbus devices | Gateway | Readings/status | threshold/fault | gateway failure | Network isolation | Planned |
| ONVIF | Camera discovery/control | ONVIF cameras | ONVIF | Camera metadata/discovery | camera discovered | discovery not configured | Credential reference | Placeholder/simulated |

## 16. Reporting and Dashboard Requirements

Reports and dashboard views should include:

- Executive dashboard.
- Operations dashboard.
- Room readiness report.
- Housekeeping report.
- Maintenance report.
- Incident report.
- Security report.
- Smart building report.
- CCTV health report.
- Integration health report.
- Guest experience report.
- Financial report where authorised.
- Audit report.
- AI recommendation report.

Reporting must respect permissions, hotel scope, and sensitive data rules.

## 17. AI and Automation Requirements

| Capability | Business Purpose | Data Sources | User Roles | Outputs | Limitations | Human Confirmation | Audit/Governance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI Context Engine | Centralise approved hotel context | Weather, occupancy, bookings, rooms, tasks, incidents, financials, messages, devices | AI services | Structured context | Limited by available data | Not applicable | Context access should be controlled |
| Daily GM Briefing | Summarise daily operational risks | AI Context Engine | GM, Manager | Health score, priorities, risks | Fallback if AI unavailable | Suggested actions require approval | Briefing generation audited |
| Department Intelligence | Department-specific briefings | AI Context Engine | Department leads | Summary, risks, priorities | Data availability | Task creation governed | Audited |
| AI Recommendation Governance | Review AI recommendations | AI outputs | Admin/Manager | Approve/reject/create task | Requires model quality | Required for task creation | Full lifecycle audited |
| AI Copilot | Role-aware operational Q&A | AI Context Engine | Authorised staff | Answers, suggestions | Not generic unrestricted chatbot | Sensitive actions confirmed | Queries and responses audited |
| Operations Concierge | Operations support | Operations data | Operations users | Responses/tools | Context-bound | Actions governed | Audited |
| Hotel Brain | Natural language operational intelligence | Enterprise Search, AI Context, platform data | Managers/authorised users | Evidence-backed answers | Must not expose restricted data | Sensitive actions confirmed | Query, answer, suggested action audited |

## 18. Security and Access Control Requirements

- Role-based access control must apply across modules.
- Module-level permissions must control navigation and backend endpoints.
- Record-level restrictions should apply where sensitive records require it.
- Audit, security, and financial data must be restricted.
- Raw credentials must be masked and replaced with credential references.
- Hotel Brain must filter context by permission.
- Enterprise Search must filter results by permission.
- Sensitive actions must require confirmation.
- Audit log access must be restricted.
- User Management must be restricted to authorised administrators.
- Financial data must only be visible to authorised users.

## 19. Audit and Logging Requirements

Audit logging should cover:

- Login/access where applicable.
- Record creation.
- Record update.
- Record deletion/archive.
- Reservation changes.
- Guest profile changes.
- Room status changes.
- Housekeeping status changes.
- Maintenance changes.
- Incident changes.
- Integration setup.
- Connection testing.
- Device import.
- CCTV stream tests.
- Smart building events.
- Search queries.
- Restricted access attempts.
- Hotel Brain queries.
- AI generated answers.
- Sensitive action confirmation/rejection.

## 20. Notification Requirements

| Trigger | Recipient Role | Channel | Priority | Escalation Rule |
| --- | --- | --- | --- | --- |
| Reservation update | Front Desk, Manager | Dashboard/Email optional | Medium | Escalate if arrival impact |
| Room readiness blocker | Front Desk, Housekeeping Manager | Dashboard/Push optional | High | Escalate if arrival due soon |
| Housekeeping delay | Housekeeping Manager, Operations | Dashboard | Medium/High | Escalate when overdue |
| Maintenance fault | Maintenance Team | Dashboard/Push optional | Medium/High | Escalate critical/overdue |
| Incident escalation | Manager, Department Lead | Dashboard/Email/SMS optional | High/Critical | Escalate by severity |
| Security alert | Security Team, Manager | Dashboard/Push/SMS optional | High/Critical | Immediate critical escalation |
| CCTV offline | Security, IT/Admin | Dashboard | Medium/High | Escalate if critical area |
| Device offline | Maintenance/Smart Building users | Dashboard | Medium | Escalate if safety/security device |
| Low battery | Maintenance | Dashboard | Low/Medium | Escalate if unresolved |
| Water leak | Maintenance, Manager | Dashboard/SMS optional | Critical | Immediate escalation |
| Smoke/fire | Security, Manager, Maintenance | Dashboard/SMS optional | Critical | Immediate escalation |
| Energy threshold exceeded | Maintenance, Operations | Dashboard | Medium | Escalate repeated breaches |
| Guest complaint | Operations, Guest Experience | Dashboard | High | Escalate unresolved complaints |
| Inventory low stock | Inventory/Operations | Dashboard | Medium | Escalate below critical threshold |
| Integration failure | IT/Admin | Dashboard/Email optional | High | Escalate repeated failures |
| Hotel Brain attention item | Manager/Department Lead | Dashboard | Medium/High | Governed action approval |

## 21. Event Bus Requirements

Event categories and examples:

- Reservation events: reservation.created, reservation.updated, reservation.cancelled, booking.checked_in, booking.checked_out.
- Guest events: guest.created, guest.updated, guest.complaint.logged.
- Room events: room.status.changed, room.housekeeping.changed, room.outOfService.
- Housekeeping events: housekeeping.task.created, housekeeping.task.completed, housekeeping.inspection.completed.
- Maintenance events: maintenance.workOrder.created, maintenance.fault.reported, maintenance.repair.completed.
- Incident events: incident.created, incident.acknowledged, incident.resolved, incident.closed.
- Security events: security.alert.created, security.access.denied, security.door.forcedOpen.
- Smart Building events: smartBuilding.device.imported, smartBuilding.device.offline, smartBuilding.device.faultDetected.
- CCTV events: cctv.camera.imported, cctv.connection.tested, cctv.stream.previewFailed.
- Integration events: integration.created, integration.connection.failed, integration.device.imported.
- Inventory events: inventory.lowStock, inventory.stockAdjusted.
- Review events: review.received, review.lowRating, review.responseRequired.
- Message/call events: message.received, call.logged, support.escalated.
- Notification events: notification.sent, notification.failed.
- Task events: task.created, task.assigned, task.completed, task.escalated.
- Enterprise Search events: enterpriseSearch.query.submitted, enterpriseSearch.results.returned, enterpriseSearch.permissionDenied.
- Hotel Brain events: hotelBrain.query.submitted, hotelBrain.answer.generated, hotelBrain.action.suggested.
- Audit events: audit.recorded, audit.failed.

## 22. Error Handling Requirements

The platform must handle:

- Form validation errors with field-level messages.
- Permission errors with restricted-access messaging.
- Missing records with clear not-found states.
- Failed saves and updates with retry guidance where possible.
- Failed integrations with actionable error details.
- Invalid credentials and expired credentials.
- Failed camera stream tests.
- Failed device discovery.
- Search unavailable.
- No search results.
- Hotel Brain insufficient data.
- Restricted data requests.
- Event Bus failure.
- Audit log failure.
- Notification failure.

## 23. Assumptions

- Hotel users and roles are defined.
- Room and hotel area data exists.
- Platform has test data for QA.
- Event Bus is available.
- Audit Engine is available.
- Notification Engine is available.
- Integration Hub is available.
- Secure credential storage is available or simulated.
- Real hardware/API testing depends on provider access.
- AI answers are limited to available authorised data.
- Production deployment will apply required database migrations.

## 24. Dependencies

- CCTV/NVR hardware.
- Smart building devices.
- Vendor APIs.
- Browser camera permission.
- Network scanning capability.
- Secure credential storage.
- Role-based access model.
- Test environment.
- Test data.
- AI provider configuration.
- Search indexing service.
- Payment provider credentials if applicable.
- Booking channel credentials if applicable.
- Production database access.

## 25. Risks and Constraints

- Hardware unavailable for real testing.
- Vendor API limitations.
- Browser limitations.
- Network scanning restrictions.
- Credential security risk.
- Permission leakage through Search or AI.
- Mock data mistaken for live functionality.
- Incomplete audit coverage.
- Event Bus failure.
- Integration failure.
- Performance impact from search indexing.
- AI hallucination risk.
- Incomplete role configuration.
- Production certification delays for payments or booking channels.

## 26. Acceptance Criteria

### AC-DASH-001 Dashboard

- Given an authorised user opens Dashboard
- When operational data exists
- Then arrivals, departures, occupancy, room readiness, incidents, integration health, and shortcuts are displayed according to permissions.

### AC-RES-001 Reservations

- Given a front desk user has reservation access
- When the user creates, updates, cancels, checks in, or checks out a reservation
- Then the reservation status updates and linked rooms/guests/audit records are updated where applicable.

### AC-GUEST-001 Guests

- Given an authorised user opens a guest profile
- When guest records exist
- Then contact details, stay history, linked messages, calls, reservations, and reviews are visible according to permissions.

### AC-ROOM-001 Rooms

- Given an authorised user views rooms
- When room status changes
- Then occupancy, housekeeping, maintenance, and out-of-service state are displayed accurately.

### AC-HK-001 Housekeeping

- Given a housekeeping user updates a cleaning or inspection task
- When the task is completed
- Then the room readiness status updates and the dashboard reflects the change.

### AC-INV-001 Inventory

- Given stock levels fall below a reorder threshold
- When Inventory is viewed
- Then a low-stock state or alert is displayed for authorised users.

### AC-CAL-001 Calendar

- Given operational schedule records exist
- When the Calendar is opened
- Then reservation and operational schedule items are visible according to access.

### AC-FIN-001 Financials

- Given an authorised finance user opens Financials
- When financial records exist
- Then revenue, payment, invoice, and balance data is displayed.

### AC-REV-001 Reviews

- Given guest reviews exist
- When Reviews are opened
- Then rating, source, sentiment, response status, and escalation state are visible.

### AC-CON-001 Concierge

- Given a guest request is logged
- When Concierge is opened
- Then request status, priority, assignment, and notes are visible.

### AC-MSG-001 Messages

- Given messages exist
- When Messages are opened
- Then conversation history and linked guest/reservation context are available according to permissions.

### AC-CALL-001 Calls

- Given calls are logged
- When Calls are opened
- Then call notes, caller details, linked records, and follow-up actions are visible.

### AC-USER-001 User Management

- Given an admin opens User Management
- When users exist
- Then roles, permissions, status, and access control actions are available.

### AC-OPS-001 Operations Center

- Given operational alerts, blockers, or tasks exist
- When Operations Center is opened
- Then cross-department attention items and priorities are visible.

### AC-SEC-001 Security Center

- Given security alerts or CCTV cameras exist
- When Security Center is opened
- Then authorised users can view alerts, camera health, access events, and escalation status.

### AC-SB-001 Smart Building

- Given smart building devices exist
- When Smart Building is opened
- Then device health, sensors, doors, energy, HVAC, and asset information are visible.

### AC-MAINT-001 Maintenance Center

- Given maintenance faults or work orders exist
- When Maintenance Center is opened
- Then status, assignment, priority, and closure workflow are available.

### AC-INC-001 Incident Center

- Given incidents exist
- When Incident Center is opened
- Then severity, status, assignment, linked records, notes, and closure workflow are available.

### AC-INT-001 Integration Manager

- Given an authorised integration admin opens Settings > Integrations
- When integration categories are displayed
- Then providers can be viewed, configured, tested, monitored, and disabled where implemented.

### AC-CCTV-001 CCTV

- Given a CCTV setup method is selected
- When the user tests and saves a valid configuration
- Then camera records are created/imported without exposing raw credentials.

### AC-SB-DEV-001 Smart Building Devices

- Given smart building devices are configured or imported
- When devices send status or fault events
- Then Smart Building, Maintenance, Security, Incident Center, Dashboard, and AI context can consume authorised data.

### AC-SEARCH-001 Enterprise Search

- Given an authenticated user searches platform records
- When results include restricted records
- Then restricted records are omitted and only authorised results are displayed.

### AC-AI-001 Hotel Brain and AI Governance

- Given an authorised user asks Hotel Brain a question
- When supporting platform data exists
- Then Hotel Brain returns an evidence-backed answer, suggested actions where relevant, and audit/governance records.

### AC-NOTIF-001 Notifications

- Given a notification-triggering event occurs
- When the event is processed
- Then relevant users or roles receive notifications according to configured rules.

### AC-AUDIT-001 Audit Logs

- Given a sensitive or important action occurs
- When the action completes or fails
- Then an audit record is created for authorised review.

### AC-RBAC-001 Role-Based Access

- Given a user lacks module permission
- When the user attempts to access the module or restricted data
- Then access is denied or filtered without exposing restricted records.

### AC-STATE-001 UI States

- Given a page is loading, empty, restricted, successful, or failed
- When the state applies
- Then the UI displays a clear corresponding state.

## 27. End-to-End Testing Scope

| Area | Test Objective | Preconditions | Test Data Required | High-Level Steps | Expected Outcome | Modules Involved | Events Expected | Audit Logs Expected | Notifications Expected |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E2E-001 Reservation to Check-In | Validate booking to arrival flow | User has reservation access | Guest, room, room type | Create reservation, assign room, check readiness, check in | Guest checked in and dashboard updated | Reservations, Guests, Rooms, Dashboard | reservation.created, booking.checked_in | Reservation and check-in logs | Optional front desk/ops |
| E2E-002 Check-Out to Room Turnover | Validate checkout and housekeeping | Existing in-house booking | Room, booking | Check out, mark dirty, create/complete cleaning, inspect | Room ready after turnover | Reservations, Rooms, Housekeeping | booking.checked_out, housekeeping.task.completed | Checkout/task logs | Housekeeping task notification |
| E2E-003 Guest Complaint to Resolution | Validate complaint handling | Guest exists | Complaint message/review/call | Log complaint, create task/incident, resolve | Complaint resolved and linked | Messages/Calls/Reviews, Ops, Incidents | guest.complaint.logged, task.created | Complaint/resolution logs | Ops/department notification |
| E2E-004 Maintenance Issue to Closure | Validate maintenance workflow | Room/device exists | Fault/work order | Report fault, assign, update, close | Fault closed and room/device status updated | Maintenance, Rooms, Smart Building | maintenance.fault.reported, task.completed | Maintenance logs | Maintenance notification |
| E2E-005 Security Alert to Incident Closure | Validate security response | Security access | Door/camera alert | Create alert, acknowledge, create/close incident | Incident closed with audit trail | Security, Incidents, CCTV | security.alert.created, incident.closed | Security/incident logs | Security/manager notification |
| E2E-006 CCTV Integration to Security Center | Validate camera setup visibility | Admin/security access | Camera/NVR config | Configure/test/import/map camera | Camera appears in Security Center | Settings, CCTV, Security Center | cctv.camera.imported | Integration/camera logs | Optional security notification |
| E2E-007 Smart Building Integration to Alert Routing | Validate device alert routing | Admin/smart building access | Device config/event | Add/import device, trigger fault | Alert routes to correct center | Settings, Smart Building, Maintenance, Security, Incidents | smartBuilding.device.faultDetected | Device/task/incident logs | Department notification |
| E2E-008 Inventory Low Stock to Notification | Validate inventory alert | Inventory access | Item below threshold | Adjust stock below threshold | Low-stock alert shown/sent | Inventory, Notifications | inventory.lowStock | Stock adjustment log | Inventory/ops notification |
| E2E-009 Review Escalation to Operations | Validate review escalation | Review access | Low review | Add low review, escalate | Operations sees issue | Reviews, Operations, Incidents | review.lowRating | Review/escalation logs | Manager/guest experience |
| E2E-010 Enterprise Search Investigation | Validate search and permissions | Search access | Mixed records | Search guest/device/incident, preview, open source | Only authorised results shown | Search, source modules | enterpriseSearch.query.submitted | Search query/restricted logs | None |
| E2E-011 Hotel Brain Daily Briefing | Validate AI briefing | AI access/context data | Operational data | Generate briefing/question | Evidence-backed summary appears | AI, Search, Dashboard, Ops | hotelBrain.answer.generated | AI answer logs | Optional attention notifications |
| E2E-012 Role-Based Access Restriction | Validate RBAC | Multiple user roles | Restricted records | Attempt restricted module/search/AI access | Access denied or filtered | All relevant modules | enterpriseSearch.permissionDenied where search | Restricted access logs | Optional admin alert |

## 28. QA / UAT Considerations

QA/UAT checklist:

- Module navigation.
- Forms.
- Validation.
- Status updates.
- Dashboards.
- Search.
- AI answers.
- Event Bus.
- Notifications.
- Audit logs.
- Permissions.
- Integration workflows.
- Mock vs production labels.
- Error handling.
- Empty states.
- Loading states.
- Responsive UI.
- Browser compatibility.
- Build validation.
- Runtime console validation.

Recommended build validation:

```bash
npm run check
```

Recommended production migration validation:

```bash
npm --prefix packages/api run db:migrate:prod
```

## 29. Future Enhancements

- Mobile app.
- Guest-facing portal.
- Advanced revenue management.
- Advanced predictive maintenance.
- More vendor integrations.
- Full booking channel certification.
- Full payment gateway certification.
- Advanced AI forecasting.
- Automated workflow orchestration.
- Multi-property enterprise reporting.
- Advanced analytics.
- Compliance reporting.
- Digital twin for smart building operations.
- Real ONVIF discovery gateway.
- RTSP-to-HLS/WebRTC media gateway.
- Enterprise permission model expansion.

## 30. Sign-Off Criteria

Sign-off checklist:

- [ ] BRD reviewed by product owner.
- [ ] Functional requirements approved.
- [ ] E2E testing scope approved.
- [ ] Security requirements approved.
- [ ] AI governance requirements approved.
- [ ] Integration assumptions accepted.
- [ ] Out-of-scope items accepted.
- [ ] QA test cases created.
- [ ] Critical test cases passed.
- [ ] High severity defects resolved or accepted.
- [ ] Stakeholder sign-off completed.
- [ ] Production migration plan approved.
- [ ] Hardware/API limitations acknowledged.
- [ ] Regression testing scope approved.

## Full-System BRD Completion Summary

This BRD covers the full LaFlo Enterprise Hotel Operations Platform, including the Platform Core, core business modules, Operations modules, Smart Building modules, Integration Layer, Enterprise Search, Hotel Brain, AI capabilities, security, audit, notifications, event-driven workflows, acceptance criteria, and end-to-end testing scope.

The document is intended to be used by QA testers, developers, product owners, stakeholders, and implementation teams as the baseline for full end-to-end validation and future roadmap planning.

## Key Assumptions

- Users, roles, hotels, rooms, and test data are available.
- Platform Core services are available and stable.
- Secure credential handling exists or is simulated where production storage is not yet configured.
- Real hardware/API validation depends on vendor access.
- AI answers are limited to authorised available data.
- Production database migrations will be applied before production testing.

## Key Risks

- Hardware/API access may delay production validation.
- Mock or simulated integrations may be mistaken for live production capability.
- Permission leakage through Search or AI is a high-risk area and must be tested carefully.
- Search indexing performance must be monitored as data grows.
- AI recommendations must remain governed and human-approved for sensitive actions.
- Incomplete role configuration can affect QA outcomes.

## Recommended Next Step

Create full end-to-end QA test cases from this BRD, using the E2E testing scope and acceptance criteria as the basis for manual, regression, and UAT test coverage.
