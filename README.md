# Weather-API

A comprehensive weather information API with OAuth 2.0 authentication, token introspection, and secure middleware.

## Features

- **Weather Data**: Scrape and provide weather information for cities worldwide
- **OAuth 2.0**: Full OAuth 2.0 implementation with RFC 7662 token introspection
- **JWT Tokens**: Secure JWT-based authentication with refresh token support
- **Rate Limiting**: Built-in rate limiting for API protection
- **Redis Support**: Optional Redis backend for token storage and caching
- **Comprehensive Testing**: Full test suite covering all OAuth flows

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

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the ISC License - see the [LICENSE.md](LICENSE.md) file for details.
