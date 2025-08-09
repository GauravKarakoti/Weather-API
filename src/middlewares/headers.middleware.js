function applySecurityHeaders(app) {
  app.use((req, res, next) => {
    // Allow inline styles for admin pages since they have embedded CSS
    const isAdminRoute = req.path && req.path.startsWith('/admin');
    const cspPolicy = isAdminRoute
      ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
      : "default-src 'self'; script-src 'self'; style-src 'self';";

    res.setHeader("Content-Security-Policy", cspPolicy);
    next();
  });
}

module.exports = { applySecurityHeaders };
