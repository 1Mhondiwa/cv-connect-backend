const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/', 'coverage/', 'uploads/', 'dist/'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // The backend logs through utils/logger.js exclusively — raw console
      // calls are disallowed everywhere except the logger wrapper itself.
      // This rule encodes the invariant completed in the console-to-logger
      // migration (PRs #15-#22, #25-#29); violations fail lint.
      'no-console': 'error',
      // Pre-existing findings in the codebase, surfaced when this config was
      // introduced. Kept as warnings so they are visible without failing the
      // build — to be tightened as they are fixed.
      'no-useless-escape': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'preserve-caught-error': 'warn',
      'no-useless-assignment': 'warn',
    },
  },
  {
    files: ['utils/logger.js'],
    rules: {
      // logger.js is the sanctioned console wrapper
      'no-console': 'off',
    },
  },
  {
    files: ['tests/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
