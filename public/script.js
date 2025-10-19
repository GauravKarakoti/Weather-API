// Constants
const API_BASE_URL = "https://weather-api-ex1z.onrender.com";
const DEFAULT_SEARCH_LIMIT = 5;

// Weather emoji configuration object
const WEATHER_CONFIG = {
  emojis: {
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
    default: "🌈",
  },
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

  if (WEATHER_CONFIG.emojis[normalizedCondition]) {
    return WEATHER_CONFIG.emojis[normalizedCondition];
  }

  for (const keyword of WEATHER_CONFIG.priority) {
    if (normalizedCondition.includes(keyword)) {
      return WEATHER_CONFIG.emojis[keyword];
    }
  }

  return WEATHER_CONFIG.emojis.default;
}

// Function to log selector failures
function logSelectorFailure(selector) {
  console.error(`Selector failure: ${selector}`);
  if (typeof window !== "undefined" && typeof window.alert === "function") {
    const isTest = typeof process !== "undefined" && process.env && process.env.NODE_ENV === "test";
    if (!isTest) {
      window.alert(
        `Failed to find element with selector: ${selector}. Please check the selector or update it if the target website has changed.`
      );
    }
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

// DOM element cache
let form;
let cityInput;
let weatherData;
let weatherBtn;
let searchBtn;
let clearBtn;
let spinner;
let errorElement;

function cacheElements() {
  form = getElement("#weather-form");
  cityInput = getElement("#city");
  weatherData = getElement("#weather-data");
  weatherBtn = getElement("#submit-btn");
  searchBtn = getElement("#search-btn");
  clearBtn = getElement("#clear-btn");
  spinner = getElement(".spinner");
  errorElement = getElement("#city-error");

  if (!document.getElementById("recent-list")) {
    const ul = document.createElement("ul");
    ul.id = "recent-list";
    try {
      document.body.appendChild(ul);
    } catch (e) {
      console.warn("Could not append recent-list to body");
    }
  }

  try {
    if (weatherBtn && weatherBtn.type === "submit") weatherBtn.type = "button";
    if (searchBtn && searchBtn.type === "submit") searchBtn.type = "button";
  } catch (e) {
    console.warn("Could not convert button types");
  }

  attachEventListeners();
}

function attachEventListeners() {
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      cacheElements();
      loadRecentSearches();
      setupMessageListener();
    });
  } else {
    cacheElements();
    loadRecentSearches();
    setupMessageListener();
  }
  
  setupServiceWorker();
  loadConfig();
}

