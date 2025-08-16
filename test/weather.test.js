/**
 * @jest-environment jsdom
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const { waitFor } = require("@testing-library/dom");

const html = fs.readFileSync(
  path.resolve(__dirname, "../public/index.html"),
  "utf8"
);

// Global mocks
global.fetch = jest.fn();
global.DOMPurify = { sanitize: (str) => str };

describe("Weather App Client-Side Tests", () => {
  let document;
  let window;
  let scriptModule;

  beforeEach(() => {
    jest.clearAllMocks();

    const dom = new JSDOM(html, {
      url: "http://localhost",
      runScripts: "dangerously",
      resources: "usable",
    });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.Event = window.Event;

    // Mock localStorage
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

    // Prevent blocking alerts
    global.window.alert = jest.fn();

    // Reload script fresh each test
    jest.resetModules();
    scriptModule = require("../public/script.js");

    if (typeof scriptModule.initialize === "function") {
      scriptModule.initialize();
    }

    // Mock fetch API responses
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
    scriptModule.cacheElements();

    const cityInput = document.getElementById("city");
    const errorElement = document.getElementById("city-error");

    expect(cityInput).toBeTruthy();
    expect(errorElement).toBeTruthy();

    cityInput.value = "";
    const mockEvent = { preventDefault: jest.fn() };
    await scriptModule.handleSubmit(mockEvent);

    await waitFor(() => {
      expect(errorElement.textContent).toContain("City name cannot be empty.");
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  test("should fetch weather, display it, and add to recent searches on form submission", async () => {
    const cityInput = document.getElementById("city");
    const weatherDataContainer = document.getElementById("weather-data");
    const recentList = document.getElementById("recent-list");

    cityInput.value = "London";
    const mockEvent = { preventDefault: jest.fn() };
    await scriptModule.handleSubmit(mockEvent);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/weather-forecast/London")
      );
      expect(weatherDataContainer.innerHTML).toContain(
        "<strong>Temp:</strong> 22.0°C"
      );
      expect(recentList.children.length).toBe(1);
      expect(recentList.textContent).toContain("London");
    });
  });

  test("should add a city to recent searches and update the UI", async () => {
    const recentList = document.getElementById("recent-list");

    scriptModule.addToRecentSearches("Tokyo");

    await waitFor(() => {
      expect(recentList.children.length).toBe(1);
      expect(recentList.textContent).toContain("Tokyo");
    });
  });
});
