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

## Using skills (every task, mandatory)

- **A skill exists for the task: use it automatically, without being asked.** Before starting any task, check the
  skills available in the session: project skills in `.claude/skills/`, plus user and plugin skills. Load every
  skill whose description matches the task, and follow it. For anything Playwright (tests, page objects,
  fixtures, config, CI, debugging), that means `playwright-best-practices`, used as rule 9 below describes.
- **No skill fits the task:** using one is optional. Do the task normally.
- **A repetitive task has no skill: ask whether to create one.** A task is repetitive if you've been asked for
  it before, or if it is a fixed multi-step routine. Examples: adding a new OrangeHRM module (page objects,
  fixtures, specs), turning a Jira ticket into tests, or triaging a failed CI run. Ask once whether to turn it into
  a project skill in `.claude/skills/<name>/`, using the `skill-creator` skill if it's available. Create the skill
  only if the user says yes, and don't ask again for the same task after a no.
- The rules in this file win if a skill conflicts with them.

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

9. **Always use the `playwright-best-practices` skill, for every task.** This applies to any work on tests, page
   objects, components, fixtures, helpers, test data, config or CI: writing, changing, reviewing, debugging or
   planning.
   - Load the skill (`.claude/skills/playwright-best-practices/`) and open its `SKILL.md`.
   - Find the task in SKILL.md's **Activity-Based Reference Guide** or **Quick Decision Tree**. Read **every**
     reference file listed for it before starting.
   - A task that spans several activities reads the files for each. For example, a new E2E test of a form that
     needs a new page object reads the E2E, forms and page-object files.
   - The table below is only a quick reference for common tasks. SKILL.md is the complete list, with topics such as
     network mocking, file upload, iframes, multi-user, mobile, visual, accessibility, security and performance.
     If a task isn't in the table, look it up in SKILL.md.
   - After writing or changing tests, follow SKILL.md's **Test Validation Loop**: run the tests, fix failures from
     the error output and trace, and re-run until they pass. Run critical tests with `--repeat-each` to catch
     flakiness.
   - In your summary, name the reference files you read.

   The rules in this file win if they conflict with the skill.

   | Task | Read |
   |---|---|
   | New E2E test | `core/test-suite-structure.md`, `core/locators.md`, `core/assertions-waiting.md` |
   | API / integration test | `testing-patterns/api-testing.md` |
   | Project structure, where new code goes | `architecture/pom-vs-fixtures.md`, `architecture/test-architecture.md` |
   | Page object or fixture | `core/page-object-model.md`, `core/fixtures-hooks.md`, `architecture/pom-vs-fixtures.md` |
   | Forms and validation | `testing-patterns/forms-validation.md`, `debugging/error-testing.md` |
   | Mocking API responses, network errors | `advanced/network-advanced.md`, `architecture/when-to-mock.md` |
   | Test data | `core/test-data.md`, `core/fixtures-hooks.md` |
   | Tags, skip/fixme | `core/test-tags.md`, `core/annotations.md` |
   | Sign-in / sessions | `advanced/authentication.md`, `core/projects-dependencies.md` |
   | Failing or flaky test | `debugging/debugging.md`, `debugging/flaky-tests.md` |
   | Config / CI | `core/configuration.md`, `infrastructure-ci-cd/github-actions.md` |
   | Accessibility | `testing-patterns/accessibility.md` |
10. **Checks must pass.** Run `npm run verify` (ESLint with `eslint-plugin-playwright`, TypeScript type check, Jira
    tag check) before saying the work is done. A Claude Code hook (`.claude/settings.json` →
    `scripts/claude-lint-hook.sh`) lints every `.ts` file right after it's edited and reports errors back; fix
    them, never disable a rule or add `eslint-disable` to get past it. CI runs `npm run verify` before the tests.
11. **Structure follows the skill's architecture, always.** Every new file goes in the layer it belongs to, as
    `architecture/pom-vs-fixtures.md` ("Combined Project Structure") describes. Read that file and
    `architecture/test-architecture.md` before adding a new file or folder.

    | Code | Layer | Where and how to name it |
    |---|---|---|
    | Locators and actions for one screen | Page object | `pages/<screen>.page.ts`: `class <Screen>Page extends BasePage` |
    | UI part shared by several screens (menu, table, dialog) | Component | `pages/components/<part>.component.ts`: `class <Part>Component` |
    | Anything with setup and teardown (API clients, sessions, records) | Fixture | `fixtures/<concern>.fixture.ts`, chained into `fixtures/index.ts` |
    | Stateless utility (typed API reads, data builders, formatting) | Helper | `helpers/<topic>.ts` |
    | Test data values | Test data | `test-data/<module>.ts` |
    | Test cases | Spec | `tests/e2e/<module>/<feature>.spec.ts`, `tests/api/<module>.spec.ts`, `tests/integration/<feature>.spec.ts` |

    - **Page objects:** hold locators plus actions named for what the user does (`submitClaim()`, not `clickButton()`).
      They make no assertions, except waiting for their screen to load in `goto()`. They make no API calls and manage
      no resources (those belong in a fixture). Don't write locator-only page objects. Split large screens into
      components.
    - **Register every page object** as a fixture in `fixtures/pages.fixture.ts`, so specs ask for it by name
      (`async ({ loginPage }) => …`) instead of calling `new LoginPage(page)`.
    - **Fixtures:** one concern per file, small and composable. Never write one fixture that does everything. A new
      concern (e.g. `data.fixture.ts`) extends the previous fixture file in the chain, and `index.ts` exports the
      last `test`.
    - **Helpers:** pure functions with no module-level state. Anything that needs cleanup is a fixture.
    - **Choosing the test type:** check rules and permutations with API tests (fast, no browser). Use E2E for
      critical user journeys and for what only the UI shows. Use integration tests to check that the UI matches the
      API. Don't write an E2E test for something an API test can check.
    - **Keep `pages/`, `fixtures/` and `helpers/` at the repository root, outside `tests/`.** The lint rule that
      bans raw CSS locators applies only to `tests/**`. That keeps OrangeHRM's `.oxd-*` class selectors confined to
      page objects.
    - A folder with no files yet keeps a `.gitkeep` so git tracks it. Delete the `.gitkeep` once the folder has a
      real file.

## Project layout

```
config/env.ts                    # URLs, users, environment (env vars or a local .env; see .env.example)
pages/base.page.ts               # BasePage: every page object extends it (path + goto())
pages/<screen>.page.ts           # page objects, one per screen
pages/components/                # <part>.component.ts: UI parts shared by several screens
fixtures/api.fixture.ts          # api (signed in) / anonymousApi (no session) clients
fixtures/pages.fixture.ts        # page objects registered as fixtures (extends api.fixture)
fixtures/index.ts                # the test/expect that specs import, plus signedOut
helpers/                         # stateless utilities, e.g. typed read-only API helpers
test-data/                       # test data, kept out of specs
tests/auth.setup.ts              # signs in once and saves the session (@no-jira)
tests/seed.spec.ts               # starting point for the Playwright agents (@no-jira)
tests/e2e/<module>/              # browser journeys, one folder per module (e.g. auth/, pim/, claim/)
tests/integration/               # API + UI checked against each other
tests/api/                       # REST API tests: 'api' project, no browser
specs/                           # test plans written by the planner agent
scripts/                         # check-jira-tags.mjs, claude-lint-hook.sh
eslint.config.mjs                # lint rules (playwright-best-practices, enforced)
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

