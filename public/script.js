// Note: Ensure no duplicate 'clearBtn' declarations exist in this file or included scripts.
// Check index.html for correct selector IDs (e.g., #clear-btn).

// Weather emoji configuration object
const WEATHER_CONFIG = {
  emojis: {
    // Primary conditions (exact matches first)
    sunny: "☀️",
    clear: "☀️",
    rain: "🌧️",
    rainy: "🌧️",
    drizzle: "🌦️",
    shower: "🌦️",
    cloud: "☁️",
    cloudy: "☁️",
    overcast: "☁️",
    snow: "❄️",
    snowy: "❄️",
    storm: "⛈️",
    thunderstorm: "⛈️",
    thunder: "⛈️",
    lightning: "⛈️",
    fog: "🌫️",
    foggy: "🌫️",
    mist: "🌫️",
    misty: "🌫️",
    haze: "🌫️",
    hazy: "🌫️",
    wind: "💨",
    windy: "💨",
    hot: "🌡️",
    cold: "🥶",
    freezing: "🧊",
    // Fallback
    default: "🌈"
  },
  
  // Priority order for checking conditions (higher priority first)
  priority: [
    "thunderstorm", "storm", "lightning", "thunder",
    "snow", "snowy", "freezing",
    "rain", "rainy", "drizzle", "shower",
    "fog", "foggy", "mist", "misty", "haze", "hazy",
    "cloud", "cloudy", "overcast",
    "sunny", "clear",
    "wind", "windy",
    "hot", "cold"
  ]
};

// Function to get weather emoji based on condition
function getWeatherEmoji(condition) {
  if (!condition || typeof condition !== 'string') {
    return WEATHER_CONFIG.emojis.default;
  }
  
  const normalizedCondition = condition.toLowerCase().trim();
  
  // Check for exact matches first
  if (WEATHER_CONFIG.emojis[normalizedCondition]) {
    return WEATHER_CONFIG.emojis[normalizedCondition];
  }
  
  // Check for partial matches using priority order
  for (const keyword of WEATHER_CONFIG.priority) {
    if (normalizedCondition.includes(keyword)) {
      return WEATHER_CONFIG.emojis[keyword];
    }
  }
  
  // Return default emoji if no match found
  return WEATHER_CONFIG.emojis.default;
}

// Function to log selector failures
function logSelectorFailure(selector) {
  console.error(`Selector failure: ${selector}`);
  if (typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(
      `Failed to find element with selector: ${selector}. Please check the selector or update it if the target website has changed.`
    );
  }
}

// Function to get element by selector with logging
function getElement(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    logSelectorFailure(selector);
  }
  return element;
}

// Update existing code to use getElement function
const form = getElement("#weather-form");
const cityInput = getElement("#city");
const weatherData = getElement("#weather-data");

const weatherBtn = getElement("#submit-btn"); // <-- FIX: Changed selector from #weather-btn to #submit-btn
const searchBtn = getElement("#search-btn");
const clearBtn = getElement("#clear-btn"); // Ensure no duplicate declaration
const spinner = getElement(".spinner");
const errorElement = getElement("#city-error");

let recentSearches = [];

if (form) {
  form.addEventListener("submit", handleSubmit);
}

// Add the clear button event listener
if (clearBtn) {
  clearBtn.addEventListener("click", handleClear);
}

function initialize() {
  loadRecentSearches();
  setupServiceWorker();
  loadConfig();
}

async function handleSubmit(e) {
  e.preventDefault();
  const city = cityInput?.value.trim();

  // Clear the previous error message when a new search starts
  clearError();

  if (!city) {
    showError("City name cannot be empty.");
    return;
  }

  if (!isValidInput(city)) {
    showError("Please enter a valid city name (e.g., São Paulo, O'Fallon).");
    return;
  }

  try {
    toggleLoading(true);
    const data = await fetchWeatherData(city);

    displayWeather(data);
    addToRecentSearches(city);
  } catch (error) {
    console.log(error);
    if (error.message.includes("Unable to parse weather data")) {
    showError("❌ City not found. Please check the spelling or try a different city.");
    } 
    else {
      showError("⚠️ Something went wrong. Please try again later.");
    }
     
  } finally {
    toggleLoading(false);
  }
}

