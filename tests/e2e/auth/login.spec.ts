// spec: specs/auth-login.md
// seed: tests/seed.spec.ts

import { test, expect, signedOut } from '../../../fixtures';
import { env } from '../../../config/env';
import { auth, authMessages, authPaths } from '../../../test-data/auth';

test.describe('Login', { tag: '@PROJ-306' }, () => {
  test.use(signedOut);

  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test(
    'The login form shows Username, a masked Password, Login and Forgot your password',
    { tag: ['@smoke', '@regression'] },
    async ({ loginPage }) => {
      await expect(loginPage.heading).toBeVisible();
      await expect(loginPage.username).toBeVisible();
      await expect(loginPage.password).toBeVisible();
      await expect(loginPage.password).toHaveAttribute('type', 'password');
      await expect(loginPage.loginButton).toBeVisible();
      await expect(loginPage.forgotPassword).toBeVisible();
    },
  );

  test('Valid admin credentials open the dashboard', { tag: ['@smoke', '@sanity', '@regression'] }, async ({
    page,
    loginPage,
  }) => {
    await loginPage.login(env.users.admin.username, env.users.admin.password);

    await expect(page).toHaveURL(authPaths.dashboard);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test(
    'A wrong password shows "Invalid credentials" and stays on the login page',
    { tag: ['@sanity', '@regression'] },
    async ({ page, loginPage }) => {
      await loginPage.login(env.users.admin.username, auth.wrongPassword);

      await expect(loginPage.errorAlert).toContainText(authMessages.invalidCredentials);
      await expect(page).toHaveURL(authPaths.login);
    },
  );

  test('An unknown username shows "Invalid credentials"', { tag: '@regression' }, async ({ loginPage }) => {
    await loginPage.login(auth.unknownUsername, auth.wrongPassword);

    await expect(loginPage.errorAlert).toContainText(authMessages.invalidCredentials);
  });

  test('Login with empty fields shows Required under Username and Password', { tag: '@regression' }, async ({
    loginPage,
  }) => {
    await loginPage.loginButton.click();

    await expect(loginPage.fieldError('Username')).toHaveText(authMessages.required);
    await expect(loginPage.fieldError('Password')).toHaveText(authMessages.required);
  });

  test('Login without a password shows Required under Password only', { tag: '@regression' }, async ({
    loginPage,
  }) => {
    await loginPage.username.fill(env.users.admin.username);
    await loginPage.loginButton.click();

    await expect(loginPage.fieldError('Password')).toHaveText(authMessages.required);
    await expect(loginPage.fieldError('Username')).toBeHidden();
  });

  test('"Forgot your password?" opens Reset Password, and Cancel returns to login', { tag: '@regression' }, async ({
    page,
    loginPage,
  }) => {
    await loginPage.forgotPassword.click();

    await expect(page).toHaveURL(authPaths.resetPassword);
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page).toHaveURL(authPaths.login);
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('A signed-out user opening the dashboard is sent to login', { tag: '@regression' }, async ({
    page,
    loginPage,
  }) => {
    await page.goto('/web/index.php/dashboard/index');

    await expect(page).toHaveURL(authPaths.login);
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('Logout returns to login, and the dashboard needs signing in again', { tag: '@regression' }, async ({
    page,
    loginPage,
    userMenu,
  }) => {
    await loginPage.login(env.users.admin.username, env.users.admin.password);
    await expect(page).toHaveURL(authPaths.dashboard);

    await userMenu.logout();
    await expect(page).toHaveURL(authPaths.login);

    await page.goto('/web/index.php/dashboard/index');
    await expect(page).toHaveURL(authPaths.login);
    await expect(loginPage.loginButton).toBeVisible();
  });
});
