/**
 * Structured Logging Utility using Winston
 * 
 * This module provides a centralized logging system with multiple log levels,
 * file rotation, and structured format for better debugging and monitoring.
 * 
 * Features:
 * - Multiple log levels (error, warn, info, debug)
 * - Daily log file rotation
 * - Console and file outputs
 * - Correlation ID support for request tracing
 * - Environment-based configuration
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = process.env.LOG_FILE_PATH || './logs';
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Custom log format with timestamp, level, correlation ID, and message
 */
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            ...(correlationId && { correlationId }),
            ...meta
        };
        return JSON.stringify(logEntry);
    })
);

/**
 * Console format for development - more readable
 */
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, correlationId }) => {
        const correlationTag = correlationId ? `[${correlationId}] ` : '';
        return `${timestamp} ${level}: ${correlationTag}${message}`;
    })
);

/**
 * Create daily rotate file transport
 * @param {string} filename - Base filename for logs
 * @param {string} level - Log level for this transport
 * @returns {DailyRotateFile} Configured transport
 */
const createRotateFileTransport = (filename, level = 'info') => {
    return new DailyRotateFile({
        filename: path.join(logsDir, `${filename}-%DATE%.log`),
        datePattern: 'YYYY-MM-DD',
        level,
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '14d',
        auditFile: path.join(logsDir, `${filename}-audit.json`),
        format: logFormat
    });
};

/**
 * Winston logger configuration
 */
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: {
        service: 'weather-api',
        version: process.env.npm_package_version || '1.0.0'
    },
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
            silent: process.env.NODE_ENV === 'test'
        }),

        // Combined logs (all levels)
        createRotateFileTransport('combined', 'debug'),

        // Error logs only
        createRotateFileTransport('error', 'error'),

        // Application logs (info and above)
        createRotateFileTransport('app', 'info')
    ],

    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            format: logFormat
        })
    ],

    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            format: logFormat
        })
    ]
});

/**
 * Create a child logger with correlation ID
 * @param {string} correlationId - Unique identifier for request tracing
 * @returns {winston.Logger} Child logger with correlation ID
 */
const createChildLogger = (correlationId) => {
    return logger.child({ correlationId });
};

/**
 * Log API request details
 * @param {Object} req - Express request object
 * @param {string} correlationId - Request correlation ID
 */
const logRequest = (req, correlationId) => {
    const childLogger = createChildLogger(correlationId);
    childLogger.info('API Request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        headers: {
            'content-type': req.get('Content-Type'),
            'accept': req.get('Accept')
        }
    });
};

/**
 * Log API response details
 * @param {Object} res - Express response object
 * @param {string} correlationId - Request correlation ID
 * @param {number} responseTime - Response time in milliseconds
 */
const logResponse = (res, correlationId, responseTime) => {
    const childLogger = createChildLogger(correlationId);
    childLogger.info('API Response', {
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        contentLength: res.get('Content-Length')
    });
};

/**
 * Log performance metrics
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 * @param {Object} metadata - Additional metadata
 */
const logPerformance = (operation, duration, metadata = {}) => {
    logger.info('Performance Metric', {
        operation,
        duration: `${duration}ms`,
        ...metadata
    });
};

/**
 * Log error with stack trace and context
 * @param {Error} error - Error object
 * @param {Object} context - Additional context information
 * @param {string} correlationId - Request correlation ID (optional)
 */
const logError = (error, context = {}, correlationId = null) => {
    const childLogger = correlationId ? createChildLogger(correlationId) : logger;
    childLogger.error('Application Error', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...context
    });
};

/**
 * Log system health metrics
 * @param {Object} metrics - Health metrics object
 */
const logHealthMetrics = (metrics) => {
    logger.info('Health Metrics', {
        type: 'system-health',
        ...metrics
    });
};

module.exports = {
    logger,
    createChildLogger,
    logRequest,
    logResponse,
    logPerformance,
    logError,
    logHealthMetrics
};
