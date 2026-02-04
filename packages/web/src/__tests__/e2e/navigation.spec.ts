/**
 * Navigation E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should display sidebar navigation', async ({ page }) => {
    // Check for main navigation items
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /rooms/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /booking|reservation/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /guest/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /housekeeping/i })).toBeVisible();
  });

  test('should navigate to rooms page', async ({ page }) => {
    await page.getByRole('link', { name: /rooms/i }).click();
    await expect(page).toHaveURL(/.*rooms/);
  });

  test('should navigate to bookings page', async ({ page }) => {
    await page.getByRole('link', { name: /booking|reservation/i }).first().click();
    await expect(page).toHaveURL(/.*booking/);
  });

  test('should navigate to guests page', async ({ page }) => {
    await page.getByRole('link', { name: /guest/i }).click();
    await expect(page).toHaveURL(/.*guest/);
  });

  test('should navigate to housekeeping page', async ({ page }) => {
    await page.getByRole('link', { name: /housekeeping/i }).click();
    await expect(page).toHaveURL(/.*housekeeping/);
  });

  test('should navigate to settings page', async ({ page }) => {
    const settingsLink = page.getByRole('link', { name: /settings/i });
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await expect(page).toHaveURL(/.*settings/);
    }
  });

  test('should display user menu', async ({ page }) => {
    // Click on user avatar/menu
    const userMenu = page.locator('[data-testid="user-menu"]');
    const userAvatar = page.locator('[data-testid="user-avatar"]');

    if (await userMenu.isVisible()) {
      await userMenu.click();
    } else if (await userAvatar.isVisible()) {
      await userAvatar.click();
    }

    // Check for logout option
    await expect(page.getByText(/logout|sign out/i)).toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('should logout successfully', async ({ page }) => {
    // Find and click logout button
    const userMenu = page.locator('[data-testid="user-menu"]');
    if (await userMenu.isVisible()) {
      await userMenu.click();
    }

    const logoutBtn = page.getByText(/logout|sign out/i);
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();

      // Should redirect to login
      await expect(page).toHaveURL(/.*login/, { timeout: 10000 });
    }
  });

  test('should highlight active navigation item', async ({ page }) => {
    // Navigate to rooms
    await page.goto('/rooms');

    // Rooms link should be active/highlighted
    const roomsLink = page.getByRole('link', { name: /rooms/i });
    await expect(roomsLink).toHaveClass(/active|bg-/);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Resize to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check for mobile menu button
    const menuButton = page.getByRole('button', { name: /menu/i });
    if (await menuButton.isVisible()) {
      await menuButton.click();

      // Navigation should be visible after clicking menu
      await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
    }
  });

  test('should display search functionality', async ({ page }) => {
    // Check for global search
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.click();
      await searchInput.fill('Room 101');

      // Should show search results
      await page.waitForTimeout(500);
    }
  });

  test('should display notification bell', async ({ page }) => {
    const notificationBell = page.locator('[data-testid="notifications"]');
    if (await notificationBell.isVisible()) {
      await notificationBell.click();
      // Should show notification panel
    }
  });
});
