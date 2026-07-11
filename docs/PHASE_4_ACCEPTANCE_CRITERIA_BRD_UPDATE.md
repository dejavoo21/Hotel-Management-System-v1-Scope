# LaFlo Enterprise Hotel Operations Platform

## Phase 4 Acceptance Criteria and BRD Update

Date: 2026-07-11  
Status: Ready for product owner, QA, developer handover, and stakeholder review

## 1. Executive Summary

Phase 4 introduces the enterprise foundation required to connect LaFlo to external systems, physical hotel hardware, unified search, and operational intelligence. The main capabilities are Integration Manager, CCTV Integration, Smart Building Hardware Integration, Enterprise Search, Hotel Brain, and a platform stabilisation pass.

The phase moves integration setup out of individual modules and into a central Settings > Integrations experience. Operational modules then consume integration records, events, and health data through shared platform services rather than managing credentials or direct vendor setup independently.

## 2. Business Objective

The objective is to make LaFlo ready for enterprise hotel operations where physical devices, external providers, operational records, and AI intelligence must work together safely.

Phase 4 supports:

- Centralised integration management.
- Safer credential handling.
- Unified CCTV and Smart Building setup workflows.
- Platform-wide search.
- Natural language operational intelligence through Hotel Brain.
- Event, audit, and permission controls across new capabilities.

## 3. Current Problem / Gap

Before Phase 4, integrations and hardware workflows risked becoming scattered across modules. Search was fragmented by feature area, AI had limited unified operational context, and physical hardware setup lacked a central management pattern.

Key gaps addressed:

- No central place to manage external providers.
- CCTV and Smart Building hardware needed realistic setup flows.
- Modules needed to consume integration data without owning credentials.
- Users needed one search surface across hotel operations.
- AI answers needed permission-aware access to platform data.
- QA needed clear acceptance criteria for Phase 4 sign-off.

## 4. Proposed Solution

Create a central Integration Manager under Settings > Integrations. Add reusable setup workflows for CCTV and Smart Building hardware. Add Enterprise Search over indexed platform records. Add Hotel Brain as a permission-aware operational intelligence surface. Use Platform Core services for events, audit, task creation, notifications, and AI governance.

## 5. Phase 4 Scope

### 5.1 Integration Manager

Integration Manager is the central enterprise integration layer under Settings > Integrations.

It supports central configuration and monitoring for:

- CCTV
- Smart Locks
- Sensors
- HVAC
- Energy Meters
- Weather
- Payments
- Booking Channels
- Microsoft 365
- OpenAI / AI Providers
- Other Providers

Modules consume integrations but should not directly manage provider credentials.

### 5.2 CCTV Integration

CCTV setup is configured through Settings > Integrations > CCTV.

Supported connection methods:

- USB / Local Camera
- Discover IP Cameras
- Connect NVR
- Manual Camera
- Cloud Cameras

Security Center consumes configured CCTV camera records from Integration Manager.

### 5.3 Smart Building Hardware Integration

Smart Building hardware is configured through Settings > Integrations > Smart Building.

Supported hardware categories:

- Smart Locks
- Door Sensors
- Motion Sensors
- Occupancy Sensors
- Temperature Sensors
- Humidity Sensors
- HVAC Controllers
- Energy Meters
- Water Leak Sensors
- Fire / Smoke Sensors
- Lighting Controllers
- Elevator / Lift Monitoring
- Access Control Panels
- Generic IoT Devices

Smart Building, Maintenance Center, Security Center, Incident Center, Operations Center, Dashboard, and AI Context Engine consume smart building data and events.

### 5.4 Enterprise Search

Enterprise Search provides unified platform-wide search across:

- Guests
- Reservations
- Rooms
- Housekeeping
- Maintenance
- Incidents
- Security
- CCTV
- Smart Building
- Inventory
- Financials
- Messages
- Calls
- Reviews
- Users
- Integrations
- Audit Logs
- AI Recommendations

Enterprise Search must respect role-based access control.

### 5.5 Hotel Brain

Hotel Brain provides natural language operational intelligence for authorised users.

Example questions:

- Which rooms are not ready for today's arrivals?
- Which devices are offline?
- What happened overnight?
- What should the GM pay attention to this morning?
- Show unresolved incidents affecting guest experience.
- Summarise today's operational risks.

Hotel Brain must answer only from available platform data and must not expose restricted records.

### 5.6 Platform Stabilisation

Phase 4 includes stabilisation covering:

