function applySecurityHeaders(app) {
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self';",
    );
    next();
  });
}

module.exports = { applySecurityHeaders };
