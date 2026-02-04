/**
 * Vitest Integration Test Setup
 * Sets up real database connection for integration tests
 */

import { beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { prisma } from '../config/database.js';

// Set test environment
process.env.NODE_ENV = 'test';

// Test hotel and user IDs - these will be created before tests
export let testHotelId: string;
export let testUserId: string;
export let testAdminId: string;

beforeAll(async () => {
  // Ensure database is connected
  await prisma.$connect();

  // Create test hotel
  const hotel = await prisma.hotel.create({
    data: {
      name: 'Test Hotel',
      address: '123 Test Street',
      phone: '+1234567890',
      email: 'test@testhotel.com',
      timezone: 'UTC',
      currency: 'USD',
    },
  });
  testHotelId = hotel.id;

  // Create test admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4mZLqbCwfMKXrW3y', // password123
      firstName: 'Test',
      lastName: 'Admin',
      role: 'ADMIN',
      hotelId: hotel.id,
      isActive: true,
    },
  });
  testAdminId = admin.id;

  // Create test receptionist user
  const user = await prisma.user.create({
    data: {
      email: 'reception@test.com',
      passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4mZLqbCwfMKXrW3y', // password123
      firstName: 'Test',
      lastName: 'Receptionist',
      role: 'RECEPTIONIST',
      hotelId: hotel.id,
      isActive: true,
    },
  });
  testUserId = user.id;
});

afterEach(async () => {
  // Clean up test data created during tests (but not seed data)
  await prisma.activityLog.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.charge.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.guest.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.roomType.deleteMany({});
  await prisma.refreshToken.deleteMany({});
});

afterAll(async () => {
  // Clean up all test data
  await prisma.activityLog.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.charge.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.guest.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.roomType.deleteMany({});
  await prisma.housekeepingLog.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.hotel.deleteMany({});

  await prisma.$disconnect();
});
