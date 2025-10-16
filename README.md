 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">
  <div align="center">
      
# Weather-API

- [Weather-API](#weather-api)
  * [✨ Features That Shine](#--features-that-shine)
  * [OAuth 2.0 Implementation](#oauth-20-implementation)
    + [Endpoints](#endpoints)
      - [1. Token Introspection (`POST /oauth/introspect`)](#1-token-introspection---post--oauth-introspect--)
      - [2. Token Refresh (`POST /oauth/token`)](#2-token-refresh---post--oauth-token--)
      - [3. Client Credentials (`POST /oauth/token`)](#3-client-credentials---post--oauth-token--)
      - [4. Token Revocation (`POST /oauth/revoke`)](#4-token-revocation---post--oauth-revoke--)
      - [5. Demo Token Issuance (`POST /oauth/demo/issue`)](#5-demo-token-issuance---post--oauth-demo-issue--)
    + [Authentication Methods](#authentication-methods)
      - [HTTP Basic Authentication](#http-basic-authentication)
      - [Bearer Token Authentication](#bearer-token-authentication)
      - [Form Data Authentication](#form-data-authentication)
    + [Protected Routes](#protected-routes)
    + [Middleware Usage](#middleware-usage)
      - [Basic Authentication](#basic-authentication)
      - [Optional Authentication](#optional-authentication)
      - [Enhanced Token Validation](#enhanced-token-validation)
    + [Configuration](#configuration)
    + [Security Features](#security-features)
  * [📬 Contact](#---contact)
  * [📜 Code of Conduct](#---code-of-conduct)
  * [📄 License](#---license)
  * [💡 Suggestions & Feedback](#---suggestions---feedback)
    + [Error Codes](#error-codes)
    + [Testing](#testing)
    + [Performance](#performance)
    + [Production Deployment](#production-deployment)
  * [API Endpoints](#api-endpoints)
    + [Weather Data](#weather-data)
    + [Configuration](#configuration-1)
  * [Contributing](#contributing)
  * [License](#license)

<small><i><a href='http://ecotrust-canada.github.io/markdown-toc/'>Table of contents generated with markdown-toc</a></i></small>

![GSSoC Logo](https://github.com/GauravKarakoti/Weather-API/blob/main/public/assets/gssoc%20logo.png)
</div>
<div style="margin: 15px 0;" align="center">
    <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&pause=1000&color=FF0000&width=435&lines=Welcome+to+Weather-API"/></a>" 
  </div>
  
 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">

<div align="center">
<img src="https://github.com/GauravKarakoti/Weather-API/blob/main/public/assets/gssoc%20logo.png" width="500" height="200">
</div>
<tr>
<td align="center">
<a href="https://s2apertre.resourcio.in"><img src="https://s2apertre.resourcio.in/Logo_primary.svg" height="140px" width="180px" alt="Apertre 2025"></a>
</td>
</tr>

<div align="Center">
A comprehensive weather information API with OAuth 2.0 authentication, token introspection, and secure middleware. This project dynamically fetches real-time weather data for any city, scrapes the necessary details, and presents them on an intuitive user interface. 🌍☀️🌧️


[![Open Source](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/GauravKarakoti/Weather-API)

[Report Bug](https://github.com/GauravKarakoti/Weather-API/issues) • [Request Feature](https://github.com/GauravKarakoti/Weather-API/issues)

</div>
<table align="center">
    <thead align="center">
        <tr border: 1px;>
            <td><b><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/tarikul-islam-anik/main/assets/images/Star.png" width="20" height="20"> Stars</b></td>
            <td><b>🍴 Forks</b></td>
            <td><b><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/tarikul-islam-anik/main/assets/images/Lady%20Beetle.png" width="20" height="20"> Issues</b></td>
            <td><b><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/tarikul-islam-anik/main/assets/images/Check%20Mark%20Button.png" width="20" height="20"> Open PRs</b></td>
            <td><b><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/tarikul-islam-anik/main/assets/images/Cross%20Mark.png" width="20" height="20"> Closed PRs</b></td>
        </tr>
     </thead>
    <tbody>
         <tr>
            <td><img alt="Stars" src="https://img.shields.io/github/stars/GauravKarakoti/Weather-API?style=flat&logo=github"/></td>
             <td><img alt="Forks" src="https://img.shields.io/github/forks/GauravKarakoti/Weather-API?style=flat&logo=github"/></td>
            <td><img alt="Issues" src="https://img.shields.io/github/issues/GauravKarakoti/Weather-API?style=flat&logo=github"/></td>
            <td><img alt="Open Pull Requests" src="https://img.shields.io/github/issues-pr/GauravKarakoti/Weather-API?style=flat&logo=github"/></td>
           <td><img alt="Closed Pull Requests" src="https://img.shields.io/github/issues-pr-closed/GauravKarakoti/Weather-API?style=flat&color=critical&logo=github"/></td>
        </tr>
    </tbody>
</table>

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">
 
## 🎯Vision
Provide a secure, self‑hostable weather backend that developers and teams can trust.

- OAuth 2.0 first — secure by design.
- Pluggable data sources and token stores (Redis / memory).
- Low-latency with caching and sensible defaults for production.

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">

## 🌟 Why Weather‑API
Why choose this project:

- Security: full OAuth flows, introspection, revocation.
- Control: self‑host to avoid vendor limits and protect data.
- Extensible: add scrapers or adapters without touching auth.
- Production-ready: caching, rate limiting, and audit logging.

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">

## 🔁 Project Flowchart
<img width="1942" height="1266" alt="Untitled diagram-2025-10-08-055250" src="https://github.com/user-attachments/assets/8a8b516d-28c6-4ff7-abe3-41c4222ddd55" />

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">

## ✨ Features That Shine

## OAuth 2.0 Implementation

This project implements a complete OAuth 2.0 system following RFC 6749, RFC 7662 (Token Introspection), and RFC 7009 (Token Revocation).

### Endpoints

#### 1. Token Introspection (`POST /oauth/introspect`)

RFC 7662 compliant token introspection endpoint that validates tokens and returns detailed information.

**Request:**

```bash
curl -X POST http://localhost:5000/oauth/introspect \
  -H "Authorization: Basic $(echo -n 'client-id:client-secret' | base64)" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "token=your-access-token"
```

**Response for Valid Token:**

```json
{
  "active": true,
  "scope": "read write",
  "client_id": "weather-api-client",
  "username": "user@example.com",
  "token_type": "access_token",
  "exp": 1700000000,
  "iat": 1699990000,
  "sub": "user-123",
  "aud": "weather-api",
  "iss": "weather-api-oauth",
  "jti": "token-uuid",
  "nbf": 1699990000,
  "user_id": "user-123",
  "token_use": "access",
  "auth_time": 1699990000,
  "permissions": ["read", "write"],
  "client_name": "Weather API Client",
  "issued_for": "weather-api"
}
```

**Response for Invalid/Expired Token:**

```json
{
  "active": false
}
```

#### 2. Token Refresh (`POST /oauth/token`)

Refresh expired access tokens using refresh tokens.

**Request:**

```bash
curl -X POST http://localhost:5000/oauth/token \
  -H "Authorization: Basic $(echo -n 'client-id:client-secret' | base64)" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=your-refresh-token"
```

**Response:**

```json
{
  "access_token": "new-access-token",
  "refresh_token": "new-refresh-token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "read write"
}
```

#### 3. Client Credentials (`POST /oauth/token`)

Get access tokens for service-to-service communication.

**Request:**

```bash
curl -X POST http://localhost:5000/oauth/token \
  -H "Authorization: Basic $(echo -n 'client-id:client-secret' | base64)" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&scope=read"
```

#### 4. Token Revocation (`POST /oauth/revoke`)
Revoke access or refresh tokens.

**Request:**

```bash
curl -X POST http://localhost:5000/oauth/revoke \
  -H "Authorization: Basic $(echo -n 'client-id:client-secret' | base64)" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "token=token-to-revoke"
```

#### 5. Demo Token Issuance (`POST /oauth/demo/issue`)
Issue demo tokens for testing purposes.

**Request:**

```bash
curl -X POST http://localhost:5000/oauth/demo/issue \
  -H "Authorization: Basic $(echo -n 'client-id:client-secret' | base64)" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser@example.com&scope=read write"
```

### Authentication Methods
#### HTTP Basic Authentication

```bash
curl -H "Authorization: Basic $(echo -n 'client-id:client-secret' | base64)" \
  http://localhost:5000/oauth/introspect
```

#### Bearer Token Authentication

```bash
curl -H "Authorization: Bearer your-client-secret" \
  -d "client_id=your-client-id" \
  http://localhost:5000/oauth/introspect
```

#### Form Data Authentication

```bash
curl -d "client_id=your-client-id&client_secret=your-client-secret" \
  http://localhost:5000/oauth/introspect
```

### Protected Routes

All weather API endpoints are protected by OAuth middleware. Include your access token in the Authorization header:

```bash
curl -H "Authorization: Bearer your-access-token" \
  http://localhost:5000/api/weather/london
```

### Middleware Usage
#### Basic Authentication

```javascript
const { requireAuth } = require("./src/middlewares/oauth.middleware");

// Require any valid token
app.get("/protected", requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

// Require specific scopes
app.get("/admin", requireAuth(["write"]), (req, res) => {
  res.json({ user: req.user });
});
```

#### Optional Authentication

```javascript
const { optionalAuth } = require("./src/middlewares/oauth.middleware");

app.get("/public", optionalAuth, (req, res) => {
  if (req.user) {
    res.json({ authenticated: true, user: req.user });
  } else {
    res.json({ authenticated: false });
  }
});
```

#### Enhanced Token Validation

```javascript
const { requireValidToken } = require("./src/middlewares/oauth.middleware");

// Uses token introspection for comprehensive validation
app.get("/secure", requireValidToken(["read", "write"]), (req, res) => {
  res.json({ user: req.user });
});
```

### Configuration
Set these environment variables for OAuth configuration:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800

# OAuth Client Configuration
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret

# Token Storage
TOKEN_STORAGE=redis  # or 'memory'
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# Security
NODE_ENV=production  # Enables HTTPS requirement
```

### Security Features
- **Token Rotation**: Refresh tokens are rotated on each use
- **Rate Limiting**: Built-in rate limiting for all OAuth endpoints
- **HTTPS Enforcement**: HTTPS required in production
- **Token Revocation**: Immediate token invalidation
- **Scope Validation**: Granular permission checking
- **Client Authentication**: Multiple authentication methods supported
- **Token Caching**: Redis-based caching for performance
- **Audit Logging**: Comprehensive request logging

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">

# Project Structure
  
  Weather-API/\
├── 📁 .github/                          #GitHub configuration\
│   ├── 📁 ISSUE_TEMPLATE/               # Issue templates\
│   │   ├── bug_report.md\
│   │   ├── documentation.md\
│   │   ├── feature_request.md\
│   │   └── performance.md\
│   ├── 📁 workflows/                    # GitHub Actions workflows\
│   │   ├── bundlewatch.yml\
│   │   ├── dependabot.yml\
│   │   ├── lint.yml\
│   │   ├── performance.yml\
│   │   ├── render-build.yml\
│   │   ├── security.yml\
│   │   ├── test.yml\
│   │   └── uptime.yml\
│   ├── dependabot.yml\
│   └── PULL_REQUEST_TEMPLATE.md\
├── 📁 docs/                             # Documentation\
│   ├── MONITORING.md
│   ├── MOST_IMPORTANT_FOR_DEVELOPERS.md\
│   ├── OAUTH.md\
│   └── REDIS_CACHE.md\
├── 📁 public/                           # Frontend assets\
│   ├── 📁 admin/                        # Admin panel\
│   │   ├── cache.html\
│   │   ├── dashboard.html\
│   │   └── login.html\
│   ├── 📁 assets/                       # Static assets\
│   │   ├── gssoc_logo.png\
│   │   └── WeatherBackground.jpg\
│   ├── 📁 css/                          # Stylesheets\
│   │   ├── cache.css\
│   │   ├── dashboard.css\
│   │   └── login.css\
│   ├── 📁 Favicon/                      # Favicon files\
│   │   └── Favicon.PNG\
│   ├── 📁 js/                           # JavaScript files\
│   │   ├── cache.js\
│   │   ├── dashboard.js\
│   │   └── login.js\
│   ├── fallback.png\
│   ├── index.html\
│   ├── script.js\
│   ├── style.css\
│   ├── sw.js\
│   ├── theme-manager.js\
│   └── themes.css\
├── 📁 scripts/                          # Utility scripts\
│   ├── test-oauth.js\
│   └── test-redis.js\
├── 📁 src/                              # Source code\
│   ├── 📁 config/                       # Configuration files\
│   │   ├── cors.js\
│   │   ├── database.js\
│   │   ├── env.js\
│   │   ├── monitoring.config.js\
│   │   └── oauth.js\
│   ├── 📁 constants/                    # Application constants\
│   │   └── selectors.js\
│   ├── 📁 controllers/                  # Route controllers\
│   │   ├── oauth.controller.js\
│   │   └── weather.controller.js\
│   ├── 📁 database/                     # Database configuration\
│   │   ├── 📁 migrations/               # Database migrations\
│   │   │   ├── 001_initial_schema.js\
│   │   │   └── 002_add_oauth_tables.js\
│   │   └── init.js\
│   ├── 📁 middlewares/                  # Express middlewares\
│   │   ├── cache.middleware.js\
│   │   ├── error.middleware.js\
│   │   ├── headers.middleware.js\
│   │   ├── logging.middleware.js\
│   │   ├── oauth.middleware.js\
│   │   └── rateLimiter.middleware.js\
│   ├── 📁 routes/                       # API routes\
│   │   ├── admin.routes.js\
│   │   ├── configRoutes.js\
│   │   ├── oauth.routes.js\
│   │   └── weather.routes.js\
│   ├── 📁 services/                     # Business logic\
│   │   ├── cache.service.js\
│   │   ├── cacheWarming.service.js\
│   │   ├── email.service.js\
│   │   ├── monitoring.service.js\
│   │   ├── oauth.service.js\
│   │   ├── redis.service.js\
│   │   ├── selectorValidation.service.js\
│   │   ├── tokenStorage.service.js\
│   │   ├── user.service.js\
│   │   └── weather.service.js\
│   └── 📁 utils/                        # Utility functions\
│       ├── ip.js\
│       ├── logger.js\
│       ├── parser.js\
│       └── sanitize.js\
├── 📁 test/                             # Test files\
│   ├── monitoring.test.js\
│   ├── oauth.test.js\
│   ├── server.test.js\
│   └── weather.test.js\
├── .env.example                         # Environment variables template\
├── .gitignore                          # Git ignore rules\
├── .lighthouserc.js                    # Lighthouse configuration\
├── babel.config.js                     # Babel configuration\
├── Code of Conduct.md                  # Community guidelines\
├── Contributing.md                     # Contribution guidelines\
├── docker-compose.yaml                 # Docker compose configuration\
├── Dockerfile                          # Docker configuration\
├── eslint.config.js                    # ESLint configuration\
├── jest.config.js                      # Jest configuration\
├── jest.setup.js                       # Jest setup file\
├── LICENSE.md                          # License information\
├── MONITORING.md                       # Monitoring documentation\
├── package-lock.json                   # NPM lock file\
├── package.json                        # NPM package configuration\
├── README.md                           # Project documentation\
├── Security.md                         # Security policy\
├── server.js                           # Main server file\
└── THEME_IMPLEMENTATION.md             # Theme implementation guide\

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">

## 📬 Contact

Have ideas, feedback, or just want to say hi?
- 🛠️ Open an issue in the repository

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">
 
## 📜 Code of Conduct

To ensure a welcoming and inclusive environment, we have a Code of Conduct that all contributors are expected to follow. In short: **Be respectful, be kind, and be collaborative.** Please read the full [Code of Conduct](https://github.com/GauravKarakoti/Weather-API/blob/main/Code%20of%20Conduct.md) before participating.

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">
 
## 📄 License

This project is licensed under the [MIT License](https://github.com/GauravKarakoti/Weather-API/blob/main/LICENSE.md).

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">
 
## 💡 Suggestions & Feedback
Feel free to open issues or discussions if you have any feedback, feature suggestions, or want to collaborate!

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">

### Error Codes

| Error Code               | HTTP Status | Description                 |
| ------------------------ | ----------- | --------------------------- |
| `invalid_request`        | 400         | Missing required parameters |
| `invalid_client`         | 401         | Invalid client credentials  |
| `invalid_grant`          | 400         | Invalid refresh token       |
| `invalid_token`          | 401         | Invalid or expired token    |
| `insufficient_scope`     | 403         | Token lacks required scopes |
| `unsupported_grant_type` | 400         | Unsupported grant type      |
| `server_error`           | 500         | Internal server error       |

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">

## 🛠️ Troubleshooting (quickfix)
- Missing env vars → add .env or set required keys (JWT_SECRET, OAUTH_CLIENT_ID/SECRET).
- Server won’t start → check PORT, kill conflicting process, or change port.
- Redis errors → verify REDIS_URL/credentials or set TOKEN_STORAGE=memory for dev.
- Introspection shows inactive → confirm token, client auth method, and clock sync.
- Refresh token failing → ensure you use the latest rotated refresh token.
- CORS or frontend blocks → update allowed origins in src/config/cors.js.
- Tests failing → run with TOKEN_STORAGE=memory, npm install, then npm test.

### Testing

Run the comprehensive test suite:

```bash
npm test
```

The test suite covers:

- Token introspection for valid, expired, and invalid tokens
- Refresh token flow
- Client credentials flow
- Token revocation
- Middleware behavior
- Security edge cases
- Rate limiting

### Performance

- **Caching**: Introspection results are cached for 5 minutes
- **Redis**: Optional Redis backend for high-performance token storage
- **Memory Fallback**: Automatic fallback to memory storage if Redis unavailable
- **Rate Limiting**: Configurable rate limits to prevent abuse

### Production Deployment

1. Set `NODE_ENV=production` to enable HTTPS enforcement
2. Use strong JWT secrets (256+ bits)
3. Configure Redis for token storage
4. Set up proper CORS configuration
5. Monitor rate limiting and token usage
6. Regular security audits and token cleanup

## API Endpoints

### Weather Data

- `GET /api/weather/:city` - Get current weather for a city
- `GET /api/weather-forecast/:city` - Get weather forecast for a city

### Configuration

- `GET /config` - Get API configuration
- `GET /api/version` - Get API version

All endpoints require OAuth authentication with appropriate scopes.

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">

## 🤝 Contributing

- Fork → branch (e.g., feat/…, fix/…, docs/…).
- Code + tests + docs: run npm install, npm test, and lint before committing.
- Commit style: Conventional Commits (feat:, fix:, docs:, test:).
- Open a focused PR with: description, testing steps, and checklist: tests, docs, lint.
- Never commit secrets; use .env.example for config samples.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">

## License

This project is licensed under the ISC License - see the [LICENSE.md](LICENSE.md) file for details.

<h2>Project Admin:</h2>
<table>
<tr>
<td align="center">
<a href="https://github.com/GauravKarakoti"><img src="https://avatars.githubusercontent.com/u/180496085?v=4" height="140px" width="140px" alt="Gaurav Karakoti "></a><br><sub><b>Gaurav Karakoti </b><br><a href="https://www.linkedin.com/in/gaurav-karakoti-248960302/"><img src="https://github-production-user-asset-6210df.s3.amazonaws.com/73993775/278833250-adb040ea-e3ef-446e-bcd4-3e8d7d4c0176.png" width="45px" height="45px"></a></sub>
</td>
</tr>
</table>

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">
 
<div align="center">
  <h2 style="font-size:3rem;">Our Contributors <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Red%20Heart.png" alt="Red Heart" width="40" height="40" /></h2>
 
  We love our contributors! If you'd like to help, please check out our [CONTRIBUTE.md](https://github.com/GauravKarakoti/Weather-API/blob/main/Contributing.md) file for guidelines.
  
  <h3>Thanks to these amazing people who have contributed to the **Weather-API** project:</h3>
<p align="center">
    <img src="https://api.vaunt.dev/v1/github/entities/GauravKarakoti/repositories/Weather-API/contributors?format=svg&limit=54" width="1000" />
</p>
<p style="font-family:var(--ff-philosopher);font-size:3rem;"><b> Show some <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Red%20Heart.png" alt="Red Heart" width="40" height="40" /> by starring this awesome repository!
</p>
 </div>

 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">
 
🚀 **Stay Ahead of the Weather – One City at a Time!** 🌍☀️🌧️


 <img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%">
 
 **👨‍💻 Developed By**  **❤️GauravKarakoti❤️** 
[GitHub](https://github.com/GauravKarakoti) | [LinkedIn](https://www.linkedin.com/in/gaurav-karakoti/)

[🔝 Back to Top](#top)
