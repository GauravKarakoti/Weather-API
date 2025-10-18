

// Service Worker Registration
// -----------------------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}


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
    default: "🌈",
  },

  // Priority order for checking conditions (higher priority first)
  priority: [
    "thunderstorm",
    "storm",
    "lightning",
    "thunder",
    "snow",
    "snowy",
    "freezing",
    "rain",
    "rainy",
    "drizzle",
    "shower",
    "fog",
    "foggy",
    "mist",
    "misty",
    "haze",
    "hazy",
    "cloud",
    "cloudy",
    "overcast",
    "sunny",
    "clear",
    "wind",
    "windy",
    "hot",
    "cold",
  ],
};

// Function to get weather emoji based on condition
function getWeatherEmoji(condition) {
  if (!condition || typeof condition !== "string") {
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
  //console.error(`Selector failure: ${selector}`);
  if (
    typeof window !== "undefined" &&
    typeof window.alert === "function" &&
    process.env.NODE_ENV !== "test"
  ) {
    window.alert(
      `Failed to find element with selector: ${selector}. Please check the selector or update it if the target website has changed.`,
    );
  }
}

// Function to get element by selector with logging
function getElement(selector) {
  if (!selector) return null;

  let element = null;

  try {
    if (selector.startsWith("#")) {
      element = document.getElementById(selector.slice(1));
    }
  } catch (e) {
    // fall through to querySelector
  }

  if (!element) {
    element = document.querySelector(selector);
  }

  if (!element) {
    logSelectorFailure(selector);
  }
  return element;
}

let form;
let cityInput;
let weatherData;
let weatherBtn;
let searchBtn;
let clearBtn;
let spinner;
let errorElement;

let recentSearches = [];

function cacheElements() {
  // Query DOM elements once DOM is available
  form = getElement("#weather-form");
  cityInput = getElement("#city");
  weatherData = getElement("#weather-data");
  weatherBtn = getElement("#submit-btn");
  searchBtn = getElement("#search-btn");
  clearBtn = getElement("#clear-btn");
  spinner = getElement(".spinner");
  errorElement = getElement("#city-error");

  // If recent-list isn't present (tests or env), create a fallback so displayRecentSearches won't fail
  if (!document.getElementById("recent-list")) {
    const ul = document.createElement("ul");
    ul.id = "recent-list";
    // Keep it out of the way if body isn't built as expected
    try {
      document.body.appendChild(ul);
    } catch (e) {
      // ignore if body doesn't exist yet
    }
  }

  // Convert submit-type buttons to plain buttons at runtime to avoid jsdom requestSubmit issues.
  // This does not change behavior in a normal browser because we attach our own click handlers.
  try {
    if (weatherBtn && weatherBtn.type === "submit") weatherBtn.type = "button";
    if (searchBtn && searchBtn.type === "submit") searchBtn.type = "button";
  } catch (e) {
    // ignore
  }

  // Attach listeners now that elements exist (if they exist)
  if (form) {
    form.addEventListener("submit", handleSubmit);
  }

  if (weatherBtn) {
    weatherBtn.addEventListener("click", handleSubmit);
  }
  if (searchBtn) {
    searchBtn.addEventListener("click", handleSubmit);
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", handleClear);
  }
}

function initialize() {
  // Ensure we cache DOM elements before doing DOM-dependent work
  cacheElements();

  // Also ensure cacheElements runs after DOM is fully parsed if needed
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cacheElements);
  }

  loadRecentSearches();
  setupServiceWorker();
  // loadConfig();
  setupMessageListener();
}

