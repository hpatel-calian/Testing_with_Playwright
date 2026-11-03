# Auth: Login page test plan

Page: `/web/index.php/auth/login`. These tests start **signed out** (`test.use(signedOut)` from `fixtures/`).
Seed: `tests/seed.spec.ts`. Spec file: `tests/e2e/auth/login.spec.ts`. Read-only: no records are changed.

Observed on the demo (OrangeHRM OS 5.9):
- Heading "Login"; textboxes "Username" and "Password" (type=password); button "Login"; text "Forgot your password?".
- Wrong credentials: alert "Invalid credentials", stays on `/auth/login`.
- Empty submit: "Required" under Username and Password. Username only: "Required" under Password only.
- "Forgot your password?" opens `/auth/requestPasswordResetCode` (heading "Reset Password", buttons Cancel and
  Reset Password). Cancel returns to `/auth/login`.
- Signed out, `/dashboard/index` redirects to `/auth/login`.
- User menu → Logout returns to `/auth/login`; the dashboard then redirects to login again.

## PROJ-306 Login

1. **The login form shows Username, a masked Password, Login and Forgot your password** (`@smoke @regression`)
2. **Valid admin credentials open the dashboard** (`@smoke @sanity @regression`): credentials from `env.users.admin`;
   expect `/dashboard/index` and the "Dashboard" heading.
3. **A wrong password shows "Invalid credentials" and stays on the login page** (`@sanity @regression`)
4. **An unknown username shows "Invalid credentials"** (`@regression`)
5. **Login with empty fields shows Required under Username and Password** (`@regression`)
6. **Login without a password shows Required under Password only** (`@regression`)
7. **"Forgot your password?" opens Reset Password, and Cancel returns to login** (`@regression`): don't press
   Reset Password.
8. **A signed-out user opening the dashboard is sent to login** (`@regression`)
9. **Logout returns to login, and the dashboard needs signing in again** (`@regression`): sign in through the form
   first (a fresh session, so the saved admin session is not affected).
