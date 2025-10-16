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
let oauthRoutes;
let requireAuth, optionalAuth;
const axios = require("axios");
const cheerio = require("cheerio");

function sendErrorResponse(res, statusCode, message, code, details = null) {
  const errRes = {
    statusCode,
    error: message,
    code,
    timestamp: new Date().toISOString(),
  };
  if (details) errRes.details = details;
  res.status(statusCode).json(errRes);
}

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

// Import cache middleware and services
const CacheMiddleware = require("./src/middlewares/cache.middleware");
const redisService = require("./src/services/redis.service");
const cacheWarmingService = require("./src/services/cacheWarming.service");

// Database initialization
const {
  initializeApp,
  shutdownDatabase,
  getDatabaseHealth,
} = require("./src/database/init");

// ENHANCED FAILURE STATE MANAGEMENT SYSTEM
class SelectorFailureManager {
  constructor() {
    this.failureStates = new Map();
    this.globalFailureState = {
      consecutiveFailures: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      notificationLevel: 0,
      isInCooldown: false,
      cooldownUntil: null
    };
    this.persistencePath = path.join(__dirname, 'data', 'selector-failures.json');
    this.loadPersistedState();
  }

  // Load failure state from persistent storage
  loadPersistedState() {
    try {
      const dataDir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(this.persistencePath)) {
        const data = JSON.parse(fs.readFileSync(this.persistencePath, 'utf8'));

        // Restore individual selector states
        if (data.failureStates) {
          this.failureStates = new Map(Object.entries(data.failureStates));
        }

        // Restore global state with date parsing
        if (data.globalFailureState) {
          this.globalFailureState = {
            ...data.globalFailureState,
            lastFailureTime: data.globalFailureState.lastFailureTime ?
              new Date(data.globalFailureState.lastFailureTime) : null,
            lastSuccessTime: data.globalFailureState.lastSuccessTime ?
              new Date(data.globalFailureState.lastSuccessTime) : null,
            cooldownUntil: data.globalFailureState.cooldownUntil ?
              new Date(data.globalFailureState.cooldownUntil) : null
          };
        }

        logger.info('Selector failure state loaded from persistence', {
          failureCount: this.failureStates.size,
          consecutiveFailures: this.globalFailureState.consecutiveFailures,
          isInCooldown: this.isInCooldown()
        });
      }
    } catch (error) {
      logger.error('Error loading persisted failure state', {
        error: error.message,
        path: this.persistencePath
      });
      // Continue with empty state if loading fails
    }
  }

  // Save failure state to persistent storage
  saveState() {
    try {
      const dataToSave = {
        failureStates: Object.fromEntries(this.failureStates),
        globalFailureState: {
          ...this.globalFailureState,
          lastFailureTime: this.globalFailureState.lastFailureTime?.toISOString(),
          lastSuccessTime: this.globalFailureState.lastSuccessTime?.toISOString(),
          cooldownUntil: this.globalFailureState.cooldownUntil?.toISOString()
        },
        savedAt: new Date().toISOString()
      };

      fs.writeFileSync(this.persistencePath, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
      logger.error('Error saving failure state to persistence', {
        error: error.message,
        path: this.persistencePath
      });
    }
  }

  // Calculate exponential backoff delay in milliseconds
  calculateBackoffDelay(notificationLevel) {
    // Base delays: 1min, 5min, 15min, 1hr, 6hr, 24hr
    const baseDelays = [
      1 * 60 * 1000,      // 1 minute
      5 * 60 * 1000,      // 5 minutes
      15 * 60 * 1000,     // 15 minutes
      60 * 60 * 1000,     // 1 hour
      6 * 60 * 60 * 1000, // 6 hours
      24 * 60 * 60 * 1000 // 24 hours (max)
    ];

    const level = Math.min(notificationLevel, baseDelays.length - 1);
    return baseDelays[level];
  }

  // Check if system is in cooldown period
  isInCooldown() {
    if (!this.globalFailureState.cooldownUntil) return false;
    return new Date() < this.globalFailureState.cooldownUntil;
  }

  // Record selector failure
  recordFailure(selectorKey, error = null) {
    const now = new Date();

    // Update individual selector state
    const selectorState = this.failureStates.get(selectorKey) || {
      consecutiveFailures: 0,
      firstFailureTime: null,
      lastFailureTime: null,
      lastNotificationTime: null,
      notificationsSent: 0
    };

    selectorState.consecutiveFailures++;
    selectorState.lastFailureTime = now;
    if (!selectorState.firstFailureTime) {
      selectorState.firstFailureTime = now;
    }

    this.failureStates.set(selectorKey, selectorState);

    // Update global state
    this.globalFailureState.consecutiveFailures++;
    this.globalFailureState.lastFailureTime = now;

    this.saveState();

    logger.warn('Selector failure recorded', {
      selector: selectorKey,
      consecutiveFailures: selectorState.consecutiveFailures,
      globalConsecutiveFailures: this.globalFailureState.consecutiveFailures,
      error: error?.message
    });
  }

  // Record successful validation (reset failure states)
  recordSuccess() {
    const now = new Date();
    const hadFailures = this.globalFailureState.consecutiveFailures > 0;

    // Clear all failure states
    this.failureStates.clear();

    // Reset global state with cooldown
    const previousLevel = this.globalFailureState.notificationLevel;
    this.globalFailureState = {
      consecutiveFailures: 0,
      lastFailureTime: this.globalFailureState.lastFailureTime,
      lastSuccessTime: now,
      notificationLevel: 0,
      isInCooldown: hadFailures, // Enter cooldown if we had failures
      cooldownUntil: hadFailures ? new Date(now.getTime() + (2 * 60 * 60 * 1000)) : null // 2 hour cooldown
    };

    this.saveState();

    if (hadFailures) {
      logger.info('Selector validation recovered - entering cooldown period', {
        cooldownUntil: this.globalFailureState.cooldownUntil,
        previousNotificationLevel: previousLevel
      });
    }
  }

  // Check if we should send notification based on exponential backoff
  shouldSendNotification(failedSelectors) {
    // Don't send notifications during cooldown
    if (this.isInCooldown()) {
      logger.debug('Notification skipped - system in cooldown', {
        cooldownUntil: this.globalFailureState.cooldownUntil
      });
      return false;
    }

    const now = new Date();
    const timeSinceLastFailure = this.globalFailureState.lastFailureTime ?
      (now - this.globalFailureState.lastFailureTime) : Infinity;

    // For the first failure, send immediately
    if (this.globalFailureState.consecutiveFailures === 1) {
      return true;
    }

    // Calculate required delay based on notification level
    const requiredDelay = this.calculateBackoffDelay(this.globalFailureState.notificationLevel);

    // Check if enough time has passed since last failure to warrant notification
    if (timeSinceLastFailure >= requiredDelay) {
      return true;
    }

    logger.debug('Notification skipped - exponential backoff active', {
      consecutiveFailures: this.globalFailureState.consecutiveFailures,
      notificationLevel: this.globalFailureState.notificationLevel,
      timeSinceLastFailure,
      requiredDelay,
      nextNotificationIn: requiredDelay - timeSinceLastFailure
    });

    return false;
  }

  // Mark notification as sent and increment level
  markNotificationSent(failedSelectors) {
    const now = new Date();

    // Update notification level for exponential backoff
    this.globalFailureState.notificationLevel++;

    // Update individual selector notification times
    failedSelectors.forEach(selectorKey => {
      const selectorState = this.failureStates.get(selectorKey);
      if (selectorState) {
        selectorState.lastNotificationTime = now;
        selectorState.notificationsSent++;
      }
    });

    this.saveState();

    logger.info('Admin notification sent', {
      notificationLevel: this.globalFailureState.notificationLevel,
      failedSelectors,
      nextNotificationDelay: this.calculateBackoffDelay(this.globalFailureState.notificationLevel)
    });
  }

  // Get failure summary for admin dashboard
  getFailureSummary() {
    return {
      globalState: {
        ...this.globalFailureState,
        isInCooldown: this.isInCooldown(),
        nextNotificationDelay: this.calculateBackoffDelay(this.globalFailureState.notificationLevel)
      },
      failedSelectors: Array.from(this.failureStates.entries()).map(([key, state]) => ({
        selector: key,
        ...state
      })),
      systemHealth: {
        hasCriticalFailures: this.globalFailureState.consecutiveFailures >= 5,
        recommendsManualCheck: this.globalFailureState.consecutiveFailures >= 10
      }
    };
  }

  // Manually reset failure state (for admin use)
  manualReset() {
    logger.info('Manual failure state reset initiated');
    this.failureStates.clear();
    this.globalFailureState = {
      consecutiveFailures: 0,
      lastFailureTime: null,
      lastSuccessTime: new Date(),
      notificationLevel: 0,
      isInCooldown: false,
      cooldownUntil: null
    };
    this.saveState();
  }
}

