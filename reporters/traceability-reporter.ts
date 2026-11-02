/**
 * Traceability reporter: groups Playwright results by Jira ticket and writes a
 * requirements traceability matrix (HTML + JSON + Markdown) with run metadata
 * and SHA-256 checksums, so a run can serve as test evidence.
 *
 * Link a test to Jira tickets with tags (on the test or any enclosing describe):
 *   test('reset password', { tag: ['@PROJ-123', '@regression'] }, async ({ page }) => { ... });
 * or with an annotation:
 *   test('reset password', { annotation: { type: 'jira', description: 'PROJ-123' } }, ...);
 */
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
} from '@playwright/test/reporter';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface TraceabilityOptions {
  /** Where the matrix is written. Default: `traceability-report`. */
  outputFolder?: string;
  /** e.g. `https://yourcompany.atlassian.net`. Default: env `JIRA_BASE_URL`. */
  jiraBaseUrl?: string;
  /** Path from the output folder to Playwright's HTML report, for evidence links. */
  htmlReportPath?: string;
  /**
   * Text file of ticket keys in scope (one per line, `#` comments allowed), e.g. exported
   * from a Jira release filter. Tickets listed but not covered are reported as NOT TESTED.
   * Default: env `TRACE_EXPECTED_TICKETS`.
   */
  expectedTicketsFile?: string;
  /** Fail the run if any test has no Jira ticket. Default: true on CI. */
  failOnUntagged?: boolean;
  /** Regex (source) for a ticket key. Default: `[A-Z][A-Z0-9]+-\d+`. */
  ticketPattern?: string;
  /** Tag that marks a test as deliberately not linked to Jira (e.g. agent seed files). Default: `@no-jira`. */
  exemptTag?: string;
}

type Outcome = 'passed' | 'failed' | 'flaky' | 'skipped';
type TicketStatus = Outcome | 'not-tested';

interface Evidence {
  name: string;
  contentType: string;
  file?: string;
  sha256?: string;
}

interface Execution {
  project: string;
  testId: string;
  outcome: Outcome;
  attempts: number;
  durationMs: number;
  startTime?: string;
  error?: string;
  evidence: Evidence[];
}

interface TestRow {
  title: string;
  file: string;
  line: number;
  tickets: string[];
  tags: string[];
  executions: Execution[];
}

interface TicketRow {
  key: string;
  url?: string;
  status: TicketStatus;
  inScope: boolean | null;
  tests: TestRow[];
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  passed: 'PASSED',
  failed: 'FAILED',
  flaky: 'FLAKY',
  skipped: 'SKIPPED',
  'not-tested': 'NOT TESTED',
};

export default class TraceabilityReporter implements Reporter {
  private readonly opts: Required<Omit<TraceabilityOptions, 'jiraBaseUrl' | 'expectedTicketsFile'>> &
    Pick<TraceabilityOptions, 'jiraBaseUrl' | 'expectedTicketsFile'>;
  private config!: FullConfig;
  private baseDir = process.cwd();
  private root!: Suite;
  private readonly startedAt = new Date();

  constructor(options: TraceabilityOptions = {}) {
    this.opts = {
      outputFolder: options.outputFolder ?? 'traceability-report',
      jiraBaseUrl: (options.jiraBaseUrl ?? process.env.JIRA_BASE_URL)?.replace(/\/+$/, ''),
      htmlReportPath: options.htmlReportPath ?? '../playwright-report/index.html',
      expectedTicketsFile: options.expectedTicketsFile ?? process.env.TRACE_EXPECTED_TICKETS,
      failOnUntagged: options.failOnUntagged ?? !!process.env.CI,
      ticketPattern: options.ticketPattern ?? '[A-Z][A-Z0-9]+-\\d+',
      exemptTag: options.exemptTag ?? '@no-jira',
    };
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.baseDir = config.configFile ? path.dirname(config.configFile) : process.cwd();
    this.root = suite;
  }

