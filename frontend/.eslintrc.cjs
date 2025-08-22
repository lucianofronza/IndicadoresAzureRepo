module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2020: true,
    node: true,
    es6: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['react-refresh', '@typescript-eslint', 'react'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'no-unused-vars': 'off', // Turn off base rule
    '@typescript-eslint/no-unused-vars': 'off', // Turn off to reduce noise
    '@typescript-eslint/no-explicit-any': 'off', // Turn off to reduce noise
    'no-undef': 'off', // Turn off to reduce noise
    'react-hooks/exhaustive-deps': 'off', // Turn off to reduce noise
    'react/prop-types': 'off', // Turn off prop-types for TypeScript
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
}
