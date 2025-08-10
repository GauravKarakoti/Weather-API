/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.test.js"],
  transform: {
    "^.+\\.js$": "babel-jest",
  },
};
