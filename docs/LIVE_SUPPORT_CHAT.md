# Live Support Chat

## Overview
LaFlo chatbot uses one widget with multiple modes and can escalate to live human support.

## Chatbot Modes
- `General`: broad app guidance.
- `Reservations`: booking/check-in/check-out help.
- `Operations`: rooms, housekeeping, inventory help.
- `Financials`: invoices, receipts, expenses, payment help.

Mode selection changes quick prompts and bot response context.

## Human Handoff Flow
1. User clicks `Escalate to human helpdesk` in chatbot.
2. System creates a concierge request for tracking.
3. System creates/opens a `Live Support` conversation in Messages.
4. User and support staff continue in the same thread.

## Open Live Helpdesk
- Chatbot `Open live helpdesk` creates/opens live support thread.
- User is redirected to `Messages` with the support thread preselected.

## Support Assignment
- Support/admin staff can assign a thread to self or another support agent.
- Assignment is stored as a system event in the conversation timeline.
- Current assignment is visible in the Messages profile panel.

## Online Presence
- Support users send a periodic heartbeat while Messages is open.
- Agent list shows online/offline status based on recent heartbeat.

## Notification Channels for Handoff
- Email notifications to `SUPPORT_NOTIFY_EMAILS`.
- SMS notifications to `SUPPORT_NOTIFY_PHONES` (Twilio if configured).

Required environment variables:
- `SUPPORT_NOTIFY_EMAILS`
- `SUPPORT_NOTIFY_PHONES`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `SMS_FROM_PHONE`

## Access Request Reliability
Access request submission now remains successful even if outbound email notification fails.
Email failures are logged and do not block request creation.
