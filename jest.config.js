module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/backup/', '/scripts/archive/'],
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
      // Baseline ratchet — reflects current coverage so regressions fail CI.
      // Raise these as more services/utils get tests.
      statements: 14,
      branches: 10,
      functions: 9,
      lines: 14,
    },
  },
};
