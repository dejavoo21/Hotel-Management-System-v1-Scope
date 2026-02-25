# SLA Escalation System

## Overview

The SLA (Service Level Agreement) Escalation system provides automatic time-based escalation for support tickets. It ensures that tickets without responses are escalated to appropriate staff levels based on configurable policies.

## Architecture

### Components

1. **Ticket Model** - Stores support tickets with SLA tracking fields
2. **SLAPolicy Model** - Configurable SLA rules per category/department
3. **Ticket Service** - Core business logic for ticket management
4. **Job Endpoint** - Cron-friendly API for processing escalations
5. **Backfill Script** - Migration tool for existing conversations

### Design Principles

- **Cron-friendly**: No separate worker service required
- **Idempotent**: Safe to run multiple times
- **Railway-compatible**: Works with Railway cron jobs
- **Hotel-scoped**: Each hotel has independent SLA policies

## Data Models

### Ticket Fields for SLA

| Field | Type | Description |
|-------|------|-------------|
| status | Enum | OPEN, PENDING, IN_PROGRESS, RESOLVED, CLOSED, BREACHED |
| priority | Enum | LOW, MEDIUM, HIGH, URGENT |
| category | Enum | COMPLAINT, BILLING, HOUSEKEEPING, MAINTENANCE, etc. |
| department | Enum | FRONT_DESK, HOUSEKEEPING, MAINTENANCE, CONCIERGE, BILLING, MANAGEMENT |
| responseDueAtUtc | DateTime | SLA deadline for first response |
| resolutionDueAtUtc | DateTime | SLA deadline for resolution |
| firstResponseAtUtc | DateTime? | When staff first responded |
| resolvedAtUtc | DateTime? | When ticket was resolved |
| escalatedLevel | Int | Current escalation level (0-3) |
| lastEscalationAtUtc | DateTime? | Last escalation timestamp |

### SLAPolicy

| Field | Type | Description |
|-------|------|-------------|
| hotelId | String | Hotel this policy belongs to |
| category | Enum | Ticket category this applies to |
| department | Enum | Department for routing |
| responseMinutes | Int | Target first response time |
| resolutionMinutes | Int | Target resolution time |
| escalationStepsJson | JSON | Escalation configuration |
| isActive | Boolean | Whether policy is active |

### Escalation Steps JSON Format

```json
[
  {"level": 1, "afterMinutes": 60, "notifyRoles": ["MANAGER"]},
  {"level": 2, "afterMinutes": 120, "notifyRoles": ["MANAGER", "ADMIN"]},
  {"level": 3, "afterMinutes": 240, "notifyRoles": ["ADMIN"]}
]
```

## API Endpoints

### Job Endpoint (Protected)

```
POST /api/jobs/sla-escalation/run
Header: X-Job-Secret: <SLA_JOB_SECRET>

Response:
{
  "success": true,
  "data": {
    "processed": 15,
    "escalated": 3,
    "breached": 1,
    "errors": [],
    "durationMs": 234,
    "runAt": "2026-02-25T10:30:00.000Z"
  },
  "message": "Processed 15 tickets: 3 escalated, 1 breached"
}
```

### Health Check

```
GET /api/jobs/health

Response:
{
  "success": true,
  "data": {
    "configured": true,
    "timestamp": "2026-02-25T10:30:00.000Z"
  }
}
```

### Ticket CRUD (Authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tickets | List tickets with filters |
| GET | /api/tickets/:id | Get single ticket |
| GET | /api/tickets/conversation/:id | Get ticket by conversation |
| PATCH | /api/tickets/:id | Update ticket |
| POST | /api/tickets/:id/assign | Assign to user |
| POST | /api/tickets/:id/resolve | Mark resolved |
| POST | /api/tickets/:id/close | Mark closed |
| POST | /api/tickets/backfill | Backfill tickets (admin) |

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SLA_JOB_SECRET | Yes | Secret for job endpoint authentication |

Set in Railway:
```bash
railway variables --set SLA_JOB_SECRET=your-secure-secret-here
```

### Railway Cron Setup

1. **Add Cron Service** (or use external cron):
   - Schedule: `*/5 * * * *` (every 5 minutes)
   
2. **Cron Command**:
```bash
curl -X POST https://laflo-hms-production.up.railway.app/api/jobs/sla-escalation/run \
  -H "X-Job-Secret: your-secure-secret-here"
```

3. **Alternative - External Cron Services**:
   - cron-job.org
   - Uptime Robot
   - GitHub Actions (scheduled workflow)

### GitHub Actions Cron Example

Create `.github/workflows/sla-escalation.yml`:

```yaml
name: SLA Escalation Job

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  run-escalation:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger SLA Escalation
        run: |
          curl -X POST ${{ secrets.API_URL }}/api/jobs/sla-escalation/run \
            -H "X-Job-Secret: ${{ secrets.SLA_JOB_SECRET }}" \
            -H "Content-Type: application/json"
```

## Escalation Logic

### Processing Flow

1. Find all tickets with status OPEN or PENDING
2. Filter to tickets without first response (firstResponseAtUtc IS NULL)
3. For each ticket:
   - Calculate ticket age in minutes
   - Check if SLA is breached (now > responseDueAtUtc)
   - If breached: mark status as BREACHED
   - Else: check escalation levels and escalate if needed

