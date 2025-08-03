const express = require("express");
const cors = require("cors");
const path = require("path");

const { configureEnv } = require("./src/config/env");
const { corsOptions } = require("./src/config/cors");
const {
  errorHandler,
  routeNotFoundHandler,
  corsErrorHandler,
} = require("./src/middleware/error.middleware");
const { applySecurityHeaders } = require("./src/middleware/headers.middleware");
const {
  dynamicRateLimiter,
} = require("./src/middleware/rateLimiter.middleware");

const weatherRoutes = require("./src/routes/weather.routes");
const {
  validateSelectors,
  scheduleSelectorValidation,
  stopValidationJob,
} = require("./src/services/selectorValidation.service");

const app = express();
configureEnv(); // Load env or fallback

app.use(cors(corsOptions));
app.use(express.static("public"));
app.use(express.json());
app.set("trust proxy", true);

applySecurityHeaders(app);
app.use(dynamicRateLimiter);

// Routes
app.use("/api/weather", weatherRoutes);

app.get("/config", (req, res) => {
  res.json({
    RECENT_SEARCH_LIMIT: process.env.RECENT_SEARCH_LIMIT || 5,
    API_URL: process.env.API_URL,
  });
});

app.get("/api/version", (req, res) => {
  res.json({ version: "1.0.0", lastUpdated: "2023-10-01" });
});

// Error Handling
app.use(corsErrorHandler);
app.use(routeNotFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log("Server started successfully");
  await validateSelectors();
  scheduleSelectorValidation();
});

module.exports = { app, server, stopValidationJob };
