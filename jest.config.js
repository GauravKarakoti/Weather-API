
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/test/**/*.test.js"],
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  transformIgnorePatterns: [
    // Ignore all node_modules except cheerio and uuid (allows jest to transpile cheerio and uuid)
    "node_modules/(?!(cheerio|uuid)/)",
  ],
  testEnvironmentOptions: {
    // Configure JSDOM to allow external resource loading in tests
    resources: "usable",
    url: "http://localhost:3000",
  },
  // Increase timeout for async operations
  testTimeout: 10000,
  // Setup files to run before each test
  setupFilesAfterEnv: ["<rootDir>/test/setup.js"],
};