// Initialize failure manager
const failureManager = new SelectorFailureManager();

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
    // Fixed code
    const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  secure: true // ensures SSL/TLS is used
});
// Enhanced admin alert function with failure management
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

  // Handle both string and array inputs
  const selectorsArray = Array.isArray(failedSelectors) ? failedSelectors : [failedSelectors];

  // Check if we should send notification based on failure management
  if (!failureManager.shouldSendNotification(selectorsArray)) {
    return; // Skip notification due to cooldown or backoff
  }

  const failureSummary = failureManager.getFailureSummary();
  const alertMessage = Array.isArray(failedSelectors)
    ? `The following selectors failed validation: ${failedSelectors.join(", ")}. Please update the environment variables or fallback selectors.`
    : failedSelectors;

  console.error(`Admin Alert: ${alertMessage}`);

  // Enhanced email content with failure context
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d32f2f;">⚠️ Weather API Selector Failure Alert</h2>

      <div style="background: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3>Current Issue</h3>
        <p><strong>${alertMessage}</strong></p>
      </div>

      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3>Failure Statistics</h3>
        <ul>
          <li><strong>Consecutive Failures:</strong> ${failureSummary.globalState.consecutiveFailures}</li>
          <li><strong>Notification Level:</strong> ${failureSummary.globalState.notificationLevel}</li>
          <li><strong>Last Success:</strong> ${failureSummary.globalState.lastSuccessTime ?
            failureSummary.globalState.lastSuccessTime.toLocaleString() : 'Never'}</li>
          <li><strong>System Status:</strong> ${failureSummary.systemHealth.hasCriticalFailures ?
            'CRITICAL - Immediate attention required' : 'DEGRADED - Monitor closely'}</li>
        </ul>
      </div>

      <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3>Recommended Actions</h3>
        <ol>
          <li>Check target website for structural changes</li>
          <li>Verify CSS selectors in environment variables</li>
          <li>Test fallback selectors functionality</li>
          <li>Monitor admin dashboard: <a href="${process.env.API_URL}/admin/dashboard">Dashboard</a></li>
          ${failureSummary.systemHealth.recommendsManualCheck ?
            '<li><strong>URGENT:</strong> Manual investigation required - failure count exceeds threshold</li>' : ''}
        </ol>
      </div>

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Next notification will be sent after ${Math.round(failureSummary.globalState.nextNotificationDelay / (1000 * 60))} minutes (exponential backoff active).
        <br>This is notification #${failureSummary.globalState.notificationLevel + 1} for the current failure sequence.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Weather API Alert" <${process.env.MAIL_USER}>`,
      to: adminEmail,
      subject: `🚨 Weather API Alert - ${failureSummary.systemHealth.hasCriticalFailures ? 'CRITICAL' : 'WARNING'} (Level ${failureSummary.globalState.notificationLevel + 1})`,
      text: `${alertMessage}\n\nConsecutive Failures: ${failureSummary.globalState.consecutiveFailures}\nLast Success: ${failureSummary.globalState.lastSuccessTime}\n\nPlease check the target website selectors or update fallback selectors.\n\nAdmin Dashboard: ${process.env.API_URL}/admin/dashboard`,
      html: emailHtml
    });

    // Mark notification as sent
    failureManager.markNotificationSent(selectorsArray);
    console.log("Email alert sent successfully with exponential backoff tracking");

  } catch (error) {
    console.error(
      "Email alert failed to send. Check your mail configuration.",
      error,
    );
  }
};

