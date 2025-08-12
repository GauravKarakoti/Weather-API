/**
 * Enhanced Error Handling Middleware with Monitoring Integration
 *
 * Provides comprehensive error handling with:
 * - Structured error responses
 * - Error tracking and metrics
 * - Alert triggering for critical errors
 * - Request context preservation
 */

const { logError } = require("../utils/logger");
const { monitoringService } = require("../services/monitoring.service");

/**
 * Error severity levels for alert triggering
 */
const ERROR_SEVERITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

/**
 * Error categorization for monitoring and alerting
 */
const ERROR_CATEGORIES = {
  VALIDATION: "validation",
  AUTHENTICATION: "authentication",
  AUTHORIZATION: "authorization",
  NETWORK: "network",
  EXTERNAL_API: "external_api",
  PARSING: "parsing",
  RATE_LIMIT: "rate_limit",
  SYSTEM: "system",
  UNKNOWN: "unknown",
};

/**
 * Enhanced error handler with monitoring and alerting
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Object} details - Additional error details
 * @param {Object} req - Express request object (optional)
 */
function handleError(
  res,
  statusCode,
  message,
  code,
  details = null,
  req = null,
) {
  const errRes = {
    statusCode,
    error: message,
    code,
    timestamp: new Date().toISOString(),
  };

  if (details) errRes.details = details;

  // Add correlation ID if available
  if (req?.correlationId) {
    errRes.correlationId = req.correlationId;
  }

  // Determine error category and severity
  const { category, severity } = categorizeError(statusCode, code);

  // Record error metrics
  const route = req?.route?.path || req?.path || "unknown";
  monitoringService.recordError(category, route);

  // Log error with context
  if (req) {
    logError(
      new Error(`${code}: ${message}`),
      {
        statusCode,
        code,
        category,
        severity,
        method: req.method,
        url: req.url,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
        details,
      },
      req.correlationId,
    );
  }

  // Trigger alerts for high/critical severity errors
  if (
    severity === ERROR_SEVERITY.HIGH ||
    severity === ERROR_SEVERITY.CRITICAL
  ) {
    triggerErrorAlert(statusCode, message, code, category, severity, req);
  }

  res.status(statusCode).json(errRes);
}

/**
 * Categorize error for monitoring and alerting
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @returns {Object} Category and severity information
 */
function categorizeError(statusCode, code) {
  let category = ERROR_CATEGORIES.UNKNOWN;
  let severity = ERROR_SEVERITY.LOW;

  // Categorize by error code
  if (code.includes("VALIDATION") || code.includes("INVALID")) {
    category = ERROR_CATEGORIES.VALIDATION;
    severity = ERROR_SEVERITY.LOW;
  } else if (code.includes("AUTH") || code.includes("UNAUTHORIZED")) {
    category = ERROR_CATEGORIES.AUTHENTICATION;
    severity = ERROR_SEVERITY.MEDIUM;
  } else if (code.includes("FORBIDDEN") || code.includes("ACCESS_DENIED")) {
    category = ERROR_CATEGORIES.AUTHORIZATION;
    severity = ERROR_SEVERITY.MEDIUM;
  } else if (code.includes("RATE_LIMIT") || code.includes("TOO_MANY")) {
    category = ERROR_CATEGORIES.RATE_LIMIT;
    severity = ERROR_SEVERITY.MEDIUM;
  } else if (
    code.includes("NETWORK") ||
    code.includes("TIMEOUT") ||
    code.includes("BAD_GATEWAY")
  ) {
    category = ERROR_CATEGORIES.NETWORK;
    severity = ERROR_SEVERITY.HIGH;
  } else if (code.includes("EXTERNAL") || code.includes("API")) {
    category = ERROR_CATEGORIES.EXTERNAL_API;
    severity = ERROR_SEVERITY.HIGH;
  } else if (code.includes("PARSING") || code.includes("PARSE")) {
    category = ERROR_CATEGORIES.PARSING;
    severity = ERROR_SEVERITY.MEDIUM;
  }

  // Adjust severity based on status code
  if (statusCode >= 500) {
    severity = ERROR_SEVERITY.CRITICAL;
    if (category === ERROR_CATEGORIES.UNKNOWN) {
      category = ERROR_CATEGORIES.SYSTEM;
    }
  } else if (statusCode >= 400 && statusCode < 500) {
    if (severity === ERROR_SEVERITY.LOW) {
      severity = ERROR_SEVERITY.MEDIUM;
    }
  }

  return { category, severity };
}

/**
 * Trigger error alert for high-severity errors
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {string} category - Error category
 * @param {string} severity - Error severity
 * @param {Object} req - Express request object
 */
async function triggerErrorAlert(
  statusCode,
  message,
  code,
  category,
  severity,
  req,
) {
  try {
    // Import email service dynamically to avoid circular dependencies
    const emailService = require("../services/email.service");

    const alertData = {
      timestamp: new Date().toISOString(),
      severity,
      category,
      statusCode,
      code,
      message,
      correlationId: req?.correlationId,
      requestDetails: req
        ? {
            method: req.method,
            url: req.url,
            userAgent: req.get("User-Agent"),
            ip: req.ip,
          }
        : null,
    };

    await emailService.sendErrorAlert(alertData);
  } catch (alertError) {
    // Log alert failure but don't throw to avoid error loops
    console.error("Failed to send error alert:", alertError.message);
  }
}

/**
 * CORS error handler with enhanced logging
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function corsErrorHandler(err, req, res, next) {
  if (err.message === "Not allowed by CORS") {
    return handleError(
      res,
      403,
      "CORS blocked this origin",
      "CORS_DENIED",
      {
        origin: req.get("Origin"),
        referer: req.get("Referer"),
      },
      req,
    );
  }
  next(err);
}

/**
 * Route not found handler with enhanced logging
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function routeNotFoundHandler(req, res) {
  return handleError(
    res,
    404,
    "Route not found",
    "ROUTE_NOT_FOUND",
    {
      attemptedRoute: req.originalUrl,
      method: req.method,
    },
    req,
  );
}

/**
 * Global error handler with comprehensive error tracking
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  if (process.env.NODE_ENV !== "test") {
    console.error("Unhandled error:", err);
  }

  const isKnownError = err.statusCode && err.code;

  if (isKnownError) {
    return handleError(
      res,
      err.statusCode,
      err.message,
      err.code,
      err.details,
      req,
    );
  }

  return handleError(
    res,
    500,
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
    "UNHANDLED_EXCEPTION",
    process.env.NODE_ENV === "production"
      ? null
      : {
          stack: err.stack,
          name: err.name,
        },
    req,
  );
}

module.exports = {
  handleError,
  corsErrorHandler,
  routeNotFoundHandler,
  errorHandler,
};
