import { test, expect } from '../fixtures';

/*
 * Seed file for the Playwright test agents (planner/generator/healer): it sets up the
 * environment they explore from. Not a real test, so it is exempt from Jira linking.
 */
test.describe('Test group', { tag: '@no-jira' }, () => {
  test('seed', async ({ page }) => {
    // Starts the agents signed in as admin on the OrangeHRM dashboard.
    await page.goto('/web/index.php/dashboard/index');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
