/**
 * Rooms API Integration Tests
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.js';
import { prisma } from '../config/database.js';

const app = createApp();

describe('Rooms API Integration', () => {
  let testHotelId: string;
  let testUserId: string;
  let testRoomTypeId: string;
  let testRoomId: string;
  let accessToken: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Create test hotel
    const hotel = await prisma.hotel.create({
      data: {
        name: 'Rooms Test Hotel',
        address: '123 Room Street',
        phone: '+1234567890',
        email: 'rooms@testhotel.com',
        timezone: 'UTC',
        currency: 'USD',
      },
    });
    testHotelId = hotel.id;

    // Create test admin user
    const passwordHash = await bcrypt.hash('TestPassword123!', 12);
    const user = await prisma.user.create({
      data: {
        email: 'roomstest@test.com',
        passwordHash,
        firstName: 'Room',
        lastName: 'Test',
        role: 'ADMIN',
        hotelId: testHotelId,
        isActive: true,
      },
    });
    testUserId = user.id;

    // Create room type
    const roomType = await prisma.roomType.create({
      data: {
        hotelId: testHotelId,
        name: 'Standard Room',
        description: 'A standard room',
        baseRate: 100.00,
        maxGuests: 2,
        amenities: ['WiFi', 'TV', 'AC'],
      },
    });
    testRoomTypeId = roomType.id;

    // Login to get access token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'roomstest@test.com',
        password: 'TestPassword123!',
      });
    accessToken = loginResponse.body.data.accessToken;
  });

  afterEach(async () => {
    // Clean up rooms created during tests (except the one we keep for other tests)
    await prisma.housekeepingLog.deleteMany({});
    await prisma.activityLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.housekeepingLog.deleteMany({});
    await prisma.room.deleteMany({ where: { hotelId: testHotelId } });
    await prisma.roomType.deleteMany({ where: { hotelId: testHotelId } });
    await prisma.refreshToken.deleteMany({});
    await prisma.activityLog.deleteMany({});
    await prisma.user.deleteMany({ where: { hotelId: testHotelId } });
    await prisma.hotel.delete({ where: { id: testHotelId } });
    await prisma.$disconnect();
  });

  describe('GET /api/rooms', () => {
    beforeAll(async () => {
      // Create some test rooms
      await prisma.room.createMany({
        data: [
          { hotelId: testHotelId, roomTypeId: testRoomTypeId, number: '101', floor: 1, status: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
          { hotelId: testHotelId, roomTypeId: testRoomTypeId, number: '102', floor: 1, status: 'OCCUPIED', housekeepingStatus: 'DIRTY' },
          { hotelId: testHotelId, roomTypeId: testRoomTypeId, number: '201', floor: 2, status: 'AVAILABLE', housekeepingStatus: 'INSPECTION' },
        ],
      });
    });

    it('should return all rooms for the hotel', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);
      expect(response.body.data[0]).toHaveProperty('number');
      expect(response.body.data[0]).toHaveProperty('floor');
      expect(response.body.data[0]).toHaveProperty('status');
      expect(response.body.data[0]).toHaveProperty('roomType');
    });

    it('should filter rooms by status', async () => {
      const response = await request(app)
        .get('/api/rooms?status=AVAILABLE')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((r: any) => r.status === 'AVAILABLE')).toBe(true);
    });

    it('should filter rooms by floor', async () => {
      const response = await request(app)
        .get('/api/rooms?floor=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((r: any) => r.floor === 1)).toBe(true);
    });

    it('should filter rooms by housekeeping status', async () => {
      const response = await request(app)
        .get('/api/rooms?housekeepingStatus=DIRTY')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((r: any) => r.housekeepingStatus === 'DIRTY')).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/rooms', () => {
    it('should create a new room', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          number: '301',
          floor: 3,
          roomTypeId: testRoomTypeId,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.number).toBe('301');
      expect(response.body.data.floor).toBe(3);
      expect(response.body.data.status).toBe('AVAILABLE');
      expect(response.body.data.housekeepingStatus).toBe('CLEAN');

      testRoomId = response.body.data.id;
    });

    it('should reject duplicate room number', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          number: '101', // Already exists
          floor: 1,
          roomTypeId: testRoomTypeId,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid room type', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          number: '999',
          floor: 9,
          roomTypeId: 'invalid-room-type-id',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/rooms/:id', () => {
    it('should return a specific room', async () => {
      const room = await prisma.room.findFirst({
        where: { hotelId: testHotelId },
      });

      const response = await request(app)
        .get(`/api/rooms/${room!.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(room!.id);
      expect(response.body.data.number).toBe(room!.number);
    });

    it('should return 404 for non-existent room', async () => {
      const response = await request(app)
        .get('/api/rooms/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/rooms/:id', () => {
    it('should update room details', async () => {
      const room = await prisma.room.findFirst({
        where: { hotelId: testHotelId },
      });

      const response = await request(app)
        .patch(`/api/rooms/${room!.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          notes: 'Updated room notes',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notes).toBe('Updated room notes');
    });
  });

  describe('PATCH /api/rooms/:id/status', () => {
    it('should update room status', async () => {
      const room = await prisma.room.findFirst({
        where: { hotelId: testHotelId, status: 'AVAILABLE' },
      });

      const response = await request(app)
        .patch(`/api/rooms/${room!.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'OUT_OF_SERVICE',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('OUT_OF_SERVICE');
    });

    it('should update housekeeping status', async () => {
      const room = await prisma.room.findFirst({
        where: { hotelId: testHotelId },
      });

      const response = await request(app)
        .patch(`/api/rooms/${room!.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          housekeepingStatus: 'CLEAN',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.housekeepingStatus).toBe('CLEAN');
    });
  });
});
