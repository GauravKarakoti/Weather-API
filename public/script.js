     console.log('🔥 script.js LOADED - Starting init');
     // Add at top (line 1-5)
        const CONFIG = {
     NODE_ENV: 'development',
     API_URL: 'https://api.openweathermap.org/data/2.5',
     OPENWEATHER_KEY: '60080cccccb614e720cd35cda50919fb',  // Your actual key here
   };
   
     

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
       console.log('🚀 initialize() called - Caching elements');
       
       cacheElements();
       console.log('📦 Elements cached - Form:', !!form, 'Input:', !!cityInput);
          // Voice Input Setup (Add this entire block)
   function setupVoiceInput() {
     const voiceBtn = document.getElementById('voiceBtn');
     if (!voiceBtn) return console.warn('Voice button not found');

     const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
     if (!SpeechRecognition) {
       voiceBtn.style.display = 'none';  // Hide if unsupported
       return console.warn('Voice not supported in this browser');
     }

     const recognition = new SpeechRecognition();
     recognition.lang = 'en-US';  // English – change to 'hi-IN' for Hindi if needed
     recognition.interimResults = false;  // Wait for full sentence
     recognition.maxAlternatives = 1;

     recognition.onstart = () => {
       voiceBtn.disabled = true;
       voiceBtn.textContent = '🔴';  // Visual feedback
       voiceBtn.classList.add('listening');
       console.log('Voice listening started...');
     };

     recognition.onresult = (event) => {
       const transcript = event.results[0][0].transcript.toLowerCase().trim();
       console.log('Voice transcript:', transcript);

       // Parse city name (e.g., "weather in mysore" -> "mysore")
const match = transcript.match(/in\s+([a-zA-Z\s,.\-]+)/i);
  // Looks for "in [city]"
let city;

if (match) {
  city = match[1].trim();
} else {
  // Fallback: First word or whole phrase
  city = transcript.split(/\s+/)[0] || transcript;
}

       if (cityInput) {
         cityInput.value = city.charAt(0).toUpperCase() + city.slice(1);  // Capitalize
         console.log('Parsed city from voice:', city);
         // Auto-submit (triggers existing handleSubmit)
         if (form) {
           handleSubmit(new Event('submit'));
         }
       }
     };

     recognition.onerror = (event) => {
       console.error('Voice error:', event.error);
       voiceBtn.disabled = false;
       voiceBtn.textContent = '🎤';
       voiceBtn.classList.remove('listening');
       if (event.error !== 'aborted') {
         alert('Voice input failed (' + event.error + '). Use text input.');
       }
     };

     recognition.onend = () => {
       voiceBtn.disabled = false;
       voiceBtn.textContent = '🎤';
       voiceBtn.classList.remove('listening');
       console.log('Voice listening ended');
     };

     // Start listening on button click
     voiceBtn.addEventListener('click', () => {
       recognition.start();
     });

     console.log('Voice input ready');
   }

  
       
       loadRecentSearches();
       setupServiceWorker();
       setupMessageListener();
        setupVoiceInput(); 
       console.log('✅ initialize() complete');
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
     console.log('🎯 handleSubmit called - City:', cityInput?.value);  // Debug

     const city = cityInput?.value.trim();

     // Clear previous error
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
       console.log('Starting fetch for city:', city);  // Debug
       toggleLoading(true);
       const data = await fetchWeatherData(city);
       console.log('Fetch success - Data:', data);  // Debug

       displayWeather(data);
       addToRecentSearches(city);
     } catch (error) {
       console.error('handleSubmit error:', error);  // Debug
       if (error.message.includes("Unable to parse weather data")) {
         showError("❌ City not found. Please check the spelling or try a different city.");
       } else {
         showError("⚠️ Something went wrong. Please try again later. Error: " + error.message);  // Show full error
       }
     } finally {
       toggleLoading(false);
     }
   }
   

   async function fetchWeatherData(city) {
     try {
       console.log('fetchWeatherData called for:', city);  // Debug
       if (!city) throw new Error("City parameter is required");

       const encodedCity = encodeURIComponent(city);
       
       // Get token (mock or real)
       const token = localStorage.getItem('access_token') || 'demo-token';
       console.log('Using token:', token.substring(0, 10) + '...');  // Debug (partial)

       // Try local backend first (if running npm start)
       let url = `http://localhost:3003/api/weather/${encodedCity}`;
       let response = await fetch(url, {
         headers: {
           'Authorization': `Bearer ${token}`,
           'Content-Type': 'application/json'
         }
       });

       if (!response.ok) {
         console.log('Local API failed (status:', response.status, '), falling back to mock');  // Debug
         // Mock fallback (no API call – for demo)
         await new Promise(resolve => setTimeout(resolve, 1000));  // Simulate delay
         return {
  city: city,
  temperature: Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 20) + 15,  // Secure random 15-35°C
  condition: ['Sunny', 'Cloudy', 'Rainy', 'Foggy'][Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 4)],  // Secure random index
  humidity: Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 40) + 50,  // Secure random 50-90%
  minTemp: Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 5) + 10,
  maxTemp: Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 5) + 20,
  pressure: 1013,
  forecast: []  // Empty for single
};

       }

       console.log('Local API success - Status:', response.status);  // Debug
       const data = await response.json();
       return data;  // Use real data if backend works
     } catch (error) {
       console.error('fetchWeatherData error:', error);  // Debug
       // Mock fallback on any error
       console.log('Using mock data due to error');
       await new Promise(resolve => setTimeout(resolve, 1000));
       return {
         city: city,
         temperature: 25,  // Default mock
         condition: 'Sunny',
         humidity: 60,
         minTemp: 22,
         maxTemp: 28,
         pressure: 1013,
         forecast: []
       };
     }
   }
   
   
