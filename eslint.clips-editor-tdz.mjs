import tseslint from 'typescript-eslint'

/**
 * CI guard: TDZ / use-before-define in EditorShell (SSR). Expand glob as legacy violations are cleared.
 */
export default tseslint.config({
  files: ['new-app/components/clips/editor/editor-shell.tsx'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  rules: {
    'no-use-before-define': ['error', { variables: true, functions: false, classes: true }],
  },
})
