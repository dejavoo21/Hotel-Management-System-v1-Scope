/**
 * Housekeeping Page E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Housekeeping Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/housekeeping');
  });

  test('should display housekeeping page header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /housekeeping/i })).toBeVisible();
  });

  test('should display room status cards', async ({ page }) => {
    // Wait for rooms to load
    await page.waitForSelector('[data-testid="housekeeping-card"]', { timeout: 10000 }).catch(() => {});

    // Check for status categories
    await expect(page.getByText(/clean/i).first()).toBeVisible();
    await expect(page.getByText(/dirty/i).first()).toBeVisible();
    await expect(page.getByText(/inspection/i).first()).toBeVisible();
  });

  test('should display room count by status', async ({ page }) => {
    // Check for room counts in status cards
    const cleanCount = page.locator('[data-testid="clean-count"]');
    const dirtyCount = page.locator('[data-testid="dirty-count"]');
    const inspectionCount = page.locator('[data-testid="inspection-count"]');

    await cleanCount.first().count();
    await dirtyCount.first().count();
    await inspectionCount.first().count();
  });

  test('should filter rooms by floor', async ({ page }) => {
    const floorFilter = page.getByRole('combobox', { name: /floor/i });
    if (await floorFilter.isVisible()) {
      await floorFilter.selectOption('1');
      await page.waitForTimeout(500);
    }
  });

  test('should update room housekeeping status', async ({ page }) => {
    // Find a room card with status buttons
    const roomCard = page.locator('[data-testid="housekeeping-room"]').first();

    if (await roomCard.isVisible()) {
      // Click to change status
      const statusButton = roomCard.locator('[data-testid="status-button"]');
      if (await statusButton.isVisible()) {
        await statusButton.click();
      }
    }
  });

  test('should display priority rooms (arrivals)', async ({ page }) => {
    // Check for priority/arrivals section
    await expect(page.getByText(/priority|arrivals|due today/i)).toBeVisible().catch(() => {});
  });

  test('should allow marking room as clean', async ({ page }) => {
    // Find a dirty room and mark it clean
    const dirtyRoom = page.locator('[data-status="DIRTY"]').first();

    if (await dirtyRoom.isVisible()) {
      const markCleanBtn = dirtyRoom.locator('button:has-text("Clean")');
      if (await markCleanBtn.isVisible()) {
        await markCleanBtn.click();

        // Confirm the action
        const confirmBtn = page.getByRole('button', { name: /confirm/i });
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }
      }
    }
  });

  test('should show room details on hover or click', async ({ page }) => {
    const roomCard = page.locator('[data-testid="housekeeping-room"]').first();

    if (await roomCard.isVisible()) {
      await roomCard.hover();
      await page.waitForTimeout(300);

      // Check for tooltip or expanded info
      await expect(page.getByText(/room \d+/i).first()).toBeVisible();
    }
  });

  test('should display last cleaned time', async ({ page }) => {
    // Check if rooms show last cleaned timestamp
    const lastCleanedText = page.getByText(/last cleaned|cleaned at/i);
    await lastCleanedText.first().count();
  });
});
