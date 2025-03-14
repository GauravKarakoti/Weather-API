const form = document.getElementById('weather-form');
const cityInput = document.getElementById('city');
const weatherData = document.getElementById('weather-data');
const submitBtn = document.getElementById('submit-btn');
const spinner = document.querySelector('.spinner');
const errorElement = document.getElementById('city-error');

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
        showError('Please enter a valid city name');
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
    const response = await fetch(`${URL}/api/weather/${city}`);

    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to fetch weather data';

        if (response.status === 404) {
            throw new Error('City not found. Please enter a valid city name.');
        }

        throw new Error(errorMessage);
    }

    return response.json();
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
                <p><strong>Min Temp:</strong> ${data.minTemperature || 'N/A'}</p>
                <p><strong>Max Temp:</strong> ${data.maxTemperature || 'N/A'}</p>
                <p><strong>Humidity:</strong> ${data.humidity || 'N/A'}</p>
                <p><strong>Pressure:</strong> ${data.pressure || 'N/A'}</p>
            </div>
        </div>
    `;

    weatherData.innerHTML = template;
    weatherData.classList.remove('hidden');
}

function isValidInput(city) {
    return /^[a-zA-Z\s-]{2,50}$/.test(city);
}

function showError(message) {
    errorElement.textContent = message;
    errorElement.classList.add('visible');
    weatherData.innerHTML = ''; // Clear previous data

    setTimeout(() => {
        errorElement.classList.remove('visible');
    }, 5000);
}

function addToRecentSearches(city) {
    let recent = JSON.parse(localStorage.getItem('recentSearches')) || [];
    recent = [city, ...recent.filter(c => c !== city)].slice(0, 5);
    localStorage.setItem('recentSearches', JSON.stringify(recent));
    displayRecentSearches(recent);
}

function displayRecentSearches(recent) {
    const list = document.getElementById('recent-list');
    list.innerHTML = recent.map(city => `
        <button class="recent-item" data-city="${city}">${city}</button>
    `).join('');
    list.style.display = 'flex';
    list.style.flexWrap = 'wrap';
}

function loadRecentSearches() {
    const recent = JSON.parse(localStorage.getItem('recentSearches')) || [];
    displayRecentSearches(recent);
}

function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker
            .register('/sw.js')
            .then(() => console.log('Service Worker registered'))
            .catch(err => console.log('SW registration failed:', err));
    }
}

function clearError() {
    const errorElement = document.getElementById('city-error');
    errorElement.textContent = '';
    errorElement.classList.remove('visible');
}


// Initialize the app
initialize();
