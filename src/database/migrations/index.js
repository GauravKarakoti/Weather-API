/**
 * Database Migration Manager
 *
 * Handles running database migrations to set up tables and initial data
 */

const fs = require("fs");
const path = require("path");
const { query } = require("../../config/database");
const { logger } = require("../../utils/logger");

/**
 * Create migrations tracking table
 */
const createMigrationsTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await query(createTableQuery);
    logger.info("Migrations table created or already exists");
  } catch (error) {
    logger.error("Failed to create migrations table", { error: error.message });
    throw error;
  }
};

/**
 * Check if migration has been executed
 * @param {string} filename - Migration filename
 * @returns {Promise<boolean>} True if migration has been executed
 */
const isMigrationExecuted = async (filename) => {
  try {
    const result = await query(
      "SELECT id FROM migrations WHERE filename = $1",
      [filename],
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error("Failed to check migration status", {
      filename,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Mark migration as executed
 * @param {string} filename - Migration filename
 */
const markMigrationExecuted = async (filename) => {
  try {
    await query("INSERT INTO migrations (filename) VALUES ($1)", [filename]);
    logger.info("Migration marked as executed", { filename });
  } catch (error) {
    logger.error("Failed to mark migration as executed", {
      filename,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Execute a single migration file
 * @param {string} migrationPath - Path to migration file
 * @param {string} filename - Migration filename
 */
const executeMigration = async (migrationPath, filename) => {
  try {
    // Check if migration already executed
    if (await isMigrationExecuted(filename)) {
      logger.info("Migration already executed, skipping", { filename });
      return;
    }

    // Read and execute migration SQL
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    logger.info("Executing migration", { filename });
    await query(migrationSql);

    // Mark as executed
    await markMigrationExecuted(filename);

    logger.info("Migration executed successfully", { filename });
  } catch (error) {
    logger.error("Migration execution failed", {
      filename,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Run all pending migrations
 */
const runMigrations = async () => {
  try {
    logger.info("Starting database migrations");

    // Ensure migrations table exists
    await createMigrationsTable();

    // Get migration files
    const migrationsDir = __dirname;
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Execute in alphabetical order

    if (migrationFiles.length === 0) {
      logger.info("No migration files found");
      return;
    }

    logger.info(`Found ${migrationFiles.length} migration files`);

    // Execute each migration
    for (const filename of migrationFiles) {
      const migrationPath = path.join(migrationsDir, filename);
      await executeMigration(migrationPath, filename);
    }

    logger.info("All migrations completed successfully");
  } catch (error) {
    logger.error("Migration process failed", { error: error.message });
    throw error;
  }
};

/**
 * Get migration status
 * @returns {Promise<Object>} Migration status information
 */
const getMigrationStatus = async () => {
  try {
    // Get all migration files
    const migrationsDir = __dirname;
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    // Get executed migrations
    const result = await query(
      "SELECT filename, executed_at FROM migrations ORDER BY executed_at",
    );
    const executedMigrations = result.rows;

    // Build status
    const status = {
      total: migrationFiles.length,
      executed: executedMigrations.length,
      pending: migrationFiles.length - executedMigrations.length,
      migrations: migrationFiles.map((filename) => ({
        filename,
        executed: executedMigrations.some((m) => m.filename === filename),
        executedAt:
          executedMigrations.find((m) => m.filename === filename)
            ?.executed_at || null,
      })),
    };

    return status;
  } catch (error) {
    logger.error("Failed to get migration status", { error: error.message });
    throw error;
  }
};

module.exports = {
  runMigrations,
  getMigrationStatus,
  executeMigration,
  createMigrationsTable,
};
