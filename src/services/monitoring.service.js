/**
 * Performance Monitoring Service
 * 
 * This service provides comprehensive performance monitoring using Prometheus metrics:
 * - HTTP request metrics (response time, status codes, throughput)
 * - System health metrics (memory usage, CPU, uptime)
 * - Business metrics (popular cities, cache performance, rate limiting)
 * - Custom application metrics
 * 
 * Following modular design with clear separation of concerns.
 */

const client = require('prom-client');
const os = require('os');
const { logHealthMetrics, logPerformance } = require('../utils/logger');

/**
 * Initialize Prometheus default metrics collection
 * Includes Node.js runtime metrics like memory usage, event loop lag, etc.
 */
if (process.env.ENABLE_METRICS !== 'false') {
    client.collectDefaultMetrics({
        timeout: 5000,
        gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        prefix: 'weather_api_'
    });
}

/**
 * Custom Prometheus Metrics Configuration
 */

// HTTP Request Duration Histogram
const httpRequestDuration = new client.Histogram({
    name: 'weather_api_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

// HTTP Request Counter
const httpRequestTotal = new client.Counter({
    name: 'weather_api_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
});

// Active Connections Gauge
const activeConnections = new client.Gauge({
    name: 'weather_api_active_connections',
    help: 'Number of active connections'
});

// Weather API Requests Counter
const weatherApiRequests = new client.Counter({
    name: 'weather_api_weather_requests_total',
    help: 'Total number of weather API requests',
    labelNames: ['city', 'status', 'source']
});

// Cache Performance Metrics
const cacheHits = new client.Counter({
    name: 'weather_api_cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_type']
});

const cacheMisses = new client.Counter({
    name: 'weather_api_cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_type']
});

// Rate Limiting Metrics
const rateLimitHits = new client.Counter({
    name: 'weather_api_rate_limit_hits_total',
    help: 'Total number of rate limit hits',
    labelNames: ['limit_type', 'ip']
});

// Error Rate Counter
const errorRate = new client.Counter({
    name: 'weather_api_errors_total',
    help: 'Total number of errors',
    labelNames: ['error_type', 'route']
});

