// Constants
const API_BASE_URL = "https://weather-api-ex1z.onrender.com";
const DEFAULT_SEARCH_LIMIT = 5;
const TEMP_UNIT_KEY = 'weatherUnit'; // For localStorage
const DEFAULT_UNIT = 'celsius'; // 'celsius' or 'fahrenheit'

console.log('🔥 script.js LOADED - Starting init');
// Add at top (line 1-5)
const CONFIG = {
  NODE_ENV: 'development',
  API_URL: 'https://api.openweathermap.org/data/2.5',
  OPENWEATHER_KEY: '60080cccccb614e720cd35cda50919fb', // Your actual key here
};

// Global state for re-rendering
let lastWeatherData = null;

function setBackground(url) {
  try {
  	document.documentElement.style.setProperty('--background-image', `url("${url}")`);
  	// Also set on body as inline style to override CSS if needed
  	if (document.body) document.body.style.backgroundImage = `linear-gradient(rgba(10,10,10,0.8), rgba(10,10,10,0.8)), url(${url})`;
  } catch (e) {
  	console.log(e);
  }
}

function detectWebP() {
  // Tiny WebP probe
  const webpProbe = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
  const img = new Image();
  img.onload = function () {
  	if (img.width > 0 && img.height > 0) {
  	 	// WebP supported
  	 	setBackground('/optimized/assets/WeatherBackground.webp');
  	} else {
  	 	setBackground('/optimized/assets/WeatherBackground-1024.jpg');
  	}
  };
  img.onerror = function () {
  	// Fallback to jpg
  	setBackground('/optimized/assets/WeatherBackground-1024.jpg');
  };
  img.src = webpProbe;
}

