import { test as base, request, type APIRequestContext } from '@playwright/test';
import { adminAuthFile, env } from '../config/env';

/** API clients for OrangeHRM's REST API (/web/index.php/api/v2/). Each test gets its own, disposed after the test. */
type ApiFixtures = {
  /** API client signed in as admin (reuses the session saved by tests/auth.setup.ts). */
  api: APIRequestContext;
  /** API client with no session. */
  anonymousApi: APIRequestContext;
};

const newApi = (ignoreHTTPSErrors: boolean, storageState?: string) =>
  request.newContext({ baseURL: env.apiUrl, ignoreHTTPSErrors, storageState, extraHTTPHeaders: { Accept: 'application/json' } });

export const test = base.extend<ApiFixtures>({
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
