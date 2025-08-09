/**
 * Monitoring Configuration
 *
 * Centralized configuration for logging and monitoring features.
 * Provides default values and validation for monitoring-related settings.
 */

const path = require("path");

/**
 * Default monitoring configuration
 */
const defaultConfig = {
  // Logging Configuration
  LOG_LEVEL: "info",
  LOG_FILE_PATH: "./logs",
  LOG_MAX_SIZE: "20m",
  LOG_MAX_FILES: "14d",

  // Monitoring Configuration
  ENABLE_METRICS: "true",
  METRICS_PORT: "9090",

  // Alert Configuration
  ALERT_EMAIL: process.env.ADMIN_EMAIL || "",
  ALERT_THRESHOLD_ERROR_RATE: "10", // errors per minute
  ALERT_THRESHOLD_RESPONSE_TIME: "5000", // milliseconds

  // Health Check Configuration
  HEALTH_CHECK_INTERVAL: "30000", // 30 seconds
  HEALTH_CHECK_MEMORY_THRESHOLD: "500", // MB
  HEALTH_CHECK_CPU_THRESHOLD: "80", // percentage

  // Performance Configuration
  PERFORMANCE_METRICS_ENABLED: "true",
  PERFORMANCE_SAMPLING_RATE: "1.0", // 100% sampling
  PERFORMANCE_HISTOGRAM_BUCKETS: "0.001,0.005,0.01,0.05,0.1,0.5,1,2,5,10",

  // Security Configuration
  SECURITY_LOGGING_ENABLED: "true",
  SECURITY_ALERT_THRESHOLD: "5", // suspicious requests per minute

  // Admin Dashboard Configuration
  ADMIN_DASHBOARD_ENABLED: "true",
  ADMIN_DASHBOARD_PATH: "/admin",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "admin123", // Change in production!
};

/**
 * Load monitoring configuration with environment variable overrides
 * @returns {Object} Configuration object
 */
const loadMonitoringConfig = () => {
  const config = {};

  // Load configuration with environment variable overrides
  Object.keys(defaultConfig).forEach((key) => {
    config[key] = process.env[key] || defaultConfig[key];
  });

  // Type conversions
  config.ENABLE_METRICS = config.ENABLE_METRICS === "true";
  config.METRICS_PORT = parseInt(config.METRICS_PORT, 10);
  config.ALERT_THRESHOLD_ERROR_RATE = parseInt(
    config.ALERT_THRESHOLD_ERROR_RATE,
    10,
  );
  config.ALERT_THRESHOLD_RESPONSE_TIME = parseInt(
    config.ALERT_THRESHOLD_RESPONSE_TIME,
    10,
  );
  config.HEALTH_CHECK_INTERVAL = parseInt(config.HEALTH_CHECK_INTERVAL, 10);
  config.HEALTH_CHECK_MEMORY_THRESHOLD = parseInt(
    config.HEALTH_CHECK_MEMORY_THRESHOLD,
    10,
  );
  config.HEALTH_CHECK_CPU_THRESHOLD = parseInt(
    config.HEALTH_CHECK_CPU_THRESHOLD,
    10,
  );
  config.PERFORMANCE_METRICS_ENABLED =
    config.PERFORMANCE_METRICS_ENABLED === "true";
  config.PERFORMANCE_SAMPLING_RATE = parseFloat(
    config.PERFORMANCE_SAMPLING_RATE,
  );
  config.SECURITY_LOGGING_ENABLED = config.SECURITY_LOGGING_ENABLED === "true";
  config.SECURITY_ALERT_THRESHOLD = parseInt(
    config.SECURITY_ALERT_THRESHOLD,
    10,
  );
  config.ADMIN_DASHBOARD_ENABLED = config.ADMIN_DASHBOARD_ENABLED === "true";

  // Parse histogram buckets
  config.PERFORMANCE_HISTOGRAM_BUCKETS =
    config.PERFORMANCE_HISTOGRAM_BUCKETS.split(",").map((bucket) =>
      parseFloat(bucket.trim()),
    );

  // Validate configuration
  validateConfig(config);

  return config;
};

/**
 * Validate monitoring configuration
 * @param {Object} config - Configuration object to validate
 * @throws {Error} If configuration is invalid
 */
