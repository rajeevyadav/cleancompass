// ESLint flat config. Enforces GOVERNANCE.md §7 forbidden identifiers via
// id-denylist, in addition to the standard recommended rules.
const js = require('@eslint/js');
const globals = require('globals');

const forbiddenIdentifiers = [
  'data',
  'result',
  'temp',
  'helper',
  'util',
  'foo',
  'bar',
  'processData',
  'handleRequest',
  'getSomething',
];

module.exports = [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'id-denylist': ['error', ...forbiddenIdentifiers],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/renderer/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser },
    },
  },
];
