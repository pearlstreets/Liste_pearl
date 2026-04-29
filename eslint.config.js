// Flat config for ESLint v9 — replaces .eslintrc.js
// eslint-config-expo v55 ships a flat preset at `eslint-config-expo/flat`.
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');
const globals = require('globals');

module.exports = [
  ...expoConfig,
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // Test files / setup — bring in Jest globals (describe / it / expect / jest).
  {
    files: [
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
      '**/*.test.{js,jsx,ts,tsx}',
      'jest.setup.js',
    ],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
  },
  // Data JSON imports / catalog files — relax dupe-key warnings; data may legitimately
  // hold near-duplicate keys for spell-check fallbacks.
  {
    files: ['data/**/*.json', 'utils/spellcheck.js'],
    rules: { 'no-dupe-keys': 'warn' },
  },
  prettierConfig,
  {
    ignores: [
      'node_modules/',
      '.expo/',
      'dist/',
      'ios/',
      'android/',
      'coverage/',
      'eslint.config.js',
      'babel.config.js',
      'metro.config.js',
      'data/**/*.json',
      'locales/**/*.json',
      '**/*.json',
    ],
  },
];
