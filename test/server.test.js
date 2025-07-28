// Mock environment variables FIRST, before any other imports
process.env.SCRAPE_API_FIRST = 'https://example.com/weather/';
process.env.SCRAPE_API_LAST = '-weather-forecast-today';
process.env.TEMPERATURE_CLASS = '.temp';
process.env.MIN_MAX_TEMPERATURE_CLASS = '.min-max-temp';
process.env.HUMIDITY_PRESSURE_CLASS = '.humidity-pressure';
process.env.CONDITION_CLASS = '.condition';
process.env.DATE_CLASS = '.date';
process.env.SCRAPE_API_FALLBACK = 'https://fallback.example.com/weather/';
process.env.ALLOWED_ORIGIN = 'http://localhost:3000';
// Add all other required env vars for the server to start
process.env.MAIL_USER = 'test@example.com';
process.env.MAIL_PASS = 'password';
process.env.ADMIN_EMAIL = 'admin@example.com';

const request = require('supertest');
const axios = require('axios');
const { app, server, stopServer } = require('../server');

jest.mock('axios');
jest.setTimeout(10000); // Set a reasonable timeout for all tests

describe('Weather API Endpoint', () => {
  afterAll(async () => {
    await stopServer(); // Ensure the server is properly closed
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock a successful API response by default
    axios.get.mockResolvedValue({
      data: `
        <html>
          <body>
            <div class="temp">25 °C</div>
            <div class="min-max-temp">18° / 28°</div>
            <div class="humidity-pressure">50% Humidity 1012 Pressure</div>
            <div class="condition">Clear Sky</div>
            <div class="date">July 28, 2025</div>
          </body>
        </html>
      `,
    });
  });

  test('should return weather data for a valid city', async () => {
    const response = await request(app).get('/api/weather/London');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      date: 'July 28, 2025',
      temperature: '25.0 °C',
      condition: 'Clear Sky',
      minTemperature: '18.0 °C',
      maxTemperature: '28.0 °C',
      humidity: '50%',
      pressure: '1012.0 hPa',
    });
  });

  test('should return 400 for an invalid city name with special characters', async () => {
    const response = await request(app).get('/api/weather/!@#$');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_CITY');
  });

  test('should return 404 when the city is not found by the scraping service', async () => {
    const error = new Error('Not Found');
    error.response = { status: 404 };
    axios.get.mockRejectedValue(error);

    const response = await request(app).get('/api/weather/InvalidCityName');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('CITY_NOT_FOUND');
  });

  test('should return 503 when weather data cannot be parsed', async () => {
    axios.get.mockResolvedValue({ data: '<html><body>Malformed HTML</body></html>' });
    const response = await request(app).get('/api/weather/London');
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('PARSING_ERROR');
  });
});