- TypeScript errors
- Import/export errors
- Runtime errors
- Broken routes
- Broken components
- Broken UI states
- Broken event flows
- Broken search flows
- Broken AI context flows
- Broken access control checks

## 6. Out of Scope

The following are not required for Phase 4 acceptance:

- Full production connection to every vendor API.
- Real ONVIF/NVR implementation where hardware is unavailable.
- Real cloud camera provider production integration where API access is unavailable.
- Full payment gateway production certification.
- Full booking channel production certification.
- Physical hardware installation.
- Live hotel deployment.
- Advanced predictive AI automation without human approval.
- Automated high-impact operational actions without confirmation.
- Production-grade RTSP browser playback without a media gateway.

## 7. User Roles and Stakeholders

Primary users:

- Admin
- Manager
- Security team
- Maintenance team
- Operations team
- Front Desk / Reception
- Housekeeping

Stakeholders:

- Product owner
- Hotel general manager
- IT administrator
- Security manager
- Maintenance manager
- QA team
- Implementation team
- Integration/vendor partners

## 8. Functional Requirements

### 8.1 Integration Manager Requirements

- Users can access Integration Manager from Settings.
- Users can view integration categories.
- Users can configure supported providers.
- Users can test connections.
- Users can view integration health.
- Users can view integration logs.
- Users can disable integrations.
- Users can map imported devices to hotel areas.
- Modules consume integrations but do not manage credentials directly.
- Credential references are displayed instead of raw secrets.

### 8.2 CCTV Requirements

- Users can select a CCTV connection method.
- Users can configure manual cameras.
- Users can discover IP cameras using a subnet scan workflow.
- Users can connect supported NVR types.
- Users can preview or test camera streams where supported.
- Users can import discovered cameras or NVR channels.
- Users can map cameras to hotel areas.
- Security Center displays configured cameras.
- Local camera is labelled as a staff/local camera and not permanent CCTV.
- Cloud camera providers can be shown as coming soon where not implemented.
- Raw passwords, API keys, and RTSP URLs are not exposed to the frontend.

### 8.3 Smart Building Requirements

- Users can configure Smart Building providers.
- Users can add or discover smart building devices.
- Users can import and map devices.
- Users can view device health.
- Devices can generate operational events.
- Maintenance Center receives device fault alerts.
- Security Center receives security-related device alerts.
- Incident Center receives critical safety/security alerts.
- Dashboard shows high-level building health.
- AI Context Engine consumes authorised smart building context.

### 8.4 Enterprise Search Requirements

- Users can search globally from the app header.
- Users can use the dedicated Enterprise Search page.
- Search results are grouped by category.
- Users can filter search results.
- Users can preview results.
- Users can open source records.
- Users can save searches.
- Users can view recent searches.
- Search respects permissions.
- Restricted records are not exposed.
- Restricted result attempts are audited.

### 8.5 Hotel Brain Requirements

- Users can ask natural language operational questions.
- Hotel Brain answers using available platform data.
- Hotel Brain shows supporting records.
- Hotel Brain provides suggested actions.
- Sensitive actions require confirmation.
- Hotel Brain respects permissions.
- Hotel Brain logs AI answers and data sources.
- Hotel Brain integrates with AI Context Engine and AI Recommendation Governance.

## 9. Non-Functional Requirements

### Performance

- Search should return results within an acceptable interactive response time for normal hotel datasets.
- Search indexing should avoid blocking core operational workflows.
- Hotel Brain should limit source records to relevant, permission-filtered context.

### Scalability

- Integration, device, and search records must be hotel-scoped.
- Search indexing should support incremental event-driven updates.
- The architecture should support future extraction of integration workers or search services if needed.

### Security and Privacy

- Secrets must not be returned to the frontend.
- Sensitive data must be filtered by user permissions.
- Hotel Brain must not reveal restricted operational records.
- Audit logs must be protected.

### Availability and Reliability

- Integration failures should degrade gracefully with visible error states.
- Search unavailable states should be clear to users.
- Hotel Brain insufficient-data states should not appear as generic database errors.

### Maintainability

- Integration setup should follow reusable patterns.
- Modules should consume Integration Manager records instead of duplicating provider setup.
- Event names and status names should remain consistent.

### Usability and Accessibility

- Major screens should include loading, empty, error, success, and restricted states.
- UI should support responsive layouts where practical.
- Controls should be labelled clearly for QA and accessibility review.

## 10. Data Requirements