// Listen for messages from service worker
function setupMessageListener() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "GET_RECENT_SEARCHES") {
        // Send recent searches back to service worker
        const recentSearches = storageManager.getItem("recentSearches") || [];
        event.ports[0]?.postMessage({ recentSearches });
      }
    });
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const city = cityInput?.value.trim();

  // Clear the previous error message when a new search starts
  clearError();

  if (!city) {
    showError("City name cannot be empty.");
    return "City name cannot be empty";
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
      showError(
        "❌ City not found. Please check the spelling or try a different city.",
      );
    } else {
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

    const encodedCity = encodeURIComponent(city);

    const url = `https://weather-api-ex1z.onrender.com/api/weather-forecast/${encodedCity}`;

    const response = await fetch(url);
    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.error("Failed to parse JSON response:", e);
      throw new Error("Invalid response format from weather API.");
    }
    if (!response.ok) {
      let errorMsg;

      if (data?.error) {
        errorMsg = data.error;
      } else if (response.status === 404) {
        errorMsg = "City not found. Please check the city name.";
      } else {
        errorMsg = "Failed to fetch weather data";
      }

      throw new Error(errorMsg);
    }

    if (data?.forecast) {
      return {
        list: data.forecast.map((entry) => ({
          dt_txt: entry.date || entry.dt_txt,
          main: {
            temp: entry.temperature || (entry.main && entry.main.temp),
            temp_min: entry.min || (entry.main && entry.main.temp_min),
            temp_max: entry.max || (entry.main && entry.main.temp_max),
            humidity: entry.humidity || (entry.main && entry.main.humidity),
            pressure: entry.pressure || (entry.main && entry.main.pressure),
          },
          weather: [
            {
              main: entry.condition || (entry.weather && entry.weather[0].main),
            },
          ],
        })),
      };
    } else {
      throw new Error("Unable to parse weather data");
    }
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
  if (!data?.list) {
    showError("Failed to retrieve weather data. Please try again.");
    return;
  }

  const weatherDataEl = document.getElementById("weather-data");
  if (!weatherDataEl) return;

  weatherDataEl.innerHTML = ""; // Clear previous data

  const dates = new Set();
  let cnt = 0;

  for (let item of data.list) {
    const date = item.dt_txt.split(" ")[0];
    const dateObj = new Date(item.dt_txt);
    const day = dateObj.toLocaleDateString("en-US", { weekday: "long" });

    if (!dates.has(date)) {
      dates.add(date);
      cnt++;

      const template = `
        <div class="weather-card">
          <div class="weather-details">
            <p><strong>Day:</strong> ${day}</p>
            <p><strong>Temp:</strong> ${item.main.temp.toFixed(1)}°C</p>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Condition:</strong> ${item.weather[0].main}</p>
            <p><strong>Min Temp:</strong> ${item.main.temp_min.toFixed(1)}°C</p>
            <p><strong>Max Temp:</strong> ${item.main.temp_max.toFixed(1)}°C</p>
            <p><strong>Humidity:</strong> ${item.main.humidity}%</p>
            <p><strong>Pressure:</strong> ${item.main.pressure}</p>
          </div>
        </div>
      `;

      weatherDataEl.insertAdjacentHTML(
        "beforeend",
        DOMPurify.sanitize(template),
      );
      if (cnt === 4) break;
    }
  }

  weatherDataEl.classList.remove("hidden");
}

function isValidInput(city) {
  return /^[\p{L}\p{M}\s''.-]{2,50}$/u.test(city);
}

