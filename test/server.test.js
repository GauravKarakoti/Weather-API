jest.mock("axios");

const axios = require("axios");
const request = require("supertest");
const {
  app,
  server,
  rateLimiters,
  stopServer,
  fetchWeatherData,
  formatDate,
} = require("../server");

process.env.TEMPERATURE_CLASS = "temp-fallback";
process.env.MIN_MAX_TEMPERATURE_CLASS = "min-max-temp-fallback";
process.env.HUMIDITY_PRESSURE_CLASS = "humidity-pressure-fallback";
process.env.CONDITION_CLASS = "condition-fallback";
process.env.DATE_CLASS = "date-fallback";
process.env.NODE_ENV = "test";
process.env.SCRAPE_API_FIRST = "https://example.com/";
process.env.SCRAPE_API_LAST = "/weather";

jest.setTimeout(120000);

// This ensures the server is stopped only once after all tests in this file run.
afterAll(async () => {
  await stopServer();
});

describe("City Validation", () => {
  const { isValidCity } = require("../server");

  test("should accept city names with digits", () => {
    expect(isValidCity("100 Mile House")).toBe(true);
    expect(isValidCity("City 123")).toBe(true);
    expect(isValidCity("1st City")).toBe(true);
  });

  test("should accept valid city names without digits", () => {
    expect(isValidCity("New York")).toBe(true);
    expect(isValidCity("São Paulo")).toBe(true);
    expect(isValidCity("San Francisco")).toBe(true);
  });

  test("should reject invalid city names", () => {
    expect(isValidCity("A")).toBe(false); // Too short
    expect(isValidCity("")).toBe(false); // Empty string
    expect(isValidCity(" ")).toBe(false); // Only whitespace
    expect(isValidCity("City@123")).toBe(false); // Invalid character
  });
});

describe("Weather API Endpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (rateLimiters.weather?.store?.hits) {
      rateLimiters.weather.store.hits = {};
    }

    axios.get.mockResolvedValue({
      data: `
        <div class="temp-fallback">20°C</div>
        <div class="min-max-temp-fallback">15°-25°</div>
        <div class="humidity-pressure-fallback">60% 1015hPa</div>
        <div class="condition-fallback">Sunny</div>
        <div class="date-fallback">2023-12-01</div>
      `,
    });
  });

  test("should return weather data for a valid city", async () => {
    const response = await request(app).get("/api/weather/London");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("temperature", "20.0 °C");
    expect(response.body).toHaveProperty("condition", "Sunny");
  });

  test("should return 400 for an invalid city name", async () => {
    const response = await request(app).get("/api/weather/x");
    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Invalid city name. Use letters, spaces, apostrophes (') and hyphens (-)",
    );
  });

  test("should return 404 for a non-existent city", async () => {
    const error = new Error("Not Found");
    error.response = { status: 404 };
    axios.get.mockRejectedValue(error);

    const response = await request(app).get("/api/weather/InvalidCity");

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("CITY_NOT_FOUND");
  });

  test("should return 502 for scraping errors", async () => {
    axios.get.mockRejectedValue(new Error("API error"));
    const response = await request(app).get("/api/weather/London");
    expect(response.status).toBe(502);
    expect(response.body.error).toBe(
      "Failed to retrieve data from the weather service.",
    );
    expect(response.body.code).toBe("BAD_GATEWAY");
  });
});

describe("fetchWeatherData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: "<html></html>" });
  });

  test("should properly encode city names with diacritics", async () => {
    const city = "München";
    await fetchWeatherData(city);

    expect(axios.get).toHaveBeenCalled();
    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).toContain(encodeURIComponent(city).replace(/%20/g, "-"));
  });

  test("should handle city names with spaces", async () => {
    const city = "New York";
    await fetchWeatherData(city);

    expect(axios.get).toHaveBeenCalled();
    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).toContain(encodeURIComponent(city).replace(/%20/g, "-"));
  });

  test("should handle city names with special characters", async () => {
    const city = "São Paulo";
    await fetchWeatherData(city);

    expect(axios.get).toHaveBeenCalled();
    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).toContain(encodeURIComponent(city).replace(/%20/g, "-"));
  });
});

describe("Rate Limiting and Parsing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({
      data: `
        <div class="temp-fallback">20°C</div>
        <div class="min-max-temp-fallback">15°-25°</div>
        <div class="humidity-pressure-fallback">60% 1015hPa</div>
        <div class="condition-fallback">Sunny</div>
        <div class="date-fallback">2023-12-01</div>
      `,
    });
  });

  test("should handle malformed HTML response", async () => {
    axios.get.mockResolvedValueOnce({
      data: "<html><body>Invalid HTML",
    });

    const response = await request(app).get("/api/weather/London");
    expect(response.status).toBe(500);
    expect(response.body.code).toBe("PARSING_ERROR");
  });

  test("should handle missing temperature data but present condition", async () => {
    axios.get.mockResolvedValueOnce({
      data: `
        <html>
          <div class="min-max-temp-fallback">15° - 25°</div>
          <div class="humidity-pressure-fallback">60% Humidity 1015 Pressure</div>
          <div class="condition-fallback">Sunny</div>
          <div class="date-fallback">2023-12-01</div>
        </html>
      `,
    });

    const response = await request(app).get("/api/weather/London");
    expect(response.status).toBe(200);
    expect(response.body.temperature).toBe("N/A");
    expect(response.body.condition).toBe("Sunny");
  });

  test("should return 429 when exceeding rate limit for /api/weather", async () => {
    const apiKey = "test-api-key";
    const headers = { "x-api-key": apiKey };
    // The beforeEach hook already resets the limiter, so no need to reset here.

    // Temporarily set NODE_ENV to production to enable rate limiting
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      for (let i = 0; i < 50; i++) {
        await request(app).get("/api/weather/London").set(headers);
      }

      const response = await request(app)
        .get("/api/weather/London")
        .set(headers);
      expect(response.status).toBe(429);
      expect(response.body.error).toBe("Rate limit exceeded");
    } finally {
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    }
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
    expect(formatDate("")).toBe("N/A");
  });
});
