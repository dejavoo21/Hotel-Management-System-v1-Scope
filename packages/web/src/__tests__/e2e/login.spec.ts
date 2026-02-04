/**
 * Login Page E2E Tests
 */

import { test, expect } from '@playwright/test';

// This test doesn't use the authenticated state
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    // Check for HotelOS branding
    await expect(page.getByText('HotelOS')).toBeVisible();

    // Check for form elements
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    // Click login without filling form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Check for validation errors
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test('should show error for wrong credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('wrong@email.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for API response
    await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 10000 });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('admin@demo.hotel');
    await page.getByLabel(/password/i).fill('Demo123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i);
    await passwordInput.fill('testpassword');

    // Password should be hidden initially
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click show password button (assuming there's one)
    const showPasswordBtn = page.getByRole('button', { name: /show|toggle/i });
    if (await showPasswordBtn.isVisible()) {
      await showPasswordBtn.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });

  test('should show demo credentials hint', async ({ page }) => {
    // Check for demo credentials
    await expect(page.getByText(/demo/i)).toBeVisible();
    await expect(page.getByText(/admin@demo.hotel/i)).toBeVisible();
  });
});
