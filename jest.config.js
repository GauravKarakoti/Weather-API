/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom", // Use jsdom environment for all tests
  setupFilesAfterEnv: ["./jest.setup.js"],
  transform: {
    "^.+\\.jsx?$": "babel-jest",
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
