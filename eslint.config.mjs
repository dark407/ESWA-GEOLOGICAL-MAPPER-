import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'release/**/*', '**/*.ts', '**/*.tsx', '**/*.js', '**/*.mjs'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
