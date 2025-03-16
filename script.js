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

    // Fix the -0 issue for minTemperature
    const minTemperature = data.minTemperature === '-0°' ? '0°' : data.minTemperature;

    // Clean the maxTemperature to remove any extra characters after the degree symbol
    let maxTemperature = data.maxTemperature ? data.maxTemperature : 'N/A';  // Default value if empty

    // Use regular expression to only capture numbers and the degree symbol (°)
    maxTemperature = maxTemperature.match(/\d+°/);  // This matches a number followed by the degree symbol

    // If match is found, take the first match; otherwise, return 'N/A'
    maxTemperature = maxTemperature ? maxTemperature[0] : 'N/A';

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
                <p><strong>Min Temp:</strong> ${minTemperature || 'N/A'}</p>
                <p><strong>Max Temp:</strong> ${maxTemperature || 'N/A'}</p>
                <p><strong>Humidity:</strong> ${parsedData.humidity || 'N/A'}%</p>
                <p><strong>Pressure:</strong> ${parsedData.pressure || 'N/A'} Pa</p>
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

function clearError() {
    const errorElement = document.getElementById('city-error');
    errorElement.textContent = '';
    errorElement.classList.remove('visible');
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

<<<<<<< HEAD
=======
    // Add click event listener to each recent search button
>>>>>>> 55905b8d855abc1bcc5e4f2800e37612f0efffe2
    document.querySelectorAll('.recent-item').forEach(button => {
        button.addEventListener('click', function () {
            cityInput.value = this.dataset.city;  // Set input value to clicked city
            handleSubmit(new Event('submit'));    // Trigger search
        });
    });
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

// Parsing humidity and pressure data
function parseHumidityPressure(humidity, pressure) {
    // Handle if the humidity and pressure are direct numeric values from API
    const parsedHumidity = humidity || "N/A";

    const parsePressure = (rawPressure) => {
        // Convert the raw pressure value to float
        const pressure = parseFloat(rawPressure);

        // If the pressure value seems unusually high (greater than 10000), divide it to normalize it to a realistic range
        if (pressure > 10000) {
            return Math.round(pressure / 100);  // Scale it down by dividing by 100
        }

        // If the pressure value is large but not too big, divide by 10 to bring it into a more standard range
        if (pressure > 1000) {
            return Math.round(pressure / 10);  // Divide by 10 for pressure within a realistic atmospheric range
        }

        // Otherwise, just return the pressure as is, rounded to the nearest integer
        return Math.round(pressure);
    };

    const parsedPressure = parsePressure(pressure);
    return { humidity: parsedHumidity, pressure: parsedPressure };
}

// Initialize the app
initialize();
