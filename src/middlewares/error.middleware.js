function handleError(res, statusCode, message, code, details = null) {
  const errRes = {
    statusCode,
    error: message,
    code,
    timestamp: new Date().toISOString(),
  };
  if (details) errRes.details = details;
  res.status(statusCode).json(errRes);
}

function corsErrorHandler(err, req, res, next) {
  if (err.message === "Not allowed by CORS") {
    return handleError(res, 403, "CORS blocked this origin", "CORS_DENIED");
  }
  next(err);
}

function routeNotFoundHandler(req, res) {
  return handleError(res, 404, "Route not found", "ROUTE_NOT_FOUND");
}

function errorHandler(err, req, res, next) {
  console.error("Unhandled error:", err);
  return handleError(
    res,
    500,
    "Server error",
    "UNHANDLED_EXCEPTION",
    err.message,
  );
}

module.exports = {
  handleError,
  corsErrorHandler,
  routeNotFoundHandler,
  errorHandler,
};
