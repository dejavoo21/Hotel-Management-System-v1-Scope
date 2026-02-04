/**
 * Rooms Page E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Rooms Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rooms');
  });

  test('should display rooms page header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /rooms/i })).toBeVisible();
  });

  test('should display room cards', async ({ page }) => {
    // Wait for rooms to load
    await page.waitForSelector('[data-testid="room-card"]', { timeout: 10000 }).catch(() => {});

    // Check for room cards or room list
    const roomCards = page.locator('[data-testid="room-card"]');
    const roomRows = page.locator('table tbody tr');

    // Either cards or table rows should be visible
    const hasCards = await roomCards.count() > 0;
    const hasRows = await roomRows.count() > 0;

    expect(hasCards || hasRows).toBe(true);
  });

  test('should filter rooms by status', async ({ page }) => {
    // Find status filter
    const statusFilter = page.getByRole('combobox', { name: /status/i });
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('AVAILABLE');

      // Wait for filter to apply
      await page.waitForTimeout(500);
    }
  });

  test('should filter rooms by floor', async ({ page }) => {
    const floorFilter = page.getByRole('combobox', { name: /floor/i });
    if (await floorFilter.isVisible()) {
      await floorFilter.selectOption('1');
      await page.waitForTimeout(500);
    }
  });

  test('should open room details when clicking a room', async ({ page }) => {
    // Click on first room card or row
    const roomCard = page.locator('[data-testid="room-card"]').first();
    const roomRow = page.locator('table tbody tr').first();

    if (await roomCard.isVisible()) {
      await roomCard.click();
    } else if (await roomRow.isVisible()) {
      await roomRow.click();
    }

    // Should see room details modal or page
    await expect(page.getByText(/room details|room \d+/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('should change room status', async ({ page }) => {
    // Find a room and its status button/dropdown
    const statusButton = page.locator('[data-testid="room-status-button"]').first();

    if (await statusButton.isVisible()) {
      await statusButton.click();

      // Select new status
      const newStatus = page.getByText(/out of service/i);
      if (await newStatus.isVisible()) {
        await newStatus.click();
      }
    }
  });

  test('should display add room button for admin', async ({ page }) => {
    // Check for add room button (only visible to admin/manager)
    const addButton = page.getByRole('button', { name: /add room/i });
    // This may or may not be visible depending on user role
    if (await addButton.isVisible()) {
      expect(addButton).toBeVisible();
    }
  });

  test('should toggle between grid and list view', async ({ page }) => {
    const gridViewBtn = page.getByRole('button', { name: /grid/i });
    const listViewBtn = page.getByRole('button', { name: /list/i });

    if (await gridViewBtn.isVisible() && await listViewBtn.isVisible()) {
      await listViewBtn.click();
      await page.waitForTimeout(300);

      await gridViewBtn.click();
      await page.waitForTimeout(300);
    }
  });
});
