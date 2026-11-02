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
