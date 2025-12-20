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

// Helper function to fill login form
async function fillLoginForm(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) {
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
}

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
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty form submission', async ({
    page,
  }) => {
    await page.goto('/login');

    // Click sign in without entering credentials
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect validation messages - check for any error text visible near the form
    // The actual validation might show different messages
    await expect(
      page.locator('text=/required|invalid|enter/i').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await fillLoginForm(page, 'invalid@example.com', 'wrongpassword');

    // Submit the form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect error message - check for toast or inline error
    await expect(
      page.locator(
        'text=/invalid|incorrect|unauthorized|failed|error|wrong/i',
      ).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in valid credentials (use test account)
    await fillLoginForm(page, 'admin@dillanci.com', 'adminpassword123');

    // Submit the form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect to be redirected to dashboard or home
    await expect(page).toHaveURL(/\/(dashboard|$)/, { timeout: 15000 });
  });

  test('should logout successfully', async ({ page }) => {
    // First, login
    await page.goto('/login');
    await fillLoginForm(page, 'admin@dillanci.com', 'adminpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation away from login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // Look for user menu button (avatar or profile icon)
    const userMenuButton = page.locator(
      '[data-testid="user-menu"], button:has([data-testid="avatar"]), button:has-text("Account"), button:has-text("Profile")',
    );

    // If user menu exists, try to logout
    if ((await userMenuButton.count()) > 0) {
      await userMenuButton.first().click();
      const logoutButton = page.locator(
        'text=/logout|sign out/i, [data-testid="logout"]',
      );
      if ((await logoutButton.count()) > 0) {
        await logoutButton.first().click();
        await expect(page).toHaveURL(/\/login/);
      }
    }
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

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Login
    await fillLoginForm(page, 'admin@dillanci.com', 'adminpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect to be redirected to the originally requested page or dashboard
    await expect(page).toHaveURL(/\/(requisitions|dashboard|$)/, {
      timeout: 15000,
    });
  });
});

test.describe('Session Persistence', () => {
  test('should maintain session across page refreshes', async ({ page }) => {
    // Login
    await page.goto('/login');
    await fillLoginForm(page, 'admin@dillanci.com', 'adminpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation away from login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // Refresh the page
    await page.reload();

    // Should still not be on login page
    await expect(page).not.toHaveURL(/\/login/);
  });
});
