import { test, expect } from '@playwright/test';

/*
 * Traceability: tag each test with the Jira ticket(s) it verifies, e.g. '@PROJ-101'.
 * A tag on test.describe applies to every test inside it.
 * PROJ-101 / PROJ-102 are placeholder keys — replace them with real tickets.
 */
test.describe('Playwright docs site', { tag: '@PROJ-101' }, () => {
  test('has title', async ({ page }) => {
    await page.goto('https://playwright.dev/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Playwright/);
  });

  test('get started link', { tag: ['@PROJ-102', '@smoke'] }, async ({ page }) => {
    await page.goto('https://playwright.dev/');

    // Click the get started link.
    await page.getByRole('link', { name: 'Get started' }).click();

    // Expects page to have a heading with the name of Installation.
    await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
  });
});