### Integration Records

Required fields:

- integrationId
- category
- providerType
- connectionMethod
- status
- healthStatus
- deviceCount
- lastTestedAt
- lastSyncAt
- credentialReference
- createdBy
- updatedBy

### Device Records

Required fields:

- deviceId
- integrationId
- category
- providerType
- protocol
- deviceName
- manufacturer
- model
- serialNumber
- location
- hotelArea
- floor
- roomNumber
- status
- healthStatus
- batteryLevel
- signalStrength
- lastSeenAt
- lastSyncAt
- firmwareVersion
- credentialReference
- enabled

### Search Index Records

Required fields:

- searchId
- entityId
- entityType
- sourceModule
- title
- summary
- searchableText
- tags
- status
- priority
- severity
- hotelId
- hotelArea
- roomNumber
- guestId
- reservationId
- ownerId
- createdAt
- updatedAt
- indexedAt
- accessScope
- sourceUrl
- metadata

## 11. Integration Requirements

Integration Manager should support provider setup and monitoring for current and future integrations.

Required provider groups:

- CCTV/NVR/IP Cameras
- Smart Building/IoT
- Weather
- Payments
- Booking Channels
- Microsoft 365
- OpenAI / AI Providers
- Other enterprise providers

Integration setup should support:

- Test connection
- Save configuration
- Disable configuration
- View logs
- View health
- Import devices or channels where applicable
- Map imported records to hotel areas

## 12. Security and Access Control Requirements

- Role-based access control must apply across Integration Manager, Enterprise Search, Hotel Brain, CCTV, Smart Building, Security Center, Maintenance Center, Incident Center, Dashboard, and Audit Logs.
- Raw credentials must not be exposed in module state.
- Credentials must be masked in the UI.
- Credential references should be used instead of raw secrets.
- Hotel Brain must not reveal restricted data.
- Enterprise Search must not return unauthorised results.
- Sensitive actions must require confirmation.
- Audit logs must be protected from unauthorised access.

## 13. Audit and Logging Requirements

Audit coverage is required for:

- Integration created
- Integration updated
- Integration disabled
- Connection tested
- Connection failed
- Device discovered
- Device imported
- Device mapped
- CCTV stream test
- NVR channel import
- Smart Building device event
- Search query submitted
- Restricted search attempt
- Hotel Brain query submitted
- Hotel Brain answer generated
- Hotel Brain suggested action
- Sensitive action confirmed or rejected

## 14. AI Governance Requirements

- Hotel Brain must consume approved platform data sources only.
- Hotel Brain must respect module permissions.
- AI answers must show supporting records where available.
- Suggested actions should not execute high-impact operations without confirmation.
- AI answer generation and suggested actions must be audited.
- Restricted data requests should return a safe refusal or filtered answer.
- AI Recommendation Governance remains the path for governed task creation.

## 15. Acceptance Criteria

### 15.1 Integration Manager Navigation

- Given an authorised Admin or Manager
- When the user opens Settings and selects Integrations
- Then the Integration Manager page is displayed with integration categories.

### 15.2 Integration Category Dashboard

- Given Integration Manager is open
- When the user views integration categories
- Then CCTV, Smart Building, Weather, Payments, Booking Channels, Microsoft 365, OpenAI, and other provider groups are visible or represented.

### 15.3 CCTV Manual Camera Setup

- Given an authorised user opens Settings > Integrations > CCTV
- When the user selects Manual Camera and enters camera details
- Then the system allows stream testing and saving without exposing raw credentials.

### 15.4 CCTV Discovery Workflow

- Given an authorised user selects Discover IP Cameras
- When the user enters a subnet and starts discovery
- Then the UI shows scanning, discovered camera results, or a clear discovery-not-configured state.

### 15.5 NVR Connection Workflow

- Given an authorised user selects Connect NVR
- When the user enters provider, host, port, username, password, and channel count
- Then the system can test the connection and show available/importable channels or a clear failure state.

### 15.6 Local Camera Workflow

- Given a user selects USB / Local Camera
- When the user grants browser camera permission
- Then the local preview is displayed and clearly labelled as staff/local use, not permanent CCTV.

### 15.7 Cloud Camera Placeholder Workflow

- Given a user selects Cloud Cameras
- When provider APIs are not configured
- Then the UI shows clear coming-soon/provider-not-configured messaging.

### 15.8 Smart Building Provider Setup

