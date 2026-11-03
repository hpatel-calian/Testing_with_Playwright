import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Environment settings. Override with environment variables: a local `.env` file (copy `.env.example`; git-ignored)
 * or CI variables/secrets. Real environment variables win over `.env`. Defaults point at the public OrangeHRM demo.
 */
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const baseUrl = (process.env.BASE_URL ?? 'https://opensource-demo.orangehrmlive.com').replace(/\/+$/, '');

export const env = {
  name: process.env.TEST_ENV ?? 'orangehrm-demo',
  baseUrl,
  /** OrangeHRM 5 REST API used by the web app. Authenticated by the session cookie. */
  apiUrl: process.env.API_URL ?? `${baseUrl}/web/index.php/api/v2/`,
  users: {
    // Public demo credentials shown on the OrangeHRM demo login page. For a real installation, never put
    // credentials here: set ADMIN_USERNAME / ADMIN_PASSWORD as CI secrets instead.
    admin: {
      username: process.env.ADMIN_USERNAME ?? 'Admin',
      password: process.env.ADMIN_PASSWORD ?? 'admin123',
    },
  },
} as const;

/** Saved browser session (cookies) of the signed-in admin, written by tests/auth.setup.ts. */
export const adminAuthFile = 'playwright/.auth/admin.json';
