-- Migration: Create admin_users table
-- Description: Creates table to store admin user credentials for authentication
-- Created: Weather API Database Setup
-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(20) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
-- Create index on is_active for filtering active users
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);
-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ language 'plpgsql';
-- Create trigger to automatically update updated_at
CREATE TRIGGER update_admin_users_updated_at BEFORE
UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Note: Default admin user will be created by the application
-- during initialization to ensure proper password hashing
-- Add comment to table
COMMENT ON TABLE admin_users IS 'Table to store admin user credentials and authentication data';
COMMENT ON COLUMN admin_users.username IS 'Unique username for admin login';
COMMENT ON COLUMN admin_users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN admin_users.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN admin_users.locked_until IS 'Timestamp until which account is locked (null if not locked)';