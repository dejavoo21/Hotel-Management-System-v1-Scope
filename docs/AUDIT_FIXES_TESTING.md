# Audit Fixes Testing Guide

This document provides testing instructions for the audit priority fixes implemented.

## Modified Files

| File | Change Description |
|------|-------------------|
| `prisma/schema.prisma` | Added `PresenceStatus` enum and `presenceStatus`/`lastSeenAt` fields to User model |
| `prisma/migrations/20260225_add_presence_fields/migration.sql` | Migration for presence fields |
| `src/services/dashboard.service.ts` | Added `buildDashboardPayload()` function for role-based filtering |
| `src/controllers/dashboard.controller.ts` | Integrated role filtering for financial data |
| `src/services/presence.service.ts` | **NEW** - In-memory presence store with DB persistence |
| `src/socket/index.ts` | Added presence events: `presence:update`, `presence:list`, `presence:set` |
| `src/routes/guest.routes.ts` | Added `requireManager` middleware to DELETE route |
| `src/types/index.ts` | Updated `DashboardSummary` type with optional financial fields |

---

## 1. Dashboard Role Filtering (HIGH)

### Test: ADMIN/MANAGER gets financial data

```bash
# Login as ADMIN or MANAGER
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password123"}' | jq -r '.data.accessToken')

# Get dashboard summary - should include todayRevenue and monthRevenue
curl -s http://localhost:3001/api/dashboard/summary \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
```

**Expected response for ADMIN/MANAGER:**
```json
{
  "todayArrivals": 5,
  "todayDepartures": 3,
  "currentOccupancy": 75,
  "totalRooms": 50,
  "occupiedRooms": 38,
  "availableRooms": 10,
  "outOfServiceRooms": 2,
  "inHouseGuests": 45,
  "todayRevenue": 12500.00,
  "monthRevenue": 185000.00
}
```

### Test: RECEPTIONIST/HOUSEKEEPING gets NO financial data

```bash
# Login as RECEPTIONIST
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "receptionist@example.com", "password": "password123"}' | jq -r '.data.accessToken')

# Get dashboard summary - should NOT include todayRevenue or monthRevenue
curl -s http://localhost:3001/api/dashboard/summary \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
```

**Expected response for RECEPTIONIST/HOUSEKEEPING:**
```json
{
  "todayArrivals": 5,
  "todayDepartures": 3,
  "currentOccupancy": 75,
  "totalRooms": 50,
  "occupiedRooms": 38,
  "availableRooms": 10,
  "outOfServiceRooms": 2,
  "inHouseGuests": 45
}
```

Note: `todayRevenue` and `monthRevenue` fields are ABSENT.

---

## 2. Socket Presence Events (MEDIUM)

### Test: Connection broadcasts online status

Use a WebSocket client (e.g., Socket.IO tester, wscat, or browser dev tools):

```javascript
// Connect to socket
const socket = io('http://localhost:3001', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

// Listen for presence updates
socket.on('presence:update', (data) => {
  console.log('Presence update:', data);
  // Expected: { userId, email, isOnline, effectiveStatus, overrideStatus, lastSeenAt }
});

// On connect, receive list of online users in hotel
socket.on('presence:list', (users) => {
  console.log('Online users:', users);
});
```

### Test: Set presence override

```javascript
// Set presence to BUSY
socket.emit('presence:set', 'BUSY');

// All users in hotel room receive:
// { userId: '...', email: '...', isOnline: true, effectiveStatus: 'BUSY', overrideStatus: 'BUSY', lastSeenAt: null }

// Valid statuses: AVAILABLE, BUSY, DND, AWAY
```

### Test: Disconnect broadcasts offline status

When a user disconnects, all users in the same hotel receive:
```json
{
  "userId": "clxxx...",
  "email": "user@example.com",
  "isOnline": false,
  "effectiveStatus": "OFFLINE",
  "overrideStatus": "AVAILABLE",
  "lastSeenAt": "2026-02-25T10:30:00.000Z"
}
```

---

## 3. Guest Delete Role Check (LOW)

### Test: RECEPTIONIST cannot delete guests

```bash
# Login as RECEPTIONIST
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "receptionist@example.com", "password": "password123"}' | jq -r '.data.accessToken')

# Try to delete a guest - should fail
curl -s -X DELETE http://localhost:3001/api/guests/GUEST_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected response:**
```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```
HTTP Status: 403

### Test: MANAGER/ADMIN can delete guests

```bash
# Login as MANAGER
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "manager@example.com", "password": "password123"}' | jq -r '.data.accessToken')

# Delete a guest - should succeed
curl -s -X DELETE http://localhost:3001/api/guests/GUEST_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected response:**
```json
{
  "success": true,
  "message": "Guest deleted successfully"
}
```

---

## 4. Apply Database Migration

After deploying, run the migration:

```bash
# In production (Railway)
npx prisma migrate deploy

# Or manually apply the SQL
psql $DATABASE_URL -f prisma/migrations/20260225_add_presence_fields/migration.sql
```

This will:
1. Create the `PresenceStatus` enum (AVAILABLE, BUSY, DND, AWAY)
2. Add `presenceStatus` column to User table (default: AVAILABLE)
3. Add `lastSeenAt` column to User table (nullable DateTime)

---

## Architecture Summary

### Dashboard Role Filtering

```
Request → authenticate → getSummary()
                              ↓
                    getDashboardSummary(hotelId)
                              ↓
                    buildDashboardPayload(summary, role)
                              ↓
                    [ADMIN/MANAGER] → full data
                    [RECEPTIONIST/HOUSEKEEPING] → stripped financial data
```

### Socket Presence Flow

```
Socket Connect
    ↓
markUserOnline(userId, email, hotelId, socketId)
    ↓
Store in memory map + fetch DB override status
    ↓
Broadcast 'presence:update' to hotel:{hotelId} room
    ↓
Send 'presence:list' to connected user

Socket 'presence:set' event
    ↓
setPresenceOverride(userId, status)
    ↓
Update DB + memory store
    ↓
Broadcast 'presence:update' to hotel room

Socket Disconnect
    ↓
markUserOffline(userId)
    ↓
Update lastSeenAt in DB + remove from memory
    ↓
Broadcast 'presence:update' with isOnline=false
```

### Guest Delete Authorization

```
DELETE /api/guests/:id
    ↓
authenticate middleware
    ↓
requireManager middleware (ADMIN or MANAGER only)
    ↓
guestController.deleteGuest()
```
