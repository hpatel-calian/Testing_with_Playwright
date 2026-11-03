# Testing with Playwright

Test framework (Playwright + TypeScript) for OrangeHRM 5 (public demo: https://opensource-demo.orangehrmlive.com,
API under /web/index.php/api/v2/). There is no test management tool. Every test is linked to its
Jira ticket by a tag.

## Commands

```bash
npm test                                # everything
npm run test:smoke | test:sanity | test:regression
npm run test:e2e | test:integration | test:api
npx playwright test --grep @PROJ-123    # tests for one Jira ticket
npm run report                          # Playwright HTML report
npm run verify                          # lint + type check + Jira tag check (must pass)
npm run lint:fix                        # auto-fix lint issues
```

Output: `playwright-report/` (steps, screenshots, traces).

## Rules for every test (mandatory)

1. **Jira tagging is automatic, through one describe block per ticket.** Every test case for a Jira ticket goes
   inside a single `test.describe` tagged with that ticket. All tests inside inherit the tag, so a ticket with 8 test
   cases has all 8 tagged, with no tagging per test:
   ```ts
   test.describe('Password reset', { tag: '@PROJ-123' }, () => {
     test('user receives a reset link', { tag: ['@smoke', '@regression'] }, async ({ page }) => { ... });
     test('weak password is rejected', { tag: '@regression' }, async ({ page }) => { ... });
     // ...all other PROJ-123 test cases
   });
   ```
   - **Adding a test case for a ticket:** put it inside that ticket's existing describe block, which you can find with
     `grep -rn "@PROJ-123" tests/`. Create a new block only if the ticket has none yet.
   - **Never put a Jira key on an individual test** inside its own ticket's block. Only type tags (`@smoke` etc.) go
     there. Exception: a test that also verifies a second ticket adds that second key on the test.
   - Key format: `@` + Jira key, e.g. `@PROJ-123`. Several ticket blocks per file are fine.
   - `@no-jira` is only for non-test infrastructure, such as `tests/seed.spec.ts` and `tests/auth.setup.ts`. Never use it to avoid tagging.
   - If the ticket key isn't known, ask the user. Never invent a key.
   - **Check after writing tests:** run `npx playwright test --list --grep @PROJ-123` and confirm every test case
     for that ticket is listed (the total also counts the `setup` sign-in step, which always runs first). Then run `npx playwright test --list --grep-invert "@[A-Z][A-Z0-9]+-[0-9]+|@no-jira"`
     and confirm it finds no tests (that is, every test has a ticket).
2. **Type tags:** `@smoke` (critical path, fast), `@sanity` (focused checks after a change), and `@regression`
   (full suite; nearly every test). E2E, integration and API tests are selected by folder, not by tag.
3. **Locators:** use `getByRole`, `getByLabel`, `getByText` or `getByTestId`. No CSS or XPath unless there's no alternative.
4. **Waiting:** rely on web-first assertions (`await expect(...).toBeVisible()`). Never use `page.waitForTimeout`.
5. **Independence:** each test sets up its own state and must pass alone and in parallel.
6. **Secrets and test data:** never hardcode credentials. Use `env.users` from `config/env.ts`, which reads
   environment variables. Put test data in `test-data/`.
7. **Imports:** specs import `test`/`expect` from `fixtures/`, not from `@playwright/test`. Use the page objects
   in `pages/`, and add to them rather than putting raw selectors in specs.
8. **Signing in:** tests start signed in as admin, using the session saved by `tests/auth.setup.ts`. Only
   `tests/e2e/auth/` goes through the login form, with `test.use(signedOut)`. For API calls, use the `api` fixture
   (signed in) or `anonymousApi` (no session).

9. **Follow the `playwright-best-practices` skill.** Before writing or changing any test, page object, fixture,
   config or CI file, load the skill (`.claude/skills/playwright-best-practices/`) and read the reference file for
   the task. The rules in this file win if they conflict.

   | Task | Read |
   |---|---|
   | New E2E test | `core/test-suite-structure.md`, `core/locators.md`, `core/assertions-waiting.md` |
   | API / integration test | `testing-patterns/api-testing.md` |
   | Page object or fixture | `core/page-object-model.md`, `core/fixtures-hooks.md`, `architecture/pom-vs-fixtures.md` |
   | Test data | `core/test-data.md` |
   | Tags, skip/fixme | `core/test-tags.md`, `core/annotations.md` |
   | Sign-in / sessions | `advanced/authentication.md`, `core/projects-dependencies.md` |
   | Failing or flaky test | `debugging/debugging.md`, `debugging/flaky-tests.md` |
   | Config / CI | `core/configuration.md`, `infrastructure-ci-cd/github-actions.md` |
   | Accessibility | `testing-patterns/accessibility.md` |
10. **Checks must pass.** Run `npm run verify` (ESLint with `eslint-plugin-playwright`, TypeScript type check, Jira
    tag check) before saying the work is done. A Claude Code hook (`.claude/settings.json` →
    `scripts/claude-lint-hook.sh`) lints every `.ts` file right after it's edited and reports errors back; fix
    them, never disable a rule or add `eslint-disable` to get past it. CI runs `npm run verify` before the tests.

## Project layout

```
config/env.ts               # URLs, users, environment (env vars or a local .env; see .env.example)
tests/e2e/<area>/           # browser journeys, one folder per module (e.g. auth/, pim/, claim/)
tests/integration/          # API + UI checked against each other
tests/api/                  # REST API tests: 'api' project, no browser
pages/                      # page objects, one per screen (empty: create as needed)
pages/components/           # reusable UI parts shared by several screens (empty)
helpers/                    # typed read-only API helpers (empty)
fixtures/index.ts           # test(): page objects, api / anonymousApi, signedOut
tests/auth.setup.ts         # signs in once and saves the session (@no-jira)
test-data/                  # test data, kept out of specs (empty)
specs/                      # test plans written by the planner agent
scripts/                    # check-jira-tags.mjs, claude-lint-hook.sh
eslint.config.mjs           # lint rules (playwright-best-practices, enforced)
```

## Playwright test agents

The agents are in `.claude/agents/`, and the browser connection they use is set up in `.mcp.json`.

- **playwright-test-planner:** explores the app and saves a test plan in `specs/`. Group the plan's scenarios
  under one heading per Jira ticket (e.g. `## PROJ-123 Password reset`).
- **playwright-test-generator:** turns a plan into tests. Write each ticket's scenarios into that ticket's
  `test.describe(..., { tag: '@PROJ-123' })` block, as rule 1 requires, and follow the other rules.
- The agents preload the skill (`skills:` in their frontmatter) and are told to read `CLAUDE.md` first. After
  `npx playwright init-agents` regenerates them, re-add that frontmatter line and the "Project rules" paragraph.
- **playwright-test-healer:** fixes failing tests. Never remove or change a Jira tag, and never weaken an
  assertion just to make a test pass. If the app behaviour is genuinely wrong, report it as a defect.