async function fetchWeatherData(city) {
  try {
    if (!city) {
      throw new Error("City parameter is required");
    }
    
    const configResponse = await fetch(
      "https://weather-api-ex1z.onrender.com/config"
    );
    if (!configResponse.ok) {
      throw new Error("Failed to load configuration");
    }

    const config = await configResponse.json();

    // Check if URL exists in config
    if (!config.API_URL) {
      throw new Error("API URL not configured");
    }

    //const URL = config.API_URL || "https://weather-api-ex1z.onrender.com";
    // Use environment variable, with fallback in case it's missing
const fallbackUrl = process.env.FALLBACK_API_URL || 'https://default-weather-api.example.com/data';

// Later when using it:
fetch(fallbackUrl)
  .then(res => res.json())
  .then(data => {
    // existing logic...
  })
  .catch(err => {
    console.error('Weather fetch failed:', err);
  });


    // Encode the city name for the URL
    const encodedCity = encodeURIComponent(city);

    const response = await fetch(`${URL}/api/weather/${encodedCity}`);
    console.log("response status", response.status);
    if (!response.ok) {
      const contentType = response.headers.get("Content-Type");

      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Failed to fetch weather data";

        if (response.status === 404) {
          throw new Error("City not found. Please check the city name.");
        }

        throw new Error(errorMessage);
      } else {
        throw new Error(
          `Unexpected error: ${response.status} ${response.statusText}`
        );
      }
    }

    return await response.json();
  } catch (error) {
    console.error("Fetch error:", error);
    throw new Error(error.message || "An unexpected error occurred");
  }
}

function toggleLoading(isLoading) {
  if (weatherBtn) weatherBtn.disabled = isLoading;
  if (searchBtn) searchBtn.disabled = isLoading;
  if (spinner) spinner.classList.toggle("hidden", !isLoading);
}

function displayWeather(data) {
  if (!data || !data.temperature) {
    showError("Failed to retrieve weather data. Please try again.");
    return;
  }

  // Use the new emoji configuration function
  const emoji = getWeatherEmoji(data.condition);

  const weatherIcon = document.getElementById("weather-icon");
  if (weatherIcon) {
    weatherIcon.textContent = emoji;
    weatherIcon.style.display = "block";
    weatherIcon.classList.remove("hidden");
  }

  if (weatherData) {
    Array.from(weatherData.children).forEach((child) => {
      if (child.id !== "weather-icon") child.remove();
    });

    const template = `
            <div class="weather-card">
                <div class="weather-details">
                    <p><strong>Temp:</strong> ${data.temperature || "N/A"}°C</p>
                    <p><strong>Date:</strong> ${data.date || "N/A"}</p>
                    <p><strong>Condition:</strong> ${
                      data.condition || "N/A"
                    }</p>
                    <p><strong>Min Temp:</strong> ${
                      data.minTemperature || "N/A"
                    }°C</p>
                    <p><strong>Max Temp:</strong> ${
                      data.maxTemperature || "N/A"
                    }°C</p>
                    <p><strong>Humidity:</strong> ${data.humidity || "N/A"}%</p>
                    <p><strong>Pressure:</strong> ${data.pressure || "N/A"}</p>
                </div>
            </div>
        `;

        // Sanitize the template before inserting it into the DOM
        weatherData.insertAdjacentHTML('beforeend', DOMPurify.sanitize(template));
        weatherData.classList.remove('hidden');
    }
}

function isValidInput(city) {
  return /^[\p{L}\p{M}\s''.-]{2,50}$/u.test(city);
}

