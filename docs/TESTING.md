# HotelOS Testing Guide

This guide covers the testing strategy and how to run tests for the HotelOS project.

## Table of Contents

1. [Overview](#overview)
2. [Test Structure](#test-structure)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [E2E Tests](#e2e-tests)
6. [Running Tests](#running-tests)
7. [Test Coverage](#test-coverage)
8. [CI/CD Integration](#cicd-integration)
9. [Writing Tests](#writing-tests)

---

## Overview

HotelOS uses a comprehensive testing strategy with three levels of tests:

| Test Type | Tool | Purpose |
|-----------|------|---------|
| Unit | Vitest | Test individual functions and components in isolation |
| Integration | Vitest + Supertest | Test API endpoints with database |
| E2E | Playwright | Test complete user workflows in browser |

### Test Coverage Targets

- **Unit Tests**: 80% coverage
- **Integration Tests**: Critical API paths
- **E2E Tests**: Core user journeys

---

## Test Structure

```
CLAUDE/
├── tests/
│   ├── unit/
│   │   └── results/         # Unit test results
│   ├── integration/
│   │   └── results/         # Integration test results
│   ├── e2e/
│   │   ├── specs/           # E2E test specifications
│   │   └── results/         # E2E test results & reports
│   └── coverage/            # Coverage reports
│
├── packages/
│   ├── api/
│   │   ├── src/
│   │   │   ├── __tests__/           # API unit tests
│   │   │   │   ├── setup.ts
│   │   │   │   ├── setup.integration.ts
│   │   │   │   ├── app.test.ts
│   │   │   │   ├── auth.integration.test.ts
│   │   │   │   ├── rooms.integration.test.ts
│   │   │   │   └── bookings.integration.test.ts
│   │   │   └── utils/
│   │   │       └── date.test.ts
│   │   ├── vitest.config.ts
│   │   └── vitest.integration.config.ts
│   │
│   └── web/
│       ├── src/
│       │   └── __tests__/
│       │       ├── setup.ts
│       │       └── e2e/              # Playwright E2E tests
│       │           ├── auth.setup.ts
│       │           ├── login.spec.ts
│       │           ├── dashboard.spec.ts
│       │           ├── rooms.spec.ts
│       │           ├── bookings.spec.ts
│       │           ├── housekeeping.spec.ts
│       │           └── navigation.spec.ts
│       ├── vitest.config.ts
│       └── playwright.config.ts
```

---

## Unit Tests

Unit tests verify individual functions and components work correctly in isolation.

### API Unit Tests

Test services, utilities, and middleware without database dependencies.

**Example: Date Utility Tests**
```typescript
// packages/api/src/utils/date.test.ts
import { describe, it, expect } from 'vitest';
import { addDays, calculateNights } from './date.js';

describe('Date Utilities', () => {
  describe('addDays', () => {
    it('should add positive days', () => {
      const date = new Date('2024-06-15');
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(20);
    });
  });

  describe('calculateNights', () => {
    it('should calculate nights between dates', () => {
      const checkIn = new Date('2024-06-15');
      const checkOut = new Date('2024-06-18');
      expect(calculateNights(checkIn, checkOut)).toBe(3);
    });
  });
});
```

### Frontend Unit Tests

Test React components, hooks, and utilities.

**Example: Component Test**
```typescript
// packages/web/src/__tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Button from '../components/Button';

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

---

## Integration Tests

Integration tests verify API endpoints work correctly with the database.

### Setup

Integration tests use a real PostgreSQL database. The setup file creates test data before tests run.

```typescript
// packages/api/src/__tests__/setup.integration.ts
import { beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '../config/database.js';

beforeAll(async () => {
  await prisma.$connect();
  // Create test data
});

afterEach(async () => {
  // Clean up test data
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### Example: Auth Integration Tests

```typescript
// packages/api/src/__tests__/auth.integration.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

const app = createApp();

describe('POST /api/auth/login', () => {
  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@test.com',
        password: 'TestPassword123!',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('accessToken');
  });

  it('should reject invalid password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@test.com',
        password: 'WrongPassword',
      })
      .expect(401);

    expect(response.body.success).toBe(false);
  });
});
```

---

## E2E Tests

End-to-end tests verify complete user workflows in a real browser.

### Setup

Playwright tests authenticate once and share the session across tests.

```typescript
// packages/web/src/__tests__/e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('admin@demo.hotel');
  await page.getByLabel(/password/i).fill('Demo123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/.*dashboard/);
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
```

### Example: Dashboard E2E Test

```typescript
// packages/web/src/__tests__/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('should display KPI cards', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText(/occupancy/i)).toBeVisible();
    await expect(page.getByText(/revenue/i)).toBeVisible();
    await expect(page.getByText(/arrivals/i)).toBeVisible();
    await expect(page.getByText(/departures/i)).toBeVisible();
  });

  test('should navigate to rooms page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /rooms/i }).click();
    await expect(page).toHaveURL(/.*rooms/);
  });
});
```

---

## Running Tests

### All Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run E2E tests only
npm run test:e2e
```

### API Tests

```bash
cd packages/api

# Run unit tests
npm run test

# Run with watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run integration tests (requires database)
npm run test:integration
```

### Frontend Tests

```bash
cd packages/web

# Run unit tests
npm run test

# Run with watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

### Specific Tests

```bash
# Run specific test file
npm test -- src/utils/date.test.ts

# Run tests matching pattern
npm test -- --grep "login"

# Run single Playwright test
npx playwright test login.spec.ts
```

---

## Test Coverage

### Generate Coverage Report

```bash
# API coverage
cd packages/api
npm run test:coverage

# Web coverage
cd packages/web
npm run test:coverage
```

### View Coverage Report

Coverage reports are generated in `tests/coverage/`:

- `tests/coverage/api/` - API coverage
- `tests/coverage/web/` - Web coverage

Open `lcov-report/index.html` in a browser to view detailed coverage.

### Coverage Thresholds

Configure in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 75,
    statements: 80,
  },
}
```

---

## CI/CD Integration

### GitHub Actions

Tests run automatically on every push and pull request.

**.github/workflows/ci.yml** includes:

1. **Lint & Type Check** - Runs ESLint and TypeScript
2. **Unit Tests** - Runs Vitest unit tests
3. **Integration Tests** - Runs API tests with PostgreSQL
4. **E2E Tests** - Runs Playwright tests
5. **Build** - Builds production assets
6. **Security** - Runs npm audit and Trivy scan

### Test Results

Test results are uploaded as artifacts:

- `unit-test-results` - Unit test JSON reports
- `integration-test-results` - Integration test reports
- `playwright-report` - Playwright HTML report
- `e2e-test-results` - E2E test JSON results

### Running Tests in CI

```yaml
# Unit tests
- name: Run unit tests
  run: npm run test:unit

# Integration tests (with PostgreSQL service)
- name: Run integration tests
  run: npm run test:integration
  env:
    DATABASE_URL: postgresql://user:pass@localhost:5432/test

# E2E tests
- name: Run E2E tests
  run: npm run test:e2e
```

---

## Writing Tests

### Test Naming Conventions

```typescript
// Use descriptive test names
describe('BookingService', () => {
  describe('createBooking', () => {
    it('should create a booking with valid data', () => {});
    it('should reject booking with checkout before checkin', () => {});
    it('should reject booking for occupied room', () => {});
  });
});
```

### Test Structure (AAA Pattern)

```typescript
it('should add a charge to booking', async () => {
  // Arrange
  const booking = await createTestBooking();

  // Act
  const charge = await addCharge(booking.id, {
    description: 'Minibar',
    amount: 25.00,
  });

  // Assert
  expect(charge.description).toBe('Minibar');
  expect(charge.amount).toBe(25.00);
});
```

### Mocking

```typescript
import { vi } from 'vitest';

// Mock module
vi.mock('../config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock function
const mockFn = vi.fn().mockResolvedValue({ id: '1' });

// Verify calls
expect(mockFn).toHaveBeenCalledWith({ id: '1' });
expect(mockFn).toHaveBeenCalledTimes(1);
```

### E2E Test Best Practices

```typescript
// Use data-testid for stable selectors
await page.locator('[data-testid="room-card"]').click();

// Wait for elements
await expect(page.getByText('Success')).toBeVisible({ timeout: 5000 });

// Use role-based selectors
await page.getByRole('button', { name: /submit/i }).click();

// Handle loading states
await page.waitForSelector('[data-testid="loading"]', { state: 'hidden' });
```

---

## Troubleshooting

### Common Issues

**Tests timeout**
```bash
# Increase timeout
npm test -- --testTimeout=30000
```

**Database connection fails**
```bash
# Ensure PostgreSQL is running
docker-compose up -d postgres

# Check connection string
echo $DATABASE_URL
```

**Playwright browsers not installed**
```bash
npx playwright install --with-deps
```

**Port already in use**
```bash
# Kill process on port
npx kill-port 3001 5173
```

### Debug Tests

```bash
# Debug Vitest
npm test -- --inspect-brk

# Debug Playwright
npx playwright test --debug

# Headed mode for E2E
npx playwright test --headed
```

---

## Test Data

### Seed Data

Run database seed to create test data:

```bash
npm run db:seed
```

This creates:
- Demo hotel
- Admin user (admin@demo.hotel / Demo123!)
- Room types (Standard, Deluxe, Suite)
- 20 rooms across 4 floors
- Sample bookings and guests

### Test Fixtures

Create reusable test fixtures:

```typescript
// tests/fixtures/booking.ts
export const createTestBooking = async () => {
  return prisma.booking.create({
    data: {
      guestId: testGuestId,
      roomId: testRoomId,
      checkInDate: new Date(),
      checkOutDate: addDays(new Date(), 2),
      status: 'CONFIRMED',
      // ...
    },
  });
};
```