// Listen for messages from service worker
function setupMessageListener() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "GET_RECENT_SEARCHES") {
        const recentSearches = storageManager.getItem("recentSearches") || [];
        if (event.ports[0]) {
          event.ports[0].postMessage({ recentSearches });
        }
      }
    });
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const city = cityInput?.value.trim();

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
    console.error(error);
    if (error.message.includes("Unable to parse weather data")) {
      showError(
        "❌ City not found. Please check the spelling or try a different city."
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
    const url = `${API_BASE_URL}/api/weather-forecast/${encodedCity}`;

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

  if (!weatherData) return;

  weatherData.innerHTML = "";

  const dates = new Set();
  const cards = [];
  let cnt = 0;

  for (let item of data.list) {
    const date = item.dt_txt.split(" ")[0];
    const dateObj = new Date(item.dt_txt);
    const day = dateObj.toLocaleDateString("en-US", { weekday: "long" });

    if (!dates.has(date)) {
      dates.add(date);
      cnt++;

      const emoji = getWeatherEmoji(item.weather[0].main);

      const template = `
        <div class="weather-card">
          <div class="weather-details">
            <p><strong>Day:</strong> ${day}</p>
            <p><strong>Temp:</strong> ${item.main.temp.toFixed(1)}°C ${emoji}</p>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Condition:</strong> ${item.weather[0].main}</p>
            <p><strong>Min Temp:</strong> ${item.main.temp_min.toFixed(1)}°C</p>
            <p><strong>Max Temp:</strong> ${item.main.temp_max.toFixed(1)}°C</p>
            <p><strong>Humidity:</strong> ${item.main.humidity}%</p>
            <p><strong>Pressure:</strong> ${item.main.pressure} hPa</p>
          </div>
        </div>
      `;

      cards.push(template);
      if (cnt === 4) break;
    }
  }

  // Check if DOMPurify is available
  const htmlContent = cards.join("");
  if (typeof DOMPurify !== "undefined") {
    weatherData.innerHTML = DOMPurify.sanitize(htmlContent);
  } else {
    weatherData.innerHTML = htmlContent;
  }

  weatherData.classList.remove("hidden");
}

function isValidInput(city) {
  return /^[\p{L}\p{M}\s''.-]{2,50}$/u.test(city);
}

function showError(message) {
  if (errorElement) {
    errorElement.innerHTML = "";
    errorElement.classList.add("visible");

    const textNode = document.createTextNode(message);
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.classList.add("close-btn");
    closeBtn.setAttribute("aria-label", "Close error message");
    closeBtn.addEventListener("click", clearError);

    errorElement.appendChild(textNode);
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

// Storage Manager Class
class StorageManager {
  constructor() {
    this.storageMethod = this.getAvailableStorage();
    this.memoryStorage = { recentSearches: [] };
    this.hasWarnedUser = false;

    if (!this.storageMethod) {
      this.setupInMemoryWarnings();
    }
  }

  getAvailableStorage() {
    if (this.checkStorageAvailability(localStorage)) {
      return localStorage;
    }

    if (this.checkStorageAvailability(sessionStorage)) {
      console.warn(
        "⚠️ localStorage not available. Using sessionStorage fallback."
      );
      return sessionStorage;
    }

    console.warn(
      "⚠️ No persistent storage available. Using in-memory fallback."
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
    this.showStorageWarning();

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

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.showStorageWarning()
      );
      return;
    }

    const notification = document.createElement("div");
    notification.className = "storage-warning";
    
    const messageSpan = document.createElement("span");
    messageSpan.textContent = "⚠️ Recent searches won't persist after page reload";
    
    const closeButton = document.createElement("button");
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close notification");
    closeButton.addEventListener("click", () => notification.remove());

    notification.appendChild(messageSpan);
    notification.appendChild(closeButton);

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
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    closeButton.style.cssText = `
      background: none;
      border: none;
      color: #856404;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    `;

    document.body.appendChild(notification);

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

console.log("🔧 Storage system initialized:", {
  storageType: storageManager.getStorageType(),
  available: !!storageManager.storageMethod,
});

function addToRecentSearches(city) {
  const normalizedCity = city.trim().toLowerCase();
  const limit = parseInt(storageManager.getItem("recentSearchLimit"), 10) || DEFAULT_SEARCH_LIMIT;

  let recent = storageManager.getItem("recentSearches") || [];
  recent = recent.filter((c) => c.toLowerCase() !== normalizedCity);
  recent = [city, ...recent].slice(0, limit);

  try {
    storageManager.setItem("recentSearches", recent);
  } catch (error) {
    if (error.name === "QuotaExceededError") {
      console.warn("Storage quota exceeded. Removing oldest search.");
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
  
  if (!list) {
    console.warn("Recent list element not found");
    return;
  }

  // Remove old event listeners by clearing and rebuilding
  list.innerHTML = "";

  recent.forEach((city) => {
    const li = document.createElement("li");
    li.setAttribute("role", "listitem");

    const button = document.createElement("button");
    button.className = "recent-item";
    button.textContent = city;
    button.dataset.city = city;
    
    button.addEventListener("click", function () {
      if (cityInput) {
        cityInput.value = this.dataset.city;
        handleSubmit(new Event("submit"));
      }
    });

    li.appendChild(button);
    list.appendChild(li);
  });

  list.style.display = "flex";
  list.style.flexWrap = "wrap";
  list.style.listStyle = "none";
}

function loadRecentSearches() {
  displayRecentSearches();
}

async function loadConfig() {
  try {
    const response = await fetch(`${API_BASE_URL}/config`);
    if (!response.ok) throw new Error("Failed to load config");

    const config = await response.json();

    const limit = parseInt(config.RECENT_SEARCH_LIMIT, 10) || DEFAULT_SEARCH_LIMIT;
    storageManager.setItem("recentSearchLimit", limit);
    console.log(`Recent search limit: ${limit}`);

    return limit;
  } catch (error) {
    console.error("Failed to load environment config:", error);
    storageManager.setItem("recentSearchLimit", DEFAULT_SEARCH_LIMIT);
    return DEFAULT_SEARCH_LIMIT;
  }
}

function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("Service Worker registered with scope:", registration.scope);

        setupPeriodicSync(registration);
        triggerNavigationSyncFallback(registration);

        registration.addEventListener("updatefound", () => {
          const newSW = registration.installing;
          if (newSW) {
            newSW.addEventListener("statechange", () => {
              if (newSW.state === "installed" && navigator.serviceWorker.controller) {
                console.log("New content is available, please refresh.");
                showUpdateNotification();
              }
            });
          }
        });
      })
      .catch((error) =>
        console.error("Service Worker registration failed:", error)
      );
  });
}

async function setupPeriodicSync(registration) {
  try {
    if ("periodicSync" in registration) {
      const status = await navigator.permissions.query({
        name: "periodic-background-sync",
      });

      if (status.state === "granted") {
        await registration.periodicSync.register("weather-sync", {
          minInterval: 12 * 60 * 60 * 1000,
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

function triggerNavigationSyncFallback(registration) {
  try {
    if (registration && registration.periodicSync) return;

    const COOLDOWN_MS = 12 * 60 * 60 * 1000;
    
    // Use in-memory storage for test environments
    const getLastSync = () => {
      if (typeof sessionStorage !== "undefined") {
        return sessionStorage.getItem("lastNavSync");
      }
      return null;
    };
    
    const setLastSync = (value) => {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("lastNavSync", value);
      }
    };

    const last = getLastSync();
    if (last && Date.now() - Number(last) < COOLDOWN_MS) return;

    const msg = { type: "NAVIGATION_SYNC" };
    
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(msg);
      setLastSync(String(Date.now()));
      console.log("Navigation sync fallback triggered");
      return;
    }

    if (registration && registration.active) {
      registration.active.postMessage(msg);
      setLastSync(String(Date.now()));
      console.log("Navigation sync fallback triggered via registration.active");
    }
  } catch (e) {
    console.warn("Failed to trigger navigation sync fallback", e);
  }
}

function showUpdateNotification() {
  const updateBanner = document.createElement("div");
  updateBanner.className = "update-banner";

  const paragraph = document.createElement("p");
  paragraph.textContent = "New version available. ";

  const reloadBtn = document.createElement("button");
  reloadBtn.id = "reload-btn";
  reloadBtn.textContent = "Reload";
  reloadBtn.addEventListener("click", () => {
    window.location.reload();
  });

  paragraph.appendChild(reloadBtn);
  updateBanner.appendChild(paragraph);
  document.body.appendChild(updateBanner);

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
      background: white;
      color: #0078D7;
      border: none;
      border-radius: 3px;
    }
  `;
  document.head.appendChild(style);
}

function handleClear(e) {
  e.preventDefault();

  if (cityInput) cityInput.value = "";
  clearError();
  if (weatherData) weatherData.innerHTML = "";
}

// Initialize the app
if (typeof window !== "undefined") {
  const isTest = typeof process !== "undefined" && process.env && process.env.NODE_ENV === "test";
  if (!isTest) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initialize);
    } else {
      initialize();
    }
  }
}

// Exports for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    isValidInput,
    addToRecentSearches,
    handleSubmit,
    handleClear,
    initialize,
    displayRecentSearches,
    storageManager,
    getElement,
    cacheElements,
    getWeatherEmoji,
  };
}
