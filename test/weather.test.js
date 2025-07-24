
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
Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
});

// Mock DOMPurify since your script uses it (you may install dompurify and import or mock it)
global.DOMPurify = {
    sanitize: (str) => str // naive passthrough for tests
};

// Provide a fake fetch API.on 'window' or global in node
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ temperature: '20°C', condition: 'Sunny' }),
    })
);

// Mock your API_URL environment/config if your client script reads from process.env or global:
process.env.API_URL = 'http://localhost/api'; // or mock in your config object


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
        form.addEventListener('submit', handleSubmit);
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
            json: async () => await ({ temperature: "20°C", condition: "Sunny" })
        });

        const data = await global.script.fetchWeatherData("London");
        expect(data.temperature).toBe("20°C");
        expect(data.condition).toBe("Sunny");
    });

    test("should handle 404 error in fetchWeatherData", async () => {
        jest.spyOn(global, "fetch").mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => await ({ error: "City not found" })
        });

        await expect(global.script.fetchWeatherData("InvalidCity")).rejects.toThrow("City not found. Please enter a valid city name.");
    });

    test("should store recent searches in localStorage", () => {
        global.script.addToRecentSearches("London");
        expect(localStorage.setItem).toHaveBeenCalledWith(
            "recentSearches",
            JSON.stringify(["London"])
        );
    });
});

const script = require("../public/script"); // import after mocks and DOM setup
global.script = script;

