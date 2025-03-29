const express = require("express");
const cheerio = require("cheerio");
const axios = require("axios");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const xss = require("xss");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

// Load environment variables
const envResult = dotenv.config();
if (envResult.error) {
  const envExamplePath = path.join(__dirname, ".env.example");
  if (fs.existsSync(envExamplePath)) {
    dotenv.config({ path: envExamplePath });
    console.warn("Using .env.example for environment variables. Please create a .env file for production.");
  } else {
    console.error("No .env or .env.example file found!");
    process.exit(1);
  }
}

const app = express();

const allowedOrigins = ["http://localhost:3003", "add-more-url"];

// Security and middleware configurations
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
}));
app.use(express.static("public"));
app.use(express.json());
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self';"
  );
  next();
});

// Required environment variables validation
const requiredEnvVars = [
  "SCRAPE_API_FIRST",
  "SCRAPE_API_LAST",
  "TEMPERATURE_CLASS",
  "MIN_MAX_TEMPERATURE_CLASS",
  "HUMIDITY_PRESSURE_CLASS",
  "CONDITION_CLASS",
  "DATE_CLASS",
  "SCRAPE_API_FALLBACK",
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Error: Missing environment variable ${varName}`);
    process.exit(1);
  }
});

// Rate limiting middleware with different strategies per origin
const rateLimiters = {
  default: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
      status: 429,
      error: "Too many requests, please try again later.",
    },
    headers: true,
    keyGenerator: (req) => req.ip,
    handler: (req, res) => {
      res.set("Retry-After", Math.ceil(rateLimiters.default.windowMs / 1000));
      res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil(rateLimiters.default.windowMs / 1000) + " seconds",
      });
    },
  }),
  special: rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 200,
    message: {
      status: 429,
      error: "Too many requests, please try again later.",
    },
    headers: true,
    keyGenerator: (req) => req.ip,
    handler: (req, res) => {
      res.set("Retry-After", Math.ceil(rateLimiters.special.windowMs / 1000));
      res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil(rateLimiters.special.windowMs / 1000) + " seconds",
      });
    },
  }),
};

// Middleware to select rate limiter based on origin
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && origin.includes('special-domain.com')) {
    rateLimiters.special(req, res, next);
  } else {
    rateLimiters.default(req, res, next);
  }
});

// Middleware to add rate limit status headers
app.use((req, res, next) => {
  res.setHeader('X-RateLimit-Limit', rateLimiters.default.max);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimiters.default.max - req.rateLimit.current));
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiters.default.windowMs).toISOString());
  next();
});

// Sanitize input to prevent XSS
const sanitizeInput = (str) => xss(str.trim());

// Enhanced city validation to support special characters
const isValidCity = (city) => {
  // Updated regex to better handle apostrophes and special characters
  return /^[a-zA-Z\s'-]{2,50}$/.test(city) || /^[\p{L}\s'-]{2,50}$/u.test(city);
};

// Function to parse temperature with sanity check
const parseTemperature = (rawText) => {
  try {
    const match = rawText.match(/-?\d+(\.\d+)?\s*°C/);
    if (match) {
      const temp = parseFloat(match[0]);
      if (temp < -100 || temp > 100) {
        return "N/A"; // Sanity check for temperature range
      }
      return `${temp.toFixed(1)} °C`;
    }
    return "N/A";
  } catch (error) {
    console.error("Error parsing temperature:", error);
    return "N/A";
  }
};

// Function to parse min and max temperatures with sanity check
const parseMinMaxTemperature = (rawText) => {
  try {
    const matches = rawText.match(/-?\d+(\.\d+)?\s*°C/g);
    const minTemp = matches?.[0] ? parseFloat(matches[0]) : null;
    const maxTemp = matches?.[1] ? parseFloat(matches[1]) : null;

    return {
      minTemperature: minTemp !== null && minTemp >= -100 && minTemp <= 100 ? `${minTemp.toFixed(1)} °C` : "N/A",
      maxTemperature: maxTemp !== null && maxTemp >= -100 && maxTemp <= 100 ? `${maxTemp.toFixed(1)} °C` : "N/A",
    };
  } catch (error) {
    console.error("Error parsing min/max temperature:", error);
    return {
      minTemperature: "N/A",
      maxTemperature: "N/A",
    };
  }
};

// Function to parse humidity and pressure with validation
const parseHumidityPressure = (rawText) => {
  try {
    const humidityMatch = rawText.match(/Humidity:\s*(\d+)%/i);
    const pressureMatch = rawText.match(/Pressure:\s*(\d+(\.\d+)?)\s*(hPa|Pa)/i);

    const humidity = humidityMatch ? parseInt(humidityMatch[1], 10) : null;
    const pressure = pressureMatch ? parseFloat(pressureMatch[1]) : null;

    return {
      humidity: humidity !== null && humidity >= 0 && humidity <= 100 ? `${humidity}%` : "N/A",
      pressure: pressure !== null && pressure >= 300 && pressure <= 1100 ? `${pressure.toFixed(1)} hPa` : "N/A",
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
      year: "numeric", // Add year
      month: "long",  // Full month name
      day: "numeric", // Day of the month
    }).format(new Date(dateString));
  } catch {
    return dateString; // Fallback to the original string if parsing fails
  }
};

// Improved Error Handling
const handleError = (res, statusCode, message, code, details = null) => {
  const errorResponse = {
    error: message,
    code,
    statusCode,
    timestamp: new Date().toISOString(),
  };
  if (details) {
    errorResponse.details = details;
  }
  res.status(statusCode).json(errorResponse);
};

// Retry mechanism for failed requests
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

// Fallback data source strategy
const fetchWeatherData = async (city) => {
  const encodedCity = city
    .normalize('NFD')
    .replace(/'/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();

  const primaryUrl = `${process.env.SCRAPE_API_FIRST}${encodedCity}${process.env.SCRAPE_API_LAST}`;
  const fallbackUrl = `${process.env.SCRAPE_API_FALLBACK}${encodedCity}`;

  try {
    return await fetchWithRetry(primaryUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
  } catch (error) {
    console.warn("Primary source failed, trying fallback:", error.message);
    return await fetchWithRetry(fallbackUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
  }
};

// API route to fetch weather data
app.get("/api/weather/:city", async (req, res) => {
  try {
    const city = sanitizeInput(req.params.city);

    // Validate city input
    if (!city || !isValidCity(city)) {
      return handleError(
        res,
        401,
        "Invalid city name. Use letters, spaces, apostrophes (') and hyphens (-)",
        "INVALID_CITY"
      );
    }

    try {
      const response = await fetchWeatherData(city);
      const $ = cheerio.load(response.data);

      // Function to extract text safely
      const getElementText = (selector) => {
        try {
          const element = $(selector);
          if (!element.length) throw new Error(`Required element ${selector} not found`);
          return element.text()?.trim() || null;
        } catch (error) {
          console.error(`Error extracting text for selector ${selector}:`, error);
          return null;
        }
      };

      try {
        const temperature = parseTemperature(getElementText(process.env.TEMPERATURE_CLASS));
        const { minTemperature, maxTemperature } = parseMinMaxTemperature(getElementText(process.env.MIN_MAX_TEMPERATURE_CLASS));
        const { humidity, pressure } = parseHumidityPressure(getElementText(process.env.HUMIDITY_PRESSURE_CLASS));
        const condition = getElementText(process.env.CONDITION_CLASS);
        const date = getElementText(process.env.DATE_CLASS);

        if (!temperature || !condition) {
          return handleError(res, 404, "Weather data not found for the specified city.", "DATA_NOT_FOUND");
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

      } catch (parsingError) {
        console.error("Data parsing error:", parsingError);
        return handleError(res, 503, "Unable to parse weather data. The weather service might be temporarily unavailable.", "PARSING_ERROR", parsingError.message);
      }

    } catch (scrapingError) {
      console.error("Scraping error:", scrapingError);

      if (scrapingError.code === "ECONNABORTED") {
        return handleError(res, 504, "The weather service is taking too long. Try again later.", "TIMEOUT");
      }

      if (scrapingError.response?.status === 404) {
        return handleError(res, 404, "City not found. Please check the spelling.", "CITY_NOT_FOUND");
      }

      return handleError(res, 503, "Weather service temporarily unavailable.", "SERVICE_UNAVAILABLE", scrapingError.message);
    }
  } catch (error) {
    console.error("Server error:", error);
    handleError(res, 500, "Unexpected server error. Please try again later.", "SERVER_ERROR", error.message);
  }
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };
