/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Load the actual HTML content from the file
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
  
  beforeEach(() => {
    // Reset DOM and mocks for each test to ensure they are isolated
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost' });
    global.document = dom.window.document;
    global.window = dom.window;
    global.localStorage.clear();
    fetch.mockClear();

    // Require the script after the DOM is set up so it can attach event listeners
    require('../public/script.js');
  });

  test('should validate city input correctly', () => {
    const { isValidInput } = require('../public/script.js');
    expect(isValidInput("London")).toBe(true);
    expect(isValidInput("St. Louis")).toBe(true);
    expect(isValidInput("!@#$")).toBe(false); // Invalid characters
    expect(isValidInput("L")).toBe(false); // Too short
  });

  test('should display an error for empty city submission', async () => {
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
    
    // Create a mock event to pass to the handler
    const submitEvent = new window.Event('submit', { bubbles: true, cancelable: true });
    
    // Dispatch the event which will trigger the handleSubmit function
    form.dispatchEvent(submitEvent);

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(fetch).toHaveBeenCalledWith('https://weather-api-ex1z.onrender.com/api/weather/London');
    expect(weatherDataContainer.textContent).toContain('Temp: 22.0 °C');
    expect(weatherDataContainer.textContent).toContain('Condition: Cloudy');
  });

  test('should add a city to recent searches', () => {
    const { addToRecentSearches } = require('../public/script.js');
    addToRecentSearches('Tokyo');
    
    const recentList = document.getElementById('recent-list');
    expect(recentList.children.length).toBe(1);
    expect(recentList.textContent).toContain('Tokyo');
  });
});