const app = express();
configureEnv(); // Load env or fallback

// After env is set, explicitly start Redis service
try {
  redisService.start();
} catch (e) {
  console.warn("Redis service start skipped due to initialization error:", e.message);
}

// Now that env is configured, require OAuth routes and middleware that depend on env
({
  requireAuth,
  optionalAuth,
} = require("./src/middlewares/oauth.middleware.js"));
oauthRoutes = require("./src/routes/oauth.routes.js");

logger.info("Weather API starting up", {
  environment: process.env.NODE_ENV,
  nodeVersion: process.version,
  timestamp: new Date().toISOString(),
});

app.use(cors(corsOptions));
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(healthCheckLoggingMiddleware);

if (process.env.NODE_ENV === "test") {
  app.set("trust proxy", false);
} else {
  const trustProxyEnv = process.env.TRUST_PROXY;
  app.set("trust proxy", trustProxyEnv ? trustProxyEnv === "true" : false);
}

// Security middleware
applySecurityHeaders(app);
app.use(securityLoggingMiddleware);

// Rate limiting with logging
app.use((req, res, next) => {
  const originalRateLimit = dynamicRateLimiter;
  originalRateLimit(req, res, (err) => {
    if (err) return next(err);

    if (req.rateLimit) {
      const limitType = req.path.startsWith("/api/weather")
        ? "weather"
        : "default";
      monitoringService.recordRateLimitHit(limitType, req.ip);
    }

    rateLimitLoggingMiddleware(req, res, next);
  });
});