  async onEnd(result: FullResult): Promise<{ status?: FullResult['status'] } | void> {
    const tests = this.collectTests();
    const expected = this.readExpectedTickets();
    const tickets = this.groupByTicket(tests, expected);
    const isExempt = (t: TestRow) => t.tags.includes(this.opts.exemptTag);
    const exempt = tests.filter((t) => t.tickets.length === 0 && isExempt(t));
    const untagged = tests.filter((t) => t.tickets.length === 0 && !isExempt(t));
    const projects = [...new Set(tests.flatMap((t) => t.executions.map((e) => e.project)))];
    const gateFailed = this.opts.failOnUntagged && untagged.length > 0;
    const run = this.runMetadata(result);
    if (gateFailed) run.status = 'failed';

    const report = {
      schemaVersion: 1,
      run,
      untaggedGateFailed: gateFailed,
      summary: {
        tickets: tickets.length,
        passed: tickets.filter((t) => t.status === 'passed').length,
        failed: tickets.filter((t) => t.status === 'failed').length,
        flaky: tickets.filter((t) => t.status === 'flaky').length,
        skipped: tickets.filter((t) => t.status === 'skipped').length,
        notTested: tickets.filter((t) => t.status === 'not-tested').length,
        tests: tests.length,
        untaggedTests: untagged.length,
        exemptTests: exempt.length,
      },
      projects,
      tickets,
      untaggedTests: untagged,
      exemptTests: exempt,
    };

    const outDir = path.resolve(this.baseDir, this.opts.outputFolder);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    const markdown = renderMarkdown(report);
    const files: Record<string, string> = {
      'traceability.json': JSON.stringify(report, null, 2),
      'traceability.md': markdown,
      'index.html': renderHtml(report, this.opts.htmlReportPath),
    };
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(outDir, name), content);
    }
    const sums = Object.entries(files)
      .map(([name, content]) => `${sha256(content)}  ${name}`)
      .join('\n');
    fs.writeFileSync(path.join(outDir, 'SHA256SUMS'), sums + '\n');

    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
    }

    const rel = path.relative(process.cwd(), outDir) || '.';
    console.log(
      `\nTraceability: ${report.summary.tickets} ticket(s) — ${report.summary.passed} passed, ` +
        `${report.summary.failed} failed, ${report.summary.flaky} flaky, ${report.summary.notTested} not tested. ` +
        `Report: ${rel}/index.html`,
    );

    if (untagged.length > 0) {
      console.log(`Traceability: ${untagged.length} test(s) have no Jira ticket:`);
      for (const t of untagged) console.log(`  - ${t.file}:${t.line} › ${t.title}`);
      if (gateFailed) {
        console.log('Traceability: failing the run because failOnUntagged is enabled.');
        return { status: 'failed' };
      }
    }
  }

  private collectTests(): TestRow[] {
    const rows = new Map<string, TestRow>();
    for (const test of this.root.allTests()) {
      const file = path.relative(this.baseDir, test.location.file).split(path.sep).join('/');
      const title = test.titlePath().slice(3).join(' › ');
      const key = `${file}:${test.location.line}:${title}`;
      let row = rows.get(key);
      if (!row) {
        row = {
          title,
          file,
          line: test.location.line,
          tickets: this.ticketsFor(test),
          tags: test.tags,
          executions: [],
        };
        rows.set(key, row);
      }
      row.executions.push(toExecution(test));
    }
    return [...rows.values()];
  }

  private ticketsFor(test: TestCase): string[] {
    const exact = new RegExp(`^@?(${this.opts.ticketPattern})$`);
    const anywhere = new RegExp(this.opts.ticketPattern, 'g');
    const keys = new Set<string>();
    for (const tag of test.tags) {
      const m = tag.match(exact);
      if (m) keys.add(m[1]);
    }
    for (const a of test.annotations) {
      if (a.type.toLowerCase() === 'jira' && a.description) {
        for (const m of a.description.matchAll(anywhere)) keys.add(m[0]);
      }
    }
    return [...keys].sort(compareKeys);
  }

  private readExpectedTickets(): Set<string> | null {
    const file = this.opts.expectedTicketsFile;
    if (!file) return null;
    const resolved = path.resolve(this.baseDir, file);
    if (!fs.existsSync(resolved)) {
      console.warn(`Traceability: expected tickets file not found: ${resolved}`);
      return null;
    }
    const keys = fs
      .readFileSync(resolved, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean);
    return new Set(keys);
  }

  private groupByTicket(tests: TestRow[], expected: Set<string> | null): TicketRow[] {
    const byKey = new Map<string, TestRow[]>();
    for (const t of tests) for (const k of t.tickets) byKey.set(k, [...(byKey.get(k) ?? []), t]);
    for (const k of expected ?? []) if (!byKey.has(k)) byKey.set(k, []);

    return [...byKey.entries()]
      .sort(([a], [b]) => compareKeys(a, b))
      .map(([key, rows]) => ({
        key,
        url: this.opts.jiraBaseUrl ? `${this.opts.jiraBaseUrl}/browse/${key}` : undefined,
        status: rollUp(rows.flatMap((r) => r.executions.map((e) => e.outcome))),
        inScope: expected ? expected.has(key) : null,
        tests: rows,
      }));
  }

  runMetadata(result: FullResult) {
    const env = process.env;
    const git = (cmd: string) => {
      try {
        return execSync(`git ${cmd}`, { cwd: this.baseDir, stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim();
      } catch {
        return undefined;
      }
    };
    const runUrl =
      env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
        ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
        : undefined;
    return {
      status: result.status as FullResult['status'],
      startedAt: this.startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      commit: env.GITHUB_SHA ?? git('rev-parse HEAD'),
      branch: env.GITHUB_REF_NAME ?? git('rev-parse --abbrev-ref HEAD'),
      uncommittedChanges: env.GITHUB_SHA ? false : !!git('status --porcelain'),
      ci: !!env.CI,
      runUrl,
      triggeredBy: env.GITHUB_ACTOR ?? safeUsername(),
      host: env.CI ? undefined : os.hostname(),
      playwrightVersion: this.config.version,
      environment: env.TEST_ENV ?? undefined,
    };
  }
}

function toExecution(test: TestCase): Execution {
  const results = test.results;
  const last = results[results.length - 1];
  const outcomeMap = { expected: 'passed', unexpected: 'failed', flaky: 'flaky', skipped: 'skipped' } as const;
  const error = last?.errors[0]?.message ?? last?.error?.message;
  return {
    project: test.parent.project()?.name ?? 'default',
    testId: test.id,
    outcome: outcomeMap[test.outcome()],
    attempts: results.length,
    durationMs: results.reduce((sum, r) => sum + r.duration, 0),
    startTime: results[0]?.startTime.toISOString(),
    error: error ? stripAnsi(error).split('\n')[0].slice(0, 500) : undefined,
    evidence: results.flatMap((r) =>
      r.attachments.map((a) => ({
        name: a.name,
        contentType: a.contentType,
        file: a.path ? path.basename(a.path) : undefined,
        sha256: a.path && fs.existsSync(a.path) ? sha256(fs.readFileSync(a.path)) : a.body ? sha256(a.body) : undefined,
      })),
    ),
  };
}

function rollUp(outcomes: Outcome[]): TicketStatus {
  if (outcomes.length === 0) return 'not-tested';
  if (outcomes.includes('failed')) return 'failed';
  if (outcomes.includes('flaky')) return 'flaky';
  if (outcomes.every((o) => o === 'skipped')) return 'skipped';
  return 'passed';
}

function compareKeys(a: string, b: string): number {
  const [pa, na] = a.split(/-(?=\d+$)/);
  const [pb, nb] = b.split(/-(?=\d+$)/);
  return pa === pb ? Number(na) - Number(nb) : pa.localeCompare(pb);
}

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;]*m/g, '');
}

