/** Test data for the sign-in screens. Real credentials come from env.users (config/env.ts), never from here. */
export const auth = {
  /** Deliberately wrong password for negative tests. */
  wrongPassword: 'not-the-admin-password',
  /** A username that does not exist. */
  unknownUsername: 'no-such-user-pw-test',
} as const;

export const authMessages = {
  invalidCredentials: 'Invalid credentials',
  required: 'Required',
} as const;

export const authPaths = {
  login: /\/auth\/login$/,
  dashboard: /\/dashboard\/index$/,
  resetPassword: /\/auth\/requestPasswordResetCode$/,
} as const;