### Escalation Levels

| Level | Trigger | Action |
|-------|---------|--------|
| 0 | Initial | No escalation |
| 1 | 60 minutes without response | First escalation |
| 2 | 120 minutes without response | Second escalation |
| 3 | 240 minutes without response | Critical escalation |

### Idempotency Guarantees

- Tickets are only escalated if `escalatedLevel < newLevel`
- `lastEscalationAtUtc` tracks when escalation occurred
- Repeated runs within the same level are no-ops
- Status changes to BREACHED only happen once

## Default SLA Times by Category

| Category | Response Time | Resolution Time |
|----------|--------------|-----------------|
| COMPLAINT | 30 min | 4 hours |
| BILLING | 1 hour | 8 hours |
| HOUSEKEEPING | 30 min | 2 hours |
| MAINTENANCE | 1 hour | 8 hours |
| CONCIERGE | 15 min | 1 hour |
| ROOM_SERVICE | 15 min | 1 hour |
| CHECK_IN_OUT | 15 min | 30 min |
| BOOKING | 1 hour | 4 hours |
| OTHER | 1 hour | 8 hours |

## Ticket Auto-Classification

Tickets are automatically classified based on keywords in conversation messages:

### Keyword Rules

| Category | Keywords | Priority |
|----------|----------|----------|
| COMPLAINT | urgent, emergency, complaint, unhappy | HIGH/URGENT |
| BILLING | invoice, bill, charge, payment, refund | MEDIUM |
| HOUSEKEEPING | clean, dirty, towel, housekeeping | MEDIUM |
| MAINTENANCE | broken, fix, repair, wifi, ac | MEDIUM |
| CONCIERGE | restaurant, taxi, tour, spa | LOW |
| ROOM_SERVICE | food, room service, breakfast | MEDIUM |
| CHECK_IN_OUT | check-in, checkout, arrival | MEDIUM |
| BOOKING | booking, reservation, cancel | MEDIUM |

## Integration Points

### Conversation Creation

When a conversation is created (e.g., from a booking):
1. Ticket is automatically created
2. Category/department/priority are classified
3. SLA policy is applied
4. Due dates are calculated

### Staff Message Sending

When staff sends a message:
1. Ticket is ensured to exist
2. First response time is recorded
3. Ticket status changes to IN_PROGRESS
4. SLA breach is prevented

## Backfill Migration

For existing systems with conversations but no tickets:

### Via Script

```bash
cd packages/api
DATABASE_URL="your-connection-string" npx tsx scripts/backfillTickets.ts
```

### Via API (Admin only)

```bash
curl -X POST https://your-api/api/tickets/backfill \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Manual Testing Checklist

### 1. Setup Verification

- [ ] SLA_JOB_SECRET is set in Railway
- [ ] Database schema is synced
- [ ] Prisma client is generated

### 2. Endpoint Tests

- [ ] GET /api/jobs/health returns configured: true
- [ ] POST /api/jobs/sla-escalation/run returns summary
- [ ] Invalid secret returns 401
- [ ] Missing secret returns 401

### 3. Ticket Creation

- [ ] Create a booking → conversation + ticket created
- [ ] Ticket has correct category/department/priority
- [ ] SLA due dates are set correctly

### 4. Escalation Flow

- [ ] Create ticket, wait 65+ minutes
- [ ] Run escalation job
- [ ] Verify escalatedLevel increased to 1
- [ ] Run again, verify no duplicate escalation

### 5. SLA Breach

- [ ] Create ticket with short SLA
- [ ] Wait past responseDueAtUtc
- [ ] Run escalation job
- [ ] Verify status changed to BREACHED

### 6. First Response

- [ ] Create ticket
- [ ] Staff sends message
- [ ] Verify firstResponseAtUtc is set
- [ ] Verify ticket not escalated on subsequent runs

## Troubleshooting

### Job Returns 401

- Verify X-Job-Secret header is correct
- Check SLA_JOB_SECRET environment variable is set
- Ensure no extra whitespace in secret

### Job Returns 503

- SLA_JOB_SECRET not configured
- Set the environment variable and redeploy

### Tickets Not Being Created

- Check ensureTicketForConversation is called
- Verify conversation has valid hotelId
- Check for errors in server logs

### Escalations Not Triggering

- Verify tickets have status OPEN or PENDING
- Check firstResponseAtUtc is NULL
- Verify ticket age exceeds escalation threshold
- Ensure escalatedLevel < target level

## File Structure

```
packages/api/
├── prisma/
│   └── schema.prisma          # Ticket + SLAPolicy models
├── scripts/
│   └── backfillTickets.ts     # Migration script
└── src/
    ├── routes/
    │   ├── job.routes.ts      # Job endpoint
    │   └── ticket.routes.ts   # Ticket CRUD
    └── services/
        └── ticket.service.ts  # Core logic
docs/
├── SLA_TICKETS.md            # Feature documentation
└── SLA_ESCALATION.md         # This file
```

## Future Enhancements

1. **Notification Integration**: Send emails/SMS on escalation
2. **Custom Escalation Steps**: Per-hotel escalation configuration
3. **Dashboard Widgets**: SLA compliance metrics
4. **Escalation Assignment**: Auto-assign to escalation handler
5. **SLA Reports**: Compliance reports and analytics
