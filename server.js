const express = require("express");
const cheerio = require("cheerio");
const axios = require("axios");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const xss = require("xss");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

// Load environment variables
const envResult = dotenv.config();
if (envResult.error) {
  const envExamplePath = path.join(__dirname, ".env.example");
  if (fs.existsSync(envExamplePath)) {
    dotenv.config({ path: envExamplePath });
    console.warn(
      "Using .env.example for environment variables. Please create a .env file for production.",
    );
  } else {
    console.error("No .env or .env.example file found!");
    process.exit(1);
  }
}

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Function to send admin alert via email
const sendAdminAlert = async (failedSelectors) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("Admin email not configured. Cannot send alert.");
    return;
  }
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.warn("Email notifications disabled: Missing MAIL_USER or MAIL_PASS in environment variables.");
    return;
  }

  const alertMessage = `The following selectors failed validation: ${failedSelectors.join(", ")}. Please update the environment variables or fallback selectors.`;
  console.error(`Admin Alert: ${alertMessage}`);

  try {
    await transporter.sendMail({
      from: `"Weather API Alert" <${process.env.MAIL_USER}>`,
      to: adminEmail,
      subject: "Weather API Selector Failure Alert",
      text: `${alertMessage}\nPlease check the selectors at https://www.indiatoday.in/weather/delhi-weather-forecast-today or update fallback selectors.`,
      html: `<p><strong>Selector Validation Failed</strong></p><p>${alertMessage}</p><p>Please check the selectors at <a href="https://www.indiatoday.in/weather/delhi-weather-forecast-today">India Today Weather</a> or update fallback selectors.</p>`,
    });
    console.log(`Email alert sent to ${adminEmail}`);
  } catch (error) {
    console.error(`Failed to send email alert: ${error.message}`);
  }
};

const app = express();

const allowedOrigins = [
    process.env.ALLOWED_ORIGIN,
    process.env.ALLOWED_ORIGIN2,
    process.env.ALLOWED_ORIGIN3,
    process.env.ALLOWED_ORIGIN4,
];

// Security and middleware configurations
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);
app.use(express.static("public"));
app.use(express.json());
app.set("trust proxy", true);
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self';",
  );
  next();
});

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

// Function to get client IP considering x-forwarded-for header
const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  return forwarded ? forwarded.split(",")[0].trim() : req.ip;
};

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
          retryAfter:
            Math.ceil(rateLimiters.default.windowMs / 1000) + " seconds",
        },
      );
    },
  }),
  weather: rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 50,
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
          retryAfter:
            Math.ceil(rateLimiters.weather.windowMs / 1000) + " seconds",
        },
      );
    },
  }),
};

const dynamicRateLimiter = (req, res, next) => {
  if (req.path.startsWith("/api/weather")) {
    return rateLimiters.weather(req, res, next);
  }
  return rateLimiters.default(req, res, next);
};

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
  return /^[\p{L}\p{M}\s'’-]{2,50}$/u.test(city);
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
  const encodedCity = city
    .normalize("NFD")
    .replace(/'/g, "")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();

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

app.get("/api/version", (req, res) => {
  res.json({
    version: "1.0.0",
    lastUpdated: "2023-10-01",
  });
});

// CORS error handler
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return handleError(res, 403, "CORS policy disallows access from this origin.", "CORS_DENIED");
  }
  next(err);
});

// Route not found handler (404)
app.use((req, res, next) => {
  handleError(res, 404, "Route not found.", "ROUTE_NOT_FOUND");
});

// Final unhandled error handler (500)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  handleError(res, 500, "Internal server error.", "UNHANDLED_EXCEPTION", err.message || null);
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
  validateSelectors();
  scheduleSelectorValidation();
});

module.exports = { app, server, rateLimiters, stopServer, fetchWeatherData };