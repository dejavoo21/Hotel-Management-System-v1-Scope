/**
 * Authentication Integration Tests
 * Tests the complete auth flow with real database
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.js';
import { prisma } from '../config/database.js';

const app = createApp();

describe('Authentication API Integration', () => {
  let testHotelId: string;
  let testUserId: string;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Create test hotel
    const hotel = await prisma.hotel.create({
      data: {
        name: 'Auth Test Hotel',
        address: '123 Auth Street',
        phone: '+1234567890',
        email: 'auth@testhotel.com',
        timezone: 'UTC',
        currency: 'USD',
      },
    });
    testHotelId = hotel.id;

    // Create test user
    const passwordHash = await bcrypt.hash('TestPassword123!', 12);
    const user = await prisma.user.create({
      data: {
        email: 'authtest@test.com',
        passwordHash,
        firstName: 'Auth',
        lastName: 'Test',
        role: 'RECEPTIONIST',
        hotelId: testHotelId,
        isActive: true,
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.activityLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.activityLog.deleteMany({});
    await prisma.user.deleteMany({ where: { hotelId: testHotelId } });
    await prisma.hotel.delete({ where: { id: testHotelId } });
    await prisma.$disconnect();
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'authtest@test.com',
          password: 'TestPassword123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe('authtest@test.com');
      expect(response.body.data.user.firstName).toBe('Auth');
      expect(response.body.data.user).not.toHaveProperty('passwordHash');

      // Save tokens for subsequent tests
      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'authtest@test.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'SomePassword123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'SomePassword123!',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'authtest@test.com',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    beforeAll(async () => {
      // Login to get fresh tokens
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'authtest@test.com',
          password: 'TestPassword123!',
        });
      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('authtest@test.com');
      expect(response.body.data.firstName).toBe('Auth');
      expect(response.body.data.lastName).toBe('Test');
      expect(response.body.data.role).toBe('RECEPTIONIST');
      expect(response.body.data).toHaveProperty('hotel');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject request with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', accessToken) // Missing 'Bearer' prefix
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    beforeAll(async () => {
      // Login to get fresh tokens
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'authtest@test.com',
          password: 'TestPassword123!',
        });
      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');

      // New tokens should be different from old ones
      expect(response.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // First login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'authtest@test.com',
          password: 'TestPassword123!',
        });

      const { accessToken: token, refreshToken: refresh } = loginResponse.body.data;

      // Then logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken: refresh })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify refresh token is invalidated
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: refresh })
        .expect(401);

      expect(refreshResponse.body.success).toBe(false);
    });
  });
});
