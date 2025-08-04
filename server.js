const express = require("express");
const cors = require("cors");
const path = require("path");

const { configureEnv } = require("./src/config/env");
const { corsOptions } = require("./src/config/cors");
const {
  errorHandler,
  routeNotFoundHandler,
  corsErrorHandler,
} = require("./src/middleware/error.middleware");
const { applySecurityHeaders } = require("./src/middleware/headers.middleware");
const {
  dynamicRateLimiter,
} = require("./src/middleware/rateLimiter.middleware");

const weatherRoutes = require("./src/routes/weather.routes");
const {
  validateSelectors,
  scheduleSelectorValidation,
  stopValidationJob,
} = require("./src/services/selectorValidation.service");

const app = express();
configureEnv(); // Load env or fallback

app.use(cors(corsOptions));
app.use(express.static("public"));
app.use(express.json());
app.set("trust proxy", true);

applySecurityHeaders(app);
app.use(dynamicRateLimiter);

app.use((req, res, next) => {
  if (req.rateLimit) {
    res.setHeader("X-RateLimit-Limit", req.rateLimit.limit);
    res.setHeader(
      "X-RateLimit-Remaining",
      Math.max(0, req.rateLimit.limit - req.rateLimit.current),
    );
    res.setHeader("X-RateLimit-Reset", Date.now() + req.rateLimit.resetTime);
  }
  next();
});

const sanitizeInput = (str) => xss(str.trim());

const isValidCity = (city) => {
  return /^[\p{L}\p{M}\s'’\-\d]{2,50}$/u.test(city);
};

const parseTemperature = (rawText) => {
  try {
    if (typeof rawText !== 'string' || rawText.length > 200) {
      return "N/A";
    }
    const match = rawText.match(/-?\d+(\.\d+)?/);
    if (match) {
      const temp = parseFloat(match[0]);
      return temp >= -100 && temp <= 100 ? `${temp.toFixed(1)} °C` : "N/A";
    }
    return "N/A";
  } catch (error) {
    console.error("Error parsing temperature:", error);
    return "N/A";
  }
};

const parseMinMaxTemperature = (rawText) => {
  try {
    const matches = rawText.match(/-?\d+(\.\d+)?/gi) || [];
    const minTemp = matches?.[0] ? parseFloat(matches[0]) : null;
    const maxTemp = matches?.[1] ? parseFloat(matches[1]) : null;

    return {
      minTemperature:
        minTemp !== null && minTemp >= -100 && minTemp <= 100
          ? `${minTemp.toFixed(1)} °C`
          : "N/A",
      maxTemperature:
        maxTemp !== null && maxTemp >= -100 && maxTemp <= 100
          ? `${maxTemp.toFixed(1)} °C`
          : "N/A",
    };
  } catch (error) {
    console.error("Error parsing min/max temperature:", error);
    return {
      minTemperature: "N/A",
      maxTemperature: "N/A",
    };
  }
};

const parseHumidityPressure = (rawText) => {
  try {
    const humidityMatch = rawText.match(/(\d+\.?\d*)\s*Humidity/i);
    const pressureMatch = rawText.match(/(\d+\.?\d*)\s*Pressure/i);

    const humidity = humidityMatch ? parseInt(humidityMatch[1], 10) : null;
    const pressure = pressureMatch ? parseFloat(pressureMatch[1]) : null;

    return {
      humidity:
        humidity !== null && humidity >= 0 && humidity <= 100
          ? `${humidity}%`
          : "N/A",
      pressure:
        pressure !== null && pressure >= 300 && pressure <= 1100
          ? `${pressure.toFixed(1)} hPa`
          : "N/A",
    };
  } catch (error) {
    console.error("Error parsing humidity/pressure:", error);
    return {
      humidity: "N/A",
      pressure: "N/A",
    };
  }
};

const formatDate = (dateString) => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
};

const fetchWithRetry = async (url, options, retries = 3, backoff = 300) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, options);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, backoff * (i + 1)));
    }
  }
};

