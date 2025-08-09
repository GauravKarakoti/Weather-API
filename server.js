const express = require("express");
const cors = require("cors");
const path = require("path");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const dotenv = require("dotenv");
const xss = require("xss");
const fs = require("fs");
const { configureEnv } = require("./src/config/env.js");
const corsOptions = require("./src/config/cors.js");
const {
  applySecurityHeaders,
} = require("./src/middlewares/headers.middleware.js");
const {
  dynamicRateLimiter,
} = require("./src/middlewares/rateLimiter.middleware.js");
const stopValidationJob = require("./src/services/selectorValidation.service.js");
const axios = require("axios");
const cheerio = require("cheerio");

// Enhanced Logging and Monitoring
const { logger, logError, logPerformance } = require("./src/utils/logger");
const {
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  rateLimitLoggingMiddleware,
  healthCheckLoggingMiddleware,
  securityLoggingMiddleware,
} = require("./src/middlewares/logging.middleware");
const { monitoringService } = require("./src/services/monitoring.service");
const adminRoutes = require("./src/routes/admin.routes");

// Import enhanced error handling
const { handleError } = require("./src/middlewares/error.middleware");

// Database initialization
const {
  initializeApp,
  shutdownDatabase,
  getDatabaseHealth,
} = require("./src/database/init");

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
  if (process.env.NODE_ENV === "test") return;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("Admin email not configured. Cannot send alert.");
    return;
  }
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.warn(
      "Email notifications disabled: Missing required email configuration in environment variables.",
    );
    return;
  }

  // FIX: Handle both string and array inputs
  const alertMessage = Array.isArray(failedSelectors)
    ? `The following selectors failed validation: ${failedSelectors.join(", ")}. Please update the environment variables or fallback selectors.`
    : failedSelectors; // If it's a string, use it directly

  console.error(`Admin Alert: ${alertMessage}`);

  try {
    await transporter.sendMail({
      from: `"Weather API Alert" <${process.env.MAIL_USER}>`,
      to: adminEmail,
      subject: "Weather API Selector Failure Alert",
      text: `${alertMessage}\nPlease check the target website selectors or update fallback selectors.`,
      html: `<p><strong>Selector Validation Failed</strong></p><p>${alertMessage}</p><p>Please check the target website selectors or update fallback selectors.</p>`,
    });
    console.log("Email alert sent successfully");
  } catch (error) {
    console.error(
      "Email alert failed to send. Check your mail configuration.",
      error,
    );
  }
};

const app = express();
configureEnv(); // Load env or fallback

// Initialize logger
logger.info("Weather API starting up", {
  environment: process.env.NODE_ENV,
  nodeVersion: process.version,
  timestamp: new Date().toISOString(),
});

// Trust proxy for proper IP detection
app.set("trust proxy", true);

// Apply logging middleware first (for health checks)
app.use(healthCheckLoggingMiddleware);

// Basic Express middleware
app.use(cors(corsOptions));
app.use(express.static("public"));
app.use(express.json());

// Security middleware
applySecurityHeaders(app);
app.use(securityLoggingMiddleware);

// Rate limiting with logging
app.use((req, res, next) => {
  const originalRateLimit = dynamicRateLimiter;
  originalRateLimit(req, res, (err) => {
    if (err) return next(err);

    // Record rate limit metrics
    if (req.rateLimit) {
      const limitType = req.path.startsWith("/api/weather")
        ? "weather"
        : "default";
      monitoringService.recordRateLimitHit(limitType, req.ip);
    }

    rateLimitLoggingMiddleware(req, res, next);
  });
});

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

// Enhanced request/response logging and monitoring
app.use((req, res, next) => {
  const startTime = Date.now();

  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    const duration = Date.now() - startTime;

    // Record HTTP request metrics
    monitoringService.recordHttpRequest(req, res, duration);

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
});

// Admin routes for monitoring dashboard
app.use("/admin", adminRoutes);

const sanitizeInput = (str) => xss(str.trim());

