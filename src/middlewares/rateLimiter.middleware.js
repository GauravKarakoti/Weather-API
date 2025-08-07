const rateLimit = require("express-rate-limit");
const { getClientIp } = require("../utils/ip");
const { handleError } = require("./error.middleware");

const createLimiter = (windowMs, max, messageKey) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.get("x-api-key") || getClientIp(req),
    handler: (req, res) =>
      handleError(res, 429, "Rate limit exceeded", messageKey, {
        retryAfter: Math.ceil(windowMs / 1000) + " seconds",
      }),
  });

const rateLimiters = {
  default: createLimiter(15 * 60 * 1000, 100, "TOO_MANY_REQUESTS"),
  weather: createLimiter(10 * 60 * 1000, 50, "RATE_LIMIT_EXCEEDED"),
};

const dynamicRateLimiter = (req, res, next) => {
  if (req.path.startsWith("/api/weather")) {
    return rateLimiters.weather(req, res, next);
  }
  return rateLimiters.default(req, res, next);
};

module.exports = { dynamicRateLimiter, rateLimiters };