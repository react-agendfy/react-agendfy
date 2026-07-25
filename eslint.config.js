import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// typescript-eslint is loaded optionally so that JS/JSX linting keeps working
// even when the dependency has not been installed yet. Run
// `yarn add -D typescript-eslint` to enable the TS/TSX linting block below.
let tseslint = null
try {
  tseslint = (await import('typescript-eslint')).default
} catch {
  tseslint = null
}

export default [
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.yarn/**'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Node-context tooling files (jest setup/config, build configs). Declared
    // after the browser js/jsx block so its Node globals win the merge.
    files: [
      '**/*.config.{js,cjs,mjs}',
      '**/jest.config.{js,cjs}',
      '**/jest.setup.{js,cjs}',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
  ...(tseslint
    ? tseslint.config({
        files: ['**/*.{ts,tsx}'],
        extends: [...tseslint.configs.recommended],
        languageOptions: {
          ecmaVersion: 2020,
          globals: globals.browser,
          parserOptions: {
            ecmaVersion: 'latest',
            ecmaFeatures: { jsx: true },
            sourceType: 'module',
          },
        },
        settings: { react: { version: '18.3' } },
        plugins: {
          react,
          'react-hooks': reactHooks,
          'react-refresh': reactRefresh,
        },
        rules: {
          ...react.configs.recommended.rules,
          ...react.configs['jsx-runtime'].rules,
          ...reactHooks.configs.recommended.rules,
          'react/jsx-no-target-blank': 'off',
          'react-refresh/only-export-components': [
            'warn',
            { allowConstantExport: true },
          ],
        },
      })
    : []),
]