// Run detection early
if (typeof globalThis.window !== 'undefined') {
  try {
  	globalThis.addEventListener('DOMContentLoaded', detectWebP);
  	globalThis.addEventListener('DOMContentLoaded', setBackground);
  } catch (e) {
  	console.log(e);
  }
}

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
  if (typeof globalThis.window !== "undefined" && typeof globalThis.alert === "function") {
  	const isTest = typeof process !== "undefined" && process.env && process.env.NODE_ENV === "test";
  	if (!isTest) {
  	 	globalThis.alert(
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
  	console.log(e);
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
let unitToggleBtn; // <-- ADDED

function cacheElements() {
  form = getElement("#weather-form");
  cityInput = getElement("#city");
  weatherData = getElement("#weather-data");
  weatherBtn = getElement("#submit-btn");
  searchBtn = getElement("#search-btn");
  clearBtn = getElement("#clear-btn");
  spinner = getElement(".spinner");
  errorElement = getElement("#city-error");
  unitToggleBtn = getElement("#unit-toggle-btn"); // <-- ADDED

  if (!document.getElementById("recent-list")) {
  	const ul = document.createElement("ul");
  	ul.id = "recent-list";
  	try {
  	 	document.body.appendChild(ul);
  	} catch (e) {
  	 	console.log(e);
  	 	console.warn("Could not append recent-list to body");
  	}
  }

  try {
  	if (weatherBtn && weatherBtn.type === "submit") weatherBtn.type = "button";
  	if (searchBtn && searchBtn.type === "submit") searchBtn.type = "button";
  } catch (e) {
  	console.log(e);
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

  if (unitToggleBtn) { // <-- ADDED
  	unitToggleBtn.addEventListener("click", handleUnitToggle);
  }
}

function initialize() {
  if (document.readyState === "loading") {
  	document.addEventListener("DOMContentLoaded", () => {
  	 	cacheElements();
  	 	setupUnitToggle(); // <-- ADDED
  	 	loadRecentSearches();
  	 	setupMessageListener();
  	});
  } else {
  	cacheElements();
  	setupUnitToggle(); // <-- ADDED
  	loadRecentSearches();
  	setupMessageListener();
  }

  setupServiceWorker();
  loadConfig();
  setupVoiceInput(); // <-- This was moved from the messy block
}
// Voice Input Setup (Add this entire block)
function setupVoiceInput() {
  const voiceBtn = document.getElementById('voiceBtn');
  if (!voiceBtn) return console.warn('Voice button not found');

  const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SpeechRecognition) {
  	voiceBtn.style.display = 'none'; // Hide if unsupported
  	return console.warn('Voice not supported in this browser');
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US'; // English – change to 'hi-IN' for Hindi if needed
  recognition.interimResults = false; // Wait for full sentence
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
  	voiceBtn.disabled = true;
  	voiceBtn.textContent = '🔴'; // Visual feedback
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
  	 	cityInput.value = city.charAt(0).toUpperCase() + city.slice(1); // Capitalize
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

// --- START: NEW TEMPERATURE TOGGLE FUNCTIONS ---

/**
 * Converts Celsius to Fahrenheit.
 * @param {number} c - Temperature in Celsius.
 * @returns {number} - Temperature in Fahrenheit.
 */
function celsiusToFahrenheit(c) {
  return (c * 9 / 5) + 32;
}

/**
 * Sets the initial state of the unit toggle button from localStorage.
 */
function setupUnitToggle() {
  if (!unitToggleBtn) return;
  const currentUnit = storageManager.getItem(TEMP_UNIT_KEY) || DEFAULT_UNIT;
  unitToggleBtn.textContent = currentUnit === 'celsius' ? '°C' : '°F';
  unitToggleBtn.setAttribute('aria-label', `Toggle temperature unit (current: ${currentUnit})`);
}

/**
 * Handles clicks on the unit toggle button.
 * Updates localStorage and re-renders weather data if it exists.
 */
function handleUnitToggle() {
  let currentUnit = storageManager.getItem(TEMP_UNIT_KEY) || DEFAULT_UNIT;
  const newUnit = currentUnit === 'celsius' ? 'fahrenheit' : 'celsius';

  storageManager.setItem(TEMP_UNIT_KEY, newUnit);

  if (unitToggleBtn) {
  	unitToggleBtn.textContent = newUnit === 'celsius' ? '°C' : '°F';
  	unitToggleBtn.setAttribute('aria-label', `Toggle temperature unit (current: ${newUnit})`);
  }

  // Re-render weather if data exists
  if (lastWeatherData) {
  	displayWeather(lastWeatherData);
  }
}

// --- END: NEW TEMPERATURE TOGGLE FUNCTIONS ---


async function handleSubmit(e) {
  e.preventDefault();
  console.log('🎯 handleSubmit called - City:', cityInput?.value); // Debug

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
  	console.log('Starting fetch for city:', city); // Debug
  	toggleLoading(true);
  	const data = await fetchWeatherData(city);
  	console.log('Fetch success - Data:', data); // Debug

  	lastWeatherData = data; // <-- ADDED: Store latest data
  	displayWeather(data);
  	addToRecentSearches(city);
  } catch (error) {
  	console.error('handleSubmit error:', error); // Debug
  	lastWeatherData = null; // <-- ADDED: Clear data on error
  	if (error.message.includes("Unable to parse weather data")) {
  	 	showError("❌ City not found. Please check the spelling or try a different city.");
  	} else {
  	 	showError("⚠️ Something went wrong. Please try again later. Error: " + error.message); // Show full error
  	}
  } finally {
  	toggleLoading(false);
  }
}


async function fetchWeatherData(city) {
  try {
  	console.log('fetchWeatherData called for:', city); // Debug
  	if (!city) throw new Error("City parameter is required");

  	const encodedCity = encodeURIComponent(city);

  	// Get token (mock or real)
  	const token = localStorage.getItem('access_token') || 'demo-token';
  	console.log('Using token:', token.substring(0, 10) + '...'); // Debug (partial)

  	// Try local backend first (if running npm start)
  	// NOTE: We assume the backend *always* returns Celsius (metric).
  	let url = `http://localhost:3003/api/weather/${encodedCity}`;
  	let response = await fetch(url, {
  	 	headers: {
  	 	 	'Authorization': `Bearer ${token}`,
  	 	 	'Content-Type': 'application/json'
  	 	}
  	});

  	if (!response.ok) {
  	 	console.log('Local API failed (status:', response.status, '), falling back to mock'); // Debug
  	 	// Mock fallback (no API call – for demo)
  	 	await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
  	 	return {
  	 	 	city: city,
  	 	 	temperature: Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 20) + 15, // Secure random 15-35°C
  	 	 	condition: ['Sunny', 'Cloudy', 'Rainy', 'Foggy'][Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 4)], // Secure random index
  	 	 	humidity: Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 40) + 50, // Secure random 50-90%
  	 	 	minTemp: Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 5) + 10,
  	 	 	maxTemp: Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 5) + 20,
  	 	 	pressure: 1013,
  	 	 	forecast: [] // Empty for single
  	 	};

  	}

  	console.log('Local API success - Status:', response.status); // Debug
  	const data = await response.json();
  	return data; // Use real data if backend works
  } catch (error) {
  	console.error('fetchWeatherData error:', error); // Debug
  	// Mock fallback on any error
  	console.log('Using mock data due to error');
  	await new Promise(resolve => setTimeout(resolve, 1000));
  	return {
  	 	city: city,
  	 	temperature: 25, // Default mock (Celsius)
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

// --- START: REFACTORED displayWeather HELPERS ---

/**
 * Renders a single weather card into the container.
 * @param {HTMLElement} container - The DOM element to append the card to.
 * @param {object} info - The weather data for the card (raw Celsius values).
 * @param {string} currentUnit - 'celsius' or 'fahrenheit'.
 * @param {string} unitSymbol - '°C' or '°F'.
 */
function renderWeatherCard(container, info, currentUnit, unitSymbol) {
  // Helper to safely parse numbers with default
  const parseNumber = (value, defaultValue = 0) => {
  	const num = Number.parseFloat(value);
  	return Number.isNaN(num) ? defaultValue : num;
  };

  // 'info' object contains raw Celsius values
  let displayTemp = parseNumber(info.temp);
  let displayMin = parseNumber(info.minTemp);
  let displayMax = parseNumber(info.maxTemp);

  // Convert if user preference is Fahrenheit
  if (currentUnit === 'fahrenheit') {
  	displayTemp = celsiusToFahrenheit(displayTemp);
  	displayMin = celsiusToFahrenheit(displayMin);
  	displayMax = celsiusToFahrenheit(displayMax);
  }

  const template = `
  	<div class="weather-card">
  	 	<div class="weather-details">
  	 	 	<p><strong>Day:</strong> ${info.day}</p>
  	 	 	<p><strong>Temp:</strong> ${displayTemp.toFixed(1)}${unitSymbol}</p>
  	 	 	<p><strong>Date:</strong> ${info.date}</p>
  	 	 	<p><strong>Condition:</strong> ${info.condition}</p>
  	 	 	<p><strong>Min Temp:</strong> ${displayMin.toFixed(1)}${unitSymbol}</p>
  	 	 	<p><strong>Max Temp:</strong> ${displayMax.toFixed(1)}${unitSymbol}</p>
  	 	 	<p><strong>Humidity:</strong> ${info.humidity}%</p>
  	 	 	<p><strong>Pressure:</strong> ${info.pressure} hPa</p>
  	 	</div>
  	</div>
  `;
  container.insertAdjacentHTML(
  	"beforeend",
  	typeof DOMPurify !== "undefined" ? DOMPurify.sanitize(template) : template
  );
}

/**
 * Speaks the weather summary using SpeechSynthesis.
 * @param {object} data - The raw weather data from the API.
 * @param {string} currentUnit - 'celsius' or 'fahrenheit'.
 */
function speakWeatherSummary(data, currentUnit) {
  if (!('speechSynthesis' in globalThis)) return;

  // Helper to safely parse numbers
  const parseNumber = (value) => Number.parseFloat(value);

  let tempToSpeakC;
  let conditionToSpeak;

  if (data.temperature !== undefined) {
  	tempToSpeakC = parseNumber(data.temperature); // Flat format
  	conditionToSpeak = data.condition || 'unknown';
  } else if (data.list && data.list.length > 0) {
  	tempToSpeakC = parseNumber(data.list[0].main.temp); // Nested format
  	conditionToSpeak = data.list[0].weather?.[0]?.main || 'unknown';
  } else {
  	tempToSpeakC = Number.NaN; // No temp found
  }

  if (!Number.isNaN(tempToSpeakC)) {
  	let tempToSpeak = tempToSpeakC;
  	let unitToSpeak = 'degrees Celsius';

  	if (currentUnit === 'fahrenheit') {
  	 	tempToSpeak = celsiusToFahrenheit(tempToSpeakC);
  	 	unitToSpeak = 'degrees Fahrenheit';
  	}

  	const utterance = new SpeechSynthesisUtterance(
  	 	`Weather in ${data.city || 'the city'} is ${conditionToSpeak} with temperature ${tempToSpeak.toFixed(0)} ${unitToSpeak}.`
  	);
  	utterance.lang = 'en-US';
  	utterance.rate = 0.9;
  	speechSynthesis.speak(utterance);
  }
}

// --- END: REFACTORED displayWeather HELPERS ---

/**
 * REFACTORED displayWeather function.
 * Uses helper functions to reduce complexity.
 */
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

  const currentUnit = storageManager.getItem(TEMP_UNIT_KEY) || DEFAULT_UNIT;
  const unitSymbol = currentUnit === 'celsius' ? '°C' : '°F';
  const parseNumber = (value, defaultValue = 0) => {
  	const num = Number.parseFloat(value);
  	return Number.isNaN(num) ? defaultValue : num;
  };

  weatherDataEl.innerHTML = ""; // Clear previous results
  weatherDataEl.classList.remove("hidden");

  if (data.temperature !== undefined) {
  	// Flat format
  	console.log('Using flat backend format');
  	const tempC = parseNumber(data.temperature); // Get raw Celsius
  	renderWeatherCard(weatherDataEl, {
  	 	day: new Date(data.date || new Date()).toLocaleDateString("en-US", { weekday: "long" }),
  	 	date: data.date || new Date().toDateString(),
  	 	temp: tempC, // Pass raw Celsius number
  	 	condition: data.condition || 'Unknown',
  	 	minTemp: parseNumber(data.minTemperature, tempC - 5), // Pass raw Celsius
  	 	maxTemp: parseNumber(data.maxTemperature, tempC + 5), // Pass raw Celsius
  	 	humidity: parseNumber(data.humidity, 60),
  	 	pressure: parseNumber(data.pressure, 1013)
  	}, currentUnit, unitSymbol);
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

  	 	renderWeatherCard(weatherDataEl, {
  	 	 	day: new Date(item.dt_txt || date).toLocaleDateString("en-US", { weekday: "long" }),
  	 	 	date,
  	 	 	temp: parseNumber(item.main.temp), // Pass raw Celsius
  	 	 	condition: item.weather?.[0]?.main ?? 'Unknown',
  	 	 	minTemp: parseNumber(item.main.temp_min), // Pass raw Celsius
  	 	 	maxTemp: parseNumber(item.main.temp_max), // Pass raw Celsius
  	 	 	humidity: item.main.humidity ?? 'N/A',
  	 	 	pressure: item.main.pressure ?? 'N/A'
  	 	}, currentUnit, unitSymbol);

  	 	if (count === 4) break;
  	}
  } else {
  	console.error('Unknown data format:', data);
  	showError('Invalid weather data format');
  	return;
  }

  console.log('displayWeather complete – UI updated');

  // Speak the summary
  speakWeatherSummary(data, currentUnit);
}


