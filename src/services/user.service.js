/**
 * User Service
 *
 * Handles all user-related database operations including authentication,
 * user management, and security features like account locking.
 */

const bcrypt = require("bcrypt");
const { query } = require("../config/database");
const { logger } = require("../utils/logger");

// Constants
const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    logger.debug("Password hashed successfully");
    return hash;
  } catch (error) {
    logger.error("Failed to hash password", { error: error.message });
    throw new Error("Password hashing failed");
  }
};

/**
 * Verify a password against its hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
const verifyPassword = async (password, hash) => {
  try {
    const isValid = await bcrypt.compare(password, hash);
    logger.debug("Password verification completed", { isValid });
    return isValid;
  } catch (error) {
    logger.error("Failed to verify password", { error: error.message });
    throw new Error("Password verification failed");
  }
};

/**
 * Get user by username
 * @param {string} username - Username to search for
 * @returns {Promise<Object|null>} User object or null if not found
 */
const getUserByUsername = async (username) => {
  try {
    const result = await query(
      "SELECT * FROM admin_users WHERE username = $1 AND is_active = true",
      [username],
    );

    if (result.rows.length === 0) {
      logger.debug("User not found", { username });
      return null;
    }

    const user = result.rows[0];
    logger.debug("User retrieved successfully", {
      username: user.username,
      id: user.id,
    });

    return user;
  } catch (error) {
    logger.error("Failed to get user by username", {
      username,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Authenticate user with username and password
 * @param {string} username - Username
 * @param {string} password - Plain text password
 * @returns {Promise<Object>} Authentication result
 */
const authenticateUser = async (username, password) => {
  try {
    logger.info("Authentication attempt", { username });

    // Get user from database
    const user = await getUserByUsername(username);

    if (!user) {
      logger.warn("Authentication failed: user not found", { username });
      return {
        success: false,
        message: "Invalid username or password",
        user: null,
      };
    }

    // Check if account is locked
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      logger.warn("Authentication failed: account locked", {
        username,
        lockedUntil: user.locked_until,
      });
      return {
        success: false,
        message:
          "Account is temporarily locked due to too many failed attempts",
        user: null,
      };
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      logger.warn("Authentication failed: invalid password", { username });

      // Increment failed attempts
      await incrementFailedAttempts(user.id);

      return {
        success: false,
        message: "Invalid username or password",
        user: null,
      };
    }

    // Authentication successful
    logger.info("Authentication successful", {
      username,
      userId: user.id,
    });

    // Reset failed attempts and update last login
    await resetFailedAttempts(user.id);
    await updateLastLogin(user.id);

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;

    return {
      success: true,
      message: "Authentication successful",
      user: userWithoutPassword,
    };
  } catch (error) {
    logger.error("Authentication error", {
      username,
      error: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      message: "Authentication service error",
      user: null,
    };
  }
};

/**
 * Increment failed login attempts and lock account if necessary
 * @param {number} userId - User ID
 */
const incrementFailedAttempts = async (userId) => {
  try {
    // Get current failed attempts
    const result = await query(
      "SELECT failed_login_attempts FROM admin_users WHERE id = $1",
      [userId],
    );

    const currentAttempts = result.rows[0]?.failed_login_attempts || 0;
    const newAttempts = currentAttempts + 1;

    let updateQuery = "UPDATE admin_users SET failed_login_attempts = $1";
    let params = [newAttempts, userId];

    // Lock account if max attempts reached
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date(
        Date.now() + LOCK_DURATION_MINUTES * 60 * 1000,
      );
      updateQuery += ", locked_until = $3";
      params = [newAttempts, userId, lockUntil];

      logger.warn("Account locked due to failed attempts", {
        userId,
        attempts: newAttempts,
        lockUntil,
      });
    }

    updateQuery += " WHERE id = $2";

    await query(updateQuery, params);

    logger.debug("Failed attempts incremented", {
      userId,
      attempts: newAttempts,
    });
  } catch (error) {
    logger.error("Failed to increment failed attempts", {
      userId,
      error: error.message,
    });
  }
};

/**
 * Reset failed login attempts and unlock account
 * @param {number} userId - User ID
 */
const resetFailedAttempts = async (userId) => {
  try {
    await query(
      "UPDATE admin_users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1",
      [userId],
    );

    logger.debug("Failed attempts reset", { userId });
  } catch (error) {
    logger.error("Failed to reset failed attempts", {
      userId,
      error: error.message,
    });
  }
};

/**
 * Update last login timestamp
 * @param {number} userId - User ID
 */
const updateLastLogin = async (userId) => {
  try {
    await query(
      "UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [userId],
    );

    logger.debug("Last login updated", { userId });
  } catch (error) {
    logger.error("Failed to update last login", {
      userId,
      error: error.message,
    });
  }
};

/**
 * Create a new admin user
 * @param {Object} userData - User data
 * @param {string} userData.username - Username
 * @param {string} userData.password - Plain text password
 * @param {string} userData.email - Email address
 * @param {string} userData.role - User role (default: 'admin')
 * @returns {Promise<Object>} Created user object
 */
const createUser = async ({ username, password, email, role = "admin" }) => {
  try {
    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert user
    const result = await query(
      `INSERT INTO admin_users (username, password_hash, email, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, email, role, created_at`,
      [username, passwordHash, email, role],
    );

    const user = result.rows[0];

    logger.info("User created successfully", {
      userId: user.id,
      username: user.username,
    });

    return user;
  } catch (error) {
    logger.error("Failed to create user", {
      username,
      error: error.message,
    });

    if (error.code === "23505") {
      // Unique violation
      throw new Error("Username already exists");
    }

    throw error;
  }
};

/**
 * Update user password
 * @param {number} userId - User ID
 * @param {string} newPassword - New plain text password
 * @returns {Promise<boolean>} True if successful
 */
const updatePassword = async (userId, newPassword) => {
  try {
    const passwordHash = await hashPassword(newPassword);

    await query(
      "UPDATE admin_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [passwordHash, userId],
    );

    logger.info("Password updated successfully", { userId });
    return true;
  } catch (error) {
    logger.error("Failed to update password", {
      userId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Get all users (without password hashes)
 * @returns {Promise<Array>} Array of user objects
 */
const getAllUsers = async () => {
  try {
    const result = await query(
      `SELECT id, username, email, role, is_active, last_login, 
              failed_login_attempts, locked_until, created_at, updated_at
       FROM admin_users 
       ORDER BY created_at DESC`,
    );

    logger.debug("Retrieved all users", { count: result.rows.length });
    return result.rows;
  } catch (error) {
    logger.error("Failed to get all users", { error: error.message });
    throw error;
  }
};

/**
 * Deactivate user account
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} True if successful
 */
const deactivateUser = async (userId) => {
  try {
    await query(
      "UPDATE admin_users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [userId],
    );

    logger.info("User deactivated", { userId });
    return true;
  } catch (error) {
    logger.error("Failed to deactivate user", {
      userId,
      error: error.message,
    });
    throw error;
  }
};

module.exports = {
  hashPassword,
  verifyPassword,
  getUserByUsername,
  authenticateUser,
  createUser,
  updatePassword,
  getAllUsers,
  deactivateUser,
  incrementFailedAttempts,
  resetFailedAttempts,
  updateLastLogin,
};
