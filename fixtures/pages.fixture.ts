import { test as base } from './api.fixture';
import { UserMenuComponent } from '../pages/components/user-menu.component';
import { LoginPage } from '../pages/login.page';

/*
 * Page objects as fixtures, so specs ask for them by name: async ({ loginPage }) => { ... }.
 * Add one entry per page object in pages/ (CLAUDE.md rule 11).
 */
type PageFixtures = {
  loginPage: LoginPage;
  userMenu: UserMenuComponent;
};

export const test = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  userMenu: async ({ page }, use) => use(new UserMenuComponent(page)),
});
