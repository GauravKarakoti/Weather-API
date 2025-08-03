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

jest.setTimeout(60000);

describe("City Validation", () => {
  const { isValidCity } = require('../server');

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
    expect(response.body.error).toBe(
      "Invalid city name. Use letters, spaces, apostrophes (') and hyphens (-)",
    );
  });

  test("should return 404 for a non-existent city", async () => {
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

describe("fetchWeatherData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: '<html></html>' });
  });

  test("should properly encode city names with diacritics", async () => {
    const city = "München";
    await fetchWeatherData(city);
    
    // Check that axios.get was called with a properly encoded URL
    expect(axios.get).toHaveBeenCalled();
    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).toContain(encodeURIComponent(city).replace(/%20/g, '-'));
  });

  test("should handle city names with spaces", async () => {
    const city = "New York";
    await fetchWeatherData(city);
    
    expect(axios.get).toHaveBeenCalled();
    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).toContain(encodeURIComponent(city).replace(/%20/g, '-'));
  });

  test("should handle city names with special characters", async () => {
    const city = "São Paulo";
    await fetchWeatherData(city);
    
    expect(axios.get).toHaveBeenCalled();
    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).toContain(encodeURIComponent(city).replace(/%20/g, '-'));
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

  test("should handle malformed HTML response", async () => {
    axios.get.mockResolvedValueOnce({
      data: "<html><body>Invalid HTML",
    });

    const response = await request(app).get("/api/weather/London");
    expect(response.status).toBe(500);
    expect(response.body.code).toBe("PARSING_ERROR");
  });

  test("should handle missing temperature data", async () => {
    axios.get.mockResolvedValueOnce({
      data: `
              <html>
                <div class="min-max-temp-fallback">15 ° - 25 °</div>
                <div class="humidity-pressure-fallback">60% Humidity 1015 Pressure</div>
                <div class="condition-fallback">Sunny</div>
                <div class="date-fallback">2023-12-01</div>
              </html>
            `,
    });

    const response = await request(app).get("/api/weather/London");
    expect(response.status).toBe(200);
    expect(response.body.temperature).toBe("N/A");
  });

  test("should handle different temperature formats", async () => {
    const testCases = [
      { temp: "20°C", expected: "20°C" },
      { temp: "68°F", expected: "68°F" },
      { temp: " 25 °C ", expected: "25°C" },
      { temp: "+15°C", expected: "15°C" },
      { temp: "N/A", expected: "N/A" },
    ];

    for (const { temp, expected } of testCases) {
      axios.get.mockResolvedValueOnce({
        data: `
                  <html>
                    <div class="temp-fallback">${temp}</div>
                    <div class="min-max-temp-fallback">15 ° - 25 °</div>
                    <div class="humidity-pressure-fallback">60% Humidity 1015 Pressure</div>
                    <div class="condition-fallback">Sunny</div>
                    <div class="date-fallback">2023-12-01</div>
                  </html>
                `,
      });

      const response = await request(app).get("/api/weather/London");
      expect(response.status).toBe(200);
      expect(response.body.temperature).toBe(expected);
    }
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
    expect(response.body.error).toBe(
      "Too many requests to the weather API. Please try again later.",
    );
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
