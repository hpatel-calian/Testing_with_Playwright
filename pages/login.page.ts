import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

type LoginField = 'Username' | 'Password';

/** OrangeHRM sign-in screen (/auth/login). */
export class LoginPage extends BasePage {
  readonly heading: Locator;
  readonly username: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;
  /** Banner shown when the credentials are rejected ("Invalid credentials"). */
  readonly errorAlert: Locator;
  /** "Forgot your password?" (rendered as text, not a link). */
  readonly forgotPassword: Locator;

  constructor(page: Page) {
    super(page, '/web/index.php/auth/login');
    this.heading = page.getByRole('heading', { name: 'Login' });
    this.username = page.getByRole('textbox', { name: 'Username' });
    this.password = page.getByRole('textbox', { name: 'Password' });
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.errorAlert = page.getByRole('alert');
    this.forgotPassword = page.getByText('Forgot your password?');
  }

  /** Opens the sign-in screen and waits until the form is ready. */
  async goto() {
    await super.goto();
    await expect(this.loginButton).toBeVisible();
  }

  async login(username: string, password: string) {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginButton.click();
  }

  /**
   * Validation message under a field (e.g. "Required"). OrangeHRM's labels are not linked to their inputs, so the
   * message is found inside the form group that shows the label.
   */
  fieldError(field: LoginField): Locator {
    return this.page
      .locator('.oxd-input-group')
      .filter({ has: this.page.locator('label', { hasText: new RegExp(`^${field}$`) }) })
      .locator('.oxd-input-field-error-message');
  }
}
