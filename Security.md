Security Policy
Supported Versions
The following versions of Weather-API are currently supported with security updates:

Version Supported
1.x.x ✅ Supported
0.x.x ❌ Not supported
Reporting a Vulnerability
If you discover a security vulnerability in Weather-API, we encourage you to report it as soon as possible. We will investigate all legitimate reports and do our best to quickly fix the issue.

How to Report
Please report vulnerabilities through one of the following secure channels:

- Create a private security advisory on GitHub
- Use GitHub's private vulnerability reporting feature
- Contact the maintainers through GitHub issues (for non-sensitive matters only)

Include as much detail as possible to help us identify and fix the issue swiftly.
Do not share the vulnerability publicly until it has been addressed and a patch is available.

Security Updates
We will notify users via GitHub releases for any critical security updates.
Minor security patches will be included in regular updates as needed.

## 🔧 Recent Security Improvements

### Fixed Vulnerabilities (Latest Update)

- **Hardcoded Password Removal**: Removed hardcoded `admin123` password from all source files
- **Login Form Security**: Removed password autofill and plain-text password display
- **Environment-Based Authentication**: Admin credentials now configured via environment variables
- **Secure Password Generation**: Auto-generates secure passwords when environment variables not set
- **Password Visibility Logging**: Added security logging for password visibility toggles

### Admin Setup (REQUIRED)

1. Copy `.env.example` to `.env`
2. Set secure admin credentials:
   ```env
   ADMIN_USERNAME=your-admin-username
   ADMIN_PASSWORD=your-secure-password-here
   ADMIN_EMAIL=admin@yourdomain.com
   ```
3. Use a strong password with:
   - At least 12 characters
   - Mix of uppercase, lowercase, numbers, and symbols
   - No dictionary words or personal information

### Security Warnings

⚠️ **If you don't set `ADMIN_PASSWORD`**: The system will generate a temporary password and log it to the console. This is for development only - always set a secure password in production.

## Security Best Practices

Make sure to use the latest version of Weather-API for the latest security features and patches.
Follow password best practices, such as using strong, unique passwords for each account.
Regularly update your dependencies to the latest versions.
Never commit `.env` files containing real credentials to version control.

Acknowledgements
We appreciate contributions from the community and researchers who help us improve the security of Weather-API. Thank you for keeping the platform secure for everyone!