- Given an authorised user opens Settings > Integrations > Smart Building
- When the user selects a provider/protocol and enters details
- Then the system supports testing and saving the configuration.

### 15.9 Smart Building Device Discovery

- Given a Smart Building integration exists
- When discovery or import is triggered
- Then discovered or configured devices can be listed for mapping.

### 15.10 Smart Building Device Mapping

- Given devices are available for import
- When the user maps device location, area, floor, or room
- Then mapped devices appear in Smart Building module views.

### 15.11 Device Health Monitoring

- Given devices exist
- When device status changes or health data is received
- Then Smart Building displays online/offline/fault/low-battery state where available.

### 15.12 Maintenance Alert Creation

- Given a maintenance-related smart building device fault occurs
- When the event is processed
- Then Maintenance Center receives or displays the relevant alert/task according to workflow rules.

### 15.13 Security Alert Routing

- Given a security-related smart building or CCTV event occurs
- When the event is processed
- Then Security Center receives or displays the relevant alert.

### 15.14 Incident Alert Routing

- Given a critical safety/security event occurs
- When the event is processed
- Then Incident Center receives or links the incident where incident workflow rules apply.

### 15.15 Enterprise Search Global Search

- Given an authenticated user uses the global search bar
- When the user searches for a platform record
- Then authorised matching results are returned alongside navigation targets.

### 15.16 Enterprise Search Advanced Search

- Given the user opens the Enterprise Search page
- When the user searches and applies filters
- Then grouped, filtered, authorised results are displayed.

### 15.17 Search Permission Filtering

- Given a user lacks permission for a module
- When the user searches for records from that module
- Then restricted records are omitted and the restricted attempt is logged.

### 15.18 Hotel Brain Natural Language Query

- Given an authorised user opens Hotel Brain
- When the user asks an operational question
- Then Hotel Brain answers from available indexed platform data.

### 15.19 Hotel Brain Answer Evidence

- Given Hotel Brain returns an answer
- When supporting records exist
- Then the answer includes supporting records or cited context sections.

### 15.20 Hotel Brain Restricted Data Handling

- Given a user asks for data they are not authorised to access
- When Hotel Brain processes the request
- Then restricted data is not exposed and the response is filtered or safely refused.

### 15.21 AI Governance Logging

- Given Hotel Brain generates an answer or suggested action
- When the response is returned
- Then AI answer generation and suggested actions are audited.

### 15.22 Audit Logging

- Given integration, search, CCTV, Smart Building, or Hotel Brain actions occur
- When actions complete or fail
- Then audit records are created for required events.

### 15.23 Event Bus Publishing

- Given Phase 4 workflows execute
- When integrations, CCTV, Smart Building, Enterprise Search, or Hotel Brain actions occur
- Then the appropriate Event Bus event is published.

### 15.24 Dashboard Integration Widgets

- Given the Dashboard loads
- When Phase 4 data exists
- Then the Dashboard can show integration health, offline devices, critical issues, search shortcut, and Hotel Brain shortcut.

### 15.25 Error and Empty States

- Given no data exists or a workflow fails
- When the relevant page or flow loads
- Then the UI shows clear loading, empty, error, success, or restricted states rather than generic failure messages.

## 16. Dependencies and Assumptions

Phase 4 depends on:

- Access to real CCTV/NVR hardware for production testing.
- Access to smart lock/sensor/HVAC/energy provider APIs.
- Browser permission support for local camera preview.
- Secure credential storage mechanism.
- Event Bus availability.
- Audit Engine availability.
- Role-based access model.
- AI Context Engine availability.
- Search indexing service availability.
- Test data availability.
- Hotel area/room mapping data availability.
- Production database migrations being applied.

Assumptions:

- Real hardware can be added later without changing the core setup pattern.
- Simulated discovery is acceptable for demos where real network scanning is unavailable.
- Sensitive operations remain confirmation-based.
- Search index rebuild is an administrative function.

## 17. Risks and Constraints

- Hardware vendor API limitations may restrict discovery or health monitoring.
- Network scanning is limited in browser environments.
- CCTV stream compatibility varies by camera, NVR, codec, and protocol.
- RTSP requires a media gateway for safe browser playback.
- Credential handling must be hardened before production hardware rollout.
- Permission leakage through Search or Hotel Brain is a high-risk area.
- Mock/simulation may be mistaken for production integration if not clearly labelled.
- Search indexing can impact performance if not batched or incrementally updated.
- Event Bus failure can prevent downstream modules from receiving updates.
- Full hardware testing is constrained without real devices.

