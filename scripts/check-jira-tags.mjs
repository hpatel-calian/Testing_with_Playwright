// Fails when any test has no Jira ticket tag (CLAUDE.md rule 1). Run: npm run check:tags
import { execFileSync } from 'node:child_process';

const untagged = '@[A-Z][A-Z0-9]+-[0-9]+|@no-jira';
const out = execFileSync('npx', ['playwright', 'test', '--list', '--grep-invert', untagged, '--pass-with-no-tests'], {
  encoding: 'utf8',
});
// Dependency projects (the 'setup' sign-in) are always listed alongside matches, so ignore them.
const tests = out.split('\n').filter((line) => line.includes(' › ') && !line.includes('[setup]'));

if (tests.length > 0) {
  console.error(`✗ ${tests.length} test(s) have no Jira ticket tag. Put them inside the ticket's tagged test.describe:\n`);
  console.error(tests.map((t) => `  ${t.trim()}`).join('\n'));
  process.exit(1);
}
console.log('✓ Every test is tagged with a Jira ticket.');
