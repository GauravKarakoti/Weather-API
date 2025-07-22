// eslint.config.js (CommonJS version)
const js = require("@eslint/js");

module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      js,
    },
    rules: {
      // you can add your custom ESLint rules here
    },
  },
];
