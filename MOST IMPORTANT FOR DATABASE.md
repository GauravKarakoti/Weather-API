# Weather API Database Setup Guide

This guide will help you set up PostgreSQL database integration using Neon for the Weather API.

## Prerequisites

1. **Neon Database Account**: Sign up at [Neon](https://neon.tech) and create a new database
2. **Node.js**: Version 16 or higher
3. **npm**: Comes with Node.js

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

This will install the new PostgreSQL dependencies:
- `pg` - PostgreSQL client for Node.js
- `bcrypt` - Password hashing library

### 2. Configure Database Connection

Create a `.env` file in the project root (if it doesn't exist) and add your DATABASE_URL:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@hostname:port/database?sslmode=require

# Example for Neon:
# DATABASE_URL=postgresql://username:password@ep-cool-lab-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### 3. Initialize Database

The database will be automatically initialized when you start the server:

```bash
npm start
```

Or run database setup manually:

```bash
# Run migrations
npm run db:migrate

# Check migration status
npm run db:status
```

### 4. Access Admin Dashboard

Once the server is running, you can access the admin dashboard:

- **URL**: http://localhost:5000/admin/login
- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Security Note**: Change the default password in production!

## Database Schema

### Admin Users Table

The `admin_users` table stores admin credentials with the following structure:

```sql
CREATE TABLE admin_users (
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
```

## Features

### 🔐 **Enhanced Security**
- Bcrypt password hashing with salt rounds 12
- Account locking after 5 failed attempts (30-minute lockout)
- Secure session handling
- Database-stored credentials

### 📊 **Admin Management**
- Create new admin users
- Update passwords
- Deactivate accounts
- View user activity logs

### 🔍 **Database Monitoring**
- Connection pool status
- Migration status tracking
- Database health checks
- Performance metrics

## API Endpoints

### Authentication
All admin routes now use database authentication via Basic Auth headers.

### New Database Management Endpoints

```bash
# Get database status
GET /admin/database/status

# Run migrations
POST /admin/database/migrate

# Get migration status
GET /admin/database/migrations

# User management
GET /admin/users                    # List all users
POST /admin/users                   # Create new user
PUT /admin/users/:id/password       # Update password
DELETE /admin/users/:id             # Deactivate user
```

## Environment Variables

Add these to your `.env` file:

```bash
# Required
DATABASE_URL=your_neon_database_url

# Optional (existing variables)
NODE_ENV=development
PORT=5000
LOG_LEVEL=info
ADMIN_EMAIL=admin@yourcompany.com
```

## Development Commands

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run database migrations
npm run db:migrate

# Check migration status
npm run db:status

# Reset database (development only)
npm run db:reset

# Lint code
npm run lint
npm run lint:fix
```

## Production Deployment

### 1. Environment Setup
- Set `NODE_ENV=production`
- Use a strong `DATABASE_URL` connection string
- Change default admin password immediately

### 2. Security Checklist
- [ ] Update default admin password
- [ ] Use environment-specific database
- [ ] Enable SSL/TLS for database connections
- [ ] Configure proper logging levels
- [ ] Set up monitoring alerts

### 3. Database Backup
Ensure your Neon database has automated backups enabled.

## Troubleshooting

### Connection Issues

**Error**: `DATABASE_URL environment variable is not set`
- **Solution**: Add DATABASE_URL to your `.env` file

**Error**: `Database connection test failed`
- **Solution**: Verify your DATABASE_URL format and credentials
- Check if your Neon database is active

**Error**: `SSL connection required`
- **Solution**: Ensure `?sslmode=require` is in your DATABASE_URL

### Migration Issues

**Error**: `relation "admin_users" does not exist`
- **Solution**: Run `npm run db:migrate` to create tables

**Error**: `Migration already executed`
- **Solution**: This is normal - migrations run only once

### Authentication Issues

**Error**: `Authentication service unavailable`
- **Solution**: Check database connection and ensure migrations have run

## Support

For issues related to:
- **Database setup**: Check Neon documentation
- **Application issues**: Check server logs
- **Authentication**: Verify database connection and user creation

## Migration from Environment Variables

If you were previously using environment variables for admin credentials:

1. The old `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables are no longer used
2. Admin credentials are now stored securely in the database
3. Default admin user (admin/admin123) is created automatically
4. You can create additional admin users via the admin dashboard

## What's New

✅ **PostgreSQL Integration**: Secure database storage using Neon  
✅ **Enhanced Authentication**: Database-backed admin login  
✅ **User Management**: Create and manage multiple admin users  
✅ **Security Features**: Account locking, failed attempt tracking  
✅ **Database Monitoring**: Health checks and performance metrics  
✅ **Migration System**: Automated database schema management  
✅ **Graceful Shutdown**: Proper database connection cleanup  

The Weather API now supports robust user management while maintaining all existing weather functionality!