function showError(message) {
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add("visible");

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "x";
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
    if (!this.storageMethod) {
      this.memoryStorage = { recentSearches: [] };
    }
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
      console.warn(
        "⚠️ localStorage not available. Using sessionStorage fallback.",
      );
      return sessionStorage;
    }

    // Last resort: in-memory storage
    console.warn(
      "⚠️ No persistent storage available. Using in-memory fallback.",
    );
    return null;
  }

  checkStorageAvailability(storageType) {
    try {
      const testKey = "__test__";
      storageType.setItem(testKey, "1");
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
    window.addEventListener("beforeunload", (e) => {
      if (
        this.memoryStorage.recentSearches &&
        this.memoryStorage.recentSearches.length > 0
      ) {
        e.preventDefault();
        e.returnValue =
          "Your recent searches will be lost when you leave this page. Are you sure?";
        return e.returnValue;
      }
    });
  }

  showStorageWarning() {
    if (this.hasWarnedUser) return;

    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.showStorageWarning(),
      );
      return;
    }

    // Create a subtle notification
    const notification = document.createElement("div");
    notification.className = "storage-warning";
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

    notification.querySelector("button").style.cssText = `
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
    if (this.storageMethod === localStorage) return "localStorage";
    if (this.storageMethod === sessionStorage) return "sessionStorage";
    return "memory";
  }
}

const storageManager = new StorageManager();

// Debug: Log storage initialization
console.log("🔧 Storage system initialized:", {
  storageType: storageManager.getStorageType(),
  available: !!storageManager.storageMethod,
});

function addToRecentSearches(city) {
  const normalizedCity = city.trim().toLowerCase();
  const limit = parseInt(storageManager.getItem("recentSearchLimit"), 10) || 5;

  let recent = storageManager.getItem("recentSearches") || [];
  recent = recent.filter((c) => c.toLowerCase() !== normalizedCity);
  recent = [city, ...recent].slice(0, limit);

  try {
    storageManager.setItem("recentSearches", recent);
  } catch (error) {
    if (error.name === "QuotaExceededError") {
      console.warn("LocalStorage quota exceeded. Removing oldest search.");
      recent.pop();
      try {
        storageManager.setItem("recentSearches", recent);
      } catch (retryError) {
        console.error("Still failing after removing oldest entry:", retryError);
      }
    } else {
      console.error("Error adding to recent searches:", error);
    }
  }

  displayRecentSearches();
}

function displayRecentSearches() {
  const recent = storageManager.getItem("recentSearches") || [];
  const list = document.getElementById("recent-list");
  if (list) {
    list.innerHTML = recent
      .map(
        (city) => `
        <li role="listitem">
          <button class="recent-item" data-city="${sanitizeHTML(city)}">
            ${sanitizeHTML(city)}
          </button>
        </li>`
      )
      .join("");

    list.style.display = "flex";
    list.style.flexWrap = "wrap";
    list.style.listStyle = "none";

    // Click/Enter events already handled by <button>
    document.querySelectorAll(".recent-item").forEach((button) => {
      button.addEventListener("click", function () {
        if (cityInput) {
          cityInput.value = this.dataset.city;
          handleSubmit(new Event("submit"));
        }
      });
    });

    // Optional: arrow key navigation
    list.addEventListener("keydown", (e) => {
      const focused = document.activeElement;
      if (!focused.classList.contains("recent-item")) return;

      if (e.key === "ArrowDown" && focused.parentElement.nextElementSibling) {
        e.preventDefault();
        focused.parentElement.nextElementSibling.querySelector(".recent-item").focus();
      }
      if (e.key === "ArrowUp" && focused.parentElement.previousElementSibling) {
        e.preventDefault();
        focused.parentElement.previousElementSibling.querySelector(".recent-item").focus();
      }
    });
  } else {
    console.warn("Recent list element not found");
  }
}

function loadRecentSearches() {
  displayRecentSearches();
}

async function loadConfig() {
  try {
    const response = await fetch(
      "https://weather-api-ex1z.onrender.com/config",
    );
    if (!response.ok) throw new Error("Failed to load config");

    const config = await response.json();

    const limit = parseInt(config.RECENT_SEARCH_LIMIT, 10) || 5;
    storageManager.setItem("recentSearchLimit", limit);
    console.log(`Recent search limit: ${limit}`);

    return limit;
  } catch (error) {
    console.error("Failed to load environment config:", error);
    return 5;
  }
}

function setupServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope);

          // Optional: register periodic sync if supported
          setupPeriodicSync(registration);

          // Navigation-based fallback: if periodicSync isn't supported, ask the SW to refresh caches
          // Throttle this to at most once per 12 hours using sessionStorage
          triggerNavigationSyncFallback(registration);

          // Listen for updates
          registration.onupdatefound = () => {
            const newSW = registration.installing;
            newSW.onstatechange = () => {
              if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New content is available, please refresh.');
                showUpdateNotification();
              }
            };
          };
        })
        .catch((error) =>
          console.error('Service Worker registration failed:', error),
        );
    });
  }
}

async function setupPeriodicSync(registration) {
  try {
    // Check if Periodic Background Sync is supported
    if ("periodicSync" in registration) {
      // Request permission for background sync
      const status = await navigator.permissions.query({
        name: "periodic-background-sync",
      });

      if (status.state === "granted") {
        // Register periodic sync
        await registration.periodicSync.register("weather-sync", {
          minInterval: 12 * 60 * 60 * 1000, // 12 hours
        });
        console.log("✅ Periodic sync registered successfully");
      } else {
        console.log("⚠️ Periodic sync permission not granted");
      }
    } else {
      console.log("⚠️ Periodic Background Sync not supported");
    }
  } catch (error) {
    console.error("Failed to register periodic sync:", error);
  }
}

/**
 * Trigger a message-based navigation sync fallback when Periodic Background Sync is unavailable.
 * Uses sessionStorage to avoid calling the SW too frequently (12 hour cooldown).
 */
function triggerNavigationSyncFallback(registration) {
  try {
    const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
    const lastTriggered = parseInt(sessionStorage.getItem("lastNavSync"), 10) || 0;
    const now = Date.now();

    // If periodicSync is supported, we prefer that and skip the manual trigger
    if (registration && "periodicSync" in registration) return;

    if (now - lastTriggered < COOLDOWN_MS) {
      // Throttled
      return;
    }

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "NAVIGATION_SYNC" });
      sessionStorage.setItem("lastNavSync", String(now));
      console.log("Requested NAVIGATION_SYNC from service worker (fallback)");
    } else if (registration && registration.waiting) {
      // In case a SW is installed but not controlling yet, send message to registration
      registration.waiting.postMessage({ type: "NAVIGATION_SYNC" });
      sessionStorage.setItem("lastNavSync", String(now));
      console.log("Requested NAVIGATION_SYNC to waiting service worker (fallback)");
    } else {
      // As a last resort, try to get the active worker from registration
      registration.active?.postMessage({ type: "NAVIGATION_SYNC" });
      sessionStorage.setItem("lastNavSync", String(now));
      console.log("Requested NAVIGATION_SYNC to active service worker (fallback)");
    }
  } catch (err) {
    console.error("Failed to trigger navigation sync fallback:", err);
  }
}

function showUpdateNotification() {
  const updateBanner = document.createElement("div");
  updateBanner.classList.add("update-banner");
  updateBanner.innerHTML = `
        <p>New version available. <button id="reload-btn">Reload</button></p>
    `;

  document.body.appendChild(updateBanner);

  const reloadBtn = document.getElementById("reload-btn");
  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      window.location.reload();
    });
  }

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
if (typeof window !== "undefined" && process.env.NODE_ENV !== "test") {
  window.addEventListener("DOMContentLoaded", initialize);
}

function handleClear(e) {
  e.preventDefault(); // Prevent form submission

  if (cityInput) cityInput.value = ""; // Clear the input field
  clearError(); // Clear error messages
  const weatherDataEl = document.getElementById("weather-data");
  if (weatherDataEl) weatherDataEl.innerHTML = ""; // Clear weather data display
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    isValidInput,
    addToRecentSearches,
    handleSubmit,
    handleClear,
    initialize, // Add this
    displayRecentSearches, // Add this
    storageManager, // Add this for testing
    getElement, // Add this for testing
    cacheElements, // Add this for testing
  };
}
