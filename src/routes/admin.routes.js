/**
 * Admin Routes for Monitoring Dashboard
 *
 * Provides endpoints for:
 * - System health monitoring
 * - Performance metrics
 * - Error tracking
 * - Log management
 * - Configuration management
 *
 * Security: These routes should be protected in production
 */

const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const { monitoringService } = require("../services/monitoring.service");
const { logger } = require("../utils/logger");
const { authenticateUser } = require("../services/user.service");
const CacheMiddleware = require("../middlewares/cache.middleware");

const router = express.Router();

/**
 * Database-based authentication middleware for admin routes
 * Checks credentials against PostgreSQL database
 */
const adminAuth = async (req, res, next) => {
  // Skip auth in test environment
  if (process.env.NODE_ENV === "test") {
    return next();
  }

  try {
    // Check for basic auth header
    const auth = req.headers?.authorization;
    if (!auth?.startsWith("Basic ")) {
      // For HTML pages, we redirect (handled only for /admin/login)
      if (req.path === "/login") {
        return res.redirect("/admin/login");
      }
      // For API endpoints, return 401 so client JS can handle
      res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
      return res.status(401).json({ error: "Authentication required" });
    }

    // Extract credentials
    const credentials = Buffer.from(auth.split(" ")[1], "base64").toString();
    const [username, password] = credentials.split(":");

    if (!username || !password) {
      return res.status(401).json({ error: "Invalid credentials format" });
    }

    // Authenticate against database
    const authResult = await authenticateUser(username, password);

    if (!authResult.success) {
      logger.warn("Admin authentication failed", {
        username,
        reason: authResult.message,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      return res.status(403).json({
        error: authResult.message || "Invalid credentials",
      });
    }

    // Store user info in request for potential use in routes
    req.user = authResult.user;

    logger.info("Admin authentication successful", {
      username: authResult.user.username,
      userId: authResult.user.id,
      ip: req.ip,
    });

    return next();
  } catch (error) {
    logger.error("Admin authentication error", {
      error: error.message,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    return res.status(500).json({
      error: "Authentication service unavailable",
    });
  }
};

/**
 * Redirect /admin to login page
 */
router.get("/", (req, res) => {
  res.redirect("/admin/login");
});

/**
 * Serve admin login page
 */
router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/admin/login.html"));
});

/**
 * Serve admin dashboard HTML
 */
router.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/admin/dashboard.html"));
});

/**
 * Get system health status
 */
router.get("/health", adminAuth, async (req, res) => {
  try {
    const healthStatus = monitoringService.getHealthStatus();
    res.json(healthStatus);
  } catch (error) {
    logger.error("Failed to get health status:", error);
    res.status(500).json({ error: "Failed to retrieve health status" });
  }
});

/**
 * Get Prometheus metrics
 */
router.get("/metrics", adminAuth, async (req, res) => {
  try {
    const metrics = await monitoringService.getMetrics();
    res.set("Content-Type", "text/plain");
    res.send(metrics);
  } catch (error) {
    logger.error("Failed to get metrics:", error);
    res.status(500).json({ error: "Failed to retrieve metrics" });
  }
});

/**
 * Get performance statistics
 */
router.get("/performance", adminAuth, async (req, res) => {
  try {
    const stats = await monitoringService.getPerformanceStats();
    res.json(stats);
  } catch (error) {
    logger.error("Failed to get performance stats:", error);
    res.status(500).json({ error: "Failed to retrieve performance stats" });
  }
});

/**
 * Get recent log entries
 */
