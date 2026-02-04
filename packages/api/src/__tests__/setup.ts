/**
 * Vitest Unit Test Setup
 * Sets up mocks and test environment for unit tests
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock Prisma client enums
vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual('@prisma/client');
  return {
    ...actual,
    Role: {
      ADMIN: 'ADMIN',
      MANAGER: 'MANAGER',
      RECEPTIONIST: 'RECEPTIONIST',
      HOUSEKEEPING: 'HOUSEKEEPING',
    },
    RoomStatus: {
      AVAILABLE: 'AVAILABLE',
      OCCUPIED: 'OCCUPIED',
      OUT_OF_SERVICE: 'OUT_OF_SERVICE',
    },
    HousekeepingStatus: {
      CLEAN: 'CLEAN',
      DIRTY: 'DIRTY',
      INSPECTION: 'INSPECTION',
      OUT_OF_SERVICE: 'OUT_OF_SERVICE',
    },
    BookingStatus: {
      CONFIRMED: 'CONFIRMED',
      CHECKED_IN: 'CHECKED_IN',
      CHECKED_OUT: 'CHECKED_OUT',
      CANCELLED: 'CANCELLED',
      NO_SHOW: 'NO_SHOW',
    },
    BookingSource: {
      DIRECT: 'DIRECT',
      BOOKING_COM: 'BOOKING_COM',
      EXPEDIA: 'EXPEDIA',
      AIRBNB: 'AIRBNB',
      WALK_IN: 'WALK_IN',
      PHONE: 'PHONE',
      CORPORATE: 'CORPORATE',
    },
  };
});

// Mock Prisma client
vi.mock('../config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    hotel: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    roomType: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    booking: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    guest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    charge: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    housekeepingLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn({
      booking: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      room: {
        update: vi.fn(),
      },
      activityLog: {
        create: vi.fn(),
      },
    })),
    $disconnect: vi.fn(),
  },
}));

// Mock logger
vi.mock('../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  requestLoggerFormat: ':method :url :status :response-time ms',
}));

beforeAll(() => {
  // Global setup before all tests
});

afterEach(() => {
  // Reset all mocks after each test
  vi.clearAllMocks();
});

afterAll(() => {
  // Global cleanup after all tests
  vi.restoreAllMocks();
});
