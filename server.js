const express = require("express");
const cheerio = require("cheerio");
const axios = require("axios");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const xss = require("xss");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
//const { console } = require("inspector");


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

const allowedOrigins = [process.env.ALLOWED_ORIGIN, process.env.ALLOWED_ORIGIN2,
process.env.ALLOWED_ORIGIN3, process.env.ALLOWED_ORIGIN4];

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
app.set("trust proxy", true);
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

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Error: Missing environment variable ${varName}`);
    process.exit(1);
  }
});

// Function to get client IP considering x-forwarded-for header
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  return forwarded ? forwarded.split(',')[0].trim() : req.ip;
};

// Rate limiting middleware with endpoint-specific strategies
const rateLimiters = {
  default: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
      status: 429,
      error: "Too many requests, please try again later.",
    },
    legacyHeaders: false,
    standardHeaders: true,
    keyGenerator: (req) => req.get("x-api-key") || getClientIp(req),
    handler: (req, res) => {
      res.set("Retry-After", Math.ceil(rateLimiters.default.windowMs / 1000));
      return handleError(
        res,
        429,
        "Too many requests to the weather API. Please try again later.",
        "TOO_MANY_REQUESTS",
        {
          retryAfter: Math.ceil(rateLimiters.default.windowMs / 1000) + " seconds",
        }
      );
    },
  }),
  weather: rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 50, // Stricter limit for /api/weather
    message: {
      status: 429,
      error: "Too many requests to the weather API. Please try again later.",
    },
    legacyHeaders: false,
    standardHeaders: true,
    keyGenerator: (req) => req.get("x-api-key") || getClientIp(req),
    handler: (req, res) => {
      res.set("Retry-After", Math.ceil(rateLimiters.weather.windowMs / 1000));
      return handleError(
        res,
        429,
        "Too many requests to the weather API. Please try again later.",
        "RATE_LIMIT_EXCEEDED",
        {
          retryAfter: Math.ceil(rateLimiters.weather.windowMs / 1000) + " seconds",
        }
      );
    },
  }),
};

// Apply rate limiting dynamically based on endpoint
const dynamicRateLimiter = (req, res, next) => {
  if (req.path.startsWith("/api/weather")) {
    return rateLimiters.weather(req, res, next);
  }
  return rateLimiters.default(req, res, next);
};

app.use(dynamicRateLimiter);

// Middleware to add rate limit status headers
app.use((req, res, next) => {
  if (req.rateLimit) {
    res.setHeader('X-RateLimit-Limit', req.rateLimit.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, req.rateLimit.limit - req.rateLimit.current));
    res.setHeader('X-RateLimit-Reset', Date.now() + req.rateLimit.resetTime);
  }
  next();
});

// Sanitize input to prevent XSS
const sanitizeInput = (str) => xss(str.trim());

// Enhanced city validation to support special characters
const isValidCity = (city) => {
  return /^[\p{L}\p{M}\s'’-]{2,50}$/u.test(city);
};

// Function to parse temperature with sanity check
const parseTemperature = (rawText) => {
  try {
    const match = rawText.match(/-?\d+(\.\d+)?\s*° c/gi);;
    if (match) {
      const temp = parseFloat(match[0]);
      return (temp >= -100 && temp <= 100) ? `${temp.toFixed(1)} °C` : "N/A";
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
    const matches = rawText.match(/-?\d+(\.\d+)?\s*°/gi) || [];
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
    const humidityMatch = rawText.match(/(\d+\.?\d*)\s*Humidity/i);
    const pressureMatch = rawText.match(/(\d+\.?\d*)\s*Pressure/i);

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

    try {
      return await fetchWithRetry(fallbackUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
    } catch (fallbackError) {
      console.error("Fallback also failed:", fallbackError.message);
      // ✅ Throw an actual error so app route can handle it
      throw fallbackError;
    }
  }
};

// Fallback selector patterns
const fallbackSelectors = {
  TEMPERATURE_CLASS: ".temp-fallback",
  MIN_MAX_TEMPERATURE_CLASS: ".min-max-temp-fallback",
  HUMIDITY_PRESSURE_CLASS: ".humidity-pressure-fallback",
  CONDITION_CLASS: ".condition-fallback",
  DATE_CLASS: ".date-fallback",
};

// Function to validate selectors
const validateSelectors = async () => {
  const testCity = "delhi";

  const testUrl = `${process.env.SCRAPE_API_FIRST}${testCity}${process.env.SCRAPE_API_LAST}`;

  try {
    const response = await axios.get(testUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
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
      sendAdminAlert(missingSelectors);
    } else {
      console.log("All selectors validated successfully.");
    }
  } catch (error) {
    console.error("Error during selector validation:", error.message);
    sendAdminAlert(["ALL_SELECTORS_FAILED"]);
  }
};

// Function to send admin alerts
const sendAdminAlert = (failedSelectors) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("Admin email not configured. Cannot send alert.");
    return;
  }

  const alertMessage = `The following selectors failed validation: ${failedSelectors.join(", ")}. Please update the environment variables or fallback selectors.`;
  console.log(`Sending alert to admin: ${alertMessage}`);
  // Implement email or notification logic here
};

// API route to fetch weather data
app.get("/api/weather/:city", async (req, res) => {
  try {
    const city = sanitizeInput(req.params.city);

    // Validate city input
    if (!city || !isValidCity(city)) {
      return handleError(
        res,
        400,
        "Invalid city name. Use letters, spaces, apostrophes (') and hyphens (-)",
        "INVALID_CITY"
      );
    }

    try {
      const response = await fetchWeatherData(city);
      const $ = cheerio.load(response.data);

      // Function to extract text safely
      const getElementText = (selector, fallbackSelector) => {
        try {
          const element = $(selector);
          if (element.length) return element.text()?.trim() || null;

          // Use fallback selector if primary fails
          const fallbackElement = $(fallbackSelector);
          if (fallbackElement.length) return fallbackElement.text()?.trim() || null;

          throw new Error(`Required element ${selector} not found`);
        } catch (error) {
          console.error(`Error extracting text for selector ${selector}:`, error);
          return null;
        }
      };

      try {
        const temperature = parseTemperature(getElementText(process.env.TEMPERATURE_CLASS, fallbackSelectors.TEMPERATURE_CLASS));
        const { minTemperature, maxTemperature } = parseMinMaxTemperature(getElementText(process.env.MIN_MAX_TEMPERATURE_CLASS, fallbackSelectors.MIN_MAX_TEMPERATURE_CLASS));
        const { humidity, pressure } = parseHumidityPressure(getElementText(process.env.HUMIDITY_PRESSURE_CLASS, fallbackSelectors.HUMIDITY_PRESSURE_CLASS));
        const condition = getElementText(process.env.CONDITION_CLASS, fallbackSelectors.CONDITION_CLASS);
        const date = getElementText(process.env.DATE_CLASS, fallbackSelectors.DATE_CLASS);

        if (!temperature || !condition) {
          return handleError(
            res,
            404,
            "Weather data not found for the specified city.",
            "DATA_NOT_FOUND"
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

      } catch (parsingError) {
        console.error("Data parsing error:", parsingError);
        return handleError(
          res,
          503,
          "Unable to parse weather data. The weather service might be temporarily unavailable.",
          "PARSING_ERROR",
          parsingError.message
        );
      }

    } catch (scrapingError) {
      console.error("Scraping error:", scrapingError);

      if (scrapingError.code === "ECONNABORTED") {
        return handleError(
          res,
          504,
          "The weather service is taking too long. Try again later.",
          "TIMEOUT"
        );
      }

      // Handle axios 404 error
      if (scrapingError.response && scrapingError.response.status === 404) {
        return handleError(
          res,
          404,
          "City not found. Please check the spelling.",
          "CITY_NOT_FOUND"
        );
      }

      // Handle generic axios error
      if (scrapingError.message && scrapingError.message.match(/not found|city not found/i)) {
        return handleError(
          res,
          404,
          "City not found. Please check the spelling.",
          "CITY_NOT_FOUND"
        );
      }

      // Handle all other errors as 500
      return handleError(
        res,
        500,
        "Failed to retrieve weather data.",
        "SERVER_ERROR",
        scrapingError.message
      );
    }
  } catch (error) {
    console.error("Server error:", error);
    handleError(
      res,
      500,
      "Unexpected server error. Please try again later.",
      "SERVER_ERROR",
      error.message
    );
  }
});

// Schedule daily selector validation

let selectorValidationInterval;

const scheduleSelectorValidation = () => {
  const interval = 24 * 60 * 60 * 1000; // 24 hours
  selectorValidationInterval = setInterval(validateSelectors, interval);
};


app.get('/config', (req, res) => {
  res.json({
    RECENT_SEARCH_LIMIT: process.env.RECENT_SEARCH_LIMIT || 5,
    API_URL: process.env.API_URL,
  });
});

// Version tracking for target website structure
app.get("/api/version", (req, res) => {
  res.json({
    version: "1.0.0", // Update this manually when selectors or logic change
    lastUpdated: "2023-10-01", // Update this date when changes are made
  });
});

app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return handleError(
      res,
      403,
      "CORS policy disallows access from this origin.", "CORS_DENIED"
    );
  }
  next(err);
});

// if route is not found, return 404
app.use((req, res) => {
  return handleError(
    res,
    404,
    "Route not found.", "ROUTE_NOT_FOUND"
  );
});

// Global error handler for unhandled errors
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  return handleError(
    res,
    500,
    "Internal server error.",
    "UNHANDLED_EXCEPTION",
    err.message || null
  );
});


const stopServer = () => {
  if (selectorValidationInterval) clearInterval(selectorValidationInterval);
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};


// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  validateSelectors(); // Initial validation on startup
  scheduleSelectorValidation(); // Schedule daily validation
});

module.exports = { app, server, rateLimiters, stopServer, fetchWeatherData };
