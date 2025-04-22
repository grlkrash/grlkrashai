module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test|integration).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      diagnostics: false
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^../../src/services/analytics/SpotifyAnalyticsService$': '<rootDir>/test/__mocks__/SpotifyAnalyticsService.ts',
    '^../../src/services/analytics/TokenAnalyticsService$': '<rootDir>/test/__mocks__/TokenAnalyticsService.ts'
  },
  testTimeout: 30000,
  maxWorkers: '50%',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/dist/',
    '/.next/'
  ],
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts']
};
