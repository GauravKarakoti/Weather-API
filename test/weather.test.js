/**
 * @jest-environment node
 */

// Mock localStorage
global.localStorage = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock fetch
global.fetch = jest.fn();

// Mock DOMPurify
global.DOMPurify = { sanitize: (str) => str };

// Mock document
global.document = {
  getElementById: jest.fn(),
  createElement: jest.fn(),
  body: { appendChild: jest.fn() },
  readyState: 'complete',
  addEventListener: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
};

// Mock window
global.window = {
  addEventListener: jest.fn(),
  alert: jest.fn(),
  location: { reload: jest.fn() },
};

// Mock navigator
global.navigator = {
  serviceWorker: {
    addEventListener: jest.fn(),
    register: jest.fn(() => Promise.resolve({ scope: "test" })),
  },
};

// Import the functions to test
const { isValidInput, addToRecentSearches, handleClear, cacheElements } = require('../public/script.js');

describe("Weather App Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should validate city input correctly", () => {
    expect(isValidInput("London")).toBe(true);
    expect(isValidInput("St. Louis")).toBe(true);
    expect(isValidInput("!@#$")).toBe(false);
    expect(isValidInput("L")).toBe(false);
    expect(isValidInput("")).toBe(false);
    expect(isValidInput("   ")).toBe(true); // Note: spaces are allowed in the regex
  });

  test("should add a city to recent searches", () => {
    // Mock document.getElementById for recent-list
    global.document.getElementById.mockImplementation((id) => {
      if (id === "recent-list") return { innerHTML: "", style: {} };
      return null;
    });

    // Call addToRecentSearches
    addToRecentSearches("Tokyo");

    // Should store the city in localStorage
    expect(global.localStorage.setItem).toHaveBeenCalledWith(
      "recentSearches",
      JSON.stringify(["Tokyo"]),
    );
  });

  test("should handle clear functionality", () => {
    const mockEvent = {
      preventDefault: jest.fn(),
    };

    // Mock DOM elements
    const mockCityInput = { value: "London" };
    const mockWeatherData = { innerHTML: "<div>Weather data</div>" };
    const mockErrorElement = { textContent: "", classList: { remove: jest.fn() } };
    const mockForm = { addEventListener: jest.fn() };
    const mockBtn = { addEventListener: jest.fn(), type: "button" };

    // Mock document.getElementById
    global.document.getElementById.mockImplementation((id) => {
      if (id === "city") return mockCityInput;
      if (id === "weather-data") return mockWeatherData;
      if (id === "city-error") return mockErrorElement;
      if (id === "recent-list") return { innerHTML: "", style: {} };
      return null;
    });

    // Mock document.querySelector
    global.document.querySelector.mockImplementation((selector) => {
      if (selector === "#weather-form") return mockForm;
      if (selector === "#submit-btn") return mockBtn;
      if (selector === "#search-btn") return mockBtn;
      if (selector === "#clear-btn") return mockBtn;
      if (selector === ".spinner") return { classList: { toggle: jest.fn() } };
      return null;
    });

    // Cache elements to set global variables
    cacheElements();

    // Call handleClear
    handleClear(mockEvent);

    // Should clear the input and weather data
    expect(mockCityInput.value).toBe("");
    expect(mockWeatherData.innerHTML).toBe("");
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });
});
