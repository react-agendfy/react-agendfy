/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.cjs',
    // react is not hoisted to the repo root; reuse the copy installed for
    // @react-agendfy/core so every module (tests + @testing-library/react)
    // resolves the same instance.
    '^react$': '<rootDir>/../core/node_modules/react',
    '^react-dom$': '<rootDir>/../core/node_modules/react-dom',
    '^react/(.*)$': '<rootDir>/../core/node_modules/react/$1',
    '^react-dom/(.*)$': '<rootDir>/../core/node_modules/react-dom/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '\\.d\\.ts$'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
};
