const { JSDOM } = require("jsdom");

/**
 * @jest-environment jsdom
 */
global.fetch = require("node-fetch");

beforeAll(() => {
  const dom = new JSDOM(` 
        <form id="weather-form">
            <input id="city" />
            <button id="submit-btn">Submit</button>
            <div id="weather-data"></div>
            <div id="city-error"></div>
            <div id="recent-list"></div>
            <div class="spinner hidden"></div>
        </form>
    `);
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

  test("should validate city names correctly", () => {
    // Invalid names
    expect(global.script.isValidInput("")).toBe(false);
    expect(global.script.isValidInput("!@#")).toBe(false);
    expect(global.script.isValidInput("L")).toBe(false);
    expect(global.script.isValidInput("1234")).toBe(false);
    expect(global.script.isValidInput("Delhi, IN")).toBe(false); // comma not allowed

    // Valid names
    expect(global.script.isValidInput("London")).toBe(true);
    expect(global.script.isValidInput("São Gonçalo")).toBe(true); // accented
    expect(global.script.isValidInput("O'Connor")).toBe(true);    // apostrophe
    expect(global.script.isValidInput("St. Louis")).toBe(true);   // period
    expect(global.script.isValidInput("Rio-de-Janeiro")).toBe(true); // hyphen
  });

  test("should fetch weather data successfully", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ temperature: "20°C", condition: "Sunny" }),
  });

  const data = await global.script.fetchWeatherData("London");
  expect(data.temperature).toBe("20°C");
  expect(data.condition).toBe("Sunny");
});



  test("should handle 404 error in fetchWeatherData", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({ error: "City not found" }),
    });

    await expect(global.script.fetchWeatherData("InvalidCity")).rejects.toThrow(
      "City not found. Please check the city name."
    );
  });

  test("should store recent searches in localStorage", () => {
    global.script.addToRecentSearches("London");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "recentSearches",
      JSON.stringify(["London"])
    );
  });
});


afterEach(() => {
  jest.clearAllMocks();
});
