import { test, expect } from '@playwright/test';

/*
 * Seed file for the Playwright test agents (planner/generator/healer): it sets up the
 * environment they explore from. Not a real test, so it is exempt from Jira linking.
 */
test.describe('Test group', { tag: '@no-jira' }, () => {
  test('seed', async ({ page }) => {
    // generate code here.
  });
});
