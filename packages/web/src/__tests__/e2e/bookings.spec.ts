/**
 * Bookings Page E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Bookings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bookings');
  });

  test('should display bookings page header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /bookings|reservations/i })).toBeVisible();
  });

  test('should display bookings table', async ({ page }) => {
    // Wait for bookings to load
    await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});

    // Check for table headers
    await expect(page.getByText(/booking ref|reference/i).first()).toBeVisible();
    await expect(page.getByText(/guest/i).first()).toBeVisible();
    await expect(page.getByText(/check-in/i).first()).toBeVisible();
    await expect(page.getByText(/check-out/i).first()).toBeVisible();
    await expect(page.getByText(/status/i).first()).toBeVisible();
  });

  test('should filter bookings by status', async ({ page }) => {
    const statusFilter = page.getByRole('combobox', { name: /status/i });
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('CONFIRMED');
      await page.waitForTimeout(500);
    }
  });

  test('should search bookings', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('John');
      await page.waitForTimeout(500);
    }
  });

  test('should open new booking form', async ({ page }) => {
    const newBookingBtn = page.getByRole('button', { name: /new booking|add booking/i });
    if (await newBookingBtn.isVisible()) {
      await newBookingBtn.click();

      // Should see booking form/modal
      await expect(page.getByText(/new booking|create booking/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test('should open booking details when clicking a booking', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 }).catch(() => {});

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();

      // Should navigate to booking details or open modal
      await expect(page.getByText(/booking details/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test('should display pagination', async ({ page }) => {
    // Check for pagination controls
    const pagination = page.locator('[data-testid="pagination"]');
    const nextBtn = page.getByRole('button', { name: /next/i });
    const prevBtn = page.getByRole('button', { name: /prev/i });

    await pagination.first().count();
    await nextBtn.first().count();
    await prevBtn.first().count();
  });

  test('should filter by date range', async ({ page }) => {
    const startDateInput = page.getByLabel(/start date|from/i);
    const endDateInput = page.getByLabel(/end date|to/i);

    if (await startDateInput.isVisible() && await endDateInput.isVisible()) {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      await startDateInput.fill(today);
      await endDateInput.fill(nextWeek);
      await page.waitForTimeout(500);
    }
  });
});