function showError(message) {
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add("visible");

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.classList.add("close-btn");
    closeBtn.setAttribute("aria-label", "Close error message");
    closeBtn.onclick = () => clearError();

    errorElement.innerHTML = "";
    errorElement.appendChild(document.createTextNode(message));
    errorElement.appendChild(closeBtn);

    errorElement.setAttribute("tabindex", "-1");
    errorElement.focus();

    if (weatherData) weatherData.innerHTML = "";
  }
}

function clearError() {
  if (errorElement) {
    errorElement.textContent = "";
    errorElement.classList.remove("visible");
  }
}

function sanitizeHTML(str) {
  return DOMPurify.sanitize(str);
}

class StorageManager {
  constructor() {
    this.storageMethod = this.getAvailableStorage();
    this.memoryStorage = { recentSearches: [] };
    this.hasWarnedUser = false;
    
    // Setup warning for in-memory storage
    if (!this.storageMethod) {
      this.setupInMemoryWarnings();
    }
  }

  getAvailableStorage() {
    // Try localStorage first
    if (this.checkStorageAvailability(localStorage)) {
      return localStorage;
    }
    
    // Fallback to sessionStorage
    if (this.checkStorageAvailability(sessionStorage)) {
      console.warn('⚠️ localStorage not available. Using sessionStorage fallback.');
      return sessionStorage;
    }
    
    // Last resort: in-memory storage
    console.warn('⚠️ No persistent storage available. Using in-memory fallback.');
    return null;
  }

  checkStorageAvailability(storageType) {
    try {
      const testKey = '__test__';
      storageType.setItem(testKey, '1');
      storageType.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  setupInMemoryWarnings() {
    // Show user notification about limited storage
    this.showStorageWarning();
    
    // Setup beforeunload warning
    window.addEventListener('beforeunload', (e) => {
      if (this.memoryStorage.recentSearches && this.memoryStorage.recentSearches.length > 0) {
        e.preventDefault();
        e.returnValue = 'Your recent searches will be lost when you leave this page. Are you sure?';
        return e.returnValue;
      }
    });
  }

  showStorageWarning() {
    if (this.hasWarnedUser) return;
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.showStorageWarning());
      return;
    }
    
    // Create a subtle notification
    const notification = document.createElement('div');
    notification.className = 'storage-warning';
    notification.innerHTML = `
      <span>⚠️ Recent searches won't persist after page reload</span>
      <button onclick="this.parentElement.remove()" aria-label="Close notification">×</button>
    `;
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
      padding: 10px 15px;
      border-radius: 5px;
      font-size: 14px;
      z-index: 1000;
      max-width: 300px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    `;
    
    notification.querySelector('button').style.cssText = `
      background: none;
      border: none;
      color: #856404;
      font-size: 16px;
      cursor: pointer;
      margin-left: 10px;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
    
    this.hasWarnedUser = true;
  }

  getItem(key) {
    if (this.storageMethod) {
      const item = this.storageMethod.getItem(key);
      return item ? JSON.parse(item) : null;
    } else {
      return this.memoryStorage[key] || null;
    }
  }

  setItem(key, value) {
    if (this.storageMethod) {
      this.storageMethod.setItem(key, JSON.stringify(value));
    } else {
      this.memoryStorage[key] = value;
    }
  }

  removeItem(key) {
    if (this.storageMethod) {
      this.storageMethod.removeItem(key);
    } else {
      delete this.memoryStorage[key];
    }
  }

  getStorageType() {
    if (this.storageMethod === localStorage) return 'localStorage';
    if (this.storageMethod === sessionStorage) return 'sessionStorage';
    return 'memory';
  }
}

const storageManager = new StorageManager();

// Debug: Log storage initialization
console.log('🔧 Storage system initialized:', {
  storageType: storageManager.getStorageType(),
  available: !!storageManager.storageMethod
});

