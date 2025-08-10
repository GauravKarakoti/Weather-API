// jest.setup.js
const { TextEncoder, TextDecoder } = require("util");

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock axios for tests to prevent external API calls
jest.mock("axios", () => ({
  get: jest.fn((url) => {
    if (url.includes("api.openweathermap.org")) {
      // Mock OpenWeatherMap API response
      return Promise.resolve({
        data: {
          list: [
            {
              dt_txt: "2024-01-15 12:00:00",
              main: {
                temp: 22,
                temp_min: 18,
                temp_max: 25,
                humidity: 65,
                pressure: 1013,
              },
              weather: [{ main: "Partly Cloudy" }],
            },
            {
              dt_txt: "2024-01-15 15:00:00",
              main: {
                temp: 24,
                temp_min: 20,
                temp_max: 27,
                humidity: 60,
                pressure: 1012,
              },
              weather: [{ main: "Sunny" }],
            },
            {
              dt_txt: "2024-01-15 18:00:00",
              main: {
                temp: 20,
                temp_min: 17,
                temp_max: 23,
                humidity: 70,
                pressure: 1014,
              },
              weather: [{ main: "Clear" }],
            },
            {
              dt_txt: "2024-01-15 21:00:00",
              main: {
                temp: 18,
                temp_min: 15,
                temp_max: 21,
                humidity: 75,
                pressure: 1015,
              },
              weather: [{ main: "Partly Cloudy" }],
            },
          ],
        },
        status: 200,
      });
    } else if (url.includes("weather.com") || url.includes("accuweather.com")) {
      // Mock weather scraping response - return HTML string directly as data
      // Use the fallback selectors that are set in the test environment
      const city = url.includes("london") ? "london" : "newyork";
      return Promise.resolve({
        data: `
          <div class="temp-fallback">22°C</div>
          <div class="min-max-temp-fallback">18°C / 25°C</div>
          <div class="humidity-pressure-fallback">65% / 1013 hPa</div>
          <div class="condition-fallback">Partly Cloudy</div>
          <div class="date-fallback">2024-01-15</div>
        `,
        status: 200,
      });
    } else {
      // Default mock response
      return Promise.resolve({
        data: {},
        status: 200,
      });
    }
  }),
}));

// Mock fetch for tests to prevent external API calls
global.fetch = jest.fn((url) => {
  if (url.includes("api.openweathermap.org")) {
    // Mock OpenWeatherMap API response
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          list: [
            {
              dt_txt: "2024-01-15 12:00:00",
              main: {
                temp: 22,
                temp_min: 18,
                temp_max: 25,
                humidity: 65,
                pressure: 1013,
              },
              weather: [{ main: "Partly Cloudy" }],
            },
          ],
        }),
    });
  } else if (url.includes("weather.com") || url.includes("accuweather.com")) {
    // Mock weather scraping response
    const city = url.includes("london") ? "london" : "newyork";
    return Promise.resolve({
      ok: true,
      status: 200,
      data: `
        <div class="temp-fallback">22°C</div>
        <div class="min-max-temp-fallback">18°C / 25°C</div>
        <div class="humidity-pressure-fallback">65% / 1013 hPa</div>
        <div class="condition-fallback">Partly Cloudy</div>
        <div class="date-fallback">2024-01-15</div>
      `,
    });
  } else {
    // Default mock response
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
  }
});

// Mock fetch and axios for testing
global.fetch = jest.fn();
global.axios = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

// Set test environment variables for weather API
process.env.NODE_ENV = "test";
process.env.SCRAPE_API_FIRST = "https://test-weather.com/";
process.env.SCRAPE_API_LAST = "/weather";
process.env.SCRAPE_API_FALLBACK = "https://fallback-weather.com/";
process.env.SPECIAL_API_KEY = "test-api-key";

// Weather selectors test defaults
process.env.TEMPERATURE_CLASS = ".temp-fallback";
process.env.MIN_MAX_TEMPERATURE_CLASS = ".min-max-temp-fallback";
process.env.HUMIDITY_PRESSURE_CLASS = ".humidity-pressure-fallback";
process.env.CONDITION_CLASS = ".condition-fallback";
process.env.DATE_CLASS = ".date-fallback";

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
