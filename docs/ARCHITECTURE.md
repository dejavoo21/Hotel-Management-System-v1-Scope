# HotelOS Architecture Documentation

## System Overview

HotelOS is a modern hotel management system built with a microservices-inspired monorepo architecture. The system is designed for scalability, maintainability, and real-time operations.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Web App    │  │ Mobile PWA   │  │   Tablet     │          │
│  │   (React)    │  │  (React)     │  │   (React)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   HTTP / WebSocket │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Express.js Server                       │  │
│  │  ┌─────────┐  ┌─────────────┐  ┌─────────────────────┐   │  │
│  │  │ Routes  │→ │ Controllers │→ │     Services        │   │  │
│  │  └─────────┘  └─────────────┘  └─────────────────────┘   │  │
│  │       │              │                    │               │  │
│  │  ┌─────────────────────────────────────────┐             │  │
│  │  │            Middleware Stack             │             │  │
│  │  │  • Auth (JWT)  • Validation  • Error   │             │  │
│  │  └─────────────────────────────────────────┘             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Socket.io Server                       │  │
│  │         Real-time events: rooms, bookings, alerts         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────┐   │
│  │   PostgreSQL     │  │     Redis       │  │   File       │   │
│  │   (Primary DB)   │  │   (Sessions)    │  │   Storage    │   │
│  └──────────────────┘  └─────────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend (packages/web)

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| Tailwind CSS | Styling |
| TanStack Query | Server state management |
| Zustand | Client state management |
| React Router | Client-side routing |
| Axios | HTTP client |
| Socket.io-client | Real-time communication |
| react-hot-toast | Notifications |

### Backend (packages/api)

| Technology | Purpose |
|------------|---------|
| Node.js | Runtime environment |
| Express.js | Web framework |
| TypeScript | Type safety |
| Prisma | ORM & database toolkit |
| Socket.io | WebSocket server |
| JWT | Authentication |
| bcryptjs | Password hashing |
| otplib | 2FA TOTP generation |
| Zod | Schema validation |
| Winston | Logging |

### Database

| Technology | Purpose |
|------------|---------|
| PostgreSQL | Primary database |
| Redis | Session storage, caching |

### DevOps

| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Multi-container orchestration |

## Directory Structure

```
CLAUDE/
├── packages/
│   ├── api/
│   │   ├── src/
│   │   │   ├── config/           # Configuration management
│   │   │   │   ├── index.ts      # Environment config
│   │   │   │   ├── database.ts   # Prisma client
│   │   │   │   └── logger.ts     # Winston logger
│   │   │   │
│   │   │   ├── controllers/      # Request handlers
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── booking.controller.ts
│   │   │   │   ├── room.controller.ts
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── middleware/       # Express middleware
│   │   │   │   ├── auth.ts       # JWT authentication
│   │   │   │   ├── errorHandler.ts
│   │   │   │   └── validate.ts
│   │   │   │
│   │   │   ├── routes/           # API route definitions
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── booking.routes.ts
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── services/         # Business logic
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── booking.service.ts
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── socket/           # WebSocket handlers
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── types/            # TypeScript interfaces
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── utils/            # Utility functions
│   │   │   ├── app.ts            # Express app setup
│   │   │   └── index.ts          # Server entry point
│   │   │
│   │   └── prisma/
│   │       ├── schema.prisma     # Database schema
│   │       ├── migrations/       # Database migrations
│   │       └── seed.ts           # Seed data
│   │
│   └── web/
│       ├── src/
│       │   ├── components/       # UI components
│       │   │   └── layouts/      # Layout components
│       │   │
│       │   ├── pages/            # Page components
│       │   │   ├── auth/
│       │   │   ├── DashboardPage.tsx
│       │   │   ├── RoomsPage.tsx
│       │   │   └── ...
│       │   │
│       │   ├── services/         # API service layer
│       │   │   ├── api.ts        # Axios instance
│       │   │   ├── auth.ts
│       │   │   └── ...
│       │   │
│       │   ├── stores/           # Zustand stores
│       │   │   └── authStore.ts
│       │   │
│       │   ├── hooks/            # Custom React hooks
│       │   ├── types/            # TypeScript types
│       │   ├── utils/            # Utility functions
│       │   ├── App.tsx           # Root component
│       │   └── main.tsx          # Entry point
│       │
│       └── public/               # Static assets
│           └── manifest.json     # PWA manifest
│
├── docs/                         # Documentation
├── tests/                        # Test results
├── docker-compose.yml
└── README.md
```

## Design Patterns

### Backend Patterns

