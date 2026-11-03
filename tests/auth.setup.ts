import { test as setup, expect } from '@playwright/test';
import { adminAuthFile, env } from '../config/env';

/*
 * Signs in once and saves the session. All other tests reuse it; only login tests (tests/e2e/auth/) should use the
 * login form. Infrastructure, not a test case, hence @no-jira.
 */
setup('sign in as admin', { tag: '@no-jira' }, async ({ page }) => {
  await page.goto('/web/index.php/auth/login');
  await page.getByPlaceholder('Username').fill(env.users.admin.username);
  await page.getByPlaceholder('Password').fill(env.users.admin.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/dashboard\/index/);
  await page.context().storageState({ path: adminAuthFile });
});
