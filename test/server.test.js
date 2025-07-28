jest.mock("axios");
// jest.mock('../utils/weatherService');

const axios = require("axios");
const request = require("supertest");
const { app, server, rateLimiters, stopServer, fetchWeatherData, formatDate } = require("../server");

process.env.TEMPERATURE_CLASS = "temp-fallback";
process.env.MIN_MAX_TEMPERATURE_CLASS = "min-max-temp-fallback";
process.env.HUMIDITY_PRESSURE_CLASS = "humidity-pressure-fallback";
process.env.CONDITION_CLASS = "condition-fallback";
process.env.DATE_CLASS = "date-fallback";



jest.setTimeout(60000);

describe("Weather API Endpoint", () => {

    beforeEach(() => {
        jest.clearAllMocks();
        const store = rateLimiters.weather.store;
        if (store && store.hits) {
            store.hits = {}; // reset all stored hits
        }

        axios.get.mockResolvedValue({
            data: `
              <html>
                <div class="temp-fallback">20 °C</div>
                <div class="min-max-temp-fallback">15 ° - 25 °</div>
                <div class="humidity-pressure-fallback">60% Humidity 1015 Pressure</div>
                <div class="condition-fallback">Sunny</div>
                <div class="date-fallback">2023-12-01</div>
              </html>
            `,
        });

    });


    afterAll(() => {
        stopServer();
    });

    test("should return weather data for a valid city", async () => {
        const response = await request(app).get("/api/weather/London");
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("temperature");
        expect(response.body).toHaveProperty("condition");
    });

    test("should return 400 for an invalid city name", async () => {
        const response = await request(app).get("/api/weather/x");
        expect(response.status).toBe(400);
        expect(response.body.error)
            .toBe("Invalid city name. Use letters, spaces, apostrophes (') and hyphens (-)");

    });

    test('should return 404 for a non-existent city', async () => {
        const error = new Error("Not Found");
        error.response = { status: 404 };
        // Mock all axios.get calls to reject
        axios.get.mockRejectedValue(error);

        const response = await request(app).get("/api/weather/InvalidCity");

        expect(response.status).toBe(404);
        expect(response.body.code).toBe("CITY_NOT_FOUND");
    });

    test("should return 500 for server errors", async () => {
        const error = new Error("Simulated server error");
        // Mock all axios.get calls to reject
        axios.get.mockRejectedValue(error);

        const response = await request(app).get("/api/weather/London");
        expect(response.status).toBe(500);
        expect(response.body.error).toBe("Failed to retrieve weather data.");
        expect(response.body.code).toBe("SERVER_ERROR");
    });
});

describe("Rate Limiting", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        axios.get.mockResolvedValue({
            data: `
              <html>
                <div class="temp-fallback">20 °C</div>
                <div class="min-max-temp-fallback">15 ° - 25 °</div>
                <div class="humidity-pressure-fallback">60% Humidity 1015 Pressure</div>
                <div class="condition-fallback">Sunny</div>
                <div class="date-fallback">2023-12-01</div>
              </html>
            `,
        });
    });

    test("should return 429 when exceeding rate limit for /api/weather", async () => {
        const apiKey = "test-api-key"; // Replace with a valid API key if needed
        const headers = { "x-api-key": apiKey };

        // Simulate exceeding the rate limit
        for (let i = 0; i < 55; i++) {
            await request(app).get("/api/weather/London").set(headers);
        }

        const response = await request(app).get("/api/weather/London").set(headers);
        expect(response.status).toBe(429);
        expect(response.body.error).toBe("Too many requests to the weather API. Please try again later.");
    });

    test("should not apply rate limit to different endpoints", async () => {
        const response = await request(app).get("/api/version");
        expect(response.status).toBe(200);
    });
});

describe("formatDate", () => {
    test("should format a valid date string", () => {
        expect(formatDate("2023-12-01")).toBe("December 1, 2023");
    });

    test("should return the original string for an invalid date", () => {
        expect(formatDate("invalid-date")).toBe("invalid-date");
    });

    test("should handle empty string", () => {
        expect(formatDate("")).toBe("");
    });
});
