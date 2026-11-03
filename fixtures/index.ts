import { test as base, expect, request, type APIRequestContext } from '@playwright/test';
import { adminAuthFile, env } from '../config/env';

/*
 * Custom test(). Add a fixture here for each page object you create in pages/, e.g.
 *   loginPage: async ({ page }, use) => use(new LoginPage(page)),
 */
type Fixtures = {
  /** API client signed in as admin (reuses the session saved by tests/auth.setup.ts). */
  api: APIRequestContext;
  /** API client with no session. */
  anonymousApi: APIRequestContext;
};

const newApi = (ignoreHTTPSErrors: boolean, storageState?: string) =>
  request.newContext({ baseURL: env.apiUrl, ignoreHTTPSErrors, storageState, extraHTTPHeaders: { Accept: 'application/json' } });

export const test = base.extend<Fixtures>({
  api: async ({ ignoreHTTPSErrors }, use) => {
    const ctx = await newApi(ignoreHTTPSErrors, adminAuthFile);
    await use(ctx);
    await ctx.dispose();
  },
  anonymousApi: async ({ ignoreHTTPSErrors }, use) => {
    const ctx = await newApi(ignoreHTTPSErrors);
    await use(ctx);
    await ctx.dispose();
  },
});

/** Use in a describe block to start signed out (e.g. login tests). */
export const signedOut = { storageState: { cookies: [], origins: [] } };

export { expect };
