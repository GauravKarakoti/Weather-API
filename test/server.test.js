// Mock environment variables FIRST, before any other code runs.
process.env.SCRAPE_API_FIRST = 'https://example.com/weather/';
process.env.SCRAPE_API_LAST = '-weather-forecast-today';
process.env.TEMPERATURE_CLASS = '.temp';
process.env.MIN_MAX_TEMPERATURE_CLASS = '.min-max-temp';
process.env.HUMIDITY_PRESSURE_CLASS = '.humidity-pressure';
process.env.CONDITION_CLASS = '.condition';
process.env.DATE_CLASS = '.date';
process.env.SCRAPE_API_FALLBACK = 'https://fallback.example.com/weather/';
process.env.ALLOWED_ORIGIN = 'http://localhost:3000';
process.env.MAIL_USER = 'test@example.com';
process.env.MAIL_PASS = 'password';
process.env.ADMIN_EMAIL = 'admin@example.com';

const request = require('supertest');
const axios = require('axios');
// NOW, import the server after env vars are set.
const { app, server, stopServer, formatDate } = require('../server');

jest.mock('axios');
jest.setTimeout(10000);

describe('Weather API Endpoint', () => {
  // Ensure the server is properly closed after all tests
  afterAll(async () => {
    await stopServer();
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock a successful API response with consistent class names
    axios.get.mockResolvedValue({
      data: `
        <html>
          <body>
            <div class="temp">25 °C</div>
            <div class="min-max-temp">18° / 28°</div>
            <div class="humidity-pressure">50% Humidity 1012 Pressure</div>
            <div class="condition">Clear Sky</div>
            <div class="date">2025-07-28</div>
          </body>
        </html>
      `,
    });
  });

  test('should return correctly parsed weather data for a valid city', async () => {
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

  test('should return 400 for an invalid city name', async () => {
    const response = await request(app).get('/api/weather/!@#$');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_CITY');
  });

  test('should return 404 for a city that is not found', async () => {
    const error = new Error('Not Found');
    error.response = { status: 404 };
    axios.get.mockRejectedValue(error);

    const response = await request(app).get('/api/weather/NonExistentCity');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('CITY_NOT_FOUND');
  });
  
  test('should return 503 if website structure changes and selectors fail', async () => {
    axios.get.mockResolvedValue({ data: '<html><body>Content is missing</div></body></html>' });
    const response = await request(app).get('/api/weather/London');
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('PARSING_ERROR');
  });
});