/**
 * Database Configuration and Connection Setup
 *
 * This module provides PostgreSQL database connection using Neon
 * with connection pooling and error handling.
 */

const { Pool } = require("pg");
const { logger } = require("../utils/logger");

let pool;

/**
 * Initialize database connection pool
 * @returns {Pool} PostgreSQL connection pool
 */
const initializeDatabase = () => {
  if (pool) {
    return pool;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false, // Required for Neon
      },
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection could not be established
      acquireTimeoutMillis: 10000, // Time to wait for connection from pool
    });

    // Handle pool errors
    pool.on("error", (err, client) => {
      logger.error("Unexpected error on idle client", { error: err.message });
    });

    // Handle pool connection events
    pool.on("connect", (client) => {
      logger.debug("New database client connected");
    });

    pool.on("remove", (client) => {
      logger.debug("Database client removed from pool");
    });

    logger.info("Database connection pool initialized successfully");
    return pool;
  } catch (error) {
    logger.error("Failed to initialize database connection pool", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get database connection pool
 * @returns {Pool} PostgreSQL connection pool
 */
const getPool = () => {
  if (!pool) {
    return initializeDatabase();
  }
  return pool;
};

/**
 * Execute a database query with error handling
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params = []) => {
  const start = Date.now();
  const client = getPool();

  try {
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    logger.debug("Database query executed", {
      query: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    logger.error("Database query failed", {
      query: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
      duration: `${duration}ms`,
      error: error.message,
      code: error.code,
    });

    throw error;
  }
};

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection is successful
 */
const testConnection = async () => {
  try {
    const result = await query("SELECT NOW() as current_time");
    logger.info("Database connection test successful", {
      timestamp: result.rows[0].current_time,
    });
    return true;
  } catch (error) {
    logger.error("Database connection test failed", { error: error.message });
    return false;
  }
};

/**
 * Close database connection pool
 * @returns {Promise<void>}
 */
const closePool = async () => {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      logger.info("Database connection pool closed successfully");
    } catch (error) {
      logger.error("Error closing database connection pool", {
        error: error.message,
      });
      throw error;
    }
  }
};

/**
 * Get pool status information
 * @returns {Object} Pool status
 */
const getPoolStatus = () => {
  if (!pool) {
    return { status: "not_initialized" };
  }

  return {
    status: "active",
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
};

module.exports = {
  initializeDatabase,
  getPool,
  query,
  testConnection,
  closePool,
  getPoolStatus,
};
