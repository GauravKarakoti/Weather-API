const express = require("express");
const rateLimit = require("express-rate-limit");
const oauthController = require("../controllers/oauth.controller");
const {
  requireClientAuth,
  requireAuth,
} = require("../middlewares/oauth.middleware");

const router = express.Router();

// Rate limiting for OAuth endpoints
const oauthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "too_many_requests",
    error_description: "Too many OAuth requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const introspectRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 introspection requests per minute
  message: {
    error: "too_many_requests",
    error_description:
      "Too many introspection requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: true,
});

// Apply rate limiting to all OAuth routes
router.use(oauthRateLimit);

// Token introspection endpoint (RFC 7662)
// POST /oauth/introspect
router.post(
  "/introspect",
  introspectRateLimit,
  requireClientAuth,
  oauthController.introspect.bind(oauthController),
);

// Token endpoint for refresh and client credentials flows (RFC 6749)
// POST /oauth/token
router.post(
  "/token",
  requireClientAuth,
  oauthController.token.bind(oauthController),
);

// Token revocation endpoint (RFC 7009)
// POST /oauth/revoke
router.post(
  "/revoke",
  requireClientAuth,
  oauthController.revoke.bind(oauthController),
);

// Demo token issuance (for testing)
// POST /oauth/demo/issue
router.post(
  "/demo/issue",
  requireClientAuth,
  oauthController.issueDemo.bind(oauthController),
);

// Token info endpoint (protected)
// GET /oauth/tokeninfo
router.get(
  "/tokeninfo",
  requireAuth(["read"]),
  oauthController.tokenInfo.bind(oauthController),
);

// Health check for OAuth service
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "oauth",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

module.exports = router;
