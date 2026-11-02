# Testing with Playwright

End-to-end tests using [Playwright](https://playwright.dev).

## Running tests

```bash
npm test                 # all tests, all browsers
npm run test:ui          # interactive mode
npx playwright test --grep @PROJ-123   # only the tests for one Jira ticket
npm run report           # open the last Playwright HTML report
```

## Jira traceability

Every test must be tagged with the Jira ticket(s) it verifies. On CI, a test without a ticket fails the run.

```ts
test('user can reset password', { tag: ['@PROJ-123', '@regression'] }, async ({ page }) => { ... });

// A tag on describe applies to every test inside it.
test.describe('Checkout', { tag: '@PROJ-200' }, () => { ... });

// Alternative: an annotation (key or full Jira URL).
test('...', { annotation: { type: 'jira', description: 'PROJ-123' } }, async () => { ... });
```

Each run writes `traceability-report/` (made by `reporters/traceability-reporter.ts`):

| File | Purpose |
|---|---|
| `index.html` | Matrix grouped by ticket: status, test cases, result per browser, links to evidence |
| `traceability.json` | Same data plus run metadata and SHA-256 of every evidence file |
| `traceability.md` | Markdown version (also shown on the GitHub Actions run summary) |
| `SHA256SUMS` | Checksums; verify with `cd traceability-report && sha256sum -c SHA256SUMS` |

The evidence links open each execution (steps, screenshots, trace) in `playwright-report/`, so keep both folders together.

**Options** (environment variables):

- `JIRA_BASE_URL`: e.g. `https://yourcompany.atlassian.net`; turns ticket keys into links.
- `TRACE_EXPECTED_TICKETS`: path to a text file of in-scope ticket keys (one per line, `#` comments). Use this for a release: export the release's tickets from Jira, and any that have no test appear as **NOT TESTED**. Tagged tickets missing from the list are marked "not in scope list".
- `TEST_ENV`: name of the environment under test, recorded in the report.

**Audit evidence:** use CI runs, not local runs. On CI every test keeps a trace and screenshot, and the workflow uploads `test-evidence-<run>-<sha>` (matrix + report) for 90 days, GitHub's maximum. Archive release evidence somewhere permanent. Local reports are marked "Local machine" and flag uncommitted changes.

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

**4. Run and check traceability.**

```bash
npx playwright test --grep @PROJ-123
```

Open `traceability-report/index.html`: PROJ-123 should show with its tests and results.

**5. Heal (when tests break).** After app changes:

> Use the playwright-test-healer agent to fix the failing tests in tests/password-reset/.

The healer replays failures, inspects the page, and updates locators or waits. It's told never to drop Jira tags or
weaken assertions. If the app itself is wrong, it reports a defect instead. **Review its changes.** A "fixed"
test that hides a real bug is a compliance problem.

### Using the skill

You don't need to call it explicitly. Ask normally and Claude applies it:

> Refactor tests/checkout into page objects.
> This test is flaky on CI, find out why.
> Add an accessibility check to the login tests.

To force it: *"Use the playwright-best-practices skill to …"*.

### Tips

- Without agents, you can also just ask: *"Write a Playwright test for PROJ-123 that checks…"*. Claude follows
  `CLAUDE.md` either way.
- Generated code is a draft. You own what gets committed, especially for audit evidence.
- Agent runs use the browser on your machine. Behind the Zscaler proxy, sites load because `ignoreHTTPSErrors`
  is on locally.

### Updating the tooling

- **Agents:** after upgrading `@playwright/test`, run `npx playwright init-agents --loop=claude` to regenerate them,
  then re-check `tests/seed.spec.ts` still has its `@no-jira` tag (regeneration may overwrite it).
- **Skill:** pinned copy; see `.claude/skills/playwright-best-practices/SOURCE.txt` for the source commit. To update,
  re-download from the source repo, review the diff, and replace the folder.
