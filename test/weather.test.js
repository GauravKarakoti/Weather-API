const { JSDOM } = require("jsdom");

global.alert = jest.fn();

// Mock localStorage fully with getItem, setItem, removeItem, clear
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});

// Mock DOMPurify since your script uses it (you may install dompurify and import or mock it)
global.DOMPurify = {
  sanitize: (str) => str, // naive passthrough for tests
};

// Provide a fake fetch API.on 'window' or global in node
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ temperature: "20°C", condition: "Sunny" }),
  }),
);

// Mock your API_URL environment/config if your client script reads from process.env or global:
process.env.API_URL = "http://localhost/api"; // or mock in your config object

/**
 * @jest-environment jsdom
 */

beforeAll(() => {
  const dom = new JSDOM(` 
        <form id="weather-form"> </form>
            <input id="city" />
            <button id="submit-btn">Submit</button>
            <div id="weather-data"></div>
            <button id="weather-btn">Weather</button>
            <button id="search-btn">Get Weather</button>
            <button id="clear-btn">Clear</button>
            <div id="city-error"></div>
            <ul id="recent-list"></ul>
            <div class="spinner hidden"></div>
            
        
    `);

  if (typeof window !== "undefined" && form) {
    form.addEventListener("submit", handleSubmit);
  }
  global.document = dom.window.document;
  global.window = dom.window;
  global.localStorage = {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    clear: jest.fn(),
  };

  global.script = require("../public/script");
});

describe("Weather App Tests", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("should reject invalid city names", () => {
    expect(global.script.isValidInput("!@#")).toBe(false);
    expect(global.script.isValidInput("L")).toBe(false);
    expect(global.script.isValidInput("London")).toBe(true);
  });

  test("should fetch weather data successfully", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => await { temperature: "20°C", condition: "Sunny" },
    });

    const data = await global.script.fetchWeatherData("London");
    expect(data.temperature).toBe("20°C");
    expect(data.condition).toBe("Sunny");
  });

  test("should handle temperature parsing edge cases", () => {
    // Test with various temperature formats
    const testCases = [
      { input: "20°C", expected: 20 },
      { input: "-5°C", expected: -5 },
      { input: "100°F", expected: 100 },
      { input: " 25 °C ", expected: 25 }, // with extra spaces
      { input: "+15°C", expected: 15 }, // with plus sign
      { input: "N/A", expected: NaN }, // invalid format
      { input: "", expected: NaN }, // empty string
      { input: null, expected: NaN }, // null input
      { input: undefined, expected: NaN }, // undefined input
    ];

    testCases.forEach(({ input, expected }) => {
      const result = global.script.parseTemperature(input);
      if (isNaN(expected)) {
        expect(isNaN(result)).toBe(true);
      } else {
        expect(result).toBe(expected);
      }
    });
  });

  test("should handle localStorage quota exceeded error", async () => {
    // Mock localStorage.setItem to throw quota exceeded error
    const originalSetItem = global.localStorage.setItem;
    global.localStorage.setItem = jest.fn().mockImplementationOnce(() => {
      const error = new Error("QuotaExceededError");
      error.name = "QuotaExceededError";
      throw error;
    });

    // Spy on console.error to verify the error is logged
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Call the function that uses localStorage
    global.script.addToRecentSearches("Test City");

    // Verify the error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      "LocalStorage quota exceeded. Clearing recent searches.",
    );

    // Verify localStorage.clear was called
    expect(global.localStorage.clear).toHaveBeenCalled();

    // Clean up
    consoleSpy.mockRestore();
    global.localStorage.setItem = originalSetItem;
  });

  test("should handle 404 error in fetchWeatherData", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => await { error: "City not found" },
    });

    await expect(global.script.fetchWeatherData("InvalidCity")).rejects.toThrow(
      "City not found. Please enter a valid city name.",
    );
  });

  test("should store recent searches in localStorage", () => {
    global.script.addToRecentSearches("London");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "recentSearches",
      JSON.stringify(["London"]),
    );
  });

  test("should limit recent searches to 5 items", () => {
    // Clear any existing mocks
    jest.clearAllMocks();

    // Mock getItem to return an empty array
    global.localStorage.getItem.mockReturnValueOnce(JSON.stringify([]));

    // Add 6 cities
    const cities = ["London", "Paris", "New York", "Tokyo", "Sydney", "Berlin"];
    cities.forEach((city) => global.script.addToRecentSearches(city));

    // Verify that only the last 5 cities were saved
    expect(localStorage.setItem).toHaveBeenLastCalledWith(
      "recentSearches",
      JSON.stringify(
        ["Paris", "New York", "Tokyo", "Sydney", "Berlin"].reverse(),
      ),
    );
  });

  test("should not add duplicate cities to recent searches", () => {
    // Clear any existing mocks
    jest.clearAllMocks();

    // Add the same city twice
    global.script.addToRecentSearches("London");
    global.script.addToRecentSearches("London");

    // Verify that the city was only added once
    expect(localStorage.setItem).toHaveBeenLastCalledWith(
      "recentSearches",
      JSON.stringify(["London"]),
    );
  });

  test("should handle empty or invalid city names in recent searches", () => {
    // Clear any existing mocks
    jest.clearAllMocks();

    // Test with empty string
    global.script.addToRecentSearches("");
    // Test with whitespace only
    global.script.addToRecentSearches("   ");
    // Test with null
    global.script.addToRecentSearches(null);
    // Test with undefined
    global.script.addToRecentSearches(undefined);

    // Verify that no invalid entries were added
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});

const script = require("../public/script"); // import after mocks and DOM setup
global.script = script;
