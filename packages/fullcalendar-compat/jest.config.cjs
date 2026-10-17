/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: '../../babel.config.cjs' }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.cjs',
    // Test against core's sources (no build step needed).
    '^@react-agendfy/core$': '<rootDir>/../core/src/index.tsx',
    '^react$': '<rootDir>/../core/node_modules/react',
    '^react-dom$': '<rootDir>/../core/node_modules/react-dom',
    '^react/(.*)$': '<rootDir>/../core/node_modules/react/$1',
    '^react-dom/(.*)$': '<rootDir>/../core/node_modules/react-dom/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '\\.d\\.ts$'],
  setupFilesAfterEnv: ['<rootDir>/../../jest.setup.js'],
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
};
