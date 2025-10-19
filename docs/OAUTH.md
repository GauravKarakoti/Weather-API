# OAuth 2.0 Implementation Guide

- [OAuth 2.0 Implementation Guide](#oauth-20-implementation-guide)
  * [Table of Contents](#table-of-contents)
  * [Quick Start](#quick-start)
    + [1. Environment Setup](#1-environment-setup)
    + [2. Install Dependencies](#2-install-dependencies)
    + [3. Start the Server](#3-start-the-server)
  * [Authentication Flows](#authentication-flows)
    + [Client Credentials Flow](#client-credentials-flow)
    + [Refresh Token Flow](#refresh-token-flow)
  * [API Endpoints](#api-endpoints)
    + [Token Introspection (RFC 7662)](#token-introspection--rfc-7662-)
    + [Token Endpoint](#token-endpoint)
    + [Token Revocation](#token-revocation)
    + [Demo Token Issuance](#demo-token-issuance)
    + [Token Info](#token-info)
  * [Token Management](#token-management)
    + [Access Tokens](#access-tokens)
    + [Refresh Tokens](#refresh-tokens)
    + [Storage Options](#storage-options)
  * [Security Features](#security-features)
    + [Token Rotation](#token-rotation)
    + [Rate Limiting](#rate-limiting)
    + [Client Authentication](#client-authentication)
    + [Scope Validation](#scope-validation)
    + [Token Limits](#token-limits)
  * [Error Handling](#error-handling)
    + [Standard OAuth 2.0 Errors](#standard-oauth-20-errors)
    + [Custom Errors](#custom-errors)
  * [Examples](#examples)
    + [Complete Authentication Flow](#complete-authentication-flow)
    + [Demo Token Flow (Development)](#demo-token-flow--development-)
    + [JavaScript Client Example](#javascript-client-example)
  * [Testing](#testing)
  * [Production Considerations](#production-considerations)
  * [Troubleshooting](#troubleshooting)
    + [Common Issues](#common-issues)
    + [Debug Mode](#debug-mode)

<small><i><a href='http://ecotrust-canada.github.io/markdown-toc/'>Table of contents generated with markdown-toc</a></i></small>

This Weather API implements OAuth 2.0 with Token Introspection (RFC 7662) for secure API access. The system supports JWT access tokens, opaque refresh tokens, and comprehensive token management.

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication Flows](#authentication-flows)
- [API Endpoints](#api-endpoints)
- [Token Management](#token-management)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Examples](#examples)

## Quick Start

### 1. Environment Setup

Add these variables to your `.env` file:

```bash
# OAuth 2.0 Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800
OAUTH_CLIENT_ID=weather-api-client
OAUTH_CLIENT_SECRET=your-oauth-client-secret-change-this
REDIS_URL=redis://localhost:6379
TOKEN_STORAGE=memory
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Server

```bash
npm start
```

## Authentication Flows

### Client Credentials Flow

Use this flow for server-to-server authentication:

```bash
curl -X POST http://localhost:3003/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "weather-api-client:your-oauth-client-secret" \
  -d "grant_type=client_credentials&scope=read"
```

### Refresh Token Flow

Use this flow to refresh expired access tokens:

```bash
curl -X POST http://localhost:3003/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "weather-api-client:your-oauth-client-secret" \
  -d "grant_type=refresh_token&refresh_token=YOUR_REFRESH_TOKEN"
```

## API Endpoints

### Token Introspection (RFC 7662)

**Endpoint:** `POST /oauth/introspect`

Validates and returns information about a token.

```bash
curl -X POST http://localhost:3003/oauth/introspect \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "weather-api-client:your-oauth-client-secret" \
  -d "token=YOUR_ACCESS_TOKEN"
```

**Response for valid token:**

```json
{
  "active": true,
  "scope": "read write",
  "client_id": "weather-api-client",
  "username": "user@example.com",
  "token_type": "access_token",
  "exp": 1700000000,
  "iat": 1699990000,
  "sub": "user-id-123",
  "aud": "weather-api",
  "iss": "weather-api-oauth",
  "jti": "token-id-456"
}
```

**Response for invalid/expired token:**

```json
{
  "active": false
}
```

### Token Endpoint

**Endpoint:** `POST /oauth/token`

Issues new tokens or refreshes existing ones.

**Supported Grant Types:**

- `client_credentials` - Server-to-server authentication
- `refresh_token` - Refresh expired access tokens

### Token Revocation

**Endpoint:** `POST /oauth/revoke`

Revokes access or refresh tokens.

```bash
curl -X POST http://localhost:3003/oauth/revoke \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "weather-api-client:your-oauth-client-secret" \
  -d "token=YOUR_TOKEN"
```

### Demo Token Issuance

**Endpoint:** `POST /oauth/demo/issue`

Issues demo tokens for testing (development only).

```bash
curl -X POST http://localhost:3003/oauth/demo/issue \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "weather-api-client:your-oauth-client-secret" \
  -d "username=testuser@example.com&scope=read write"
```

### Token Info

**Endpoint:** `GET /oauth/tokeninfo`

Returns information about the current token (requires authentication).

```bash
curl -X GET http://localhost:3003/oauth/tokeninfo \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Token Management

### Access Tokens

- **Format:** JWT (JSON Web Token)
- **Default Expiry:** 1 hour (3600 seconds)
- **Scopes:** `read`, `write`
- **Algorithm:** HS256

### Refresh Tokens

- **Format:** Opaque token (cryptographically secure random string)
- **Default Expiry:** 7 days (604800 seconds)
- **Rotation:** Enabled by default (old refresh tokens are invalidated)

### Storage Options

1. **Memory Storage** (default)
   - Fast, suitable for development
   - Tokens lost on server restart

2. **Redis Storage**
   - Persistent, suitable for production
   - Supports clustering and high availability

## Security Features

### Token Rotation

Refresh tokens are automatically rotated when used, preventing replay attacks.

### Rate Limiting

- OAuth endpoints: 100 requests per 15 minutes per IP
- Introspection endpoint: 60 requests per minute per IP

### Client Authentication

Supports both HTTP Basic Auth and form-based authentication:

```bash
# HTTP Basic Auth
curl -u "client_id:client_secret" ...

# Form-based
curl -d "client_id=...&client_secret=..." ...
```

### Scope Validation

Endpoints can require specific scopes:

```javascript
app.get("/protected", requireAuth(["read"]), (req, res) => {
  // Only accessible with 'read' scope
});
```

### Token Limits

- Maximum 5 active tokens per user
- Automatic cleanup of expired tokens

## Error Handling

### Standard OAuth 2.0 Errors

| Error Code               | Description                              |
| ------------------------ | ---------------------------------------- |
| `invalid_request`        | Missing or invalid request parameters    |
| `invalid_client`         | Client authentication failed             |
| `invalid_grant`          | Invalid or expired grant (refresh token) |
| `unsupported_grant_type` | Grant type not supported                 |
| `invalid_scope`          | Requested scope is invalid               |
| `invalid_token`          | Access token is invalid or expired       |
| `insufficient_scope`     | Token doesn't have required scope        |

### Custom Errors

| Error Code          | Description           |
| ------------------- | --------------------- |
| `server_error`      | Internal server error |
| `too_many_requests` | Rate limit exceeded   |

## Examples

### Complete Authentication Flow

1. **Get Access Token (Client Credentials)**

```bash
curl -X POST http://localhost:3003/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "weather-api-client:your-oauth-client-secret" \
  -d "grant_type=client_credentials&scope=read"
```

Response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "read"
}
```

2. **Access Protected Weather API**

```bash
curl -X GET http://localhost:3003/api/weather/london \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

3. **Introspect Token**

```bash
curl -X POST http://localhost:3003/oauth/introspect \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "weather-api-client:your-oauth-client-secret" \
  -d "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Demo Token Flow (Development)

1. **Issue Demo Tokens**

```bash
curl -X POST http://localhost:3003/oauth/demo/issue \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "weather-api-client:your-oauth-client-secret" \
  -d "username=demo@example.com&scope=read write"
```

2. **Use Refresh Token**

```bash
curl -X POST http://localhost:3003/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "weather-api-client:your-oauth-client-secret" \
  -d "grant_type=refresh_token&refresh_token=REFRESH_TOKEN_FROM_STEP_1"
```

### JavaScript Client Example

```javascript
class WeatherAPIClient {
  constructor(clientId, clientSecret, baseUrl = "http://localhost:3003") {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.refreshToken = null;
  }

  async authenticate() {
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
      },
      body: "grant_type=client_credentials&scope=read",
    });

    const tokens = await response.json();
    this.accessToken = tokens.access_token;
    return tokens;
  }

  async getWeather(city) {
    if (!this.accessToken) {
      await this.authenticate();
    }

    const response = await fetch(`${this.baseUrl}/api/weather/${city}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (response.status === 401) {
      // Token expired, re-authenticate
      await this.authenticate();
      return this.getWeather(city);
    }

    return response.json();
  }

  async introspectToken(token) {
    const response = await fetch(`${this.baseUrl}/oauth/introspect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
      },
      body: `token=${token}`,
    });

    return response.json();
  }
}

// Usage
const client = new WeatherAPIClient("weather-api-client", "your-client-secret");
const weather = await client.getWeather("london");
console.log(weather);
```

## Testing

Run the OAuth test suite:

```bash
npm test -- oauth.test.js
```

The tests cover:

- Token introspection for valid, invalid, and expired tokens
- Refresh token flow
- Client credentials flow
- Token revocation
- Middleware protection
- Security edge cases
- Rate limiting

## Production Considerations

1. **Use HTTPS:** All OAuth endpoints must use HTTPS in production
2. **Strong Secrets:** Use cryptographically strong JWT secrets and client secrets
3. **Redis Storage:** Use Redis for token storage in production environments
4. **Rate Limiting:** Configure appropriate rate limits for your use case
5. **Monitoring:** Monitor token usage and failed authentication attempts
6. **Token Rotation:** Enable refresh token rotation to prevent replay attacks
7. **Scope Management:** Implement fine-grained scopes for different API operations

## Troubleshooting

### Common Issues

1. **"invalid_client" Error**
   - Check client ID and secret in environment variables
   - Verify HTTP Basic Auth format: `Basic base64(client_id:client_secret)`

2. **"invalid_token" Error**
   - Token may be expired
   - Check JWT secret configuration
   - Verify token format and signature

3. **Redis Connection Issues**
   - Check Redis URL and credentials
   - System falls back to memory storage automatically

4. **Rate Limiting**
   - Reduce request frequency
   - Implement proper retry logic with exponential backoff

### Debug Mode

Enable debug logging by setting:

```bash
NODE_ENV=development
```

This will provide detailed error messages and token validation information.
