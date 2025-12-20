import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 *
 * Tests the critical authentication flows:
 * - User login with valid credentials
 * - Login validation errors
 * - User logout
 * - Protected route redirects
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto('/');
  });

  test('should display login page for unauthenticated users', async ({
    page,
  }) => {
    // Expect to be redirected to login
    await expect(page).toHaveURL(/\/login/);

    // Verify login form elements are present
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty form submission', async ({
    page,
  }) => {
    await page.goto('/login');

    // Click sign in without entering credentials
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect validation messages
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');

    // Submit the form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect error message
    await expect(
      page.getByText(/invalid credentials|incorrect|unauthorized/i),
    ).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in valid credentials (use test account)
    await page.getByLabel(/email/i).fill('admin@dillanci.com');
    await page.getByLabel(/password/i).fill('adminpassword123');

    // Submit the form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect to be redirected to dashboard
    await expect(page).toHaveURL(/\/(dashboard)?$/);

    // Expect dashboard elements to be visible
    await expect(
      page.getByRole('heading', { name: /dashboard/i }),
    ).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // First, login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@dillanci.com');
    await page.getByLabel(/password/i).fill('adminpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard
    await expect(page).toHaveURL(/\/(dashboard)?$/);

    // Click user menu and logout
    await page.getByRole('button', { name: /user|profile|account/i }).click();
    await page.getByRole('menuitem', { name: /logout|sign out/i }).click();

    // Expect to be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect to login when accessing protected route', async ({
    page,
  }) => {
    // Try to access protected route directly
    await page.goto('/requisitions');

    // Expect redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should remember return URL after login', async ({ page }) => {
    // Try to access protected route
    await page.goto('/requisitions');

    // Login
    await page.getByLabel(/email/i).fill('admin@dillanci.com');
    await page.getByLabel(/password/i).fill('adminpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect to be redirected to the originally requested page
    await expect(page).toHaveURL(/\/requisitions/);
  });
});

test.describe('Session Persistence', () => {
  test('should maintain session across page refreshes', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@dillanci.com');
    await page.getByLabel(/password/i).fill('adminpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard
    await expect(page).toHaveURL(/\/(dashboard)?$/);

    // Refresh the page
    await page.reload();

    // Should still be on dashboard, not redirected to login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByRole('heading', { name: /dashboard/i }),
    ).toBeVisible();
  });
});
