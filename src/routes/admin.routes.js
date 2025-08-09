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

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { monitoringService } = require('../services/monitoring.service');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * Basic authentication middleware for admin routes
 * Checks credentials and redirects to login page if not authenticated
 */
const adminAuth = (req, res, next) => {
    // Skip auth in test environment
    if (process.env.NODE_ENV === 'test') {
        return next();
    }

    // Check for basic auth header
    const auth = req.headers?.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
        // For HTML pages, we redirect (handled only for /admin/login)
        if (req.path === '/login') {
            return res.redirect('/admin/login');
        }
        // For API endpoints, return 401 so client JS can handle
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
        return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate credentials
    const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString();
    const [username, password] = credentials.split(':');

    const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
    const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === expectedUsername && password === expectedPassword) {
        return next();
    }

    // Invalid credentials -> API JSON response
    return res.status(403).json({ error: 'Invalid credentials' });
};

/**
 * Redirect /admin to login page
 */
router.get('/', (req, res) => {
    res.redirect('/admin/login');
});

/**
 * Serve admin login page
 */
router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin/login.html'));
});

/**
 * Serve admin dashboard HTML
 */
router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin/dashboard.html'));
});

/**
 * Get system health status
 */
router.get('/health', adminAuth, async (req, res) => {
    try {
        const healthStatus = monitoringService.getHealthStatus();
        res.json(healthStatus);
    } catch (error) {
        logger.error('Failed to get health status:', error);
        res.status(500).json({ error: 'Failed to retrieve health status' });
    }
});

/**
 * Get Prometheus metrics
 */
