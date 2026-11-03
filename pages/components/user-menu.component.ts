import type { Locator, Page } from '@playwright/test';

/** The signed-in user's drop-down in the top bar (About, Support, Change Password, Logout). */
export class UserMenuComponent {
  /** The name/avatar that opens the menu. It has no accessible name, hence the class selector. */
  readonly trigger: Locator;
  readonly menu: Locator;

  constructor(private readonly page: Page) {
    this.trigger = page.locator('.oxd-userdropdown-tab');
    this.menu = page.getByRole('menu');
  }

  item(name: string): Locator {
    return this.menu.getByRole('menuitem', { name, exact: true });
  }

  async logout() {
    await this.trigger.click();
    await this.item('Logout').click();
  }
}