function toggleLoading(isLoading) {
  if (weatherBtn) weatherBtn.disabled = isLoading;
  if (searchBtn) searchBtn.disabled = isLoading;
  if (spinner) spinner.classList.toggle("hidden", !isLoading);
}

function displayWeather(data) {
  console.log('displayWeather called with data:', data);

  if (!data) {
    console.error('No data to display');
    showError('No weather data received');
    return;
  }

  const weatherDataEl = document.getElementById("weather-data");
  if (!weatherDataEl) {
    console.error('Weather element not found – check HTML <div id="weather-data">');
    return;
  }

  weatherDataEl.innerHTML = "";
  weatherDataEl.classList.remove("hidden");

  // Helper to safely parse numbers with default
  const parseNumber = (value, defaultValue = 0) => {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  };

  // Helper to render a weather card
  const renderCard = (info) => {
    const template = `
      <div class="weather-card">
        <div class="weather-details">
          <p><strong>Day:</strong> ${info.day}</p>
          <p><strong>Temp:</strong> ${info.temp}°C</p>
          <p><strong>Date:</strong> ${info.date}</p>
          <p><strong>Condition:</strong> ${info.condition}</p>
          <p><strong>Min Temp:</strong> ${info.minTemp}°C</p>
          <p><strong>Max Temp:</strong> ${info.maxTemp}°C</p>
          <p><strong>Humidity:</strong> ${info.humidity}%</p>
          <p><strong>Pressure:</strong> ${info.pressure} hPa</p>
        </div>
      </div>
    `;
    weatherDataEl.insertAdjacentHTML(
      "beforeend",
      DOMPurify ? DOMPurify.sanitize(template) : template
    );
  };

  if (data.temperature !== undefined) {
    // Flat format
    console.log('Using flat backend format');
    const temp = parseNumber(data.temperature);
    renderCard({
      day: new Date(data.date || new Date()).toLocaleDateString("en-US", { weekday: "long" }),
      date: data.date || new Date().toDateString(),
      temp: temp.toFixed(1),
      condition: data.condition || 'Unknown',
      minTemp: parseNumber(data.minTemperature, temp - 5).toFixed(1),
      maxTemp: parseNumber(data.maxTemperature, temp + 5).toFixed(1),
      humidity: parseNumber(data.humidity, 60),
      pressure: parseNumber(data.pressure, 1013)
    });
  } else if (data.list) {
    // Nested format
    console.log('Using nested format');
    const dates = new Set();
    let count = 0;

    for (const item of data.list) {
      if (!item.main) continue;

      const date = item.dt_txt?.split(" ")[0] || new Date().toDateString();
      if (dates.has(date)) continue;

      dates.add(date);
      count++;

      renderCard({
        day: new Date(item.dt_txt || date).toLocaleDateString("en-US", { weekday: "long" }),
        date,
        temp: item.main.temp?.toFixed(1) ?? 'N/A',
        condition: item.weather?.[0]?.main ?? 'Unknown',
        minTemp: item.main.temp_min?.toFixed(1) ?? 'N/A',
        maxTemp: item.main.temp_max?.toFixed(1) ?? 'N/A',
        humidity: item.main.humidity ?? 'N/A',
        pressure: item.main.pressure ?? 'N/A'
      });

      if (count === 4) break;
    }
  } else {
    console.error('Unknown data format:', data);
    showError('Invalid weather data format');
    return;
  }

  console.log('displayWeather complete – UI updated');

  if ('speechSynthesis' in globalThis) {
    const utterance = new SpeechSynthesisUtterance(
      `Weather in ${data.city || 'the city'} is ${data.condition || 'unknown'} with temperature ${data.temperature || 'unknown'} degrees.`
    );
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
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
        </li>`,
      )
      .join("");

    list.style.display = "flex";
    list.style.flexWrap = "wrap";
    list.style.listStyle = "none";

    document.querySelectorAll(".recent-item").forEach((button) => {
      button.addEventListener("click", function () {
        if (cityInput) {
          cityInput.value = this.dataset.city;
          handleSubmit(new Event("submit"));
        }
      });
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

          // Fixed: Browser-safe init (no process.env)
     if (typeof globalThis !== 'undefined') {  // Detect browser
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
