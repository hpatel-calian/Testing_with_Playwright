import { test as setup, expect } from '@playwright/test';
import { adminAuthFile, env } from '../config/env';
import { LoginPage } from '../pages/login.page';

/*
 * Signs in once and saves the session. All other tests reuse it; only login tests (tests/e2e/auth/) should use the
 * login form. Infrastructure, not a test case, hence @no-jira.
 */
setup('sign in as admin', { tag: '@no-jira' }, async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(env.users.admin.username, env.users.admin.password);
  await expect(page).toHaveURL(/\/dashboard\/index/);
  await page.context().storageState({ path: adminAuthFile });
});