// External API Response Time
const externalApiDuration = new client.Histogram({
    name: 'weather_api_external_api_duration_seconds',
    help: 'Duration of external API calls in seconds',
    labelNames: ['api_name', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

// System Health Metrics
const systemMemoryUsage = new client.Gauge({
    name: 'weather_api_memory_usage_bytes',
    help: 'Memory usage in bytes',
    labelNames: ['type']
});

const systemCpuUsage = new client.Gauge({
    name: 'weather_api_cpu_usage_percent',
    help: 'CPU usage percentage'
});

/**
 * Monitoring Service Class
 * Provides methods to record and track various application metrics
 */
class MonitoringService {
    constructor() {
        this.startTime = Date.now();
        this.registry = client.register;

        // Start periodic health metrics collection
        if (process.env.NODE_ENV !== 'test') {
            this.startHealthMetricsCollection();
        }
    }

    /**
     * Record HTTP request metrics
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {number} duration - Request duration in milliseconds
     */
    recordHttpRequest(req, res, duration) {
        const route = req.route?.path || req.path;
        const method = req.method;
        const statusCode = res.statusCode.toString();
        const durationSeconds = duration / 1000;

        // Record histogram and counter metrics
        httpRequestDuration
            .labels(method, route, statusCode)
            .observe(durationSeconds);

        httpRequestTotal
            .labels(method, route, statusCode)
            .inc();

        // Log performance metric
        logPerformance('HTTP Request', duration, {
            method,
            route,
            statusCode,
            type: 'http-request'
        });
    }

    /**
     * Record weather API request metrics
     * @param {string} city - City name requested
     * @param {string} status - Request status (success, error, timeout)
     * @param {string} source - API source (primary, fallback)
     */
    recordWeatherApiRequest(city, status, source = 'primary') {
        weatherApiRequests
            .labels(city.toLowerCase(), status, source)
            .inc();
    }

    /**
     * Record cache hit metrics
     * @param {string} cacheType - Type of cache (weather, config, etc.)
     */
    recordCacheHit(cacheType) {
        cacheHits.labels(cacheType).inc();
    }

    /**
     * Record cache miss metrics
     * @param {string} cacheType - Type of cache (weather, config, etc.)
     */
    recordCacheMiss(cacheType) {
        cacheMisses.labels(cacheType).inc();
    }

    /**
     * Record cache performance metrics (deprecated - use recordCacheHit/recordCacheMiss)
     * @deprecated Use recordCacheHit() or recordCacheMiss() instead
     * @param {string} cacheType - Type of cache (weather, config, etc.)
     * @param {boolean} hit - Whether it was a cache hit or miss
     */
    recordCachePerformance(cacheType, hit) {
        if (hit) {
            this.recordCacheHit(cacheType);
        } else {
            this.recordCacheMiss(cacheType);
        }
    }

    /**
     * Record rate limiting events
     * @param {string} limitType - Type of rate limit (weather, default)
     * @param {string} ip - Client IP address
     */
    recordRateLimitHit(limitType, ip) {
        rateLimitHits.labels(limitType, ip).inc();
    }

    /**
     * Record application errors
     * @param {string} errorType - Type of error (validation, network, parsing)
     * @param {string} route - Route where error occurred
     */
    recordError(errorType, route) {
        errorRate.labels(errorType, route).inc();
    }

    /**
     * Record external API call duration
     * @param {string} apiName - Name of external API
     * @param {number} duration - Duration in milliseconds
     * @param {string} status - Call status (success, error, timeout)
     */
    recordExternalApiCall(apiName, duration, status) {
        const durationSeconds = duration / 1000;
        externalApiDuration
            .labels(apiName, status)
            .observe(durationSeconds);
    }

    /**
     * Update active connections count
     * @param {number} count - Current active connections
     */
    updateActiveConnections(count) {
        activeConnections.set(count);
    }

    /**
     * Get current metrics in Prometheus format
     * @returns {Promise<string>} Prometheus metrics string
     */
    async getMetrics() {
        return this.registry.metrics();
    }

    /**
     * Get application health status
     * @returns {Object} Health status object
     */
    getHealthStatus() {
        const memUsage = process.memoryUsage();
        const uptime = Date.now() - this.startTime;

        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: uptime,
            memory: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external
            },
            system: {
                loadAverage: os.loadavg(),
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                cpuCount: os.cpus().length
            }
        };
    }

    /**
     * Start periodic collection of system health metrics
     * Collects metrics every 30 seconds
     */
    startHealthMetricsCollection() {
        const collectInterval = 30000; // 30 seconds

        setInterval(() => {
            try {
                this.collectSystemMetrics();
            } catch (error) {
                console.error('Error collecting system metrics:', error);
            }
        }, collectInterval);
    }

    /**
     * Collect and record system metrics
     * @private
     */
    collectSystemMetrics() {
        const memUsage = process.memoryUsage();
        const loadAvg = os.loadavg();

        // Update memory usage metrics
        systemMemoryUsage.labels('rss').set(memUsage.rss);
        systemMemoryUsage.labels('heap_total').set(memUsage.heapTotal);
        systemMemoryUsage.labels('heap_used').set(memUsage.heapUsed);
        systemMemoryUsage.labels('external').set(memUsage.external);

        // Update CPU usage (1-minute load average as proxy)
        systemCpuUsage.set(loadAvg[0] * 100);

        // Log health metrics
        const healthData = {
            memory: {
                rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
            },
            system: {
                loadAverage: loadAvg[0].toFixed(2),
                freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`
            }
        };

        logHealthMetrics(healthData);
    }

    /**
     * Get performance summary statistics
     * @returns {Object} Performance statistics
     */
    async getPerformanceStats() {
        const metrics = await this.getMetrics();
        const healthStatus = this.getHealthStatus();

        return {
            health: healthStatus,
            uptime: Date.now() - this.startTime,
            metricsCount: metrics.split('\n').length,
            timestamp: new Date().toISOString()
        };
    }
}

// Export singleton instance
const monitoringService = new MonitoringService();

module.exports = {
    monitoringService,
    // Export individual metrics for direct access if needed
    metrics: {
        httpRequestDuration,
        httpRequestTotal,
        weatherApiRequests,
        cacheHits,
        cacheMisses,
        rateLimitHits,
        errorRate,
        externalApiDuration
    }
};
