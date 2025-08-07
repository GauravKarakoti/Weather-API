/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Load the actual HTML content from the public/index.html file
const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');

// Mock fetch before each test
global.fetch = jest.fn((url) => {
  if (url.toString().includes('/api/weather-forecast/')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        forecast: [{
          dt_txt: '2025-07-28 12:00:00',
          main: { temp: 22.0, temp_min: 18.0, temp_max: 26.0, humidity: 75, pressure: 1010.0 },
          weather: [{ main: 'Cloudy' }]
        }]
      }),
    });
  }
  if (url.toString().includes('/config')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ RECENT_SEARCH_LIMIT: 5 }),
    });
  }
  return Promise.resolve({ ok: false, statusText: 'Not Found' });
});


// Mock DOMPurify
global.DOMPurify = {
  sanitize: (str) => str,
};

describe('Weather App Client-Side Tests', () => {
  let scriptModule;
  let dom;

  beforeEach(() => {
    dom = new JSDOM(html, { url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    
    global.window.alert = jest.fn();
    
    // Clear mocks and storage
    jest.resetModules();
    fetch.mockClear();
    global.localStorage.clear();
    
    // Require the script module, which runs its initialization code
    scriptModule = require('../public/script.js');
  });

  test('should validate city input correctly', () => {
    expect(scriptModule.isValidInput("London")).toBe(true);
    expect(scriptModule.isValidInput("St. Louis")).toBe(true);
    expect(scriptModule.isValidInput("!@#$")).toBe(false);
    expect(scriptModule.isValidInput("L")).toBe(false);
  });

  test('should display an error for empty city submission', async () => {
    const cityInput = document.getElementById('city');
    const errorElement = document.getElementById('city-error');

    cityInput.value = '';
    const mockEvent = { preventDefault: jest.fn() };
    await scriptModule.handleSubmit(mockEvent);
    
    expect(errorElement.textContent).toContain('City name cannot be empty.');
    // Ensure fetch was not called for the weather API
    const weatherCalls = fetch.mock.calls.filter(call => call[0].includes('api/weather-forecast'));
    expect(weatherCalls.length).toBe(0);
  });

  test('should fetch and display weather data on form submission', async () => {
    const cityInput = document.getElementById('city');
    const weatherDataContainer = document.getElementById('weather-data');
    
    cityInput.value = 'London';
    const mockEvent = { preventDefault: jest.fn() };
    await scriptModule.handleSubmit(mockEvent);

    // handleSubmit should make one call to the weather forecast API
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/weather-forecast/London'));

    expect(weatherDataContainer.innerHTML).toContain('Temp: 22.0°C');
    expect(weatherDataContainer.innerHTML).toContain('Condition: Cloudy');
  });

  test('should add a city to recent searches', () => {
    scriptModule.addToRecentSearches('Tokyo');
    const recentList = document.getElementById('recent-list');
    expect(recentList.children.length).toBe(1);
    expect(recentList.textContent).toContain('Tokyo');
  });
});