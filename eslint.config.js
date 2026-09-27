const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  globalIgnores(['dist/*', 'node_modules/*', 'tierx-scaffold/**']),
  expoConfig,
  {
    files: ['*.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
]);