router.get("/logs", adminAuth, async (req, res) => {
  try {
    const { level = "info", limit = 100, offset = 0 } = req.query;
    const logsDir = process.env.LOG_FILE_PATH || "./logs";

    // Get the most recent log file
    const logFiles = await fs.readdir(logsDir);
    const appLogFiles = logFiles
      .filter((file) => file.startsWith("app-") && file.endsWith(".log"))
      .sort()
      .reverse();

    if (appLogFiles.length === 0) {
      return res.json({ logs: [], total: 0 });
    }

    const latestLogFile = path.join(logsDir, appLogFiles[0]);
    const logContent = await fs.readFile(latestLogFile, "utf8");

    // Parse log entries (assuming JSON format)
    const logLines = logContent
      .trim()
      .split("\n")
      .filter((line) => line.trim());
    const logs = logLines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((log) => log !== null)
      .filter((log) => {
        if (level === "all") return true;
        return log.level?.toLowerCase() === level.toLowerCase();
      })
      .slice(offset, offset + parseInt(limit));

    res.json({
      logs,
      total: logLines.length,
      level,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error("Failed to get logs:", error);
    res.status(500).json({ error: "Failed to retrieve logs" });
  }
});

/**
 * Get error summary
 */
router.get("/errors", adminAuth, async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const logsDir = process.env.LOG_FILE_PATH || "./logs";

    // Get error log file
    const logFiles = await fs.readdir(logsDir);
    const errorLogFiles = logFiles
      .filter((file) => file.startsWith("error-") && file.endsWith(".log"))
      .sort()
      .reverse();

    if (errorLogFiles.length === 0) {
      return res.json({ errors: [], summary: { total: 0, byCategory: {} } });
    }

    const latestErrorFile = path.join(logsDir, errorLogFiles[0]);
    const errorContent = await fs.readFile(latestErrorFile, "utf8");

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const errorLines = errorContent
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    const errors = errorLines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((error) => error !== null)
      .filter((error) => new Date(error.timestamp) > cutoffTime);

    // Generate summary
    const summary = {
      total: errors.length,
      byCategory: {},
      bySeverity: {},
      recent: errors.slice(0, 10),
    };

    errors.forEach((error) => {
      const category = error.category || "unknown";
      const severity = error.severity || "unknown";

      summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
      summary.bySeverity[severity] = (summary.bySeverity[severity] || 0) + 1;
    });

    res.json({ errors, summary });
  } catch (error) {
    logger.error("Failed to get error summary:", error);
    res.status(500).json({ error: "Failed to retrieve error summary" });
  }
});

/**
 * Get system configuration
 */
router.get("/config", adminAuth, (req, res) => {
  try {
    const config = {
      environment: process.env.NODE_ENV,
      logLevel: process.env.LOG_LEVEL,
      enableMetrics: process.env.ENABLE_METRICS,
      metricsPort: process.env.METRICS_PORT,
      emailConfigured: !!(process.env.ADMIN_EMAIL && process.env.MAIL_USER),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    };

    res.json(config);
  } catch (error) {
    logger.error("Failed to get config:", error);
    res.status(500).json({ error: "Failed to retrieve configuration" });
  }
});

/**
 * Clear log files (admin action)
 */
router.delete("/logs", adminAuth, async (req, res) => {
  try {
    const { type = "all" } = req.query;
    const logsDir = process.env.LOG_FILE_PATH || "./logs";

    const logFiles = await fs.readdir(logsDir);
    let filesToDelete = [];

    if (type === "all") {
      filesToDelete = logFiles.filter((file) => file.endsWith(".log"));
    } else {
      filesToDelete = logFiles.filter(
        (file) => file.startsWith(`${type}-`) && file.endsWith(".log"),
      );
    }

    for (const file of filesToDelete) {
      await fs.unlink(path.join(logsDir, file));
    }

    logger.info(`Admin action: Cleared ${filesToDelete.length} log files`, {
      type,
      files: filesToDelete,
      correlationId: req.correlationId,
    });

    res.json({
      message: `Cleared ${filesToDelete.length} log files`,
      files: filesToDelete,
    });
  } catch (error) {
    logger.error("Failed to clear logs:", error);
    res.status(500).json({ error: "Failed to clear logs" });
  }
});

/**
 * Update log level dynamically
 */
router.put("/config/log-level", adminAuth, (req, res) => {
  try {
    const { level } = req.body;
    const validLevels = ["error", "warn", "info", "debug"];

    if (!validLevels.includes(level)) {
      return res.status(400).json({
        error: "Invalid log level",
        validLevels,
      });
    }

    // Update logger level
    logger.level = level;
    process.env.LOG_LEVEL = level;

    logger.info(`Admin action: Log level changed to ${level}`, {
      correlationId: req.correlationId,
    });

    res.json({
      message: `Log level updated to ${level}`,
      level,
    });
  } catch (error) {
    logger.error("Failed to update log level:", error);
    res.status(500).json({ error: "Failed to update log level" });
  }
});

/**
 * Trigger test alert (for testing alert system)
 */
