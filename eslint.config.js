import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['packages/shared/src/simulation/**/*.ts'],
    ignores: ['packages/shared/src/simulation/**/__tests__/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'simulation must stay portable to Node — do not reference window.' },
        { name: 'document', message: 'simulation must stay portable to Node — do not reference document.' },
        { name: 'localStorage', message: 'simulation must stay portable to Node — do not reference localStorage.' },
        { name: 'setTimeout', message: 'simulation must be tick-driven — replace with a countdown field on state or a controller.' },
        { name: 'setInterval', message: 'simulation must be tick-driven — replace with a countdown field on state or a controller.' },
        { name: 'Date', message: 'simulation must be deterministic — read time from state.timeMs, not Date.' },
        { name: 'performance', message: 'simulation must be deterministic — read time from state.timeMs, not performance.now().' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'simulation must be deterministic — use state.rng() instead of Math.random().',
        },
      ],
    },
  }
);
