import { defineConfig, devices } from '@playwright/test';
import { adminAuthFile, env } from './config/env';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    /* On GitHub Actions, failures are also shown as annotations on the PR / run. */
    ...(process.env.CI ? [['github'] as ['github']] : []),
  ],
  /* The shared public demo can be slow; give web-first assertions more time than the 5s default. */
  expect: { timeout: 10_000 },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* App under test. Override with BASE_URL (see config/env.ts). */
    baseURL: env.baseUrl,

    /* Fail a single click/fill or page load with a clear error instead of waiting for the 30s test timeout.
       The shared public demo is slow, so these are a bit above Playwright's usual suggestions. */
    actionTimeout: 15_000,
    navigationTimeout: 30_000,

    /* Test evidence: on CI keep a trace and screenshot for every test (pass or fail), for audit.
       Locally only keep them when a test fails. See https://playwright.dev/docs/trace-viewer */
    trace: process.env.CI ? 'on' : 'retain-on-failure',
    screenshot: process.env.CI ? 'on' : 'only-on-failure',
    video: 'retain-on-failure',

    /* Locally, the Zscaler proxy re-signs HTTPS traffic, which Chromium/Firefox reject.
       Accept it outside CI only; CI keeps strict certificate checks. */
    ignoreHTTPSErrors: !process.env.CI,
  },

  /* Configure projects for major browsers */
  projects: [
    /* Signs in once and saves the session to playwright/.auth/; every other project reuses it. */
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    /* Browser tests (E2E + integration). API tests are excluded and run once in the 'api' project. */
    {
      name: 'chromium',
      testIgnore: '**/api/**',
      use: { ...devices['Desktop Chrome'], storageState: adminAuthFile },
      dependencies: ['setup'],
    },

    // {
    //   name: 'firefox',
    //   testIgnore: '**/api/**',
    //   use: { ...devices['Desktop Firefox'], storageState: adminAuthFile },
    //   dependencies: ['setup'],
    // },

    // {
    //   name: 'webkit',
    //   testIgnore: '**/api/**',
    //   use: { ...devices['Desktop Safari'], storageState: adminAuthFile },
    //   dependencies: ['setup'],
    // },

    /* API tests: no browser. The `api` fixture reuses the saved session cookie. */
    {
      name: 'api',
      testMatch: '**/api/**/*.spec.ts',
      dependencies: ['setup'],
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
