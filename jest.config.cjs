/** @type {import('jest').Config} */
module.exports = {
  // Define o ambiente de teste para simular o DOM
  testEnvironment: 'jest-environment-jsdom',

  // Usa o babel-jest para transformar arquivos JavaScript, JSX, TypeScript ou TSX
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },

  // Mapeamento para importação de arquivos estáticos (ex.: CSS)
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.cjs',
    // react is not hoisted to the repo root (only @react-agendfy/core installs
    // it), but hoisted deps like lucide-react require it from root
    // node_modules. Pin every import to core's single copy.
    '^react$': '<rootDir>/packages/core/node_modules/react',
    '^react-dom$': '<rootDir>/packages/core/node_modules/react-dom',
    '^react/(.*)$': '<rootDir>/packages/core/node_modules/react/$1',
    '^react-dom/(.*)$': '<rootDir>/packages/core/node_modules/react-dom/$1',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '\\.d\\.ts$', // ignora arquivos de definição de tipo
  ],
  // Arquivo de configuração para testes (ex.: extensão dos matchers do Testing Library)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Padrões para localizar arquivos de teste
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
};
