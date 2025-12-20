import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Dillanci Procurement Platform
 *
 * Run all E2E tests: npx playwright test
 * Run with UI: npx playwright test --ui
 * Run specific test: npx playwright test e2e/auth.spec.ts
 * Generate tests: npx playwright codegen localhost:3000
 */

export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Test file pattern
  testMatch: '**/*.spec.ts',

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],

  // Shared settings for all projects
  use: {
    // Base URL for relative navigation
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'on-first-retry',

    // Browser viewport
    viewport: { width: 1280, height: 720 },

    // Emulate media for prefers-color-scheme
    colorScheme: 'light',

    // Timeout for each action
    actionTimeout: 10000,

    // Timeout for navigation
    navigationTimeout: 30000,
  },

  // Global timeout for tests
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Configure projects for major browsers
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile viewports (optional, uncomment if needed)
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'mobile-safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Run local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    // Ignore if already running
    ignoreHTTPSErrors: true,
  },

  // Output directory for test artifacts
  outputDir: 'test-results',
});