const validateConfig = (config) => {
  // Validate log level
  const validLogLevels = ["error", "warn", "info", "debug"];
  if (!validLogLevels.includes(config.LOG_LEVEL)) {
    throw new Error(
      `Invalid LOG_LEVEL: ${config.LOG_LEVEL}. Must be one of: ${validLogLevels.join(", ")}`,
    );
  }

  // Validate numeric values
  if (config.METRICS_PORT < 1 || config.METRICS_PORT > 65535) {
    throw new Error(
      `Invalid METRICS_PORT: ${config.METRICS_PORT}. Must be between 1 and 65535`,
    );
  }

  if (
    config.PERFORMANCE_SAMPLING_RATE < 0 ||
    config.PERFORMANCE_SAMPLING_RATE > 1
  ) {
    throw new Error(
      `Invalid PERFORMANCE_SAMPLING_RATE: ${config.PERFORMANCE_SAMPLING_RATE}. Must be between 0 and 1`,
    );
  }

  // Validate paths
  if (
    !path.isAbsolute(config.LOG_FILE_PATH) &&
    !config.LOG_FILE_PATH.startsWith("./")
  ) {
    config.LOG_FILE_PATH = path.resolve(process.cwd(), config.LOG_FILE_PATH);
  }
};

/**
 * Get environment-specific configuration overrides
 * @param {string} environment - Environment name (development, test, production)
 * @returns {Object} Environment-specific configuration
 */
const getEnvironmentConfig = (environment) => {
  switch (environment) {
    case "test":
      return {
        LOG_LEVEL: "error", // Reduce log noise in tests
        ENABLE_METRICS: false,
        HEALTH_CHECK_INTERVAL: 60000, // Longer interval for tests
        PERFORMANCE_SAMPLING_RATE: 0.1, // Reduced sampling for tests
        SECURITY_LOGGING_ENABLED: false,
        ADMIN_DASHBOARD_ENABLED: false,
      };

    case "development":
      return {
        LOG_LEVEL: "debug",
        ADMIN_DASHBOARD_ENABLED: true,
        SECURITY_LOGGING_ENABLED: true,
      };

    case "production":
      return {
        LOG_LEVEL: "info",
        ADMIN_PASSWORD: "", // Must be set via environment variable
        SECURITY_LOGGING_ENABLED: true,
        ALERT_THRESHOLD_ERROR_RATE: 5, // Stricter in production
      };

    default:
      return {};
  }
};

/**
 * Create monitoring configuration for current environment
 * @returns {Object} Complete monitoring configuration
 */
const createMonitoringConfig = () => {
  const baseConfig = loadMonitoringConfig();
  const environment = process.env.NODE_ENV || "development";
  const envConfig = getEnvironmentConfig(environment);

  // Merge configurations (environment overrides base)
  const finalConfig = { ...baseConfig, ...envConfig };

  // Set environment variables for other modules
  Object.keys(finalConfig).forEach((key) => {
    if (process.env[key] === undefined) {
      process.env[key] = String(finalConfig[key]);
    }
  });

  return finalConfig;
};

/**
 * Monitoring feature flags
 */
const isFeatureEnabled = (feature, config) => {
  switch (feature) {
    case "metrics":
      return config.ENABLE_METRICS;
    case "performance":
      return config.PERFORMANCE_METRICS_ENABLED;
    case "security":
      return config.SECURITY_LOGGING_ENABLED;
    case "dashboard":
      return config.ADMIN_DASHBOARD_ENABLED;
    default:
      return false;
  }
};

/**
 * Get monitoring configuration summary for display
 * @param {Object} config - Monitoring configuration
 * @returns {Object} Configuration summary
 */
const getConfigSummary = (config) => {
  return {
    environment: process.env.NODE_ENV || "development",
    logging: {
      level: config.LOG_LEVEL,
      path: config.LOG_FILE_PATH,
      maxSize: config.LOG_MAX_SIZE,
      retention: config.LOG_MAX_FILES,
    },
    monitoring: {
      enabled: config.ENABLE_METRICS,
      port: config.METRICS_PORT,
      performanceTracking: config.PERFORMANCE_METRICS_ENABLED,
      samplingRate: config.PERFORMANCE_SAMPLING_RATE,
    },
    security: {
      enabled: config.SECURITY_LOGGING_ENABLED,
      alertThreshold: config.SECURITY_ALERT_THRESHOLD,
    },
    adminDashboard: {
      enabled: config.ADMIN_DASHBOARD_ENABLED,
      path: config.ADMIN_DASHBOARD_PATH,
    },
    alerts: {
      email: !!config.ALERT_EMAIL,
      errorRateThreshold: config.ALERT_THRESHOLD_ERROR_RATE,
      responseTimeThreshold: config.ALERT_THRESHOLD_RESPONSE_TIME,
    },
  };
};

module.exports = {
  loadMonitoringConfig,
  createMonitoringConfig,
  getEnvironmentConfig,
  isFeatureEnabled,
  getConfigSummary,
  defaultConfig,
};
