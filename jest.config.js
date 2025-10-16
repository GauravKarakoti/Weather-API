/** @type {import('jest').Config} */
     module.exports = {
       testEnvironment: 'jsdom',  // Enables browser APIs like TextEncoder
       setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],  // If exists
       transform: {
         '^.+\\.js$': 'babel-jest',  // For ES6+
       },
       moduleNameMapper: {
         '\\.(css|less|scss|sass)$': 'identity-obj-proxy',  // Mock styles if needed
       },
       testMatch: ['**/test/**/*.test.js'],  // Match test files
     };
     