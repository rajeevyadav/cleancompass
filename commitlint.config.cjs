// Commit-message validation — GOVERNANCE.md §4.
// Conventional Commits with a required, meaningful body. The body must explain
// reasoning and risk, not just "what". "WIP"/"misc"/"update" are rejected.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'docs', 'refactor', 'perf', 'test', 'build', 'ci', 'revert'],
    ],
    'scope-empty': [2, 'never'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
    'body-empty': [2, 'never'],
    'body-leading-blank': [2, 'always'],
    'body-min-length': [2, 'always', 20],
    'footer-leading-blank': [2, 'always'],
  },
};