const fetchWeatherData = async (city) => {
  // Encode the city name for URL, preserving special characters
  const encodedCity = encodeURIComponent(city.trim())
    .replace(/%20/g, '-')  // Replace spaces with hyphens
    .replace(/'/g, '');    // Remove single quotes

  const primaryUrl = `${process.env.SCRAPE_API_FIRST}${encodedCity}${process.env.SCRAPE_API_LAST}`;
  const fallbackUrl = `${process.env.SCRAPE_API_FALLBACK}${encodedCity}`;

  try {
    return await fetchWithRetry(primaryUrl, {
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
  } catch (error) {
    console.warn("Primary source failed, trying fallback:", error.message);
    try {
      return await fetchWithRetry(fallbackUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
    } catch (fallbackError) {
      console.error("Fallback also failed:", fallbackError.message);
      throw fallbackError;
    }
  }
};

const fallbackSelectors = {
  TEMPERATURE_CLASS: ".temp-fallback",
  MIN_MAX_TEMPERATURE_CLASS: ".min-max-temp-fallback",
  HUMIDITY_PRESSURE_CLASS: ".humidity-pressure-fallback",
  CONDITION_CLASS: ".condition-fallback",
  DATE_CLASS: ".date-fallback",
};

const validateSelectors = async () => {
  const testCity = "delhi";
  const testUrl = `${process.env.SCRAPE_API_FIRST}${testCity}${process.env.SCRAPE_API_LAST}`;

  try {
    const response = await axios.get(testUrl, {
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    const $ = cheerio.load(response.data);

    const missingSelectors = [];
    Object.keys(fallbackSelectors).forEach((key) => {
      if (!$(process.env[key]).length) {
        missingSelectors.push(key);
      }
    });

    if (missingSelectors.length) {
      console.warn("Selector validation failed for:", missingSelectors);
      await sendAdminAlert(missingSelectors);
    } else {
      console.log("All selectors validated successfully.");
    }
  } catch (error) {
    console.error("Error during selector validation:", error.message);
    await sendAdminAlert(["ALL_SELECTORS_FAILED"]);
  }
};

app.get("/api/weather-forecast/:city", async (req, res) => {
  const city = req.params.city;
  const apiKey = process.env.SPECIAL_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API key not set." });
  }

  try {
    const encodedCity = encodeURIComponent(city);

    const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
    url.searchParams.set("q", encodedCity);
    url.searchParams.set("appid", apiKey);
    url.searchParams.set("units", "metric");

    const response = await fetch(url.toString());

    if (!response.ok) {
      return res.status(response.status).json({ error: "City not found or failed to fetch data." });
    }

    const data = await response.json();

    const forecast = data.list
      .filter((_, i) => i % 8 === 0)
      .slice(0, 4)
      .map(entry => ({
        date: entry.dt_txt,
        temperature: entry.main.temp,
        min: entry.main.temp_min,
        max: entry.main.temp_max,
        humidity: entry.main.humidity,
        pressure: entry.main.pressure,
        condition: entry.weather[0].main,
      }));

    res.json({ forecast });
  } catch (err) {
    console.error("Error fetching forecast:", err);
    res.status(500).json({ error: "Failed to fetch weather forecast." });
  }
});


app.get("/api/weather/:city", async (req, res) => {
  try {
    const city = sanitizeInput(req.params.city);

    if (!city || !isValidCity(city)) {
      return handleError(
        res,
        400,
        "Invalid city name. Use letters, spaces, apostrophes (') and hyphens (-)",
        "INVALID_CITY",
      );
    }

    const response = await fetchWeatherData(city);
    const $ = cheerio.load(response.data);

    const getElementText = (selector, fallbackSelector) => {
      const element = $(selector);
      if (element.length) return element.text()?.trim() || null;

      const fallbackElement = $(fallbackSelector);
      if (fallbackElement.length) return fallbackElement.text()?.trim() || null;

      // It's better to return null and handle it later than to throw here
      console.error(`Required element not found for primary selector: ${selector} or fallback: ${fallbackSelector}`);
      return null;
    };

    const temperature = parseTemperature(
      getElementText(
        process.env.TEMPERATURE_CLASS,
        fallbackSelectors.TEMPERATURE_CLASS,
      ),
    );
    const { minTemperature, maxTemperature } = parseMinMaxTemperature(
      getElementText(
        process.env.MIN_MAX_TEMPERATURE_CLASS,
        fallbackSelectors.MIN_MAX_TEMPERATURE_CLASS,
      ),
    );
    const { humidity, pressure } = parseHumidityPressure(
      getElementText(
        process.env.HUMIDITY_PRESSURE_CLASS,
        fallbackSelectors.HUMIDITY_PRESSURE_CLASS,
      ),
    );
    const condition = getElementText(
      process.env.CONDITION_CLASS,
      fallbackSelectors.CONDITION_CLASS,
    );
    const date = getElementText(
      process.env.DATE_CLASS,
      fallbackSelectors.DATE_CLASS,
    );

    if (!temperature || !condition) {
      return handleError(
        res,
        503, // Use 503 as it indicates a server-side parsing/scraping issue
        "Unable to parse weather data. The source website structure might have changed.",
        "PARSING_ERROR"
      );
    }

    const weatherData = {
      date: formatDate(date),
      temperature,
      condition,
      minTemperature,
      maxTemperature,
      humidity,
      pressure,
    };

    res.json(weatherData);

  } catch (scrapingError) {
    console.error("Scraping error:", scrapingError);

    if (scrapingError.code === "ECONNABORTED") {
      return handleError(res, 504, "The weather service is taking too long. Try again later.", "TIMEOUT");
    }
    if (scrapingError.response?.status === 404) {
      return handleError(res, 404, "City not found. Please check the spelling.", "CITY_NOT_FOUND");
    }

    // Generic fallback for other scraping errors
    return handleError(res, 502, "Failed to retrieve data from the weather service.", "BAD_GATEWAY");
  }
});

// Schedule weekly selector validation with randomness
let selectorValidationInterval;
const scheduleSelectorValidation = () => {
  // Base interval: 7 days (weekly)
  const baseInterval = 7 * 24 * 60 * 60 * 1000;

  // Add randomness: ±12 hours to distribute load across instances
  const randomBytes = crypto.randomBytes(4);
  const randomValue = randomBytes.readUInt32BE(0) / 0xFFFFFFFF; // Convert to 0-1 range
  const randomOffset = randomValue * 24 * 60 * 60 * 1000 - 12 * 60 * 60 * 1000; // ±12 hours
  const interval = baseInterval + randomOffset;

  console.log("Selector validation scheduled successfully");
  selectorValidationInterval = setInterval(validateSelectors, interval);
};

app.get('/config', (req, res) => {
  res.json({
    RECENT_SEARCH_LIMIT: process.env.RECENT_SEARCH_LIMIT || 5,
    API_URL: process.env.API_URL,
  });
});

app.get("/api/version", (req, res) => {
  res.json({ version: "1.0.0", lastUpdated: "2023-10-01" });
});

// Error Handling
app.use(corsErrorHandler);
app.use(routeNotFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log("Server started successfully");
  await validateSelectors();
  scheduleSelectorValidation();
});

module.exports = { app, server, stopValidationJob };