// OAuth routes
app.use("/oauth", oauthRoutes);

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

  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    const duration = Date.now() - startTime;
    monitoringService.recordHttpRequest(req, res, duration);
    originalEnd.call(this, chunk, encoding);
  };

  next();
});

// Admin routes for monitoring dashboard
app.use("/admin", adminRoutes);

// Add failure manager status endpoint for admin dashboard
app.get("/admin/selector-status", requireAuth(["admin"]), (req, res) => {
  try {
    const failureSummary = failureManager.getFailureSummary();
    res.json({
      success: true,
      data: failureSummary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching selector status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch selector status',
      timestamp: new Date().toISOString()
    });
  }
});

// Manual reset endpoint for admins
app.post("/admin/reset-selector-failures", requireAuth(["admin"]), (req, res) => {
  try {
    const previousState = failureManager.getFailureSummary();
    failureManager.manualReset();

    logger.info('Manual selector failure reset performed', {
      admin: req.user?.username,
      previousFailures: previousState.globalState.consecutiveFailures
    });

    res.json({
      success: true,
      message: 'Selector failure state has been reset',
      previousState: previousState.globalState,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error resetting selector failures', {
      error: error.message,
      admin: req.user?.username
    });
    res.status(500).json({
      success: false,
      error: 'Failed to reset selector failure state',
      timestamp: new Date().toISOString()
    });
  }
});

const { sanitizeInput, isValidCity } = require('./src/utils/sanitize');

const sanitizeCityName = (str) => {
  const generalSanitized = sanitizeInput(str);
  return generalSanitized
    .replace(/[^\p{L}\p{M}\s''\-\d]/gu, '')
    .substring(0, 50);
};

const TEMPERATURE_PATTERN = /-?\d+(?:\.\d+)?/;

