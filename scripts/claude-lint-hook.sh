#!/usr/bin/env bash
# Claude Code PostToolUse hook (.claude/settings.json): after Claude or an agent edits a TypeScript file, lint it
# (and, for tests, check Jira tags). On failure, exit 2 so the errors go back to Claude to fix.
export PATH="$HOME/.local/node/bin:$PATH"
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0

file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const i=JSON.parse(s).tool_input||{};const f=i.file_path||i.fileName||"";process.stdout.write(f&&!f.startsWith("/")?require("path").resolve(f):f)}catch{}})')
case "$file" in
  *.ts) ;;
  *) exit 0 ;;
esac
case "$file" in
  */node_modules/*|*/playwright-report/*|*/test-results/*) exit 0 ;;
esac
[ -f "$file" ] || exit 0

if ! out=$(npx eslint "$file" 2>&1); then
  echo "ESLint (playwright-best-practices rules) failed for $file. Fix these before continuing:" >&2
  echo "$out" >&2
  exit 2
fi

case "$file" in
  */tests/*)
    if ! out=$(node scripts/check-jira-tags.mjs 2>&1); then
      echo "$out" >&2
      exit 2
    fi ;;
esac
exit 0
