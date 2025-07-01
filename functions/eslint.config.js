const globals = require("globals");
const js = require("@eslint/js");
const google = require("eslint-config-google");

module.exports = [
  js.configs.recommended,
  google,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-restricted-globals": ["error", "name", "length"],
      "prefer-arrow-callback": "error",
      "quotes": ["error", "double", { "allowTemplateLiterals": true }],
      "require-jsdoc": "off", // Optional: Turn off JSDoc requirement
      "valid-jsdoc": "off",   // Optional: Turn off JSDoc validation
      "new-cap": "off",       // Optional: Allow capital letters for functions (like Express routers)
    },
  },
  {
    files: ["**/*.spec.*"],
    languageOptions: {
      globals: {
        ...globals.mocha,
      },
    },
    rules: {},
  },
];