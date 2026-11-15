// ESLint flat config for the template registry package.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'electron-react-ts/**',
      'tauri-react-ts/**',
      'renderers/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
