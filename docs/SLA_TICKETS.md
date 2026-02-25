# Ticket + SLA System

## Overview

The Ticket + SLA system provides automatic support ticket creation and SLA-based escalation for all guest conversations. Every conversation automatically gets a ticket, which is classified and assigned SLA deadlines based on content and hotel policies.

## Features

- **Auto-ticket creation**: Every conversation gets exactly ONE ticket (1:1 relationship)
- **Keyword-based classification**: Tickets are auto-categorized based on message content
- **SLA policies**: Configurable response and resolution time targets per category
- **Automatic escalation**: Tickets without response are escalated based on age
- **SLA breach tracking**: Tickets that exceed SLA deadlines are marked as breached

## Architecture

### Database Models

#### Ticket
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| hotelId | String | Hotel reference |
| conversationId | String | Unique conversation reference |
| type | TicketType | BOOKING_RELATED or GENERAL_INQUIRY |
| category | TicketCategory | Auto-classified category |
| department | Department | Responsible department |
| priority | TicketPriority | LOW, MEDIUM, HIGH, URGENT |
| status | TicketStatus | OPEN, PENDING, IN_PROGRESS, RESOLVED, CLOSED, BREACHED |
| assignedToId | String? | Assigned staff member |
| responseDueAtUtc | DateTime | SLA response deadline |
| resolutionDueAtUtc | DateTime | SLA resolution deadline |
| firstResponseAtUtc | DateTime? | When first response was sent |
| resolvedAtUtc | DateTime? | When ticket was resolved |
| escalatedLevel | Int | Current escalation level (0-3) |
| lastEscalationAtUtc | DateTime? | Last escalation timestamp |

#### SLAPolicy
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| hotelId | String | Hotel reference |
| category | TicketCategory | Category this policy applies to |
| department | Department | Department for routing |
| responseMinutes | Int | Target response time in minutes |
| resolutionMinutes | Int | Target resolution time in minutes |
| escalationStepsJson | Json | Escalation configuration |
| isActive | Boolean | Whether policy is active |

### Enums

**TicketType**: `BOOKING_RELATED`, `GENERAL_INQUIRY`

**TicketStatus**: `OPEN`, `PENDING`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `BREACHED`

**TicketPriority**: `LOW`, `MEDIUM`, `HIGH`, `URGENT`

**Department**: `FRONT_DESK`, `HOUSEKEEPING`, `MAINTENANCE`, `CONCIERGE`, `BILLING`, `MANAGEMENT`

**TicketCategory**: `COMPLAINT`, `BILLING`, `HOUSEKEEPING`, `MAINTENANCE`, `CONCIERGE`, `ROOM_SERVICE`, `CHECK_IN_OUT`, `BOOKING`, `OTHER`

## API Endpoints

### Ticket CRUD (requires authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | List tickets (with filters) |
| GET | `/api/tickets/:id` | Get ticket by ID |
| GET | `/api/tickets/conversation/:conversationId` | Get ticket by conversation |
| PATCH | `/api/tickets/:id` | Update ticket |
| POST | `/api/tickets/:id/assign` | Assign ticket to user |
| POST | `/api/tickets/:id/resolve` | Mark ticket as resolved |
| POST | `/api/tickets/:id/close` | Mark ticket as closed |
| POST | `/api/tickets/backfill` | Backfill tickets (admin only) |

#### Query Parameters for GET /api/tickets

| Parameter | Type | Description |
|-----------|------|-------------|
| status | TicketStatus | Filter by status |
| priority | TicketPriority | Filter by priority |
| department | Department | Filter by department |
| category | TicketCategory | Filter by category |
| assignedToId | String | Filter by assigned user |
| page | Number | Page number (default: 1) |
| limit | Number | Items per page (default: 20) |

### SLA Escalation Job (requires X-Job-Secret header)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/jobs/sla-escalation/run` | Process SLA escalations |
| GET | `/api/jobs/health` | Job system health check |

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| SLA_JOB_SECRET | Secret for job endpoint authentication | Yes (for cron) |

Set this in Railway:
```bash
railway variables --set SLA_JOB_SECRET=your-secure-secret-here
```

### Cron Job Setup

To run SLA escalation automatically, set up a Railway cron job:

1. Add a new cron service or use Railway's built-in cron
2. Schedule: `*/5 * * * *` (every 5 minutes)
3. Command:
   ```bash
   curl -X POST https://laflo-hms-production.up.railway.app/api/jobs/sla-escalation/run \
     -H "X-Job-Secret: your-secure-secret-here"
   ```

## Ticket Classification

Tickets are automatically classified based on keywords in the conversation subject and messages:

| Category | Keywords | Default Priority |
|----------|----------|-----------------|
| COMPLAINT | urgent, emergency, complaint, unhappy, disappointed, terrible | HIGH/URGENT |
| BILLING | invoice, bill, charge, payment, refund | MEDIUM |
| HOUSEKEEPING | clean, dirty, towel, sheet, housekeeping | MEDIUM |
| MAINTENANCE | broken, fix, repair, leak, wifi, ac | MEDIUM |
| CONCIERGE | restaurant, reservation, taxi, tour, spa | LOW |
| ROOM_SERVICE | food, room service, breakfast, menu, order | MEDIUM |
| CHECK_IN_OUT | check-in, checkout, early, late, arrival | MEDIUM |
| BOOKING | booking, reservation, cancel, modify | MEDIUM |
| OTHER | (default) | MEDIUM |

## Escalation Levels

| Level | Trigger | Description |
|-------|---------|-------------|
| 0 | Initial | No escalation |
| 1 | 60 minutes | First escalation |
| 2 | 120 minutes | Second escalation |
| 3 | 240 minutes | Critical escalation |

## Default SLA Times

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

## Backfill Script

To create tickets for existing conversations:

```bash
# From packages/api directory
npx ts-node scripts/backfillTickets.ts
```

Or via the API (admin only):
```bash
curl -X POST https://laflo-hms-production.up.railway.app/api/tickets/backfill \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Integration Points

### Conversation Creation
When a conversation is created (e.g., from a booking), a ticket is automatically created.

### Message Sending
When staff sends a message to a conversation:
1. A ticket is ensured to exist
2. First response time is recorded (if not already)
3. Ticket status changes to IN_PROGRESS

### Activity Logging
All ticket operations are logged in the ActivityLog table:
- `TICKET_CREATED`: New ticket created
- `TICKET_UPDATED`: Ticket modified
- `TICKET_ASSIGNED`: Ticket assigned to user
- `TICKET_FIRST_RESPONSE`: Staff responded
- `TICKET_ESCALATED`: Ticket escalated
- `TICKET_SLA_BREACHED`: SLA deadline exceeded

## Example Usage

### Listing Open Tickets
```typescript
GET /api/tickets?status=OPEN&priority=HIGH
Authorization: Bearer YOUR_TOKEN
```

### Assigning a Ticket
```typescript
POST /api/tickets/abc123/assign
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "assignedToId": "user-123"
}
```

### Running SLA Escalation
```typescript
POST /api/jobs/sla-escalation/run
X-Job-Secret: your-secure-secret
```

Response:
```json
{
  "success": true,
  "data": {
    "processed": 15,
    "escalated": 3,
    "breached": 1,
    "errors": [],
    "durationMs": 234,
    "runAt": "2025-01-15T10:30:00.000Z"
  },
  "message": "Processed 15 tickets: 3 escalated, 1 breached"
}
```
