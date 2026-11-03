# Testing with Playwright

Playwright + TypeScript test framework: E2E, integration, API, smoke, sanity and regression tests, tagged with
Jira tickets.

**Application under test:** [OrangeHRM](https://opensource-demo.orangehrmlive.com), the open-source HR management system
([source](https://github.com/orangehrm/orangehrm)), using its public demo, version 5.
API: `https://opensource-demo.orangehrmlive.com/web/index.php/api/v2/`, authenticated by the session cookie.

## Running tests

```bash
npm test                    # everything
npm run test:smoke          # @smoke: critical path, fast (run on every deploy)
npm run test:sanity         # @sanity: focused checks after a change
npm run test:regression     # @regression: the full regression suite
npm run test:e2e            # tests/e2e only (browser)
npm run test:integration    # tests/integration only (API + UI together)
npm run test:api            # tests/api only (no browser)
npx playwright test --grep @PROJ-123   # only the tests for one Jira ticket
npm run test:ui             # interactive mode
npm run report              # open the last Playwright HTML report
npm run verify              # lint + type check + Jira tag check (CI runs this first)
npm run lint:fix            # auto-fix lint issues
```

Tags combine: `npx playwright test --grep @smoke --project=api` runs API smoke tests only.

## Framework layout

```
config/env.ts          # URLs, admin user, environment name (env vars or a local .env)
.env.example           # copy to .env (git-ignored) to override settings locally
pages/                 # page objects, one per screen (empty: create as needed)
pages/components/      # reusable UI parts shared by several screens (empty)
helpers/               # typed, read-only API helpers (empty)
fixtures/index.ts      # custom test(): page objects, `api` / `anonymousApi` clients, `signedOut`
eslint.config.mjs      # lint rules (eslint-plugin-playwright); scripts/ has the Jira tag check and Claude hook
test-data/             # test data kept out of specs (empty)
tests/auth.setup.ts    # signs in once and saves the session; all other tests reuse it (@no-jira)
tests/e2e/             # browser journeys, one folder per module (empty: add tests here)
tests/integration/     # UI and API checked against each other (empty)
tests/api/             # REST API tests (run in the `api` project, no browser; empty)
tests/seed.spec.ts     # starting point for the Playwright agents (@no-jira)
```

**Sign-in:** the `setup` project signs in as admin once, through the login form, and saves the session to
`playwright/.auth/admin.json` (git-ignored). Browser tests start already signed in, and the `api` fixture sends the
same session cookie. Login tests opt out with `test.use(signedOut)`. Running a single file or ticket still runs
`setup` first, automatically.

Specs import `test`/`expect` from `fixtures`, not from `@playwright/test`:

```ts
import { test, expect } from '../../../fixtures';

test.describe('Employee search (PIM)', { tag: '@PROJ-123' }, () => {
  test('search by Employee Id …', { tag: ['@smoke', '@regression'] }, async ({ api, page }) => { … });
});
```

| Test type | How it's selected | Example |
|---|---|---|
| E2E | folder `tests/e2e/` | a user journey in the browser, e.g. login, searching a list screen |
| Integration | folder `tests/integration/` | the UI shows what the API returns, e.g. a list's record count equals the API total |
| API | project `api` (`tests/api/`) | status codes and response shapes, e.g. 401 without a session |
| Smoke / Sanity / Regression | tags `@smoke` / `@sanity` / `@regression` | one test can carry several |

**Configuration** (environment variables, defaults in `config/env.ts`): `BASE_URL`, `API_URL`, `TEST_ENV`,
`ADMIN_USERNAME`, `ADMIN_PASSWORD`. Locally, copy `.env.example` to `.env` and fill in what you need. Real environment
variables and CI secrets override `.env`. The defaults are the public demo's credentials (shown on its login page). For a
real installation, set credentials as CI secrets.

**Public demo limitations:** the demo is shared with everyone, and other people change its data constantly (for
example, the admin's display name, employees, and leave). So the tests:
- are **read-only**: they don't create, edit or delete records;
- don't assert values other people can change, such as the admin's display name or a fixed employee. Read
  current data from the API at run time instead;
- re-check counts that can change mid-test.

To test creating employees, leave requests, and so on, [run OrangeHRM locally with
Docker](https://github.com/orangehrm/orangehrm) and set `BASE_URL`.

## Jira ticket tagging

Every test is tagged with the Jira ticket it verifies. **Group all test cases for a ticket in one `test.describe`
tagged with the ticket key.** Every test inside inherits the tag automatically: if PROJ-123 has 8 test cases, all
8 carry `@PROJ-123`, and any test added to that block later gets it too, with no tagging per test.

```ts
// tests/e2e/auth/password-reset.spec.ts
test.describe('Password reset', { tag: '@PROJ-123' }, () => {
  test('user receives a reset link', { tag: ['@smoke', '@regression'] }, async ({ page }) => { ... });
  test('reset link expires after 1 hour', { tag: '@regression' }, async ({ page }) => { ... });
  test('weak password is rejected', { tag: ['@sanity', '@regression'] }, async ({ page }) => { ... });
  // ... every PROJ-123 test case goes here and is tagged @PROJ-123 automatically
});
```

- One file can hold several ticket blocks (one `describe` per ticket).
- If a test also verifies another ticket, add that key on the test itself: `{ tag: ['@PROJ-130', '@regression'] }`.
  It then carries both tickets.
- Tests that aren't real test cases (e.g. `tests/seed.spec.ts`) are tagged `@no-jira`.

Run or list the tests for a ticket:

```bash
npx playwright test --grep @PROJ-123          # run all test cases for PROJ-123
npx playwright test --grep @PROJ-123 --list   # list them (and the count)
npx playwright test --grep "@PROJ-123|@PROJ-124"   # several tickets
```

In the HTML report (`npm run report`), the tags show on every test, and you can filter by typing `@PROJ-123` in the
search box.

**Local note:** behind the Zscaler proxy, run with `NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/zscaler.crt` when downloading browsers. Locally, tests ignore HTTPS certificate errors; on CI they don't.

## Writing tests with Claude Code (agents + skill)

The repo includes AI tooling for [Claude Code](https://claude.com/claude-code). Open Claude Code in this folder and
everything below loads automatically.

| What | Where | Purpose |
|---|---|---|
| Project rules | `CLAUDE.md` | Rules that every test must follow (Jira tags, locators, no fixed waits…). Claude and the agents read it every session. |
| Best-practices skill | `.claude/skills/playwright-best-practices/` | Playwright guidance (POM, fixtures, auth, mocking, flaky tests, CI…). Used automatically when you work on tests. |
| Test agents | `.claude/agents/` | **planner**, **generator**, **healer**: Playwright's official agents. |
| Browser tools for agents | `.mcp.json` | Lets the agents drive a real browser. Claude Code asks you to approve it the first time. |
| Seed test | `tests/seed.spec.ts` | Starting point the agents run before exploring (e.g. sign-in, base URL). Tagged `@no-jira`. |
| Test plans | `specs/` | Plans written by the planner, reviewed by you, used by the generator. |

### Typical workflow: Jira ticket → tested

**1. Prepare the seed** (once per app). Edit `tests/seed.spec.ts` so it opens your app in the state the agents
should start from, for example the logged-in home page. Also set `baseURL` in `playwright.config.ts`.

**2. Plan.** Ask Claude to use the planner with the ticket and its acceptance criteria:

> Use the playwright-test-planner agent to create a test plan for PROJ-123 "Password reset" on https://qa.myapp.com.
> Acceptance criteria: user receives reset link; link expires after 1 hour; weak passwords are rejected.

The planner explores the app in a browser and saves `specs/proj-123-password-reset.md`. **Review and edit the plan.**
It's the human checkpoint: check that every acceptance criterion has a scenario and that each scenario names its ticket.

**3. Generate.**

> Use the playwright-test-generator agent to generate tests from specs/proj-123-password-reset.md.

The generator performs each step in a real browser, then writes tests under `tests/`. Each test is tagged
`@PROJ-123` (required by `CLAUDE.md`). Read the generated code before committing.

**4. Run the ticket's tests.**

```bash
npx playwright test --grep @PROJ-123
```

All PROJ-123 test cases run, because they sit inside the `@PROJ-123` describe block. Check the results with
`npm run report`.

**5. Heal (when tests break).** After app changes:

> Use the playwright-test-healer agent to fix the failing tests in tests/password-reset/.

The healer replays failures, inspects the page, and updates locators or waits. It's told never to drop Jira tags or
weaken assertions. If the app itself is wrong, it reports a defect instead. **Review its changes.** A "fixed"
test that hides a real bug is a compliance problem.

### Using the skill

You don't need to call it explicitly. Ask normally and Claude applies it:

> Add a page object for the Leave List screen.
> This test is flaky on CI, find out why.
> Add an accessibility check to the login tests.

To force it: *"Use the playwright-best-practices skill to …"*.

### Making Claude and the agents follow the skill

The skill is guidance. These four layers make sure it's actually followed:

| Layer | Where | What it does |
|---|---|---|
| Rule | `CLAUDE.md` rules 9–10 | Claude must load the skill and read the guide for the task (table of task → guide), then pass `npm run verify` |
| Agents | `skills: playwright-best-practices` in `.claude/agents/*.md` | Planner, generator and healer start with the skill loaded and are told to read `CLAUDE.md` first |
| Hook | `.claude/settings.json` → `scripts/claude-lint-hook.sh` | After Claude or an agent edits a `.ts` file, ESLint runs on it (and the Jira tag check for tests); errors go straight back to Claude to fix |
| CI | `npm run verify` step in `.github/workflows/playwright.yml` | Lint, TypeScript type check and Jira tag check must pass before tests run |

Lint rules (`eslint.config.mjs`, using `eslint-plugin-playwright`) catch: missing `await` on actions and
assertions, `waitForTimeout`, `test.only`, `page.pause()`, `networkidle`, `{ force: true }`, raw CSS/XPath in
specs (keep them in page objects), non-web-first assertions, and importing from `@playwright/test` instead of
`fixtures/`.

To point Claude at specific guides, name them: *"/playwright-best-practices review pages/ against
core/page-object-model.md"*.

### Tips

- Without agents, you can also just ask: *"Write a Playwright test for PROJ-123 that checks…"*. Claude follows
  `CLAUDE.md` either way.
- Generated code is a draft. You own what gets committed, especially for audit evidence.
- Agent runs use the browser on your machine. Behind the Zscaler proxy, sites load because `ignoreHTTPSErrors`
  is on locally.

### Updating the tooling

- **Agents:** after upgrading `@playwright/test`, run `npx playwright init-agents --loop=claude` to regenerate them,
  then re-check `tests/seed.spec.ts` still has its `@no-jira` tag, and re-add `skills: playwright-best-practices` and the
  "Project rules" paragraph to each agent (regeneration overwrites them).
- **Skill:** pinned copy; see `.claude/skills/playwright-best-practices/SOURCE.txt` for the source commit. To update,
  re-download from the source repo, review the diff, and replace the folder.
