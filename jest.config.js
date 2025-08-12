/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.test.js"],
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  transformIgnorePatterns: [
    // Ignore all node_modules except cheerio (allows jest to transpile cheerio)
    "node_modules/(?!(cheerio)/)",
  ],
  testEnvironmentOptions: {
    // Configure JSDOM to allow external resource loading in tests
    resources: "usable",
    url: "http://localhost:3000",
  },
  // Increase timeout for async operations
  testTimeout: 10000,
};
