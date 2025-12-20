import { test as base, expect } from '@playwright/test';

/**
 * Test fixtures for Dillanci E2E tests
 *
 * Provides:
 * - Authenticated page fixture (auto-login)
 * - Test data helpers
 * - Common page object methods
 */

// Test user credentials
export const testUsers = {
  admin: {
    email: 'admin@dillanci.com',
    password: 'adminpassword123',
    roles: ['ORGANIZATION_ADMIN'],
  },
  procurementOfficer: {
    email: 'procurement@dillanci.com',
    password: 'procurepass123',
    roles: ['PROCUREMENT_OFFICER'],
  },
  requester: {
    email: 'requester@dillanci.com',
    password: 'requestpass123',
    roles: ['REQUESTER'],
  },
  approver: {
    email: 'approver@dillanci.com',
    password: 'approvepass123',
    roles: ['BUDGET_HOLDER'],
  },
  accountsPayable: {
    email: 'ap@dillanci.com',
    password: 'appass123',
    roles: ['ACCOUNTS_PAYABLE'],
  },
};

type TestUser = keyof typeof testUsers;

// Extended test type with authentication
type AuthenticatedFixtures = {
  authenticatedPage: {
    page: ReturnType<typeof base['page']>;
    user: (typeof testUsers)[TestUser];
  };
  loginAs: (userType: TestUser) => Promise<void>;
};

// Create extended test with authentication fixture
export const test = base.extend<AuthenticatedFixtures>({
  // Authenticated page that auto-logs in as admin
  authenticatedPage: async ({ page }, use) => {
    const user = testUsers.admin;

    // Navigate to login
    await page.goto('/login');

    // Perform login using ID selectors for reliability
    await page.locator('#email').fill(user.email);
    await page.locator('#password').fill(user.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation away from login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // Provide the authenticated page to the test
    await use({ page, user });
  },

  // Helper to login as a specific user type
  loginAs: async ({ page }, use) => {
    const loginAs = async (userType: TestUser) => {
      const user = testUsers[userType];

      await page.goto('/login');
      await page.locator('#email').fill(user.email);
      await page.locator('#password').fill(user.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    };

    await use(loginAs);
  },
});

export { expect };

/**
 * Page Object Helpers
 */
export const pageHelpers = {
  /**
   * Navigate to a module and verify we're on the correct page
   */
  async navigateToModule(
    page: ReturnType<typeof base['page']>,
    moduleName: string,
  ) {
    await page.getByRole('link', { name: new RegExp(moduleName, 'i') }).click();
    await expect(page).toHaveURL(new RegExp(`/${moduleName.toLowerCase()}`));
  },

  /**
   * Wait for a table to load (has rows)
   */
  async waitForTableLoad(page: ReturnType<typeof base['page']>) {
    await page.waitForSelector('table tbody tr', { state: 'visible' });
  },

  /**
   * Click the first row in a data table
   */
  async clickFirstTableRow(page: ReturnType<typeof base['page']>) {
    await page.getByRole('row').nth(1).click();
  },

  /**
   * Fill a form field by label
   */
  async fillField(
    page: ReturnType<typeof base['page']>,
    label: string,
    value: string,
  ) {
    await page.getByLabel(new RegExp(label, 'i')).fill(value);
  },

  /**
   * Select an option from a dropdown
   */
  async selectOption(
    page: ReturnType<typeof base['page']>,
    label: string,
    optionText?: string,
  ) {
    const select = page.getByLabel(new RegExp(label, 'i'));
    await select.click();
    if (optionText) {
      await page
        .getByRole('option', { name: new RegExp(optionText, 'i') })
        .click();
    } else {
      await page.getByRole('option').first().click();
    }
  },

  /**
   * Click a button by name
   */
  async clickButton(
    page: ReturnType<typeof base['page']>,
    name: string,
  ) {
    await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
  },

  /**
   * Verify success toast/message appears
   */
  async expectSuccess(page: ReturnType<typeof base['page']>) {
    await expect(page.getByText(/success|saved|created|updated/i)).toBeVisible({
      timeout: 10000,
    });
  },

  /**
   * Verify error toast/message appears
   */
  async expectError(page: ReturnType<typeof base['page']>) {
    await expect(page.getByText(/error|failed|invalid/i)).toBeVisible();
  },
};

/**
 * Test data generators
 */
export const testData = {
  /**
   * Generate a unique requisition title
   */
  requisitionTitle(): string {
    return `Test Requisition ${Date.now()}`;
  },

  /**
   * Generate a unique invoice number
   */
  invoiceNumber(): string {
    return `INV-TEST-${Date.now()}`;
  },

  /**
   * Generate a unique PO number
   */
  poNumber(): string {
    return `PO-TEST-${Date.now()}`;
  },
};
