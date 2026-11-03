/*
 * The test() that every spec imports (CLAUDE.md rule 7). Fixtures are split by concern and chained:
 *   api.fixture.ts   → API clients (api, anonymousApi)
 *   pages.fixture.ts → page objects (extends the API fixtures)
 * Add a new file per concern (e.g. data.fixture.ts) and chain it here, rather than growing one large fixture.
 */
export { test } from './pages.fixture';
export { expect } from '@playwright/test';

/** Use in a describe block to start signed out (e.g. login tests): test.use(signedOut). */
export const signedOut = { storageState: { cookies: [], origins: [] } };