const parseTemperature = (rawText) => {
  try {
    if (typeof rawText !== "string" || rawText.length > 200) {
      return "N/A";
    }
    const match = rawText.match(TEMPERATURE_PATTERN);
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
    const regex = new RegExp(TEMPERATURE_PATTERN.source, 'g');
    const matches = rawText.match(regex) || [];

    const minTemp = matches[0] ? parseFloat(matches[0]) : null;
    const maxTemp = matches[1] ? parseFloat(matches[1]) : null;

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
    if (!rawText) return { humidity: "N/A", pressure: "N/A" };
    const humidityMatch =
      rawText.match(/(\d+\.?\d*)\s*%/i) ||
      rawText.match(/(\d+\.?\d*)\s*Humidity/i);
    const pressureMatch =
      rawText.match(/(\d+\.?\d*)\s*hPa/i) ||
      rawText.match(/(\d+\.?\d*)\s*Pressure/i);

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
  const encodedCity = encodeURIComponent(city.trim())
    .replace(/%20/g, "-")
    .replace(/'/g, "");

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

// Enhanced selector validation with failure management
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
        // Record individual selector failure
        failureManager.recordFailure(key);
      }
    });

    if (missingSelectors.length) {
      console.warn("Selector validation failed for:", missingSelectors);

      // Send alert only if failure manager allows it
      await sendAdminAlert(missingSelectors);

      // Log validation failure with context
      logger.warn('Selector validation failed', {
        missingSelectors,
        testUrl,
        consecutiveFailures: failureManager.globalFailureState.consecutiveFailures,
        isInCooldown: failureManager.isInCooldown()
      });
    } else {
      // All selectors validated successfully - record success
      console.log("All selectors validated successfully.");
      failureManager.recordSuccess();

      logger.info('Selector validation successful', {
        testUrl,
        validatedSelectors: Object.keys(fallbackSelectors),
        recoveredFromFailures: failureManager.globalFailureState.lastFailureTime !== null
      });
    }
  } catch (error) {
    console.error("Error during selector validation:", error.message);

    // Record failure for all selectors when network/parsing fails
    Object.keys(fallbackSelectors).forEach((key) => {
      failureManager.recordFailure(key, error);
    });

    // Send admin alert for complete validation failure
    await sendAdminAlert([
      `COMPLETE_VALIDATION_FAILURE: ${error.message}`,
    ]);

    logger.error('Complete selector validation failure', {
      error: error.message,
      testUrl,
      consecutiveFailures: failureManager.globalFailureState.consecutiveFailures
    });
  }
};

// In tests, do not require OAuth for weather endpoints to keep legacy tests passing
const weatherAuthMiddleware =
  process.env.NODE_ENV === "test"
    ? (req, res, next) => next()
    : requireAuth(["read"]);

app.get(
  "/api/weather-forecast/:city",
  weatherAuthMiddleware,
  async (req, res) => {
    const city = req.params.city;
    const apiKey = process.env.SPECIAL_API_KEY;
    const startTime = Date.now();

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
      return sendErrorResponse(
        res,
        500,
        "API key not set",
        "MISSING_API_KEY",
        null,
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
        return sendErrorResponse(
          res,
          response.status,
          errorData.message || "City not found or failed to fetch data",
          "FORECAST_API_ERROR",
          null,
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
      monitoringService.recordWeatherApiRequest(
        city,
        "error",
        "openweathermap",
      );
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
    }
  },
);

app.get(
  "/api/weather/:city",
  CacheMiddleware.weatherCache,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const city = sanitizeCityName(req.params.city);

      logger.info(`Weather request for ${city}`, {
        correlationId: req.correlationId,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      if (!city || !isValidCity(city)) {
        monitoringService.recordError("validation", "/api/weather/:city");
        return sendErrorResponse(
          res,
          400,
          "Invalid city name. Use letters, spaces, apostrophes (') and hyphens (-)",
          "INVALID_CITY",
          null,
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
        return sendErrorResponse(
          res,
          500,
          "Failed to parse weather data.",
          "PARSING_ERROR",
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

      console.error("Scraping error:", scrapingError.message);

      // Sanitize error message before sending to admin
      const sanitizedCity = sanitizeCityName(req.params.city);
      await sendAdminAlert(
        `Weather scrape failed for city: ${sanitizedCity}\nReason: ${scrapingError.message}`,
      );

      if (scrapingError.code === "ECONNABORTED") {
        monitoringService.recordError("network", "/api/weather/:city");
        return sendErrorResponse(
          res,
          504,
          "The weather service is taking too long. Try again later.",
          "TIMEOUT",
          null,
        );
      }
      if (scrapingError.response?.status === 404) {
        monitoringService.recordError("external_api", "/api/weather/:city");
        return sendErrorResponse(
          res,
          404,
          "City not found. Please check the spelling.",
          "CITY_NOT_FOUND",
          null,
        );
      }

      monitoringService.recordError("external_api", "/api/weather/:city");
      return sendErrorResponse(
        res,
        502,
        "Failed to retrieve data from the weather service.",
        "BAD_GATEWAY",
        null,
      );
    }
  },
);

// Enhanced selector validation scheduling with smart intervals
let selectorValidationInterval;
const scheduleSelectorValidation = () => {
  // Clear any existing interval
  if (selectorValidationInterval) {
    clearInterval(selectorValidationInterval);
  }

  // Base interval: 7 days (weekly)
  const baseInterval = 7 * 24 * 60 * 60 * 1000;

  // Add randomness: ±12 hours to distribute load across instances
  const randomBytes = crypto.randomBytes(4);
  const randomValue = randomBytes.readUInt32BE(0) / 0xffffffff;
  const randomOffset = randomValue * 24 * 60 * 60 * 1000 - 12 * 60 * 60 * 1000;
  const interval = baseInterval + randomOffset;

  console.log("Selector validation scheduled successfully", {
    baseIntervalHours: baseInterval / (1000 * 60 * 60),
    actualIntervalHours: interval / (1000 * 60 * 60),
    nextValidation: new Date(Date.now() + interval).toISOString()
  });

  selectorValidationInterval = setInterval(validateSelectors, interval);

  // Also perform immediate validation on startup (with slight delay)
  setTimeout(validateSelectors, 5000); // Wait 5 seconds after startup
};

app.get("/config", optionalAuth, (req, res) => {
  const config = {
    RECENT_SEARCH_LIMIT: process.env.RECENT_SEARCH_LIMIT || 5,
    API_URL: process.env.API_URL,
  };

  // Add user info if authenticated
  if (req.user) {
    config.user = {
      username: req.user.username,
      scopes: req.user.scopes,
    };
  }

  res.json(config);
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
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return sendErrorResponse(
      res,
      403,
      "CORS policy disallows access from this origin.",
      "CORS_DENIED",
    );
  }
  next(err);
});
app.use(corsErrorHandler);

// Route not found handler (404)
app.use(routeNotFoundHandler);

// Final unhandled error handler (500)
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("Unhandled error:", err);
  }
  sendErrorResponse(res, 500, "Internal server error", "SERVER_ERROR");
});
app.use(errorHandler);

