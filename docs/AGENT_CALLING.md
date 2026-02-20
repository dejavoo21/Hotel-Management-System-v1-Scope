# Agent Calling (Workers)

## Overview
LaFlo now supports worker call actions directly from app workflows where staff already operate:

- `Messages`: call button in active thread header and a call console panel
- `Guests`: call button in guest list and guest profile modal
- `Booking Detail`: call button in guest information card

These are `tel:` links for immediate dialing on mobile and desktop softphone setups.

## What Was Added

### 1) Messages Call Console
- Queue view for active guest threads
- Per-thread call status:
  - `Pending`
  - `Calling`
  - `Done`
- Per-thread call notes for handoff documentation
- One-click `Call` action per queue item

### 2) Messages Active Thread Call Button
- A `Call guest` button appears in the conversation header when a phone number is available.

### 3) Guests Page Call Actions
- Guest table includes a `Call` action beside phone number.
- Guest profile modal includes `Call Guest` action.

### 4) Booking Detail Call Action
- Guest information section includes a `Call` action beside phone.

## Technical Notes
- Dialing uses `tel:{number}`.
- Phone values are normalized before dialing to prevent formatting issues.
- Threads without stored phone fall back to mock numbers in the Messages mock dataset.
- Current feature is intentionally low-risk and does not alter booking/guest business logic.

## Files Updated
- `packages/web/src/pages/MessagesPage.tsx`
- `packages/web/src/pages/GuestsPage.tsx`
- `packages/web/src/pages/BookingDetailPage.tsx`
- `packages/web/src/types/index.ts`

## Next Phase (Optional)
- Replace `tel:` with browser-based in-app calling (Twilio Voice/WebRTC)
- Add persisted call logs in API
- Add supervisor metrics (missed calls, average response time, disposition codes)
