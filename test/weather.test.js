

const request = require("supertest");
const { fetchWeatherData, isValidInput, addToRecentSearches } = require("../public/script");

describe("Weather App Tests", () => {
    beforeAll(() => {
        // Mock global alert
        global.alert = jest.fn();

        // Mock DOM elements
        document.body.innerHTML = `
            <form id="weather-form"></form>
            <input id="city" />
            <div id="weather-data"></div>
            <button id="weather-btn"></button>
            <button id="search-btn"></button>
            <button id="clear-btn"></button>
            <div class="spinner"></div>
            <div id="city-error"></div>
            <div id="weather-icon"></div>
            <ul id="recent-list"></ul>
        `;

        // Mock fetch
        global.fetch = jest.fn();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    test("should reject invalid city names", () => {
        expect(isValidInput("123")).toBe(false);
        expect(isValidInput("New York!")).toBe(false);
        expect(isValidInput("London")).toBe(true);
        expect(isValidInput("São Paulo")).toBe(true);
    });

    test("should fetch weather data successfully", async () => {
        const mockData = {
            temperature: "20°C",
            condition: "Sunny",
            date: "2025-07-23",
            minTemperature: "15°C",
            maxTemperature: "25°C",
            humidity: "70%",
            pressure: "1010 hPa"
        };
        global.fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ API_URL: "https://weather-api-ex1z.onrender.com" }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });

        const data = await fetchWeatherData("London");
        expect(data).toEqual(mockData);
        expect(global.fetch).toHaveBeenCalledWith("https://weather-api-ex1z.onrender.com/api/weather/London");
    });

    test("should handle 404 error in fetchWeatherData", async () => {
        global.fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ API_URL: "https://weather-api-ex1z.onrender.com" }) })
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
                headers: { get: () => "application/json" },
                json: () => Promise.resolve({ error: "City not found. Please check the city name." })
            });

        await expect(fetchWeatherData("InvalidCity")).rejects.toThrow("City not found. Please check the city name.");
    });

    test("should store recent searches in localStorage", () => {
        // Mock localStorage
        const localStorageMock = {
            store: {},
            getItem: jest.fn((key) => localStorageMock.store[key] || null),
            setItem: jest.fn((key, value) => (localStorageMock.store[key] = value)),
            removeItem: jest.fn((key) => delete localStorageMock.store[key])
        };
        Object.defineProperty(global, "localStorage", { value: localStorageMock });

        // Mock recentSearchLimit
        localStorageMock.setItem("recentSearchLimit", "3");

        addToRecentSearches("London");
        addToRecentSearches("Paris");
        addToRecentSearches("Tokyo");
        addToRecentSearches("London"); // Should deduplicate

        const recent = JSON.parse(localStorageMock.getItem("recentSearches"));
        expect(recent).toEqual(["London", "Tokyo", "Paris"]);
    });
});

/**
 * @jest-environment jsdom
 */
const fs = require("fs");
const path = require("path");

describe("Weather App Tests", () => {
  let html;
  let script;

  beforeAll(() => {
    html = fs.readFileSync(
      path.resolve(__dirname, "../public/index.html"),
      "utf8",
    );
    document.documentElement.innerHTML = html;
    script = require("../public/script.js");
    global.script = script;
  });

  beforeEach(() => {
    Storage.prototype.setItem = jest.fn(); // ✅ mock setItem
    localStorage.clear();
  });

  test("should store recent searches in localStorage", () => {
    global.script.addToRecentSearches("London");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "recentSearches",
      JSON.stringify(["London"]),
    );
  });
});

