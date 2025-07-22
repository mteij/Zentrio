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
      "quotes": ["error", "double", {"allowTemplateLiterals": true}],
      "require-jsdoc": "off",
      "valid-jsdoc": "off",
      "new-cap": "off",
      "max-len": ["error", {"code": 80}],
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
