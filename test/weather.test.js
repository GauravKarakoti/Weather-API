/**
 * @jest-environment jsdom
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const { waitFor } = require("@testing-library/dom");

// Load the actual HTML content once
const html = fs.readFileSync(
  path.resolve(__dirname, "../public/index.html"),
  "utf8",
);

// Mock fetch before all tests
global.fetch = jest.fn();

// Mock DOMPurify
global.DOMPurify = {
  sanitize: (str) => str,
};

describe("Weather App Client-Side Tests", () => {
  let document;
  let window;
  let scriptModule;

  beforeEach(() => {
    // Reset mocks for each test
    fetch.mockClear();

    // Set up a new JSDOM instance for each test to ensure isolation
    const dom = new JSDOM(html, {
      url: "http://localhost",
      runScripts: "dangerously",
      resources: "usable",
    });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.Event = window.Event; // Make the Event constructor available globally

    // Mock localStorage for consistent testing
    const mockStorage = {};
    global.localStorage = {
      getItem: jest.fn((key) => mockStorage[key] || null),
      setItem: jest.fn((key, value) => {
        mockStorage[key] = value;
      }),
      removeItem: jest.fn((key) => {
        delete mockStorage[key];
      }),
      clear: jest.fn(() => {
        Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
      }),
    };

    // Mock alert to prevent it from blocking test execution
    global.window.alert = jest.fn();

    // Reset modules and re-require the script to get a fresh instance with the new DOM
    jest.resetModules();
    scriptModule = require("../public/script.js");

    // Manually initialize the application logic on the new JSDOM instance
    scriptModule.initialize();

    // Mock the successful fetch responses
    fetch.mockImplementation((url) => {
      if (url.toString().includes("/api/weather-forecast/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              forecast: [
                {
                  dt_txt: "2025-07-28 12:00:00",
                  main: {
                    temp: 22.0,
                    temp_min: 18.0,
                    temp_max: 26.0,
                    humidity: 75,
                    pressure: 1010.0,
                  },
                  weather: [{ main: "Cloudy" }],
                },
              ],
            }),
        });
      }
      if (url.toString().includes("/config")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ RECENT_SEARCH_LIMIT: 5 }),
        });
      }
      return Promise.reject(new Error("Not Found"));
    });
  });

  test("should validate city input correctly", () => {
    expect(scriptModule.isValidInput("London")).toBe(true);
    expect(scriptModule.isValidInput("St. Louis")).toBe(true);
    expect(scriptModule.isValidInput("!@#$")).toBe(false);
    expect(scriptModule.isValidInput("L")).toBe(false);
  });

  test("should display an error for empty city submission", async () => {
    const cityInput = document.getElementById("city");
    const errorElement = document.getElementById("city-error");
    const submitBtn = document.getElementById("submit-btn");

    cityInput.value = "";
    submitBtn.click(); // Simulate a user clicking the submit button

    await waitFor(() => {
      expect(errorElement.textContent).toContain("City name cannot be empty.");
    });
    // Ensure fetch was not called for an empty input
    expect(fetch).not.toHaveBeenCalled();
  });

  test("should fetch weather, display it, and add to recent searches on form submission", async () => {
    const cityInput = document.getElementById("city");
    const weatherDataContainer = document.getElementById("weather-data");
    const recentList = document.getElementById("recent-list");
    const submitBtn = document.getElementById("submit-btn");

    cityInput.value = "London";
    submitBtn.click(); // Simulate a user click to trigger the whole process

    await waitFor(() => {
      // 1. Verify fetch was called with the correct URL
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/weather-forecast/London"),
      );
      // 2. Verify weather data is rendered in the DOM
      expect(weatherDataContainer.innerHTML).toContain(
        "<strong>Temp:</strong> 22.0°C",
      );
      // 3. Verify the city was added to the recent searches list
      expect(recentList.children.length).toBe(1);
      expect(recentList.textContent).toContain("London");
    });
  });

  test("should add a city to recent searches and update the UI", async () => {
    const recentList = document.getElementById("recent-list");

    // Manually call the function to test its logic in isolation
    scriptModule.addToRecentSearches("Tokyo");

    await waitFor(() => {
      expect(recentList.children.length).toBe(1);
      expect(recentList.textContent).toContain("Tokyo");
    });
  });
});
