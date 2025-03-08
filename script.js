const form = document.getElementById('weather-form');
const cityInput = document.getElementById('city');
const weatherData = document.getElementById('weather-data');
const submitBtn = document.getElementById('submit-btn');
const spinner = document.querySelector('.spinner');

form.addEventListener('submit', handleSubmit);

function initialize() {
    loadRecentSearches();
    setupServiceWorker();
}

async function handleSubmit(e) {
    e.preventDefault();
    const city = cityInput.value.trim();
    
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

    const URL ='https://weather-api-ex1z.onrender.com'
    const response = await fetch(`${URL}/api/weather/${city}`);
    
 

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('City not found. Please enter a valid city name.');
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch weather data');
        }
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
        
    const temperature = data.temperature || 'N/A';
    const humidity = data.humidity || 'N/A';
    const pressure = data.pressure || 'N/A';
    const minTemperature = data.minTemperature || 'N/A';
    const maxTemperature = data.maxTemperature || 'N/A';

    const template = `
        <div class="weather-card">
            <div class="weather-main">
                <div class="temp-container">
                    <span class="temperature">Temp: ${temperature}</span>
                </div>
            </div>
            <div class="weather-details">
                <p>Humidity: ${humidity}</p>
                <p>Pressure: ${pressure}</p>
                <p>Min Temp: ${minTemperature}</p>
                <p>Max Temp: ${maxTemperature}</p>
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
    const errorElement = document.getElementById('city-error');
    errorElement.textContent = message;
    errorElement.classList.add('visible');
    
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

// Initialize the app
initialize();
