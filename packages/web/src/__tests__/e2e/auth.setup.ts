/**
 * Playwright Auth Setup
 * Handles authentication before running tests
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Wait for the login form to be visible
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

  // Fill in login credentials (demo user)
  await page.getByLabel(/email/i).fill('admin@demo.hotel');
  await page.getByLabel(/password/i).fill('Demo123!');

  // Click login button
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for successful login (redirect to dashboard)
  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.getByText(/dashboard/i).first()).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
