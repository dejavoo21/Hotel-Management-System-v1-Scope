/**
 * App Unit Tests
 * Tests the Express application configuration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('App', () => {
  const app = createApp();

  describe('Health Check', () => {
    it('should return healthy status on GET /health', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data.environment).toBe('test');
    });
  });

  describe('API Root', () => {
    it('should return API info on GET /api', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('HotelOS API');
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data).toHaveProperty('endpoints');
      expect(response.body.data.endpoints).toHaveProperty('auth');
      expect(response.body.data.endpoints).toHaveProperty('rooms');
      expect(response.body.data.endpoints).toHaveProperty('bookings');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should return 404 for unknown API routes', async () => {
      const response = await request(app)
        .get('/api/unknown-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('CORS', () => {
    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in response', async () => {
      const response = await request(app)
        .get('/health');

      // Helmet adds various security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('JSON Body Parsing', () => {
    it('should parse JSON request body', async () => {
      // This will fail auth, but proves JSON parsing works
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'password' })
        .set('Content-Type', 'application/json');

      // We expect 401 (invalid credentials), not 400 (bad request)
      // which proves the JSON was parsed correctly
      expect(response.status).toBe(401);
    });

    it('should reject invalid JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send('{ invalid json }')
        .set('Content-Type', 'application/json');

      // Express returns 400 or 500 for JSON parse errors depending on error handler
      expect([400, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });
  });
});