## 18. Future Enhancements

- Real ONVIF discovery service.
- RTSP-to-HLS/WebRTC media gateway.
- Provider SDK integrations for Hikvision, Dahua, Axis, Verkada, Eagle Eye, Rhombus, TTLock, SALTO, BACnet, MQTT, and Modbus.
- Dedicated Operations Center permission.
- Shared saved searches stored in the backend.
- Search analytics and relevance tuning.
- Hotel Brain governed action execution with approval workflows.
- Integration health alerting and SLA metrics.
- Automated device-to-room mapping suggestions.

## 19. QA / Testing Considerations

QA checklist:

- Navigation
- Role permissions
- Integration setup
- CCTV setup
- Smart Building setup
- Device mapping
- Event publishing
- Audit logging
- Search indexing
- Search result filtering
- Hotel Brain answer validation
- Restricted data handling
- Error handling
- Empty states
- Loading states
- Responsive UI
- TypeScript/build validation
- Runtime console validation

Recommended validation commands:

```bash
npm run check
npm --prefix packages/api run db:migrate:prod
```

Recommended manual QA flows:

- Settings > Integrations > CCTV > Manual Camera
- Settings > Integrations > CCTV > Discover IP Cameras
- Settings > Integrations > CCTV > Connect NVR
- Settings > Integrations > CCTV > USB / Local Camera
- Settings > Integrations > Smart Building
- Security Center > CCTV
- Smart Building dashboard
- Global header search
- Enterprise Search page
- Hotel Brain page
- Dashboard shortcuts

## 20. Sign-Off Criteria

Phase 4 can be signed off when:

- The root build/check command passes.
- Database migrations are applied in the target environment.
- Integration Manager is accessible under Settings > Integrations.
- CCTV setup methods render and handle success/error/empty states.
- Smart Building setup methods render and handle success/error/empty states.
- Security Center consumes configured CCTV records.
- Smart Building consumes configured device records.
- Enterprise Search returns permission-filtered results.
- Hotel Brain answers only from authorised platform data.
- Required audit events are recorded.
- Required Event Bus events are published.
- Raw credentials are not exposed in the frontend.
- Simulated areas are clearly labelled.
- QA has documented any hardware/API limitations that block production certification.

## Event Bus Requirements

### Integration Events

- integration.created
- integration.updated
- integration.connection.tested
- integration.connection.failed
- integration.device.discovered
- integration.device.imported
- integration.sync.completed
- integration.sync.failed

### CCTV Events

- cctv.integration.created
- cctv.connection.tested
- cctv.connection.failed
- cctv.camera.discovered
- cctv.camera.imported
- cctv.nvr.connected
- cctv.nvr.channelImported
- cctv.stream.previewStarted
- cctv.stream.previewFailed
- cctv.camera.statusChanged

### Smart Building Events

- smartBuilding.integration.created
- smartBuilding.connection.tested
- smartBuilding.discovery.started
- smartBuilding.discovery.completed
- smartBuilding.device.imported
- smartBuilding.device.statusChanged
- smartBuilding.device.offline
- smartBuilding.device.online
- smartBuilding.device.lowBattery
- smartBuilding.device.faultDetected

### Enterprise Search and Hotel Brain Events

- enterpriseSearch.query.submitted
- enterpriseSearch.results.returned
- enterpriseSearch.noResults
- enterpriseSearch.permissionDenied
- hotelBrain.query.submitted
- hotelBrain.answer.generated
- hotelBrain.answer.failed
- hotelBrain.action.suggested
- hotelBrain.summary.generated

## Implementation Sign-Off Checklist

- [ ] Product owner confirms Phase 4 scope matches expectations.
- [ ] QA confirms acceptance criteria coverage.
- [ ] Developer confirms routes, services, and frontend pages are wired.
- [ ] API typecheck passes.
- [ ] Web build passes.
- [ ] Database migration is reviewed and applied.
- [ ] Integration Manager is visible to authorised users.
- [ ] CCTV workflows are tested with simulated and, where available, real hardware.
- [ ] Smart Building workflows are tested with simulated and, where available, real devices.
- [ ] Enterprise Search permission filtering is verified.
- [ ] Hotel Brain restricted data handling is verified.
- [ ] Audit logs are verified for key actions.
- [ ] Event Bus events are verified for key workflows.
- [ ] Simulated areas are documented for stakeholders.
- [ ] Remaining production hardware/API dependencies are documented.