function safeUsername(): string | undefined {
  try {
    return os.userInfo().username;
  } catch {
    return undefined;
  }
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

type Report = {
  run: ReturnType<TraceabilityReporter['runMetadata']>;
  summary: Record<string, number>;
  projects: string[];
  tickets: TicketRow[];
  untaggedTests: TestRow[];
  exemptTests: TestRow[];
};

const ICON: Record<Outcome, string> = { passed: '✅', failed: '❌', flaky: '⚠️', skipped: '⏭️' };

function renderMarkdown(r: Report): string {
  const s = r.summary;
  const lines = [
    '## Jira traceability matrix',
    '',
    `**Run:** ${r.run.status.toUpperCase()} · commit \`${(r.run.commit ?? 'unknown').slice(0, 12)}\` · ${r.run.finishedAt}` +
      (r.run.runUrl ? ` · [CI run](${r.run.runUrl})` : ''),
    '',
    `**Tickets:** ${s.tickets} · ✅ ${s.passed} passed · ❌ ${s.failed} failed · ⚠️ ${s.flaky} flaky · ⛔ ${s.notTested} not tested · untagged tests: ${s.untaggedTests}`,
    '',
    `| Jira | Status | Test case | ${r.projects.join(' | ')} |`,
    `|---|---|---|${r.projects.map(() => '---').join('|')}|`,
  ];
  for (const t of r.tickets) {
    const key = t.url ? `[${t.key}](${t.url})` : t.key;
    if (t.tests.length === 0) {
      lines.push(`| ${key} | ⛔ NOT TESTED | — | ${r.projects.map(() => '').join(' | ')} |`);
      continue;
    }
    t.tests.forEach((test, i) => {
      const cells = r.projects.map((p) => {
        const e = test.executions.find((x) => x.project === p);
        return e ? ICON[e.outcome] : '—';
      });
      lines.push(
        `| ${i === 0 ? key : ''} | ${i === 0 ? STATUS_LABEL[t.status] : ''} | ${test.title.replace(/\|/g, '\\|')} | ${cells.join(' | ')} |`,
      );
    });
  }
  if (r.untaggedTests.length) {
    lines.push('', '**Tests without a Jira ticket:**', '');
    for (const t of r.untaggedTests) lines.push(`- \`${t.file}:${t.line}\` ${t.title}`);
  }
  return lines.join('\n') + '\n';
}

function renderHtml(r: Report, htmlReportPath: string): string {
  const s = r.summary;
  const run = r.run;
  const evidenceLink = (e: Execution) =>
    `<a href="${esc(htmlReportPath)}#?testId=${encodeURIComponent(e.testId)}" title="Open in Playwright report">${esc(
      e.project,
    )}</a>`;

  const rows = r.tickets
    .map((t) => {
      const keyCell = t.url ? `<a href="${esc(t.url)}">${esc(t.key)}</a>` : esc(t.key);
      const scope = t.inScope === false ? ' <span class="note">not in scope list</span>' : '';
      const badge = `<span class="badge ${t.status}">${STATUS_LABEL[t.status]}</span>`;
      if (t.tests.length === 0) {
        return `<tr class="${t.status}"><td class="key">${keyCell}${scope}</td><td>${badge}</td><td colspan="${
          r.projects.length + 2
        }" class="muted">No test is tagged with this ticket.</td></tr>`;
      }
      return t.tests
        .map((test, i) => {
          const head =
            i === 0
              ? `<td class="key" rowspan="${t.tests.length}">${keyCell}${scope}</td><td rowspan="${t.tests.length}">${badge}</td>`
              : '';
          const cells = r.projects
            .map((p) => {
              const e = test.executions.find((x) => x.project === p);
              if (!e) return '<td class="muted">—</td>';
              const tip = [
                `${e.outcome}`,
                `${(e.durationMs / 1000).toFixed(1)}s`,
                e.attempts > 1 ? `${e.attempts} attempts` : '',
                e.error ?? '',
              ]
                .filter(Boolean)
                .join(' · ');
              return `<td class="cell ${e.outcome}" title="${esc(tip)}">${ICON[e.outcome]}</td>`;
            })
            .join('');
          const evidence = test.executions.map(evidenceLink).join(' · ');
          return `<tr class="${t.status}">${head}<td><div>${esc(test.title)}</div><div class="loc">${esc(
            test.file,
          )}:${test.line}</div></td>${cells}<td class="ev">${evidence}</td></tr>`;
        })
        .join('');
    })
    .join('');

  const untagged = r.untaggedTests.length
    ? `<section><h2>Tests without a Jira ticket (${r.untaggedTests.length})</h2><ul>${r.untaggedTests
        .map((t) => `<li><code>${esc(t.file)}:${t.line}</code> ${esc(t.title)}</li>`)
        .join('')}</ul></section>`
    : '';
  const exemptList = r.exemptTests.length
    ? `<section><h2>Exempt from Jira linking (${r.exemptTests.length})</h2><ul>${r.exemptTests
        .map((t) => `<li><code>${esc(t.file)}:${t.line}</code> ${esc(t.title)}</li>`)
        .join('')}</ul></section>`
    : '';

  const meta: [string, string | undefined][] = [
    ['Run result', run.status.toUpperCase()],
    ['Started', run.startedAt],
    ['Finished', run.finishedAt],
    ['Commit', run.commit],
    ['Branch', run.branch],
    ['Uncommitted changes', run.uncommittedChanges ? 'YES — local changes not in the commit' : 'No'],
    ['Executed on', run.ci ? 'CI' : `Local machine${run.host ? ` (${run.host})` : ''}`],
    ['Triggered by', run.triggeredBy],
    ['Environment', run.environment],
    ['Playwright', run.playwrightVersion],
  ];
  const metaRows =
    meta
      .filter(([, v]) => v)
      .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
      .join('') +
    (run.runUrl ? `<tr><th>CI run</th><td><a href="${esc(run.runUrl)}">${esc(run.runUrl)}</a></td></tr>` : '');

  const card = (label: string, value: number, cls: string) =>
    `<div class="card ${cls}"><div class="n">${value}</div><div class="l">${label}</div></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jira Traceability Matrix</title>
<style>
:root { --bg:#f7f8fa; --fg:#1d2330; --muted:#6b7280; --card:#fff; --line:#e3e6eb;
  --pass:#1a7f37; --fail:#cf222e; --flaky:#9a6700; --skip:#6b7280; --nt:#8250df; }
@media (prefers-color-scheme: dark) { :root { --bg:#0f1218; --fg:#e6e9ef; --muted:#9aa3b2; --card:#171b23;
  --line:#2a303c; --pass:#3fb950; --fail:#f85149; --flaky:#d29922; --skip:#8b949e; --nt:#a371f7; } }
* { box-sizing:border-box; }
body { margin:0; padding:24px 16px 48px; background:var(--bg); color:var(--fg);
  font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
main { max-width:1200px; margin:0 auto; }
h1 { font-size:22px; margin:0 0 4px; } h2 { font-size:16px; margin:28px 0 10px; }
a { color:inherit; } .muted,.loc,.note { color:var(--muted); } .loc { font-size:12px; font-family:ui-monospace,monospace; }
.note { font-size:11px; display:block; }
.cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; margin:18px 0; }
.card { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:12px; }
.card .n { font-size:24px; font-weight:600; } .card .l { color:var(--muted); font-size:12px; }
.card.passed .n{color:var(--pass)} .card.failed .n{color:var(--fail)} .card.flaky .n{color:var(--flaky)} .card.not-tested .n{color:var(--nt)}
.wrap { overflow-x:auto; background:var(--card); border:1px solid var(--line); border-radius:8px; }
table { border-collapse:collapse; width:100%; }
th,td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
thead th { font-size:12px; color:var(--muted); font-weight:600; white-space:nowrap; }
td.cell { text-align:center; } td.key { font-weight:600; white-space:nowrap; } td.ev { font-size:12px; white-space:nowrap; }
.badge { font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; border:1px solid currentColor; white-space:nowrap; }
.badge.passed{color:var(--pass)} .badge.failed{color:var(--fail)} .badge.flaky{color:var(--flaky)} .badge.skipped{color:var(--skip)} .badge.not-tested{color:var(--nt)}
.meta th { width:180px; color:var(--muted); font-weight:500; }
footer { margin-top:28px; color:var(--muted); font-size:12px; }
</style>
</head>
<body><main>
<h1>Jira Traceability Matrix</h1>
<div class="muted">Generated ${esc(run.finishedAt)} · commit ${esc((run.commit ?? 'unknown').slice(0, 12))}</div>
<div class="cards">
${card('Tickets', s.tickets, '')}${card('Passed', s.passed, 'passed')}${card('Failed', s.failed, 'failed')}${card(
    'Flaky',
    s.flaky,
    'flaky',
  )}${card('Not tested', s.notTested, 'not-tested')}${card('Untagged tests', s.untaggedTests, '')}
</div>
<h2>Matrix</h2>
<div class="wrap"><table>
<thead><tr><th>Jira</th><th>Status</th><th>Test case</th>${r.projects
    .map((p) => `<th>${esc(p)}</th>`)
    .join('')}<th>Evidence</th></tr></thead>
<tbody>${rows || `<tr><td colspan="${r.projects.length + 4}" class="muted">No tickets found.</td></tr>`}</tbody>
</table></div>
${untagged}
${exemptList}
<h2>Run details</h2>
<div class="wrap"><table class="meta"><tbody>${metaRows}</tbody></table></div>
<footer>Evidence links open each execution (steps, screenshots, trace) in the Playwright HTML report, which must sit at
<code>${esc(htmlReportPath)}</code> relative to this page. File integrity: <code>sha256sum -c SHA256SUMS</code>.
Evidence file hashes are recorded in <code>traceability.json</code>.</footer>
</main></body></html>
`;
}
