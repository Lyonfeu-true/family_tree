import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Clean Architecture boundaries are enforced here, not just documented.
 * Allowed direction:  app -> presentation/infrastructure -> application -> domain -> (nothing)
 * `shared` is a leaf that every layer may use. See docs/ARCHITECTURE.md.
 */
const LAYERS = ['domain', 'application', 'infrastructure', 'presentation', 'app'];

const FORBIDDEN_LAYERS = {
  shared: ['domain', 'application', 'infrastructure', 'presentation', 'app'],
  domain: ['application', 'infrastructure', 'presentation', 'app'],
  application: ['infrastructure', 'presentation', 'app'],
  infrastructure: ['presentation', 'app'],
  presentation: ['infrastructure', 'app'],
};

const UI_LIBS = ['react', 'react/*', 'react-dom', 'react-dom/*', '@xyflow/*', 'zustand'];
const PLATFORM_LIBS = ['idb', 'hash-wasm', '@zxcvbn-ts/*'];

const FORBIDDEN_LIBS = {
  shared: [...UI_LIBS, ...PLATFORM_LIBS],
  domain: [...UI_LIBS, ...PLATFORM_LIBS],
  application: [...UI_LIBS, ...PLATFORM_LIBS],
  infrastructure: UI_LIBS,
  presentation: PLATFORM_LIBS,
};

const layerImportRules = Object.keys(FORBIDDEN_LAYERS).map((layer) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          ...FORBIDDEN_LAYERS[layer].map((forbidden) => ({
            group: [`@${forbidden}/*`, `**/${forbidden}/**`],
            message: `The ${layer} layer must not import from ${forbidden}. See docs/ARCHITECTURE.md.`,
          })),
          {
            group: FORBIDDEN_LIBS[layer],
            message: `The ${layer} layer must not depend on this library. See docs/ARCHITECTURE.md.`,
          },
        ],
      },
    ],
  },
}));

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'eslint.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],

      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // Security rules (docs/SECURITY.md, threat A4 and key handling)
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Use the encrypted persistence layer. Never store secrets here.' },
        { name: 'sessionStorage', message: 'Use the encrypted persistence layer. Never store secrets here.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use crypto.getRandomValues / crypto.randomUUID.' },
        { object: 'window', property: 'localStorage', message: 'Use the encrypted persistence layer.' },
        { object: 'window', property: 'sessionStorage', message: 'Use the encrypted persistence layer.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Rendering HTML is forbidden (XSS). Render data as text.',
        },
        {
          selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]",
          message: 'Assigning HTML is forbidden (XSS). Use textContent or React.',
        },
        {
          selector: "CallExpression[callee.property.name=/^(insertAdjacentHTML|write)$/]",
          message: 'Writing HTML is forbidden (XSS).',
        },
      ],
    },
  },
  ...layerImportRules,
  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  prettier,
);

export { LAYERS };
