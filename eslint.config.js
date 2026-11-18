const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "coverage/*", "web-build/*"],
  },
  {
    files: ["**/*.test.ts"],
    languageOptions: {
      globals: globals.jest,
    },
  },
]);