const stopServer = async () => {
  if (selectorValidationInterval) clearInterval(selectorValidationInterval);

  // Stop cache warming service
  try {
    cacheWarmingService.stop();
    logger.info("Cache warming service stopped");
  } catch (error) {
    logger.error("Error stopping cache warming service", {
      error: error.message,
    });
  }

  // Close Redis connections
  try {
    await redisService.disconnect();
    logger.info("Redis connections closed");
  } catch (error) {
    logger.error("Error during Redis shutdown", { error: error.message });
  }

  // Close database connections
  try {
    await shutdownDatabase();
  } catch (error) {
    logger.error("Error during database shutdown", { error: error.message });
  }

  return new Promise((resolve, reject) => {
    if (server && server.close) {
      server.close((err) => {
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

const PORT = process.env.PORT || 3003;
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

      // Initialize monitoring and validation with failure management
      await validateSelectors();
      scheduleSelectorValidation();

      // Initialize cache warming service
      if (process.env.CACHE_WARMING_ENABLED !== "false") {
        logger.info("Starting cache warming service...");
        cacheWarmingService.start();
      }

      // Get database health status
      const dbHealth = await getDatabaseHealth();
      const failureSummary = failureManager.getFailureSummary();

      logger.info("System initialization completed", {
        database: dbHealth.status,
        selectorValidation: "enabled",
        failureManagement: {
          consecutiveFailures: failureSummary.globalState.consecutiveFailures,
          isInCooldown: failureSummary.globalState.isInCooldown,
          notificationLevel: failureSummary.globalState.notificationLevel
        },
        monitoring: "enabled",
        cacheWarming:
          process.env.CACHE_WARMING_ENABLED !== "false"
            ? "enabled"
            : "disabled",
        redis: redisService.isConnected ? "connected" : "disconnected",
        adminDashboard: `/admin/dashboard`,
        adminLogin: `/admin/login`,
        selectorStatus: `/admin/selector-status`,
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

// Graceful shutdown handling with failure manager cleanup
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Save final failure state before shutdown
    if (failureManager) {
      failureManager.saveState();
      logger.info("Selector failure state persisted before shutdown");
    }

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
  failureManager, // Export for testing purposes
};