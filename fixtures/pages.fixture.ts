import { test as base } from './api.fixture';

/*
 * Page objects as fixtures, so specs ask for them by name: async ({ loginPage }) => { ... }.
 * Add one entry per page object in pages/, e.g.
 *   type PageFixtures = { loginPage: LoginPage };
 *   loginPage: async ({ page }, use) => use(new LoginPage(page)),
 */
/** Empty until the first page object is added. */
type PageFixtures = Record<never, never>;

export const test = base.extend<PageFixtures>({});
