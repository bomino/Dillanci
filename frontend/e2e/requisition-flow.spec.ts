import { test, expect } from '@playwright/test';

/**
 * Requisition Workflow E2E Tests
 *
 * Tests the critical requisition flow:
 * - Creating a new requisition
 * - Adding line items
 * - Submitting for approval
 * - Approval process
 */

test.describe('Requisition Flow', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@dillanci.com');
    await page.getByLabel(/password/i).fill('adminpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });

  test('should navigate to requisitions page', async ({ page }) => {
    // Click on Requisitions in sidebar
    await page.getByRole('link', { name: /requisitions/i }).click();

    // Verify we're on the requisitions page
    await expect(page).toHaveURL(/\/requisitions/);
    await expect(
      page.getByRole('heading', { name: /requisitions/i }),
    ).toBeVisible();
  });

  test('should create a new requisition', async ({ page }) => {
    await page.goto('/requisitions');

    // Click create new requisition button
    await page.getByRole('button', { name: /new|create/i }).click();

    // Verify we're on the create page
    await expect(page).toHaveURL(/\/requisitions\/new|\/requisitions\/create/);

    // Fill in requisition details
    await page.getByLabel(/title|subject|description/i).first().fill('Test Requisition - Office Supplies');
    await page.getByLabel(/justification|reason/i).fill('Monthly office supply replenishment');

    // Select a category if available
    const categorySelect = page.getByLabel(/category/i);
    if (await categorySelect.isVisible()) {
      await categorySelect.click();
      await page.getByRole('option').first().click();
    }

    // Add a line item
    await page.getByRole('button', { name: /add.*item|add.*line/i }).click();

    // Fill line item details
    await page.getByPlaceholder(/item.*name|description/i).first().fill('Printer Paper A4');
    await page.getByPlaceholder(/quantity/i).first().fill('10');
    await page.getByPlaceholder(/unit.*price|price/i).first().fill('25.00');

    // Save as draft
    await page.getByRole('button', { name: /save.*draft|save/i }).click();

    // Verify success message or redirect
    await expect(
      page.getByText(/saved|created|success/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should view requisition details', async ({ page }) => {
    await page.goto('/requisitions');

    // Click on a requisition in the list
    await page.getByRole('row').nth(1).click();

    // Verify we're on the detail page
    await expect(page).toHaveURL(/\/requisitions\/[a-f0-9-]+/);

    // Verify detail page elements
    await expect(page.getByText(/status/i)).toBeVisible();
    await expect(page.getByText(/total|amount/i)).toBeVisible();
  });

  test('should submit requisition for approval', async ({ page }) => {
    await page.goto('/requisitions');

    // Click on a draft requisition
    await page.getByRole('row', { name: /draft/i }).first().click();

    // Click submit for approval
    await page.getByRole('button', { name: /submit.*approval|submit/i }).click();

    // Confirm submission if dialog appears
    const confirmButton = page.getByRole('button', { name: /confirm|yes/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Verify status changed to pending
    await expect(page.getByText(/pending|submitted|awaiting/i)).toBeVisible();
  });

  test('should approve a requisition', async ({ page }) => {
    await page.goto('/requisitions');

    // Filter for pending requisitions if filter exists
    const statusFilter = page.getByLabel(/status/i);
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.getByRole('option', { name: /pending/i }).click();
    }

    // Click on a pending requisition
    await page.getByRole('row', { name: /pending/i }).first().click();

    // Click approve button
    await page.getByRole('button', { name: /approve/i }).click();

    // Enter approval comments if required
    const commentsInput = page.getByPlaceholder(/comment|notes/i);
    if (await commentsInput.isVisible()) {
      await commentsInput.fill('Approved - within budget');
    }

    // Confirm approval
    await page.getByRole('button', { name: /confirm|approve/i }).last().click();

    // Verify status changed to approved
    await expect(page.getByText(/approved/i)).toBeVisible();
  });

  test('should reject a requisition', async ({ page }) => {
    await page.goto('/requisitions');

    // Click on a pending requisition
    await page.getByRole('row', { name: /pending/i }).first().click();

    // Click reject button
    await page.getByRole('button', { name: /reject/i }).click();

    // Enter rejection reason
    await page.getByPlaceholder(/reason|comment/i).fill('Budget not available');

    // Confirm rejection
    await page.getByRole('button', { name: /confirm|reject/i }).last().click();

    // Verify status changed to rejected
    await expect(page.getByText(/rejected/i)).toBeVisible();
  });

  test('should search and filter requisitions', async ({ page }) => {
    await page.goto('/requisitions');

    // Search by title/number
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('Office');

    // Wait for results to filter
    await page.waitForTimeout(500);

    // Verify filtered results
    const rows = page.getByRole('row');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });
});

test.describe('Requisition to PO Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@dillanci.com');
    await page.getByLabel(/password/i).fill('adminpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });

  test('should convert approved requisition to PO', async ({ page }) => {
    await page.goto('/requisitions');

    // Find an approved requisition
    await page.getByRole('row', { name: /approved/i }).first().click();

    // Click convert to PO
    await page.getByRole('button', { name: /convert.*po|create.*po|generate.*po/i }).click();

    // Fill in PO details if form appears
    const supplierSelect = page.getByLabel(/supplier/i);
    if (await supplierSelect.isVisible()) {
      await supplierSelect.click();
      await page.getByRole('option').first().click();
    }

    // Submit PO creation
    await page.getByRole('button', { name: /create|submit|generate/i }).click();

    // Verify PO was created
    await expect(page).toHaveURL(/\/purchase-orders\/[a-f0-9-]+/);
    await expect(page.getByText(/po|purchase.*order/i)).toBeVisible();
  });
});
