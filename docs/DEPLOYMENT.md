# HotelOS Deployment Guide

This guide covers deploying HotelOS to various platforms.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Docker Deployment](#docker-deployment)
4. [Railway Deployment](#railway-deployment)
5. [Render Deployment](#render-deployment)
6. [DigitalOcean Deployment](#digitalocean-deployment)
7. [Production Checklist](#production-checklist)

---

## Prerequisites

Before deploying, ensure you have:

- Node.js 18+ installed locally (for building)
- Docker & Docker Compose (for containerized deployment)
- Git repository with your code
- Domain name (optional but recommended)
- SSL certificate (provided by most platforms)

---

## Environment Configuration

### Required Environment Variables

Create a `.env.production` file with:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/hotelos?schema=public

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-domain.com

# Optional: Redis (for sessions)
REDIS_URL=redis://localhost:6379

# Optional: Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@your-domain.com
```

### Security Notes

- Generate strong random strings for JWT secrets:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Never commit `.env` files to version control
- Use platform-specific secret management when available

---

## Docker Deployment

### Using Docker Compose

1. **Build production images:**
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

2. **Start services:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Run database migrations:**
   ```bash
   docker-compose exec api npx prisma migrate deploy
   ```

4. **Seed initial data (optional):**
   ```bash
   docker-compose exec api npx prisma db seed
   ```

### Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
      target: production
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    ports:
      - "3001:3001"
    depends_on:
      - postgres
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
      target: production
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

---

## Railway Deployment

Railway provides easy deployment with automatic SSL and managed databases.

### Step 1: Create Project

1. Go to [Railway](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize and select your repository

### Step 2: Add PostgreSQL

1. In your project, click "New"
2. Select "Database" → "PostgreSQL"
3. Copy the `DATABASE_URL` from the Variables tab

### Step 3: Configure API Service

1. Click on your API service
2. Go to "Settings" → "Build"
3. Set build command:
   ```
   cd packages/api && npm install && npm run build && npx prisma migrate deploy
   ```
4. Set start command:
   ```
   cd packages/api && npm start
   ```

### Step 4: Configure Environment Variables

Add these variables in the "Variables" tab:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
NODE_ENV=production
PORT=3001
```

### Step 5: Deploy Frontend

1. Create a new service for the frontend
2. Set build command:
   ```
   cd packages/web && npm install && npm run build
   ```
3. Set output directory: `packages/web/dist`
4. Add environment variable:
   ```
   VITE_API_URL=https://your-api.up.railway.app/api
   ```

### Step 6: Set Up Domain (Optional)

1. Go to Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

---

## Render Deployment

### Step 1: Create Web Services

#### API Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name:** hotelos-api
   - **Root Directory:** packages/api
   - **Build Command:** `npm install && npm run build && npx prisma migrate deploy`
   - **Start Command:** `npm start`
   - **Environment:** Node

#### Frontend Service

1. Click "New" → "Static Site"
2. Connect repository
3. Configure:
   - **Name:** hotelos-web
   - **Root Directory:** packages/web
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** dist

### Step 2: Create PostgreSQL Database

1. Click "New" → "PostgreSQL"
2. Configure database settings
3. Copy the Internal Database URL

### Step 3: Configure Environment Variables

For the API service, add:

```
DATABASE_URL=<Internal Database URL>
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
NODE_ENV=production
```

For the frontend:

```
VITE_API_URL=https://hotelos-api.onrender.com/api
```

---

## DigitalOcean Deployment

### Using App Platform

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click "Create App"
3. Connect your GitHub repository

### Configure Components

Add three components:

#### 1. API Component
- **Type:** Web Service
- **Source Directory:** /packages/api
- **Build Command:** `npm install && npm run build`
- **Run Command:** `npm start`
- **HTTP Port:** 3001

#### 2. Web Component
- **Type:** Static Site
- **Source Directory:** /packages/web
- **Build Command:** `npm install && npm run build`
- **Output Directory:** dist

#### 3. Database Component
- **Type:** Dev Database (PostgreSQL)
- Or attach existing managed database

### Environment Variables

Set these in the App settings:

```
DATABASE_URL=${db.DATABASE_URL}
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
NODE_ENV=production
VITE_API_URL=${api.PUBLIC_URL}/api
```

---

## Production Checklist

### Before Going Live

- [ ] **Security**
  - [ ] Strong JWT secrets generated
  - [ ] 2FA enabled for admin accounts
  - [ ] CORS configured for production domain
  - [ ] Rate limiting enabled
  - [ ] SSL/TLS configured

- [ ] **Database**
  - [ ] Migrations applied
  - [ ] Database backups configured
  - [ ] Connection pooling set up

- [ ] **Monitoring**
  - [ ] Error tracking (Sentry, etc.)
  - [ ] Application logging
  - [ ] Uptime monitoring

- [ ] **Performance**
  - [ ] CDN configured for static assets
  - [ ] Gzip compression enabled
  - [ ] Database indexes optimized

### Post-Deployment

1. **Create admin user:**
   ```bash
   # Via API or seed script
   npm run db:seed
   ```

2. **Test critical flows:**
   - Login/logout
   - Create booking
   - Check-in/check-out
   - View dashboard

3. **Monitor logs:**
   ```bash
   # Docker
   docker-compose logs -f api

   # Railway
   railway logs

   # Render
   View logs in dashboard
   ```

### Scaling Considerations

For high-traffic deployments:

1. **Horizontal Scaling**
   - Add more API instances
   - Use load balancer

2. **Database Scaling**
   - Use read replicas
   - Implement connection pooling (PgBouncer)

3. **Caching**
   - Add Redis for session storage
   - Cache frequently accessed data

4. **CDN**
   - Use Cloudflare or similar for static assets
   - Enable edge caching

---

## Troubleshooting

### Common Issues

**Database connection failed:**
- Check DATABASE_URL format
- Verify network connectivity
- Check database credentials

**API not responding:**
- Check logs for errors
- Verify PORT environment variable
- Check CORS configuration

**Frontend can't reach API:**
- Verify VITE_API_URL is correct
- Check CORS settings on API
- Ensure API is running

### Getting Help

- Check application logs first
- Review environment variables
- Verify database migrations ran
- Test endpoints with curl/Postman
