// Polyfill TextEncoder and TextDecoder for JSDOM
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for crypto.getRandomValues if needed
if (!global.crypto) {
  global.crypto = {
    getRandomValues: (array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
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
