// Polyfill TextEncoder and TextDecoder for JSDOM
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for crypto.getRandomValues
const nodeCrypto = require('crypto');

if (!global.crypto) {
  // If global.crypto doesn't exist at all, create it.
  // We can assign the whole webcrypto interface for broader compatibility.
  global.crypto = nodeCrypto.webcrypto;
} else if (!global.crypto.getRandomValues) {
  // If global.crypto *does* exist but is missing getRandomValues (common in JSDOM),
  // add the *secure* Node.js implementation.
  global.crypto.getRandomValues = (array) => {
    return nodeCrypto.randomFillSync(array);
  };
}

// Polyfill for URL if needed
if (!global.URL) {
  global.URL = require('url').URL;
}

// Polyfill for AbortController if needed
if (!global.AbortController) {
  global.AbortController = require('abort-controller');
}