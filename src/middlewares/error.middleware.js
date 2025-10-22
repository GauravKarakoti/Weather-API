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
const { retryWithBackoff } = require("../utils/retry.util");

const ERROR_SEVERITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

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
  DATABASE: "database",
  CACHE: "cache",
  FILE_SYSTEM: "file_system",
  SERIALIZATION: "serialization",
  CONFIGURATION: "configuration",
  THIRD_PARTY: "third_party",
  RESOURCE_EXHAUSTION: "resource_exhaustion",
};

/**
 * Enhanced error handler with monitoring, alerting and recovery
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Object} details - Additional error details
 * @param {Object} req - Express request object (optional)
 */
async function handleError(res, statusCode, message, code, details = null, req = null) {
  const { category, severity } = categorizeError(statusCode, code);

  // Attempt recovery for non-critical errors
  if (severity !== ERROR_SEVERITY.CRITICAL && req) {
    const recovered = await attemptErrorRecovery(
      { statusCode, message, code, details },
      category,
      req
    );
    if (recovered) {
      return;
    }
  }

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
 * Enhanced error categorization
 */
function categorizeError(statusCode, code, error) {
  let category = ERROR_CATEGORIES.UNKNOWN;
  let severity = ERROR_SEVERITY.LOW;

  // Database errors
  if (
    error?.name?.includes('Mongo') ||
    error?.name?.includes('Sequelize') ||
    error?.name?.includes('Postgres') ||
    code.includes('DB_')
  ) {
    category = ERROR_CATEGORIES.DATABASE;
    severity = ERROR_SEVERITY.HIGH;
  }
  // Cache errors
  else if (
    code.includes('CACHE_') ||
    error?.name?.includes('Redis') ||
    error?.name?.includes('Cache')
  ) {
    category = ERROR_CATEGORIES.CACHE;
    severity = ERROR_SEVERITY.MEDIUM;
  }
  // Network errors
  else if (code.includes('NETWORK_')) {
    category = ERROR_CATEGORIES.NETWORK;
    severity = ERROR_SEVERITY.MEDIUM;
  }
  // Resource exhaustion
  else if (
    error instanceof RangeError ||
    code.includes('MEMORY_') ||
    code.includes('HEAP_') ||
    code.includes('RESOURCE_')
  ) {
    category = ERROR_CATEGORIES.RESOURCE_EXHAUSTION;
    severity = ERROR_SEVERITY.CRITICAL;
  }
  // File system errors
  else if (
    error?.code?.includes('ENOENT') ||
    error?.code?.includes('EACCES') ||
    code.includes('FILE_')
  ) {
    category = ERROR_CATEGORIES.FILE_SYSTEM;
    severity = ERROR_SEVERITY.HIGH;
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

/**
 * Attempt to recover from certain types of errors
 */
async function attemptErrorRecovery(err, category, req) {
  try {
    switch (category) {
      case ERROR_CATEGORIES.DATABASE:
        await retryWithBackoff(() => req.operation, 3);
        return true;
      case ERROR_CATEGORIES.CACHE:
        await monitoringService.clearCache();
        return true;
      case ERROR_CATEGORIES.NETWORK:
        if (err.isRetryable) {
          await retryWithBackoff(() => req.operation, 3);
          return true;
        }
        return false;
      default:
        return false;
    }
  } catch (recoveryError) {
    logError(recoveryError, {
      context: 'error_recovery',
      originalError: err,
      category
    });
    return false;
  }
}

/**
 * Specific error handlers for different types of errors
 */
function handleDatabaseError(err, req, res, next) {
  if (err.name?.includes('Mongo') || err.name?.includes('Sequelize')) {
    return handleError(
      res,
      503,
      'Database operation failed',
      'DB_ERROR',
      {
        operation: err.operation,
        collection: err.collection,
        code: err.code
      },
      req
    );
  }
  next(err);
}

function handleCacheError(err, req, res, next) {
  if (err.name?.includes('Redis') || err.name?.includes('Cache')) {
    return handleError(
      res,
      503,
      'Cache operation failed',
      'CACHE_ERROR',
      {
        operation: err.operation,
        key: err.key
      },
      req
    );
  }
  next(err);
}
