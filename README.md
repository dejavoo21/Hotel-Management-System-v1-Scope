# HotelOS - Hotel Management System

A modern, production-ready Hotel Management System built with React, Node.js, and PostgreSQL. Designed to compete with solutions like Cloudbeds, Little Hotelier, and RoomRaccoon.

## Features

- **Dashboard** - Real-time overview of hotel operations, KPIs, arrivals/departures
- **Room Management** - Visual room grid, status tracking, housekeeping status
- **Booking System** - Full reservation management with check-in/check-out workflows
- **Guest Management** - Guest profiles, history, VIP status tracking
- **Housekeeping** - Interactive housekeeping board with status updates
- **Billing & Payments** - Charges, payments, invoice generation
- **Reports** - Revenue, occupancy, and performance analytics
- **User Management** - Role-based access control (Admin, Manager, Receptionist, Housekeeping)
- **Real-time Updates** - WebSocket-based live updates across all clients
- **PWA Support** - Installable on mobile devices, offline capabilities
- **2FA Security** - Two-factor authentication with TOTP

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS
- TanStack Query (server state)
- Zustand (client state)
- React Router
- PWA support

### Backend
- Node.js + Express + TypeScript
- PostgreSQL database
- Prisma ORM
- JWT authentication
- Socket.io (real-time)
- bcrypt + TOTP (security)

### DevOps
- Docker + Docker Compose
- Environment-based configuration

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   cd "Hotel Management System v1 scope/CLAUDE"
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations and seed**
   ```bash
   docker-compose exec api npx prisma migrate deploy
   docker-compose exec api npx prisma db seed
   ```

5. **Access the application**
   - Frontend: http://localhost:4212
   - API: http://localhost:4010

### Development Setup (Without Docker)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start PostgreSQL** (ensure it's running on port 5432)

3. **Run migrations**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.hotel | Demo123! |
| Manager | manager@demo.hotel | Demo123! |
| Receptionist | reception@demo.hotel | Demo123! |
| Housekeeping | housekeeping@demo.hotel | Demo123! |

## Project Structure

```
CLAUDE/
├── packages/
│   ├── api/              # Backend API
│   │   ├── src/
│   │   │   ├── config/       # Configuration
│   │   │   ├── controllers/  # Route handlers
│   │   │   ├── middleware/   # Express middleware
│   │   │   ├── routes/       # API routes
│   │   │   ├── services/     # Business logic
│   │   │   ├── socket/       # WebSocket handlers
│   │   │   └── types/        # TypeScript types
│   │   ├── prisma/           # Database schema & migrations
│   │   └── package.json
│   │
│   └── web/              # Frontend React App
│       ├── src/
│       │   ├── components/   # UI components
│       │   ├── pages/        # Page components
│       │   ├── services/     # API services
│       │   ├── stores/       # State management
│       │   ├── hooks/        # Custom hooks
│       │   └── types/        # TypeScript types
│       └── package.json
│
├── docs/                 # Documentation
├── tests/                # Test results
├── docker-compose.yml    # Development Docker setup
├── docker-compose.prod.yml # Production Docker setup
└── README.md
```

## API Documentation

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for full API documentation.

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | User login |
| POST | /api/auth/logout | User logout |
| GET | /api/dashboard/summary | Dashboard data |
| GET | /api/rooms | List rooms |
| GET | /api/bookings | List bookings |
| POST | /api/bookings | Create booking |
| POST | /api/bookings/:id/check-in | Check in guest |
| POST | /api/bookings/:id/check-out | Check out guest |
| GET | /api/guests | List guests |
| GET | /api/housekeeping/rooms | Housekeeping board |

## Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hotelos

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development

# Frontend
VITE_API_URL=http://localhost:3001/api

# Twilio (SMS + in-app Voice calls)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
SMS_FROM_PHONE=+15551234567
TWILIO_VOICE_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_VOICE_API_KEY_SECRET=your_twilio_voice_api_key_secret
TWILIO_VOICE_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_VOICE_FROM_PHONE=+15551234567
```

## User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all features, user management, settings |
| **Manager** | Bookings, rooms, guests, reports, housekeeping |
| **Receptionist** | Bookings, check-in/out, guests, basic room status |
| **Housekeeping** | Housekeeping board, room status updates |

## Testing

```bash
# Run all tests
npm test

# Run API tests
npm run test:api

# Run E2E tests
npm run test:e2e

# Run with coverage
npm run test:coverage
```

## Deployment

### Using Docker

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production containers
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions for:
- Railway
- Render
- DigitalOcean
- AWS

### Railway (Quick Start)

Deploy as two Railway services (API + Web):

1. **API service**
   - Root: `CLAUDE/packages/api`
   - Set `DATABASE_URL` (Postgres plugin), `JWT_SECRET`, `JWT_REFRESH_SECRET`
   - Start command: `npm run start`
   - Run migrations: `npm run db:migrate:prod` then `npm run db:seed`

2. **Web service**
   - Root: `CLAUDE/packages/web`
   - Set `VITE_API_URL` to `https://<your-api-service>.railway.app/api`
   - Build command: `npm run build`
   - Start command: `npm run preview -- --host 0.0.0.0 --port $PORT`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact support@hotelos.io.