#### 1. Controller-Service Pattern
Controllers handle HTTP requests and delegate business logic to services.

```typescript
// Controller: handles HTTP
async function getBookings(req, res, next) {
  const bookings = await bookingService.getAll(req.user.hotelId);
  res.json({ success: true, data: bookings });
}

// Service: business logic
class BookingService {
  async getAll(hotelId) {
    return prisma.booking.findMany({ where: { hotelId } });
  }
}
```

#### 2. Repository Pattern (via Prisma)
Database operations are abstracted through Prisma ORM.

#### 3. Middleware Chain
Request processing through composable middleware.

```typescript
router.get('/bookings',
  authenticate,      // JWT verification
  authorize(['ADMIN', 'MANAGER', 'RECEPTIONIST']),  // Role check
  validate(schema),  // Input validation
  controller.getBookings
);
```

### Frontend Patterns

#### 1. Container/Presentational Components
Pages contain logic, components focus on presentation.

#### 2. Custom Hooks Pattern
Reusable logic extracted into custom hooks.

```typescript
function useBookings(filters) {
  return useQuery({
    queryKey: ['bookings', filters],
    queryFn: () => bookingService.getBookings(filters)
  });
}
```

#### 3. Store Pattern (Zustand)
Global client state management with Zustand.

```typescript
const useAuthStore = create((set) => ({
  user: null,
  login: async (credentials) => { /* ... */ },
  logout: async () => { /* ... */ },
}));
```

## Authentication Flow

```
┌─────────┐         ┌──────────┐         ┌──────────┐
│  Client │         │   API    │         │ Database │
└────┬────┘         └────┬─────┘         └────┬─────┘
     │                   │                    │
     │  POST /auth/login │                    │
     │──────────────────>│                    │
     │                   │  Verify password   │
     │                   │───────────────────>│
     │                   │<───────────────────│
     │                   │                    │
     │                   │  If 2FA enabled    │
     │  requiresTwoFactor│                    │
     │<──────────────────│                    │
     │                   │                    │
     │  POST /auth/2fa   │                    │
     │──────────────────>│                    │
     │                   │  Verify TOTP       │
     │                   │                    │
     │  accessToken +    │                    │
     │  refreshToken     │                    │
     │<──────────────────│                    │
     │                   │                    │
     │  API request with │                    │
     │  Bearer token     │                    │
     │──────────────────>│                    │
     │                   │  Verify JWT        │
     │                   │                    │
     │  Response         │                    │
     │<──────────────────│                    │
```

## Real-time Architecture

Socket.io is used for real-time updates across all connected clients.

### Event Types

| Event | Description |
|-------|-------------|
| `room:updated` | Room status changed |
| `booking:created` | New booking created |
| `booking:checkedIn` | Guest checked in |
| `booking:checkedOut` | Guest checked out |
| `housekeeping:updated` | Room cleaning status changed |

### Room-based Broadcasting

Events are broadcast to all clients subscribed to a specific hotel's room.

```typescript
// Server-side
io.to(`hotel:${hotelId}`).emit('room:updated', data);

// Client-side
socket.on('room:updated', (data) => {
  queryClient.invalidateQueries(['rooms']);
});
```

## Database Schema

### Entity Relationships

```
Hotel
├── Users (many)
├── RoomTypes (many)
│   └── Rooms (many)
│       └── Bookings (many)
├── Guests (many)
│   └── Bookings (many)
└── Bookings (many)
    ├── Charges (many)
    ├── Payments (many)
    └── Invoices (many)
```

### Key Tables

| Table | Purpose |
|-------|---------|
| Hotel | Hotel configuration and settings |
| User | Staff accounts |
| RoomType | Room categories |
| Room | Individual rooms |
| Guest | Guest profiles |
| Booking | Reservations |
| Charge | Additional charges |
| Payment | Payment records |
| Invoice | Generated invoices |
| ActivityLog | Audit trail |
| RefreshToken | JWT refresh tokens |

## Security Considerations

### Authentication
- JWT with short expiry (15 minutes)
- Refresh tokens for session management
- Optional 2FA with TOTP

### Authorization
- Role-based access control (RBAC)
- Hotel-scoped data isolation
- Route-level permission checks

### Data Protection
- Password hashing with bcrypt
- SQL injection prevention via Prisma
- XSS protection headers
- CORS configuration
- Rate limiting

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Session storage in Redis
- Database connection pooling

### Performance
- Query optimization with Prisma
- Response caching strategies
- Efficient pagination

### Future Improvements
- Message queue for async operations
- CDN for static assets
- Database read replicas
