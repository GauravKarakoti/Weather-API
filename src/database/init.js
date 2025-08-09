/**
 * Database Initialization Script
 * 
 * Initializes the database connection, runs migrations, and sets up initial data.
 * This script should be run when the application starts to ensure the database
 * is properly configured.
 */

const { logger } = require('../utils/logger');
const { initializeDatabase, testConnection, closePool } = require('../config/database');
const { runMigrations } = require('./migrations');
const { createUser, getUserByUsername, hashPassword } = require('../services/user.service');

/**
 * Initialize database and run setup tasks
 * @returns {Promise<boolean>} True if initialization successful
 */
const initializeApp = async () => {
    let isInitialized = false;

    try {
        logger.info('Starting database initialization...');

        // Step 1: Initialize database connection pool
        logger.info('Initializing database connection pool...');
        initializeDatabase();

        // Step 2: Test database connection
        logger.info('Testing database connection...');
        const isConnected = await testConnection();

        if (!isConnected) {
            throw new Error('Database connection test failed');
        }

        // Step 3: Run database migrations
        logger.info('Running database migrations...');
        await runMigrations();

        // Step 4: Ensure default admin user exists
        logger.info('Verifying default admin user...');
        await ensureDefaultAdminUser();

        logger.info('Database initialization completed successfully');
        isInitialized = true;

    } catch (error) {
        logger.error('Database initialization failed', {
            error: error.message,
            stack: error.stack
        });

        // Log detailed error information for debugging
        if (error.code) {
            logger.error('Database error details', {
                code: error.code,
                detail: error.detail,
                hint: error.hint,
                position: error.position
            });
        }

        throw error;
    }

    return isInitialized;
};

/**
 * Ensure default admin user exists in database
 * Creates default admin user if it doesn't exist
 */
const ensureDefaultAdminUser = async () => {
    try {
        const defaultUsername = 'admin';

        // Check if admin user already exists
        const existingUser = await getUserByUsername(defaultUsername);

        if (existingUser) {
            logger.info('Default admin user already exists', {
                username: existingUser.username,
                id: existingUser.id
            });
            return;
        }

        // Create default admin user
        logger.info('Creating default admin user...');

        const defaultUser = {
            username: 'admin',
            password: 'admin123', // Default password - should be changed in production
            email: 'admin@weatherapi.local',
            role: 'admin'
        };

        const createdUser = await createUser(defaultUser);

        logger.info('Default admin user created successfully', {
            username: createdUser.username,
            id: createdUser.id,
            email: createdUser.email
        });

        // Log warning about default password
        if (process.env.NODE_ENV === 'production') {
            logger.warn('SECURITY WARNING: Default admin password is being used in production. Please change it immediately!', {
                username: defaultUser.username
            });
        } else {
            logger.info('Default admin credentials created', {
                username: defaultUser.username,
                password: '[HIDDEN - check logs for details]',
                note: 'Change these credentials in production'
            });
        }

    } catch (error) {
        if (error.message === 'Username already exists') {
            logger.info('Default admin user already exists (concurrent creation)');
            return;
        }

        logger.error('Failed to ensure default admin user', {
            error: error.message,
            stack: error.stack
        });

        throw error;
    }
};

/**
 * Gracefully shutdown database connections
 * @returns {Promise<void>}
 */
const shutdownDatabase = async () => {
    try {
        logger.info('Shutting down database connections...');
        await closePool();
        logger.info('Database connections closed successfully');
    } catch (error) {
        logger.error('Error during database shutdown', {
            error: error.message
        });
        throw error;
    }
};

/**
 * Check database health status
 * @returns {Promise<Object>} Health status object
 */
const getDatabaseHealth = async () => {
    try {
        const { getPoolStatus } = require('../config/database');

        const isConnected = await testConnection();
        const poolStatus = getPoolStatus();

        return {
            status: isConnected ? 'healthy' : 'unhealthy',
            connected: isConnected,
            pool: poolStatus,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        logger.error('Database health check failed', {
            error: error.message
        });

        return {
            status: 'unhealthy',
            connected: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

/**
 * Reset database (for development/testing only)
 * WARNING: This will drop all data!
 * @returns {Promise<void>}
 */
const resetDatabase = async () => {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Database reset is not allowed in production environment');
    }

    try {
        logger.warn('RESETTING DATABASE - ALL DATA WILL BE LOST');

        const { query } = require('../config/database');

        // Drop all tables (be careful with order due to foreign keys)
        await query('DROP TABLE IF EXISTS migrations CASCADE');
        await query('DROP TABLE IF EXISTS admin_users CASCADE');

        // Drop functions
        await query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');

        logger.warn('Database reset completed');

        // Re-initialize after reset
        await initializeApp();

    } catch (error) {
        logger.error('Database reset failed', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
};

module.exports = {
    initializeApp,
    ensureDefaultAdminUser,
    shutdownDatabase,
    getDatabaseHealth,
    resetDatabase
};