function addToRecentSearches(city) {
  const normalizedCity = city.trim().toLowerCase();
  const limit = parseInt(storageManager.getItem('recentSearchLimit'), 10) || 5;

  let recent = storageManager.getItem('recentSearches') || [];
  recent = recent.filter(c => c.toLowerCase() !== normalizedCity);
  recent = [city, ...recent].slice(0, limit);

  try {
    storageManager.setItem('recentSearches', recent);
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.warn('LocalStorage quota exceeded. Removing oldest search.');
      recent.pop();
      try {
        storageManager.setItem('recentSearches', recent);
      } catch (retryError) {
        console.error('Still failing after removing oldest entry:', retryError);
      }
    } else {
      console.error('Error adding to recent searches:', error);
    }
  }

  displayRecentSearches();
}

function displayRecentSearches() {
  const recent = storageManager.getItem('recentSearches') || [];
  const list = document.getElementById('recent-list');
  if (list) {
    list.innerHTML = recent
      .map(city => `
        <li role="listitem">
          <button class="recent-item" data-city="${sanitizeHTML(city)}">
            ${sanitizeHTML(city)}
          </button>
        </li>`)
      .join('');

    list.style.display = 'flex';
    list.style.flexWrap = 'wrap';
    list.style.listStyle = 'none';

    document.querySelectorAll('.recent-item').forEach(button => {
      button.addEventListener('click', function () {
        if (cityInput) {
          cityInput.value = this.dataset.city;
          handleSubmit(new Event('submit'));
        }
      });
    });
  }
}

function loadRecentSearches() {
  displayRecentSearches();
}

async function loadConfig() {
  try {
    const response = await fetch('https://weather-api-ex1z.onrender.com/config');
    if (!response.ok) throw new Error('Failed to load config');

    const config = await response.json();

    const limit = parseInt(config.RECENT_SEARCH_LIMIT, 10) || 5;
    storageManager.setItem('recentSearchLimit', limit);
    console.log(`Recent search limit: ${limit}`);

    return limit;
  } catch (error) {
    console.error('Failed to load environment config:', error);
    return 5;
  }
}

function setupServiceWorker() {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log(
          "Service Worker registered with scope:",
          registration.scope
        );
        registration.onupdatefound = () => {
          const newSW = registration.installing;
          newSW.onstatechange = () => {
            if (
              newSW.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              console.log("New content is available, please refresh.");
              showUpdateNotification();
            }
          };
        };
      })
      .catch((error) =>
        console.error("Service Worker registration failed:", error)
      );
  });
}

function showUpdateNotification() {
  const updateBanner = document.createElement("div");
  updateBanner.classList.add("update-banner");
  updateBanner.innerHTML = `
        <p>New version available. <button id="reload-btn">Reload</button></p>
    `;

  document.body.appendChild(updateBanner);

  document.getElementById("reload-btn").addEventListener("click", () => {
    window.location.reload();
  });

  const style = document.createElement("style");
  style.textContent = `
        .update-banner {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #0078D7;
            color: white;
            padding: 15px;
            text-align: center;
            z-index: 9999;
        }
        .update-banner button {
            margin-left: 10px;
            padding: 5px 10px;
            cursor: pointer;
        }
    `;
  document.head.appendChild(style);
}

// Documentation for updating CSS selectors
/**
 * If the target website changes its structure, the CSS selectors used in this script may need to be updated.
 * To update the selectors:
 * 1. Identify the new structure of the target website.
 * 2. Update the selectors in the getElement function calls.
 * 3. Test the application to ensure the new selectors work correctly.
 */

// Initialize the app
initialize();

function handleClear(e) {
  e.preventDefault(); // Prevent form submission
  
  if (cityInput) cityInput.value = ""; // Clear the input field
  clearError(); // Clear error messages
  if (weatherData) weatherData.innerHTML = ""; // Clear weather data display
}
