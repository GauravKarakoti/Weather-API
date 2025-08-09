/**
 * Logging Middleware for Request/Response Tracking
 * 
 * This middleware provides comprehensive request and response logging with:
 * - Unique correlation IDs for request tracing
 * - Performance timing measurements
 * - Request/response details logging
 * - Error context preservation
 * 
 * Following Express.js middleware pattern and modular design principles.
 */

// Note: using crypto for UUID generation
const { logRequest, logResponse, logError, logPerformance } = require('../utils/logger');

/**
 * Generate a unique correlation ID for request tracing
 * Uses crypto.randomUUID() if available, fallback to timestamp-based ID
 * @returns {string} Unique correlation ID
 */
const generateCorrelationId = () => {
    try {
        // Use crypto.randomUUID() if available (Node.js 14.17.0+)
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback to timestamp + random for older Node.js versions
        return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    } catch (error) {
        // Ultimate fallback
        return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }
};

/**
 * Request logging middleware
 * Logs incoming requests with correlation ID and performance tracking
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
const requestLoggingMiddleware = (req, res, next) => {
    // Generate unique correlation ID for this request
    const correlationId = generateCorrelationId();

    // Attach correlation ID to request for use in other middleware/routes
    req.correlationId = correlationId;

    // Set correlation ID in response headers for client-side tracing
    res.setHeader('X-Correlation-ID', correlationId);

    // Record request start time for performance measurement
    req.startTime = Date.now();

    // Log the incoming request
    logRequest(req, correlationId);

    // Override res.end to capture response details
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        // Calculate response time
        const responseTime = Date.now() - req.startTime;

        // Log response details
        logResponse(res, correlationId, responseTime);

        // Log performance metrics
        logPerformance(`${req.method} ${req.route?.path || req.path}`, responseTime, {
            statusCode: res.statusCode,
            method: req.method,
            path: req.path
        });

        // Call original end method
        originalEnd.call(this, chunk, encoding);
    };

    next();
};

/**
 * Error logging middleware
 * Captures and logs errors with correlation ID and request context
 * Should be used after all other middleware and routes
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorLoggingMiddleware = (err, req, res, next) => {
    // Log error with request context and correlation ID
    logError(err, {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        statusCode: res.statusCode || 500,
        responseTime: req.startTime ? Date.now() - req.startTime : undefined
    }, req.correlationId);

    // Pass error to next error handler
    next(err);
};

/**
 * Rate limit logging middleware
 * Logs rate limit violations and tracking information
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const rateLimitLoggingMiddleware = (req, res, next) => {
    // Check if rate limit information is available
    if (req.rateLimit) {
        const { limit, current, remaining, resetTime } = req.rateLimit;

        // Log rate limit usage
        logPerformance('Rate Limit Check', 0, {
            type: 'rate-limit',
            limit,
            current,
            remaining,
            resetTime,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            correlationId: req.correlationId
        });

        // Log rate limit violations
        if (remaining <= 0) {
            logError(new Error('Rate limit exceeded'), {
                type: 'rate-limit-violation',
                limit,
                current,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path,
                method: req.method
            }, req.correlationId);
        }
    }

    next();
};

/**
 * Health check logging middleware
 * Logs health check requests separately with minimal overhead
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const healthCheckLoggingMiddleware = (req, res, next) => {
    // Skip detailed logging for health check endpoints
    if (req.path === '/health' || req.path === '/api/health' || req.path === '/api/version') {
        // Set a simple correlation ID without full logging
        req.correlationId = generateCorrelationId();
        res.setHeader('X-Correlation-ID', req.correlationId);
        return next();
    }

    // Use normal request logging for other endpoints
    return requestLoggingMiddleware(req, res, next);
};

/**
 * Security event logging middleware
 * Logs security-related events and suspicious activities
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const securityLoggingMiddleware = (req, res, next) => {
    // Log potentially suspicious requests
    const suspiciousPatterns = [
        /\.\./,  // Directory traversal
        /<script/i,  // XSS attempts
        /union\s+select/i,  // SQL injection
        /eval\s*\(/i,  // Code injection
        /javascript:/i  // JavaScript injection
    ];

    const requestData = JSON.stringify({
        url: req.url,
        body: req.body,
        query: req.query,
        headers: req.headers
    });

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(requestData));

    if (isSuspicious) {
        logError(new Error('Suspicious request detected'), {
            type: 'security-event',
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            body: req.body,
            query: req.query
        }, req.correlationId);
    }

    next();
};

module.exports = {
    requestLoggingMiddleware,
    errorLoggingMiddleware,
    rateLimitLoggingMiddleware,
    healthCheckLoggingMiddleware,
    securityLoggingMiddleware,
    generateCorrelationId
};
