import type { Page } from '@playwright/test';

/**
 * Base class for page objects: one subclass per OrangeHRM screen, named <screen>.page.ts, e.g.
 *
 *   export class LoginPage extends BasePage {
 *     readonly username = this.page.getByPlaceholder('Username');
 *     constructor(page: Page) { super(page, '/web/index.php/auth/login'); }
 *     async login(user: string, password: string) { ... }
 *   }
 *
 * Keep locators and actions here; keep assertions in specs (skill: core/page-object-model.md).
 * Reusable UI parts shared by several screens go in pages/components/<part>.component.ts.
 */
export abstract class BasePage {
  constructor(
    protected readonly page: Page,
    /** Path under BASE_URL, e.g. '/web/index.php/dashboard/index'. */
    readonly path: string,
  ) {}

  /** Opens this screen. */
  async goto() {
    await this.page.goto(this.path);
  }
}
