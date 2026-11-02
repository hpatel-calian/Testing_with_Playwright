# Testing with Playwright

End-to-end test suite (Playwright + TypeScript). There is no test management tool. Jira traceability
comes from test tags and `reporters/traceability-reporter.ts`, and CI runs are the audit evidence.

## Commands

```bash
npm test                                # all tests, all browsers
npx playwright test --project=chromium  # one browser
npx playwright test --grep @PROJ-123    # tests for one Jira ticket
npm run report                          # Playwright HTML report
```

Output: `playwright-report/` (steps, screenshots, traces) and `traceability-report/` (Jira matrix).

## Rules for every test (mandatory)

1. **Tag with the Jira ticket(s) it verifies.** Use the key format `@PROJ-123`, on the test or its `test.describe`:
   ```ts
   test('user can reset password', { tag: ['@PROJ-123', '@regression'] }, async ({ page }) => { ... });
   ```
   - On CI, a test without a Jira tag **fails the build**.
   - `@no-jira` is only for non-test infrastructure, such as `tests/seed.spec.ts`. Never use it to get around the rule.
   - If the ticket key isn't known, ask the user. Never invent a key.
2. **Other tags:** `@smoke` (critical path, fast) and `@regression` (full suite).
3. **Locators:** use `getByRole`, `getByLabel`, `getByText` or `getByTestId`. No CSS or XPath unless there's no alternative.
4. **Waiting:** rely on web-first assertions (`await expect(...).toBeVisible()`). Never use `page.waitForTimeout`.
5. **Independence:** each test sets up its own state and must pass alone and in parallel.
6. **Secrets and test data:** never hardcode credentials. Read them from environment variables.

For anything else (fixtures, POM, mocking, auth, flaky tests, CI), follow the
`playwright-best-practices` skill in `.claude/skills/`.

## Project layout

```
tests/<feature>/*.spec.ts   # tests, grouped by business area
pages/                      # page objects (create when needed)
fixtures/                   # shared fixtures, e.g. signed-in users (create when needed)
test-data/                  # test data, kept out of specs (create when needed)
specs/                      # test plans written by the planner agent
reporters/                  # traceability reporter: change with care, it produces audit evidence
```

## Playwright test agents

The agents are in `.claude/agents/`, and the browser connection they use is set up in `.mcp.json`.

- **playwright-test-planner:** explores the app and saves a test plan in `specs/`. Each scenario in the plan
  must name the Jira ticket it covers.
- **playwright-test-generator:** turns a plan into tests. Each generated test must carry the Jira tag(s) from
  its plan scenario and follow the rules above.
- **playwright-test-healer:** fixes failing tests. Never remove or change a Jira tag, and never weaken an
  assertion just to make a test pass. If the app behaviour is genuinely wrong, report it as a defect.

## Environment notes

- The corporate Zscaler proxy re-signs HTTPS. For npm and browser downloads use
  `NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/zscaler.crt`. Locally, the config sets
  `ignoreHTTPSErrors` outside CI. Keep it off on CI.
- Installing Linux browser dependencies needs `sudo env "PATH=$PATH" npx playwright install-deps`,
  which the user runs because it needs their password.

## Git

**Never commit or push without the user's explicit permission, each time.** Prepare the changes, summarise
them, and ask.
