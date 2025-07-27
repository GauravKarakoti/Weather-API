
// Note: Ensure no duplicate 'clearBtn' declarations exist in this file or included scripts.
// Check index.html for correct selector IDs (e.g., #clear-btn).

// Function to log selector failures
function logSelectorFailure(selector) {
    console.error(`Selector failure: ${selector}`);
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Failed to find element with selector: ${selector}. Please check the selector or update it if the target website has changed.`);
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
const form = getElement('#weather-form');
const cityInput = getElement('#city');
const weatherData = getElement('#weather-data');

const weatherBtn = getElement('#weather-btn');
const searchBtn = getElement('#search-btn');
const clearBtn = getElement('#clear-btn'); // Ensure no duplicate declaration
const spinner = getElement('.spinner');
const clr_spinner = getElement('.clr-spinner');
const errorElement = getElement('#city-error');

let recentSearches = [];

if (form) {
    form.addEventListener('submit', handleSubmit);
}

// Add the clear button event listener
if (clearBtn) {
    clearBtn.addEventListener('click', handleClear);
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
        showError('City name cannot be empty.');
        return;
    }



    if (!isValidInput(city)) {
      
        showError('Please enter a valid city name (e.g., São Paulo, O\'Fallon).');
        return;
    }

    try {
        toggleLoading(true);
        const data = await fetchWeatherData(city);
        
        displayWeather(data);
        addToRecentSearches(city);
    } catch (error) {
        console.log(error)
        showError(error.message);
    } finally {
        toggleLoading(false);
    }
}

async function fetchWeatherData(city) {
    try {
        if (!city) {
            throw new Error('City parameter is required');
        }

        const configResponse = await fetch('https://weather-api-ex1z.onrender.com/config');
        if (!configResponse.ok) {
            throw new Error('Failed to load configuration');
        }

        const config = await configResponse.json();

        // Check if URL exists in config
        if (!config.API_URL) {
            throw new Error('API URL not configured');
        }

        const URL = config.API_URL || 'https://weather-api-ex1z.onrender.com'

        // Encode the city name for the URL
        const encodedCity = encodeURIComponent(city);

        const response = await fetch(`${URL}/api/weather/${encodedCity}`);
        console.log('response status', response.status);
        if (!response.ok) {
            const contentType = response.headers.get('Content-Type');

            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                const errorMessage = errorData.error || 'Failed to fetch weather data';

                if (response.status === 404) {
                    throw new Error('City not found. Please check the city name.');
                }

                throw new Error(errorMessage);
            } else {
                throw new Error(`Unexpected error: ${response.status} ${response.statusText}`);
            }
        }

        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        throw new Error(error.message || 'An unexpected error occurred');
    }
}

function toggleLoading(isLoading) {
    if (weatherBtn) weatherBtn.disabled = isLoading;
    if (searchBtn) searchBtn.disabled = isLoading;
    if (spinner) spinner.classList.toggle('hidden', !isLoading);
}

function toggleClearLoading(isLoading){
    clearBtn.disabled = isLoading;
    clr_spinner.classList.toggle('hidden', !isLoading);
}

function displayWeather(data) {
    if (!data || !data.temperature) {
        showError('Failed to retrieve weather data. Please try again.');
        return;
    }

    let emoji = '';
    const condition = data.condition?.toLowerCase() || '';
    if (condition.includes('sun')) emoji = '☀️';
    else if (condition.includes('rain')) emoji = '🌧️';
    else if (condition.includes('cloud')) emoji = '☁️';
    else if (condition.includes('snow')) emoji = '❄️';
    else if (condition.includes('storm')) emoji = '⛈️';
    else emoji = '🌈';

    const weatherIcon = document.getElementById('weather-icon');
    if (weatherIcon) {
        weatherIcon.textContent = emoji;
        weatherIcon.style.display = 'block';
        weatherIcon.classList.remove('hidden');
    }

    if (weatherData) {
        Array.from(weatherData.children).forEach(child => {
            if (child.id !== 'weather-icon') child.remove();
        });

        const template = `
            <div class="weather-card">
                <div class="weather-details">
                    <p><strong>Temp:</strong> ${data.temperature || 'N/A'}°C</p>
                    <p><strong>Date:</strong> ${data.date || 'N/A'}</p>
                    <p><strong>Condition:</strong> ${data.condition || 'N/A'}</p>
                    <p><strong>Min Temp:</strong> ${data.minTemperature || 'N/A'}°C</p>
                    <p><strong>Max Temp:</strong> ${data.maxTemperature || 'N/A'}°C</p>
                    <p><strong>Humidity:</strong> ${data.humidity || 'N/A'}%</p>
                    <p><strong>Pressure:</strong> ${data.pressure || 'N/A'}</p>
                </div>
            </div>
        `;

        weatherData.insertAdjacentHTML('beforeend', template);
        weatherData.classList.remove('hidden');
    }
}

function isValidInput(city) {
    return /^[\p{L}\p{M}\s'’.-]{2,50}$/u.test(city);
}

function showError(message) {
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('visible');

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.classList.add('close-btn');
        closeBtn.setAttribute('aria-label', 'Close error message');
        closeBtn.onclick = () => clearError();

        errorElement.innerHTML = '';
        errorElement.appendChild(document.createTextNode(message));
        errorElement.appendChild(closeBtn);

        errorElement.setAttribute('tabindex', '-1');
        errorElement.focus();

        if (weatherData) weatherData.innerHTML = '';
    }
}

function clearError() {
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.remove('visible');
    }
}

function sanitizeHTML(str) {
    return DOMPurify.sanitize(str);
}

function isLocalStorageAvailable() {
    try {
        const testKey = '__test__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        return true;
    } catch (error) {
        console.warn("⚠️ localStorage not available. Using in-memory fallback.");
        return false;
    }
}

async function loadConfig() {
    try {
        const response = await fetch('https://weather-api-ex1z.onrender.com/config');
        if (!response.ok) throw new Error('Failed to load config');

        const config = await response.json();

        const limit = parseInt(config.RECENT_SEARCH_LIMIT, 10) || 5;
        localStorage.setItem('recentSearchLimit', limit);
        console.log(`Recent search limit: ${limit}`);

        return limit;
    } catch (error) {
        console.error('Failed to load environment config:', error);
        return 5;
    }
}

function addToRecentSearches(city) {
    const normalizedCity = city.trim().toLowerCase();
    let limit = parseInt(localStorage.getItem('recentSearchLimit'), 10) || 5;
    try {
        if (isLocalStorageAvailable()) {
            let recent = JSON.parse(localStorage.getItem('recentSearches')) || [];
            recent = recent.filter(c => c.toLowerCase() !== normalizedCity);
            recent = [city, ...recent].slice(0, limit);
            localStorage.setItem('recentSearches', JSON.stringify(recent));
        } else {
            recentSearches = recentSearches
                .filter(c => c.toLowerCase() !== normalizedCity)
                .slice(0, limit - 1);
            recentSearches.unshift(city);
        }
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.warn('LocalStorage quota exceeded. Removing oldest search.');
            let recent = JSON.parse(localStorage.getItem('recentSearches')) || [];
            recent.pop();
            try {
                localStorage.setItem('recentSearches', JSON.stringify(recent));
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
    const recent = isLocalStorageAvailable()
        ? JSON.parse(localStorage.getItem('recentSearches')) || []
        : recentSearches;
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
function setupServiceWorker() {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);
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
            .catch((error) => console.error('Service Worker registration failed:', error));
    });
}

function showUpdateNotification() {
    const updateBanner = document.createElement('div');
    updateBanner.classList.add('update-banner');
    updateBanner.innerHTML = `
        <p>New version available. <button id="reload-btn">Reload</button></p>
    `;

    document.body.appendChild(updateBanner);

    document.getElementById('reload-btn').addEventListener('click', () => {
        window.location.reload();
    });

    const style = document.createElement('style');
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
    toggleClearLoading(true); // Show loading spinner

    setTimeout(() => {
        cityInput.value = ''; // Clear the input field
        clearError();         // Clear error messages
        toggleClearLoading(false); // Hide spinner
    }, 300); // Simulate a short delay for UI feedback
}

module.exports = {
    fetchWeatherData,
    isValidInput,
    addToRecentSearches
};


