module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo|expo-.*|@expo|@expo/.*|react-native-.*)',
  ],
  collectCoverageFrom: [
    'utils/**/*.js',
    'services/**/*.js',
    'lib/**/*.js',
    'components/**/*.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      // Baseline reflects current coverage (security + spellcheck only).
      // Raise these as more services/utils get tests — they act as a ratchet
      // so coverage can't silently regress.
      statements: 3,
      branches: 2,
      functions: 4,
      lines: 3,
    },
  },
};
