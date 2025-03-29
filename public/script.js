// Function to log selector failures
function logSelectorFailure(selector) {
    console.error(`Selector failure: ${selector}`);
    alert(`Failed to find element with selector: ${selector}. Please check the selector or update it if the target website has changed.`);
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
const submitBtn = getElement('#submit-btn');
const spinner = getElement('.spinner');
const errorElement = getElement('#city-error');

let recentSearches = [];

form.addEventListener('submit', handleSubmit);

function initialize() {
    loadRecentSearches();
    setupServiceWorker();
}

async function handleSubmit(e) {
    e.preventDefault();
    const city = cityInput.value.trim();

    // Clear the previous error message when a new search starts
    clearError();

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
        showError(error.message);
    } finally {
        toggleLoading(false);
    }
}

async function fetchWeatherData(city) {
    const URL = 'https://weather-api-ex1z.onrender.com';

    try {
        const response = await fetch(`${URL}/api/weather/${city}`);

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error || 'Failed to fetch weather data';

            if (response.status === 404) {
                throw new Error('City not found. Please enter a valid city name.');
            }

            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error('Network error. Please check your connection and try again.');
        }
        throw new Error(error.message || 'An unexpected error occurred');
    }
}

function toggleLoading(isLoading) {
    submitBtn.disabled = isLoading;
    spinner.classList.toggle('hidden', !isLoading);
}

function displayWeather(data) {
    if (!data || !data.temperature) {
        showError('Failed to retrieve weather data. Please try again.');
        return;
    }

    // Fix the -0 issue for minTemperature
    const minTemperature = parseTemperature(data.minTemperature);

    // Clean the maxTemperature to remove any extra characters after the degree symbol
    const maxTemperature = parseTemperature(data.maxTemperature);

    // Parse humidity and pressure correctly
    const parsedData = parseHumidityPressure(data.humidity, data.pressure);

    // Create the template for displaying weather data
    const template = `
        <div class="weather-card">
            <div class="weather-main">
                <div class="temp-container">
                    <span class="temperature">Temp: ${data.temperature || 'N/A'}</span>
                </div>
            </div>
            <div class="weather-details">
                <p><strong>Date:</strong> ${data.date || 'N/A'}</p>
                <p><strong>Condition:</strong> ${data.condition || 'N/A'}</p>
                <p><strong>Min Temp:</strong> ${`${minTemperature}C` || 'N/A'}</p>
                <p><strong>Max Temp:</strong> ${`${maxTemperature}C` || 'N/A'}</p>
                <p><strong>Humidity:</strong> ${parsedData.humidity || 'N/A'}%</p>
                <p><strong>Pressure:</strong> ${parsedData.pressure || 'N/A'}</p>
            </div>
        </div>
    `;

    weatherData.innerHTML = template;
    weatherData.classList.remove('hidden');
}

function isValidInput(city) {
    // Updated regex to support international city names with special characters
    return /^[\p{L}\s'’-]{2,50}$/u.test(city);
}

function showError(message) {
    errorElement.textContent = message;
    errorElement.classList.add('visible');
    weatherData.innerHTML = ''; // Clear previous data

    setTimeout(() => {
        errorElement.classList.remove('visible');
    }, 5000);
}

function clearError() {
    errorElement.textContent = '';
    errorElement.classList.remove('visible');
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

function addToRecentSearches(city) {
    const normalizedCity = city.trim().toLowerCase(); // Normalize to lowercase
    try {
        if (isLocalStorageAvailable()) {
            let recent = JSON.parse(localStorage.getItem('recentSearches')) || [];
            recent = recent.filter(c => c.toLowerCase() !== normalizedCity);
            recent = [city, ...recent].slice(0, 5);
            localStorage.setItem('recentSearches', JSON.stringify(recent));
        } else {
            recentSearches = recentSearches
                .filter(c => c.toLowerCase() !== normalizedCity)
                .slice(0, 4);
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
    list.innerHTML = recent
        .map(city => `
            <button class="recent-item" data-city="${sanitizeHTML(city)}">
                ${sanitizeHTML(city)}
            </button>`)
        .join('');
    list.style.display = 'flex';
    list.style.flexWrap = 'wrap';

    document.querySelectorAll('.recent-item').forEach(button => {
        button.addEventListener('click', function () {
            cityInput.value = this.dataset.city;  // Set input value to clicked city
            handleSubmit(new Event('submit'));    // Trigger search
        });
    });
}

function loadRecentSearches() {
    displayRecentSearches();
}

function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker
            .register('./sw.js')  // Use relative path for service worker
            .then(() => console.log('Service Worker registered'))
            .catch(err => console.log('SW registration failed:', err));
    }
}

function parseHumidityPressure(humidity, pressure) {
    // Handle if the humidity and pressure are direct numeric values from API
    const parsedHumidity = parseInt(humidity, 10) || "N/A"; // Remove leading zeros

    const parsePressure = (rawPressure) => {
        // Use regex to extract numeric value from pressure string
        const match = rawPressure.match(/(\d+(\.\d+)?)/);
        if (!match) return 'N/A';

        const pressureValue = parseFloat(match[0]);

        // Normalize pressure value if necessary
        if (pressureValue > 10000) {
            return `${(pressureValue / 100).toFixed(2)} hPa`;
        }
        if (pressureValue > 1000) {
            return `${(pressureValue / 10).toFixed(2)} hPa`;
        }
        return `${pressureValue} Pa`;
    };

    const parsedPressure = parsePressure(pressure);
    return { humidity: parsedHumidity, pressure: parsedPressure };
}

function parseTemperature(temp) {
    if (!temp) return 'N/A';
    // Use regex to capture numbers and the degree symbol (°)
    const match = temp.match(/-?\d+°/);
    return match ? match[0] : 'N/A';
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

export {
    fetchWeatherData,
    isValidInput,
    addToRecentSearches
};
