/**
 * Bookings API Integration Tests
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.js';
import { prisma } from '../config/database.js';

const app = createApp();

describe('Bookings API Integration', () => {
  let testHotelId: string;
  let testUserId: string;
  let testRoomTypeId: string;
  let testRoomId: string;
  let testGuestId: string;
  let testBookingId: string;
  let accessToken: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Create test hotel
    const hotel = await prisma.hotel.create({
      data: {
        name: 'Booking Test Hotel',
        address: '123 Booking Street',
        phone: '+1234567890',
        email: 'booking@testhotel.com',
        timezone: 'UTC',
        currency: 'USD',
      },
    });
    testHotelId = hotel.id;

    // Create test user
    const passwordHash = await bcrypt.hash('TestPassword123!', 12);
    const user = await prisma.user.create({
      data: {
        email: 'bookingtest@test.com',
        passwordHash,
        firstName: 'Booking',
        lastName: 'Test',
        role: 'RECEPTIONIST',
        hotelId: testHotelId,
        isActive: true,
      },
    });
    testUserId = user.id;

    // Create room type
    const roomType = await prisma.roomType.create({
      data: {
        hotelId: testHotelId,
        name: 'Deluxe Room',
        description: 'A deluxe room',
        baseRate: 150.00,
        maxGuests: 3,
        amenities: ['WiFi', 'TV', 'AC', 'Minibar'],
      },
    });
    testRoomTypeId = roomType.id;

    // Create room
    const room = await prisma.room.create({
      data: {
        hotelId: testHotelId,
        roomTypeId: testRoomTypeId,
        number: 'B101',
        floor: 1,
        status: 'AVAILABLE',
        housekeepingStatus: 'CLEAN',
      },
    });
    testRoomId = room.id;

    // Create guest
    const guest = await prisma.guest.create({
      data: {
        hotelId: testHotelId,
        firstName: 'Test',
        lastName: 'Guest',
        email: 'testguest@example.com',
        phone: '+1234567890',
        nationality: 'US',
      },
    });
    testGuestId = guest.id;

    // Login to get access token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'bookingtest@test.com',
        password: 'TestPassword123!',
      });
    accessToken = loginResponse.body.data.accessToken;
  });

  afterEach(async () => {
    await prisma.activityLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({});
    await prisma.charge.deleteMany({});
    await prisma.booking.deleteMany({ where: { hotelId: testHotelId } });
    await prisma.guest.deleteMany({ where: { hotelId: testHotelId } });
    await prisma.room.deleteMany({ where: { hotelId: testHotelId } });
    await prisma.roomType.deleteMany({ where: { hotelId: testHotelId } });
    await prisma.housekeepingLog.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.activityLog.deleteMany({});
    await prisma.user.deleteMany({ where: { hotelId: testHotelId } });
    await prisma.hotel.delete({ where: { id: testHotelId } });
    await prisma.$disconnect();
  });

  describe('POST /api/bookings', () => {
    it('should create a new booking', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 3);

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          guestId: testGuestId,
          roomId: testRoomId,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
          numberOfGuests: 2,
          source: 'DIRECT',
          specialRequests: 'Late check-in',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('bookingRef');
      expect(response.body.data.status).toBe('CONFIRMED');
      expect(response.body.data.numberOfGuests).toBe(2);
      expect(response.body.data.specialRequests).toBe('Late check-in');

      testBookingId = response.body.data.id;
    });

    it('should reject booking with checkout before checkin', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 5);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 2);

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          guestId: testGuestId,
          roomId: testRoomId,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
          numberOfGuests: 1,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject booking with invalid guest', async () => {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 10);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 12);

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          guestId: 'invalid-guest-id',
          roomId: testRoomId,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
          numberOfGuests: 1,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/bookings', () => {
    it('should return all bookings', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0]).toHaveProperty('bookingRef');
      expect(response.body.data[0]).toHaveProperty('guest');
    });

    it('should filter bookings by status', async () => {
      const response = await request(app)
        .get('/api/bookings?status=CONFIRMED')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((b: any) => b.status === 'CONFIRMED')).toBe(true);
    });

    it('should paginate bookings', async () => {
      const response = await request(app)
        .get('/api/bookings?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
    });
  });

  describe('GET /api/bookings/:id', () => {
    it('should return booking details', async () => {
      const response = await request(app)
        .get(`/api/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testBookingId);
      expect(response.body.data).toHaveProperty('guest');
      expect(response.body.data).toHaveProperty('room');
      expect(response.body.data).toHaveProperty('charges');
      expect(response.body.data).toHaveProperty('payments');
    });

    it('should return 404 for non-existent booking', async () => {
      const response = await request(app)
        .get('/api/bookings/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/bookings/:id/check-in', () => {
    it('should check in a booking', async () => {
      // First create a booking for today
      const checkInDate = new Date();
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 2);

      // Create a new room for this test
      const room = await prisma.room.create({
        data: {
          hotelId: testHotelId,
          roomTypeId: testRoomTypeId,
          number: 'B102',
          floor: 1,
          status: 'AVAILABLE',
          housekeepingStatus: 'CLEAN',
        },
      });

      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          guestId: testGuestId,
          roomId: room.id,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
          numberOfGuests: 1,
        });

      const bookingId = bookingResponse.body.data.id;

      const response = await request(app)
        .post(`/api/bookings/${bookingId}/check-in`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ roomId: room.id })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CHECKED_IN');

      // Verify room is now occupied
      const roomCheck = await prisma.room.findUnique({ where: { id: room.id } });
      expect(roomCheck?.status).toBe('OCCUPIED');
    });
  });

  describe('POST /api/bookings/:id/charges', () => {
    it('should add a charge to booking', async () => {
      const response = await request(app)
        .post(`/api/bookings/${testBookingId}/charges`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          description: 'Minibar',
          category: 'MINIBAR',
          amount: 25.00,
          quantity: 1,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toBe('Minibar');
      expect(parseFloat(response.body.data.amount)).toBe(25.00);
    });
  });

  describe('POST /api/bookings/:id/payments', () => {
    it('should add a payment to booking', async () => {
      const response = await request(app)
        .post(`/api/bookings/${testBookingId}/payments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 100.00,
          method: 'CARD',
          reference: '****4242',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(parseFloat(response.body.data.amount)).toBe(100.00);
      expect(response.body.data.method).toBe('CARD');
    });
  });

  describe('PATCH /api/bookings/:id', () => {
    it('should update booking details', async () => {
      const response = await request(app)
        .patch(`/api/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          specialRequests: 'Early check-in, Extra pillows',
          numberOfGuests: 3,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.specialRequests).toBe('Early check-in, Extra pillows');
      expect(response.body.data.numberOfGuests).toBe(3);
    });
  });

  describe('POST /api/bookings/:id/cancel', () => {
    it('should cancel a booking', async () => {
      // Create a new booking to cancel
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 15);
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 17);

      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          guestId: testGuestId,
          roomId: testRoomId,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
          numberOfGuests: 1,
        });

      const bookingId = bookingResponse.body.data.id;

      const response = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'Guest requested cancellation' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CANCELLED');
    });
  });
});
