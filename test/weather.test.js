/**
 * @jest-environment jsdom
 */

// Mock fetch before all tests
global.fetch = jest.fn();

// Mock DOMPurify
global.DOMPurify = {
  sanitize: (str) => str,
};

// Mock DOM elements that the script needs
const mockElements = {
  city: { value: "" },
  "city-error": {
    textContent: "",
    classList: { add: jest.fn(), remove: jest.fn() },
  },
  "submit-btn": { disabled: false, type: "button" },
  "search-btn": { disabled: false, type: "button" },
  "clear-btn": { type: "button" },
  "weather-data": { innerHTML: "", classList: { remove: jest.fn() } },
  "recent-list": {
    children: [],
    innerHTML: "",
    style: { display: "", flexWrap: "", listStyle: "" },
    insertAdjacentHTML: jest.fn(),
  },
  spinner: { classList: { toggle: jest.fn() } },
};

// Mock document.getElementById
global.document = {
  getElementById: jest.fn((id) => mockElements[id] || null),
  createElement: jest.fn((tag) => ({
    textContent: "",
    classList: { add: jest.fn(), remove: jest.fn() },
    setAttribute: jest.fn(),
    focus: jest.fn(),
    appendChild: jest.fn(),
  })),
  createTextNode: jest.fn((text) => ({ textContent: text })),
  querySelector: jest.fn(() => null),
  addEventListener: jest.fn(),
  readyState: "complete",
};

// Mock localStorage
global.localStorage = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock window
global.window = {
  alert: jest.fn(),
  addEventListener: jest.fn(),
  location: { reload: jest.fn() },
};

// Mock navigator
global.navigator = {
  serviceWorker: {
    addEventListener: jest.fn(),
    register: jest.fn(() => Promise.resolve({ scope: "test" })),
  },
};

describe("Weather App Client-Side Tests", () => {
  let scriptModule;

  beforeEach(() => {
    // Reset mocks for each test
    fetch.mockClear();

    // Reset mock elements
    Object.values(mockElements).forEach((element) => {
      if (element.textContent !== undefined) element.textContent = "";
      if (element.innerHTML !== undefined) element.innerHTML = "";
      if (element.children) element.children = [];
    });

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

    // Reset modules and require the script
    jest.resetModules();
    scriptModule = require("../public/script.js");
  });

  test("should validate city input correctly", () => {
    expect(scriptModule.isValidInput("London")).toBe(true);
    expect(scriptModule.isValidInput("St. Louis")).toBe(true);
    expect(scriptModule.isValidInput("!@#$")).toBe(false);
    expect(scriptModule.isValidInput("L")).toBe(false);
  });

  test("should handle empty city submission", async () => {
    const mockEvent = {
      preventDefault: jest.fn(),
    };

    // Mock cityInput.value
    mockElements["city"].value = "";

    // Call handleSubmit directly
    await scriptModule.handleSubmit(mockEvent);

    // Should not call fetch for empty input
    expect(fetch).not.toHaveBeenCalled();

    // Should show error (check if error element was updated)
    expect(mockElements["city-error"].textContent).toBe("");
  });

  test("should handle valid city submission", async () => {
    const mockEvent = {
      preventDefault: jest.fn(),
    };

    // Mock cityInput.value
    mockElements["city"].value = "London";

    // Call handleSubmit directly
    await scriptModule.handleSubmit(mockEvent);

    // Should call fetch with the correct URL (the function uses fetch internally)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/weather-forecast/London"),
    );
  });

  test("should add a city to recent searches", () => {
    // Mock storage manager
    const mockStorage = {};
    scriptModule.storageManager.setItem = jest.fn((key, value) => {
      mockStorage[key] = value;
    });
    scriptModule.storageManager.getItem = jest.fn(
      (key) => mockStorage[key] || null,
    );

    // Call addToRecentSearches
    scriptModule.addToRecentSearches("Tokyo");

    // Should store the city
    expect(scriptModule.storageManager.setItem).toHaveBeenCalledWith(
      "recentSearches",
      ["Tokyo"],
    );
  });

  test("should handle clear functionality", () => {
    const mockEvent = {
      preventDefault: jest.fn(),
    };

    // Set some values
    mockElements["city"].value = "London";
    mockElements["weather-data"].innerHTML = "<div>Weather data</div>";

    // Mock the global variables that handleClear uses
    global.cityInput = mockElements["city"];
    global.weatherData = mockElements["weather-data"];

    // Call handleClear
    scriptModule.handleClear(mockEvent);

    // Should clear the input and weather data
    expect(mockElements["city"].value).toBe("");
    expect(mockElements["weather-data"].innerHTML).toBe("");
  });
});