router.post("/test-alert", adminAuth, async (req, res) => {
  try {
    const { type = "error", severity = "medium" } = req.body;

    if (type === "error") {
      const emailService = require("../services/email.service");
      await emailService.sendErrorAlert({
        timestamp: new Date().toISOString(),
        severity,
        category: "test",
        statusCode: 500,
        code: "TEST_ALERT",
        message: "This is a test alert triggered from admin dashboard",
        correlationId: req.correlationId,
        requestDetails: {
          method: "POST",
          url: "/admin/test-alert",
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });
    }

    logger.info(`Admin action: Test alert triggered`, {
      type,
      severity,
      correlationId: req.correlationId,
    });

    res.json({ message: `Test ${type} alert sent with ${severity} severity` });
  } catch (error) {
    logger.error("Failed to send test alert:", error);
    res.status(500).json({ error: "Failed to send test alert" });
  }
});

/**
 * Database Management Routes
 */

/**
 * Get database status and connection info
 */
router.get("/database/status", adminAuth, async (req, res) => {
  try {
    const { testConnection, getPoolStatus } = require("../config/database");

    const isConnected = await testConnection();
    const poolStatus = getPoolStatus();

    res.json({
      connected: isConnected,
      pool: poolStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to get database status:", error);
    res.status(500).json({ error: "Failed to retrieve database status" });
  }
});

/**
 * Run database migrations
 */
router.post("/database/migrate", adminAuth, async (req, res) => {
  try {
    const { runMigrations } = require("../database/migrations");

    await runMigrations();

    logger.info("Admin action: Database migrations executed", {
      userId: req.user?.id,
      username: req.user?.username,
    });

    res.json({ message: "Database migrations completed successfully" });
  } catch (error) {
    logger.error("Failed to run migrations:", error);
    res.status(500).json({ error: "Failed to run database migrations" });
  }
});

/**
 * Get migration status
 */
router.get("/database/migrations", adminAuth, async (req, res) => {
  try {
    const { getMigrationStatus } = require("../database/migrations");

    const status = await getMigrationStatus();
    res.json(status);
  } catch (error) {
    logger.error("Failed to get migration status:", error);
    res.status(500).json({ error: "Failed to retrieve migration status" });
  }
});

/**
 * User Management Routes
 */

/**
 * Get all admin users
 */
router.get("/users", adminAuth, async (req, res) => {
  try {
    const { getAllUsers } = require("../services/user.service");

    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    logger.error("Failed to get users:", error);
    res.status(500).json({ error: "Failed to retrieve users" });
  }
});

/**
 * Create new admin user
 */
router.post("/users", adminAuth, async (req, res) => {
  try {
    const { createUser } = require("../services/user.service");
    const { username, password, email, role = "admin" } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    const user = await createUser({ username, password, email, role });

    logger.info("Admin action: New user created", {
      createdUserId: user.id,
      createdUsername: user.username,
      createdBy: req.user?.username,
    });

    res.status(201).json(user);
  } catch (error) {
    logger.error("Failed to create user:", error);

    if (error.message === "Username already exists") {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to create user" });
  }
});

/**
 * Update user password
 */
router.put("/users/:userId/password", adminAuth, async (req, res) => {
  try {
    const { updatePassword } = require("../services/user.service");
    const { userId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    await updatePassword(parseInt(userId), password);

    logger.info("Admin action: User password updated", {
      targetUserId: userId,
      updatedBy: req.user?.username,
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    logger.error("Failed to update password:", error);
    res.status(500).json({ error: "Failed to update password" });
  }
});

/**
 * Deactivate user account
 */
router.delete("/users/:userId", adminAuth, async (req, res) => {
  try {
    const { deactivateUser } = require("../services/user.service");
    const { userId } = req.params;

    // Prevent users from deactivating themselves
    if (req.user?.id === parseInt(userId)) {
      return res
        .status(400)
        .json({ error: "Cannot deactivate your own account" });
    }

    await deactivateUser(parseInt(userId));

    logger.info("Admin action: User deactivated", {
      targetUserId: userId,
      deactivatedBy: req.user?.username,
    });

    res.json({ message: "User deactivated successfully" });
  } catch (error) {
    logger.error("Failed to deactivate user:", error);
    res.status(500).json({ error: "Failed to deactivate user" });
  }
});

// ===== CACHE MANAGEMENT ENDPOINTS =====

/**
 * Cache Analytics - Get cache performance metrics
 */
router.get("/cache/analytics", adminAuth, CacheMiddleware.getCacheAnalytics);

/**
 * Cache Health Check - Check Redis connection and cache status
 */
router.get("/cache/health", adminAuth, CacheMiddleware.healthCheck);

/**
 * Cache Info for specific city
 */
router.get("/cache/info/:city", adminAuth, CacheMiddleware.getCacheInfo);

/**
 * Cache Warming - Trigger cache warming for popular cities
 */
router.post("/cache/warm", adminAuth, CacheMiddleware.warmCache);

/**
 * Cache Invalidation - Invalidate cache for specific city or pattern
 * Body: { city?: string, pattern?: string }
 */
router.post("/cache/invalidate", adminAuth, CacheMiddleware.invalidateCache);

/**
 * Cache Dashboard - Serve cache management HTML page
 */
router.get("/cache", adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/admin/cache.html"));
});

module.exports = router;
