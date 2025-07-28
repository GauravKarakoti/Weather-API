/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Load the actual HTML content from the public/index.html file
const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');

// Mock fetch before each test
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ 
        temperature: '22.0 °C', 
        condition: 'Cloudy',
        date: 'July 28, 2025',
        minTemperature: '18.0 °C',
        maxTemperature: '26.0 °C',
        humidity: '75%',
        pressure: '1010.0 hPa'
    }),
  })
);

// Mock DOMPurify
global.DOMPurify = {
  sanitize: (str) => str,
};

describe('Weather App Client-Side Tests', () => {
  let scriptModule;

  beforeEach(() => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    
    // Mock window.alert as it's not implemented in JSDOM
    global.window.alert = jest.fn();
    global.localStorage.clear();
    fetch.mockClear();

    // Use jest.isolateModules to ensure the script runs in the new DOM environment
    jest.isolateModules(() => {
      scriptModule = require('../public/script.js');
    });
  });

  test('should validate city input correctly', () => {
    expect(scriptModule.isValidInput("London")).toBe(true);
    expect(scriptModule.isValidInput("St. Louis")).toBe(true);
    expect(scriptModule.isValidInput("!@#$")).toBe(false);
    expect(scriptModule.isValidInput("L")).toBe(false);
  });

  test('should display an error for empty city submission', () => {
    const form = document.getElementById('weather-form');
    const cityInput = document.getElementById('city');
    const errorElement = document.getElementById('city-error');

    cityInput.value = '';
    form.dispatchEvent(new window.Event('submit'));
    
    expect(errorElement.textContent).toContain('City name cannot be empty.');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('should fetch and display weather data on form submission', async () => {
    const form = document.getElementById('weather-form');
    const cityInput = document.getElementById('city');
    const weatherDataContainer = document.getElementById('weather-data');
    
    cityInput.value = 'London';
    form.dispatchEvent(new window.Event('submit'));

    // Wait for async operations like fetch to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(fetch).toHaveBeenCalledTimes(2); // Once for config, once for weather
    expect(weatherDataContainer.textContent).toContain('Temp: 22.0 °C');
    expect(weatherDataContainer.textContent).toContain('Condition: Cloudy');
  });

  test('should add a city to recent searches', () => {
    scriptModule.addToRecentSearches('Tokyo');
    const recentList = document.getElementById('recent-list');
    expect(recentList.children.length).toBe(1);
    expect(recentList.textContent).toContain('Tokyo');
  });
});