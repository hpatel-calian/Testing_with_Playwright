// Lint rules from the playwright-best-practices skill, enforced automatically (npm run lint, CI, Claude hook).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
  { ignores: ['node_modules/', 'playwright-report/', 'test-results/', 'playwright/', '.claude/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // A missing await on an action or assertion is the most common Playwright bug.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/missing-playwright-await': 'error',
      'playwright/no-wait-for-timeout': 'error', // CLAUDE.md rule 4
      'playwright/no-focused-test': 'error', // no test.only
      'playwright/no-page-pause': 'error',
      'playwright/no-element-handle': 'error',
      'playwright/no-eval': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-networkidle': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
      'playwright/valid-title': 'error',
      // Specs use page objects, not raw selectors (CLAUDE.md rule 7). Page objects may use CSS.
      'playwright/no-raw-locators': 'error',
      // Specs import test/expect from fixtures/ (CLAUDE.md rule 7).
      'no-restricted-imports': [
        'error',
        { paths: [{ name: '@playwright/test', message: "Import test/expect from 'fixtures/' instead." }] },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
  {
    // The setup file signs in before fixtures exist, so it imports @playwright/test directly.
    files: ['tests/auth.setup.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