router.get('/metrics', adminAuth, async (req, res) => {
    try {
        const metrics = await monitoringService.getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
    } catch (error) {
        logger.error('Failed to get metrics:', error);
        res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
});

/**
 * Get performance statistics
 */
router.get('/performance', adminAuth, async (req, res) => {
    try {
        const stats = await monitoringService.getPerformanceStats();
        res.json(stats);
    } catch (error) {
        logger.error('Failed to get performance stats:', error);
        res.status(500).json({ error: 'Failed to retrieve performance stats' });
    }
});

/**
 * Get recent log entries
 */
router.get('/logs', adminAuth, async (req, res) => {
    try {
        const { level = 'info', limit = 100, offset = 0 } = req.query;
        const logsDir = process.env.LOG_FILE_PATH || './logs';

        // Get the most recent log file
        const logFiles = await fs.readdir(logsDir);
        const appLogFiles = logFiles
            .filter(file => file.startsWith('app-') && file.endsWith('.log'))
            .sort()
            .reverse();

        if (appLogFiles.length === 0) {
            return res.json({ logs: [], total: 0 });
        }

        const latestLogFile = path.join(logsDir, appLogFiles[0]);
        const logContent = await fs.readFile(latestLogFile, 'utf8');

        // Parse log entries (assuming JSON format)
        const logLines = logContent.trim().split('\n').filter(line => line.trim());
        const logs = logLines
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(log => log !== null)
            .filter(log => {
                if (level === 'all') return true;
                return log.level?.toLowerCase() === level.toLowerCase();
            })
            .slice(offset, offset + parseInt(limit));

        res.json({
            logs,
            total: logLines.length,
            level,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        logger.error('Failed to get logs:', error);
        res.status(500).json({ error: 'Failed to retrieve logs' });
    }
});

/**
 * Get error summary
 */
router.get('/errors', adminAuth, async (req, res) => {
    try {
        const { hours = 24 } = req.query;
        const logsDir = process.env.LOG_FILE_PATH || './logs';

        // Get error log file
        const logFiles = await fs.readdir(logsDir);
        const errorLogFiles = logFiles
            .filter(file => file.startsWith('error-') && file.endsWith('.log'))
            .sort()
            .reverse();

        if (errorLogFiles.length === 0) {
            return res.json({ errors: [], summary: { total: 0, byCategory: {} } });
        }

        const latestErrorFile = path.join(logsDir, errorLogFiles[0]);
        const errorContent = await fs.readFile(latestErrorFile, 'utf8');

        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
        const errorLines = errorContent.trim().split('\n').filter(line => line.trim());

        const errors = errorLines
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(error => error !== null)
            .filter(error => new Date(error.timestamp) > cutoffTime);

        // Generate summary
        const summary = {
            total: errors.length,
            byCategory: {},
            bySeverity: {},
            recent: errors.slice(0, 10)
        };

        errors.forEach(error => {
            const category = error.category || 'unknown';
            const severity = error.severity || 'unknown';

            summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
            summary.bySeverity[severity] = (summary.bySeverity[severity] || 0) + 1;
        });

        res.json({ errors, summary });
    } catch (error) {
        logger.error('Failed to get error summary:', error);
        res.status(500).json({ error: 'Failed to retrieve error summary' });
    }
});

/**
 * Get system configuration
 */
router.get('/config', adminAuth, (req, res) => {
    try {
        const config = {
            environment: process.env.NODE_ENV,
            logLevel: process.env.LOG_LEVEL,
            enableMetrics: process.env.ENABLE_METRICS,
            metricsPort: process.env.METRICS_PORT,
            emailConfigured: !!(process.env.ADMIN_EMAIL && process.env.MAIL_USER),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        };

        res.json(config);
    } catch (error) {
        logger.error('Failed to get config:', error);
        res.status(500).json({ error: 'Failed to retrieve configuration' });
    }
});

/**
 * Clear log files (admin action)
 */
router.delete('/logs', adminAuth, async (req, res) => {
    try {
        const { type = 'all' } = req.query;
        const logsDir = process.env.LOG_FILE_PATH || './logs';

        const logFiles = await fs.readdir(logsDir);
        let filesToDelete = [];

        if (type === 'all') {
            filesToDelete = logFiles.filter(file => file.endsWith('.log'));
        } else {
            filesToDelete = logFiles.filter(file => file.startsWith(`${type}-`) && file.endsWith('.log'));
        }

        for (const file of filesToDelete) {
            await fs.unlink(path.join(logsDir, file));
        }

        logger.info(`Admin action: Cleared ${filesToDelete.length} log files`, {
            type,
            files: filesToDelete,
            correlationId: req.correlationId
        });

        res.json({
            message: `Cleared ${filesToDelete.length} log files`,
            files: filesToDelete
        });
    } catch (error) {
        logger.error('Failed to clear logs:', error);
        res.status(500).json({ error: 'Failed to clear logs' });
    }
});

/**
 * Update log level dynamically
 */
router.put('/config/log-level', adminAuth, (req, res) => {
    try {
        const { level } = req.body;
        const validLevels = ['error', 'warn', 'info', 'debug'];

        if (!validLevels.includes(level)) {
            return res.status(400).json({
                error: 'Invalid log level',
                validLevels
            });
        }

        // Update logger level
        logger.level = level;
        process.env.LOG_LEVEL = level;

        logger.info(`Admin action: Log level changed to ${level}`, {
            correlationId: req.correlationId
        });

        res.json({
            message: `Log level updated to ${level}`,
            level
        });
    } catch (error) {
        logger.error('Failed to update log level:', error);
        res.status(500).json({ error: 'Failed to update log level' });
    }
});

/**
 * Trigger test alert (for testing alert system)
 */
router.post('/test-alert', adminAuth, async (req, res) => {
    try {
        const { type = 'error', severity = 'medium' } = req.body;

        if (type === 'error') {
            const emailService = require('../services/email.service');
            await emailService.sendErrorAlert({
                timestamp: new Date().toISOString(),
                severity,
                category: 'test',
                statusCode: 500,
                code: 'TEST_ALERT',
                message: 'This is a test alert triggered from admin dashboard',
                correlationId: req.correlationId,
                requestDetails: {
                    method: 'POST',
                    url: '/admin/test-alert',
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });
        }

        logger.info(`Admin action: Test alert triggered`, {
            type,
            severity,
            correlationId: req.correlationId
        });

        res.json({ message: `Test ${type} alert sent with ${severity} severity` });
    } catch (error) {
        logger.error('Failed to send test alert:', error);
        res.status(500).json({ error: 'Failed to send test alert' });
    }
});

module.exports = router;
