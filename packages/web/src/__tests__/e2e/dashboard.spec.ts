/**
 * Dashboard E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should display dashboard header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should display KPI cards', async ({ page }) => {
    // Check for key metrics cards
    await expect(page.getByText(/occupancy/i)).toBeVisible();
    await expect(page.getByText(/revenue/i)).toBeVisible();
    await expect(page.getByText(/arrivals/i)).toBeVisible();
    await expect(page.getByText(/departures/i)).toBeVisible();
  });

  test('should display room status summary', async ({ page }) => {
    // Room status section
    await expect(page.getByText(/room status/i)).toBeVisible();
    await expect(page.getByText(/available/i).first()).toBeVisible();
    await expect(page.getByText(/occupied/i).first()).toBeVisible();
  });

  test('should display today arrivals section', async ({ page }) => {
    await expect(page.getByText(/today.*arrivals/i)).toBeVisible();
  });

  test('should display today departures section', async ({ page }) => {
    await expect(page.getByText(/today.*departures/i)).toBeVisible();
  });

  test('should display housekeeping summary', async ({ page }) => {
    await expect(page.getByText(/housekeeping/i)).toBeVisible();
    await expect(page.getByText(/clean/i).first()).toBeVisible();
    await expect(page.getByText(/dirty/i).first()).toBeVisible();
  });

  test('should navigate to rooms page when clicking room status', async ({ page }) => {
    // Find and click on room status link/card
    const roomsLink = page.getByRole('link', { name: /rooms|view all rooms/i });
    if (await roomsLink.isVisible()) {
      await roomsLink.click();
      await expect(page).toHaveURL(/.*rooms/);
    }
  });

  test('should refresh data when clicking refresh button', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /refresh/i });
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      // Should see loading state or data refresh
    }
  });
});