const isValidCity = (city) => {
  return /^[\p{L}\p{M}\s'’\-\d]{2,50}$/u.test(city);
};

const parseTemperature = (rawText) => {
  try {
    if (typeof rawText !== "string" || rawText.length > 200) {
      return "N/A";
    }
    // Atomic grouping to prevent backtracking
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
    if (typeof rawText !== "string" || rawText.length > 200) {
      return { minTemperature: "N/A", maxTemperature: "N/A" };
    }
    // Atomic grouping to prevent backtracking
    const matches = rawText.match(/-?\d+(\.\d+)?/g) || [];
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
    if (typeof rawText !== "string" || rawText.length > 200) {
      return { humidity: "N/A", pressure: "N/A" };
    }
    // Optimized regex patterns
    const humidityMatch = rawText.match(/(\d+)\s*%/i);
    const pressureMatch = rawText.match(/(\d+(\.\d+)?)\s*hPa/i);

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
    if (!dateString) return "N/A";
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
    .replace(/%20/g, "-") // Replace spaces with hyphens
    .replace(/'/g, ""); // Remove single quotes

  const primaryUrl = `${process.env.SCRAPE_API_FIRST}${encodedCity}${process.env.SCRAPE_API_LAST}`;
  const fallbackUrl = `${process.env.SCRAPE_API_FALLBACK}${encodedCity}`;

  try {
    return await fetchWithRetry(primaryUrl, {
      timeout: 5000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
  } catch (error) {
    console.warn("Primary source failed, trying fallback:", error.message);
    try {
      return await fetchWithRetry(fallbackUrl, {
        timeout: 5000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
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
  if (process.env.NODE_ENV === "test") {
    console.log("Skipping selector validation in test mode");
    return;
  }
  const testCity = "delhi";
  const testUrl = `${process.env.SCRAPE_API_FIRST}${testCity}${process.env.SCRAPE_API_LAST}`;
  try {
    const response = await axios.get(testUrl, {
      timeout: 5000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
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
  const startTime = Date.now();

  // Log request
  logger.info(`Weather forecast request for ${city}`, {
    correlationId: req.correlationId,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  if (!apiKey) {
    monitoringService.recordError(
      "configuration",
      "/api/weather-forecast/:city",
    );
    return handleError(
      res,
      500,
      "API key not set",
      "MISSING_API_KEY",
      null,
      req,
    );
  }

  try {
    const encodedCity = encodeURIComponent(city);

    const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
    url.searchParams.set("q", encodedCity);
    url.searchParams.set("appid", apiKey);
    url.searchParams.set("units", "metric");

    const response = await fetch(url.toString());
    const externalApiDuration = Date.now() - startTime;

    // Record external API call
    monitoringService.recordExternalApiCall(
      "openweathermap-forecast",
      externalApiDuration,
      response.ok ? "success" : "error",
    );

    if (!response.ok) {
      const errorData = await response.json();
      monitoringService.recordWeatherApiRequest(
        city,
        "error",
        "openweathermap",
      );
      return handleError(
        res,
        response.status,
        errorData.message || "City not found or failed to fetch data",
        "FORECAST_API_ERROR",
        null,
        req,
      );
    }

    const data = await response.json();

    const forecast = data.list
      .filter((_, i) => i % 8 === 0)
      .slice(0, 4)
      .map((entry) => ({
        date: entry.dt_txt,
        temperature: entry.main.temp,
        min: entry.main.temp_min,
        max: entry.main.temp_max,
        humidity: entry.main.humidity,
        pressure: entry.main.pressure,
        condition: entry.weather[0].main,
      }));

    // Record successful API request
    monitoringService.recordWeatherApiRequest(
      city,
      "success",
      "openweathermap",
    );

    logger.info(`Weather forecast successful for ${city}`, {
      correlationId: req.correlationId,
      duration: Date.now() - startTime,
      forecastCount: forecast.length,
    });

    res.json({ forecast });
  } catch (err) {
    const duration = Date.now() - startTime;

    // Record error metrics
    monitoringService.recordWeatherApiRequest(city, "error", "openweathermap");
    monitoringService.recordError(
      "external_api",
      "/api/weather-forecast/:city",
    );

    logError(
      err,
      {
        city,
        duration,
        endpoint: "weather-forecast",
      },
      req.correlationId,
    );

    return handleError(
      res,
      500,
      "Failed to fetch weather forecast",
      "FORECAST_FETCH_ERROR",
      { originalError: err.message },
      req,
    );
  }
});

app.get("/api/weather/:city", async (req, res) => {
  const startTime = Date.now();

  try {
    const city = sanitizeInput(req.params.city);

    // Log request
    logger.info(`Weather request for ${city}`, {
      correlationId: req.correlationId,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    if (!city || !isValidCity(city)) {
      monitoringService.recordError("validation", "/api/weather/:city");
      return handleError(
        res,
        400,
        "Invalid city name. Use letters, spaces, apostrophes (') and hyphens (-)",
        "INVALID_CITY",
        null,
        req,
      );
    }

    const response = await fetchWeatherData(city);
    const $ = cheerio.load(response.data);

    const getElementText = (selectorKey) => {
      const primarySelector = process.env[selectorKey];
      const fallbackSelector = fallbackSelectors[selectorKey];
      let text = null;

      if (primarySelector && $(primarySelector).length) {
        text = $(primarySelector).text()?.trim();
      }

      if (!text && fallbackSelector && $(fallbackSelector).length) {
        text = $(fallbackSelector).text()?.trim();
      }

      return text || null;
    };

    const temperatureText = getElementText("TEMPERATURE_CLASS");
    const minMaxText = getElementText("MIN_MAX_TEMPERATURE_CLASS");
    const humidityPressureText = getElementText("HUMIDITY_PRESSURE_CLASS");
    const conditionText = getElementText("CONDITION_CLASS");
    const dateText = getElementText("DATE_CLASS");

    const temperature = parseTemperature(temperatureText);
    const { minTemperature, maxTemperature } =
      parseMinMaxTemperature(minMaxText);
    const { humidity, pressure } = parseHumidityPressure(humidityPressureText);
    const condition = conditionText || "N/A";
    const date = formatDate(dateText);

    if (temperature === "N/A" && condition === "N/A") {
      monitoringService.recordError("parsing", "/api/weather/:city");
      return handleError(
        res,
        500,
        "Failed to parse weather data",
        "PARSING_ERROR",
        null,
        req,
      );
    }

    const weatherData = {
      date,
      temperature,
      condition,
      minTemperature,
      maxTemperature,
      humidity,
      pressure,
    };

    // Record successful scraping
    const duration = Date.now() - startTime;
    monitoringService.recordWeatherApiRequest(city, "success", "scraping");

    logger.info(`Weather request successful for ${city}`, {
      correlationId: req.correlationId,
      duration,
      dataQuality: {
        temperature: temperature !== "N/A",
        condition: condition !== "N/A",
        humidity: humidity !== "N/A",
        pressure: pressure !== "N/A",
      },
    });

    res.json(weatherData);
  } catch (scrapingError) {
    const duration = Date.now() - startTime;

    // Record error metrics
    monitoringService.recordWeatherApiRequest(
      req.params.city,
      "error",
      "scraping",
    );

    // Log error with context
    logError(
      scrapingError,
      {
        city: req.params.city,
        duration,
        endpoint: "weather",
        errorCode: scrapingError.code,
        statusCode: scrapingError.response?.status,
      },
      req.correlationId,
    );

    await sendAdminAlert(
      `Weather scrape failed for city: ${req.params.city}\nReason: ${scrapingError.message}`,
    );

    if (scrapingError.code === "ECONNABORTED") {
      monitoringService.recordError("network", "/api/weather/:city");
      return handleError(
        res,
        504,
        "The weather service is taking too long. Try again later.",
        "TIMEOUT",
        null,
        req,
      );
    }
    if (scrapingError.response?.status === 404) {
      monitoringService.recordError("external_api", "/api/weather/:city");
      return handleError(
        res,
        404,
        "City not found. Please check the spelling.",
        "CITY_NOT_FOUND",
        null,
        req,
      );
    }

    monitoringService.recordError("external_api", "/api/weather/:city");
    return handleError(
      res,
      502,
      "Failed to retrieve data from the weather service.",
      "BAD_GATEWAY",
      null,
      req,
    );
  }
});

// Schedule weekly selector validation with randomness
let selectorValidationInterval;
const scheduleSelectorValidation = () => {
  // Base interval: 7 days (weekly)
  const baseInterval = 7 * 24 * 60 * 60 * 1000;

  // Add randomness: ±12 hours to distribute load across instances
  const randomBytes = crypto.randomBytes(4);
  const randomValue = randomBytes.readUInt32BE(0) / 0xffffffff; // Convert to 0-1 range
  const randomOffset = randomValue * 24 * 60 * 60 * 1000 - 12 * 60 * 60 * 1000; // ±12 hours
  const interval = baseInterval + randomOffset;

  console.log("Selector validation scheduled successfully");
  selectorValidationInterval = setInterval(validateSelectors, interval);
};

app.get("/config", (req, res) => {
  res.json({
    RECENT_SEARCH_LIMIT: process.env.RECENT_SEARCH_LIMIT || 5,
    API_URL: process.env.API_URL,
  });
});

app.get("/api/version", (req, res) => {
  res.json({ version: "1.0.0", lastUpdated: "2023-10-01" });
});

// Import enhanced error handlers
const {
  corsErrorHandler,
  routeNotFoundHandler,
  errorHandler,
} = require("./src/middlewares/error.middleware");

// Add error logging middleware first
app.use(errorLoggingMiddleware);

// CORS error handler
app.use(corsErrorHandler);

// Route not found handler (404)
app.use(routeNotFoundHandler);

// Final unhandled error handler (500)
app.use(errorHandler);

const stopServer = async () => {
  if (selectorValidationInterval) clearInterval(selectorValidationInterval);

  // Close database connections
  try {
    await shutdownDatabase();
  } catch (error) {
    logger.error("Error during database shutdown", { error: error.message });
  }

  return new Promise((resolve, reject) => {
    if (server && server.close) {
      server.close((err) => {
        // In a test environment, the server may not be formally "running".
        // Ignore the "Not running" error to allow tests to complete gracefully.
        if (
          err &&
          err.code !== "ERR_SERVER_NOT_RUNNING" &&
          err.message !== "Not running"
        ) {
          return reject(err);
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
};

const PORT = process.env.PORT || 5000;
let server;

if (process.env.NODE_ENV !== "test") {
  server = app.listen(PORT, async () => {
    logger.info("Weather API server started successfully", {
      port: PORT,
      environment: process.env.NODE_ENV,
      nodeVersion: process.version,
      enableMetrics: process.env.ENABLE_METRICS,
    });

    // Initialize database and system components
    try {
      // Initialize database first
      logger.info("Initializing database...");
      await initializeApp();

      // Initialize monitoring and validation
      await validateSelectors();
      scheduleSelectorValidation();

      // Get database health status
      const dbHealth = await getDatabaseHealth();

      logger.info("System initialization completed", {
        database: dbHealth.status,
        selectorValidation: "enabled",
        monitoring: "enabled",
        adminDashboard: `/admin/dashboard`,
        adminLogin: `/admin/login`,
        defaultCredentials:
          process.env.NODE_ENV !== "production"
            ? "admin/admin123 (change in production)"
            : "configured via database",
      });
    } catch (error) {
      logError(error, { context: "server-startup" });

      // For database errors, log additional context
      if (error.message.includes("DATABASE_URL")) {
        logger.error(
          "Database connection failed. Please ensure DATABASE_URL is set in your .env file",
          {
            hint: "Example: DATABASE_URL=postgresql://username:password@host:port/database?ssl=true",
          },
        );
      }

      // Don't exit on database errors in development, but warn
      if (process.env.NODE_ENV === "production") {
        logger.error("Critical error during startup in production. Exiting...");
        process.exit(1);
      } else {
        logger.warn("Continuing without database in development mode");
      }
    }
  });
} else {
  server = require("http").createServer(app);
  logger.info("Test server created", { environment: "test" });
}

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    await stopServer();
    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during graceful shutdown", { error: error.message });
    process.exit(1);
  }
};

// Register shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", {
    reason: reason,
    promise: promise,
  });
  gracefulShutdown("unhandledRejection");
});

module.exports = {
  app,
  server,
  stopServer,
  rateLimiters: require("./src/middlewares/rateLimiter.middleware")
    .rateLimiters,
  isValidCity,
  fetchWeatherData,
  formatDate,
};