function isValidInput(city) {
  // FIX: Removed duplicate quote '' and unnecessary escape on hyphen
  return /^[\p{L}\p{M}\s'.-]{2,50}$/u.test(city);
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
  	 	console.log(error);
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
  	 	 	// FIX: Use modern/compatible way to trigger prompt
  	 	 	e.returnValue = "";
  	 	 	return "";
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
  	 	// Handle non-JSON data gracefully (for simple strings)
  	 	const item = this.storageMethod.getItem(key);
  	 	if (key === TEMP_UNIT_KEY && (item === 'celsius' || item === 'fahrenheit')) {
  	 	 	return item; // Return raw string for unit
  	 	}
  	 	try {
  	 	 	return item ? JSON.parse(item) : null;
  	 	} catch (e) {
  	 	 	console.log(e);
  	 	 	return item; // Return raw item if JSON.parse fails
  	 	}
  	} else {
  	 	return this.memoryStorage[key] || null;
  	}
  }

  setItem(key, value) {
  	if (this.storageMethod) {
  	 	// Store units as plain strings, others as JSON
  	 	const valueToStore = (key === TEMP_UNIT_KEY) ? value : JSON.stringify(value);
  	 	this.storageMethod.setItem(key, valueToStore);
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
  const limit = Number.parseInt(storageManager.getItem("recentSearchLimit"), 10) || DEFAULT_SEARCH_LIMIT;

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

// Simple sanitizer as fallback if DOMPurify fails to load
function sanitizeHTML(str) {
  if (typeof DOMPurify !== 'undefined') {
  	return DOMPurify.sanitize(str);
  }
  // Basic fallback
  // FIX: No duplicate characters to remove here, class is correct.
  return str.replaceAll(/[&<>"']/g, function(m) {
  	return {
  	 	'&': '&amp;',
  	 	'<': '&lt;',
  	 	'>': '&gt;',
  	 	'"': '&quot;',
  	 	"'": '&#39;'
  	}[m];
  });
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

  // FIX: Use for...of loop instead of .forEach
  for (const city of recent) {
  	const li = document.createElement("li");
  	li.setAttribute("role", "listitem");

  	const button = document.createElement("button");
  	button.className = "recent-item";
  	button.textContent = city; // Text content is automatically sanitized by browser
  	button.dataset.city = city; // Data attribute is safe

  	button.addEventListener("click", function () {
  	 	if (cityInput) {
  	 	 	cityInput.value = this.dataset.city;
  	 	 	handleSubmit(new Event("submit"));
  	 	}
  	});

  	li.appendChild(button);
  	list.appendChild(li);
  }

  list.style.display = "flex";
  list.style.flexWrap = "wrap";
  list.style.listStyle = "none";

  // Optional: arrow key navigation
  list.addEventListener("keydown", (e) => {
  	const focused = document.activeElement;
  	if (!focused || !focused.classList.contains("recent-item")) return;

  	// FIX: Use optional chaining
  	if (e.key === "ArrowDown" && focused.parentElement?.nextElementSibling) {
  	 	e.preventDefault();
  	 	focused.parentElement.nextElementSibling.querySelector(".recent-item")?.focus();
  	}
  	// FIX: Use optional chaining
  	if (e.key === "ArrowUp" && focused.parentElement?.previousElementSibling) {
  	 	e.preventDefault();
  	 	focused.parentElement.previousElementSibling.querySelector(".recent-item")?.focus();
  	}
  });
}


function loadRecentSearches() {
  displayRecentSearches();
}

async function loadConfig() {
  try {
  	const response = await fetch(`${API_BASE_URL}/config`);
  	if (!response.ok) throw new Error("Failed to load config");

  	const config = await response.json();

  	const limit = Number.parseInt(config.RECENT_SEARCH_LIMIT, 10) || DEFAULT_SEARCH_LIMIT;
  	storageManager.setItem("recentSearchLimit", limit);
  	console.log(`Recent search limit: ${limit}`);

  	return limit;
  } catch (error) {
  	console.error("Failed to load environment config:", error);
  	storageManager.setItem("recentSearchLimit", DEFAULT_SEARCH_LIMIT);
  	return DEFAULT_SEARCH_LIMIT;
  }
}

// FIX: Extracted helper function to reduce nesting
function handleSWUpdate(newSW) {
  if (newSW.state === "installed" && navigator.serviceWorker.controller) {
  	console.log("New content is available, please refresh.");
  	showUpdateNotification();
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
  	 	 	 	// FIX: Call extracted function to reduce nesting level
  	 	 	 	newSW.onstatechange = () => handleSWUpdate(newSW);
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

/**
 * Trigger a message-based navigation sync fallback when Periodic Background Sync is unavailable.
 * Uses sessionStorage to avoid calling the SW too frequently (12 hour cooldown).
 */
function triggerNavigationSyncFallback(registration) {
  try {
  	const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
  	const lastTriggered = Number.parseInt(sessionStorage.getItem("lastNavSync"), 10) || 0;
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
  	// FIX: Use optional chaining
  	} else if (registration?.waiting) {
  	 	// In case a SW is installed but not controlling yet, send message to registration
  	 	registration.waiting.postMessage({ type: "NAVIGATION_SYNC" });
  	 	sessionStorage.setItem("lastNavSync", String(now));
  	 	console.log("Requested NAVIGATION_SYNC to waiting service worker (fallback)");
  	} else {
  	 	// As a last resort, try to get the active worker from registration
  	 	registration.active?.postMessage({ type: "NAVIGATION_SYNC" });
  	 	sessionStorage.setItem("lastNavSync", String(now));
  	 	console.log("Requested NAVIGATION_SYNC to active service worker (fallback)");
s  	}
  } catch (err) {
  	console.error("Failed to trigger navigation sync fallback:", err);
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
  	globalThis.location.reload();
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
  lastWeatherData = null; // <-- ADDED: Clear stored data
}

// Initialize the app
if (typeof globalThis.window !== "undefined") {
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
  	celsiusToFahrenheit, // <-- ADDED for testing
  	handleUnitToggle, // <-- ADDED for testing
  	setupUnitToggle, // <-- ADDED for testing
  	TEMP_UNIT_KEY, // <-- ADDED for testing
  	DEFAULT_UNIT // <-- ADDED for testing
  };
}