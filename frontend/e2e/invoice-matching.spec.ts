import { test, expect } from '@playwright/test';

/**
 * Invoice 3-Way Matching E2E Tests
 *
 * Tests the critical invoice matching flow:
 * - Creating an invoice
 * - 3-way matching (PO, GRN, Invoice)
 * - Approval/rejection based on matching
 */

test.describe('Invoice 3-Way Matching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@dillanci.com');
    await page.getByLabel(/password/i).fill('adminpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });

  test('should navigate to invoices page', async ({ page }) => {
    await page.getByRole('link', { name: /invoices/i }).click();
    await expect(page).toHaveURL(/\/invoices/);
    await expect(page.getByRole('heading', { name: /invoices/i })).toBeVisible();
  });

  test('should create a new invoice', async ({ page }) => {
    await page.goto('/invoices');

    // Click create new invoice
    await page.getByRole('button', { name: /new|create/i }).click();
    await expect(page).toHaveURL(/\/invoices\/new|\/invoices\/create/);

    // Fill invoice details
    await page.getByLabel(/invoice.*number/i).fill('INV-2024-001');
    await page.getByLabel(/invoice.*date/i).fill('2024-12-20');

    // Select supplier
    const supplierSelect = page.getByLabel(/supplier/i);
    await supplierSelect.click();
    await page.getByRole('option').first().click();

    // Select PO to match
    const poSelect = page.getByLabel(/purchase.*order|po/i);
    await poSelect.click();
    await page.getByRole('option').first().click();

    // Add invoice line matching PO
    await page.getByRole('button', { name: /add.*line|add.*item/i }).click();
    await page.getByPlaceholder(/quantity/i).first().fill('10');
    await page.getByPlaceholder(/unit.*price|price/i).first().fill('25.00');

    // Save invoice
    await page.getByRole('button', { name: /save|create/i }).click();

    // Verify success
    await expect(page.getByText(/saved|created|success/i)).toBeVisible();
  });

  test('should show matching status on invoice', async ({ page }) => {
    await page.goto('/invoices');

    // Click on an invoice
    await page.getByRole('row').nth(1).click();

    // Verify matching section is visible
    await expect(page.getByText(/matching|3-way|three.*way/i)).toBeVisible();

    // Check for PO match indicator
    await expect(page.getByText(/po.*match|purchase.*order/i)).toBeVisible();

    // Check for GRN match indicator
    await expect(page.getByText(/grn.*match|goods.*receipt|receiving/i)).toBeVisible();
  });

  test('should display matched invoice details', async ({ page }) => {
    await page.goto('/invoices');

    // Click on a matched invoice
    await page.getByRole('row', { name: /matched/i }).first().click();

    // Verify matching details are shown
    await expect(page.getByText(/quantity.*match/i)).toBeVisible();
    await expect(page.getByText(/price.*match/i)).toBeVisible();
  });

  test('should highlight discrepancies in unmatched invoices', async ({
    page,
  }) => {
    await page.goto('/invoices');

    // Look for unmatched or discrepancy indicators
    const discrepancyRow = page.getByRole('row', {
      name: /unmatched|discrepancy|warning/i,
    });

    if ((await discrepancyRow.count()) > 0) {
      await discrepancyRow.first().click();

      // Verify discrepancy is highlighted
      await expect(
        page.getByText(/discrepancy|variance|mismatch/i),
      ).toBeVisible();
    }
  });

  test('should approve matched invoice', async ({ page }) => {
    await page.goto('/invoices');

    // Click on a matched invoice pending approval
    await page.getByRole('row', { name: /matched/i }).first().click();

    // Click approve
    await page.getByRole('button', { name: /approve/i }).click();

    // Confirm if dialog appears
    const confirmButton = page.getByRole('button', { name: /confirm|yes/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Verify approved status
    await expect(page.getByText(/approved/i)).toBeVisible();
  });

  test('should reject invoice with discrepancies', async ({ page }) => {
    await page.goto('/invoices');

    // Click on an invoice with discrepancies
    await page.getByRole('row').nth(1).click();

    // Click reject
    await page.getByRole('button', { name: /reject/i }).click();

    // Enter rejection reason
    await page.getByPlaceholder(/reason|comment/i).fill('Price mismatch with PO');

    // Confirm rejection
    await page.getByRole('button', { name: /confirm|reject/i }).last().click();

    // Verify rejected status
    await expect(page.getByText(/rejected/i)).toBeVisible();
  });
});

test.describe('Invoice Payment Processing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@dillanci.com');
    await page.getByLabel(/password/i).fill('adminpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });

  test('should mark invoice as paid', async ({ page }) => {
    await page.goto('/invoices');

    // Filter for approved invoices
    const statusFilter = page.getByLabel(/status/i);
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.getByRole('option', { name: /approved/i }).click();
    }

    // Click on approved invoice
    await page.getByRole('row', { name: /approved/i }).first().click();

    // Click mark as paid
    await page.getByRole('button', { name: /mark.*paid|pay|payment/i }).click();

    // Fill payment details
    const paymentDateInput = page.getByLabel(/payment.*date/i);
    if (await paymentDateInput.isVisible()) {
      await paymentDateInput.fill('2024-12-20');
    }

    const referenceInput = page.getByLabel(/reference|transaction/i);
    if (await referenceInput.isVisible()) {
      await referenceInput.fill('PAY-2024-001');
    }

    // Confirm payment
    await page.getByRole('button', { name: /confirm|save/i }).last().click();

    // Verify paid status
    await expect(page.getByText(/paid/i)).toBeVisible();
  });
});
