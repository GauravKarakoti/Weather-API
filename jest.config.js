/** @type {import('jest').Config} */
module.exports = {
  // Use jsdom so browser-like globals are available to tests
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/test/**/*.test.js"],
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  transformIgnorePatterns: [
    // Ignore all node_modules except cheerio and uuid (allows jest to transpile them)
    "node_modules/(?!(cheerio|uuid)/)",
  ],
  // Ensure setup file runs before tests to define TextEncoder/TextDecoder and mocks
  setupFiles: ["<rootDir>/jest.setup.js"],
  testEnvironmentOptions: {
    // Configure JSDOM to allow external resource loading in tests
    resources: "usable",
    url: "http://localhost:3000",
  },
  // Increase timeout for async operations
  testTimeout: 10000,
};
