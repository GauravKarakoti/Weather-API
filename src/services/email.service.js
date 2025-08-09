/**
 * Enhanced Email Service for Alerts and Monitoring
 * 
 * Provides comprehensive email alerting functionality:
 * - Error alerts with severity-based formatting
 * - System health notifications
 * - Performance degradation alerts
 * - Selector validation failure alerts
 * 
 * Modular design with template-based email formatting.
 */

const nodemailer = require("nodemailer");
const { logError } = require("../utils/logger");

/**
 * Email transporter configuration
 * Supports Gmail SMTP with fallback configuration
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== 'false', // Default to secure
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 10, // 10 emails per second max
  });
};

const transporter = createTransporter();

/**
 * Check if email configuration is available
 * @returns {boolean} True if email can be sent
 */
const isEmailConfigured = () => {
  return !!(process.env.ADMIN_EMAIL && process.env.MAIL_USER && process.env.MAIL_PASS);
};

/**
 * Get severity-based email styling
 * @param {string} severity - Error severity level
 * @returns {Object} Color and icon for the severity
 */
const getSeverityStyle = (severity) => {
  const styles = {
    low: { color: '#28a745', icon: 'ℹ️', priority: 'Low' },
    medium: { color: '#ffc107', icon: '⚠️', priority: 'Medium' },
    high: { color: '#fd7e14', icon: '🚨', priority: 'High' },
    critical: { color: '#dc3545', icon: '🔥', priority: 'CRITICAL' }
  };
  return styles[severity] || styles.medium;
};

/**
 * Generate HTML template for error alerts
 * @param {Object} alertData - Alert data object
 * @returns {string} HTML email template
 */
const generateErrorAlertHTML = (alertData) => {
  const { severity, category, statusCode, code, message, correlationId, requestDetails } = alertData;
  const style = getSeverityStyle(severity);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Weather API Error Alert</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px; }
        .header { background: ${style.color}; color: white; padding: 15px; border-radius: 5px; text-align: center; }
        .content { background: white; padding: 20px; margin: 10px 0; border-radius: 5px; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        .priority { font-size: 18px; font-weight: bold; }
        .code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>${style.icon} Weather API Error Alert</h2>
          <div class="priority">Priority: ${style.priority}</div>
        </div>
        
        <div class="content">
          <h3>Error Details</h3>
          <p><strong>Timestamp:</strong> ${alertData.timestamp}</p>
          <p><strong>Status Code:</strong> ${statusCode}</p>
          <p><strong>Error Code:</strong> <span class="code">${code}</span></p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Message:</strong> ${message}</p>
          ${correlationId ? `<p><strong>Correlation ID:</strong> <span class="code">${correlationId}</span></p>` : ''}
        </div>
        
        ${requestDetails ? `
        <div class="details">
          <h4>Request Details</h4>
          <p><strong>Method:</strong> ${requestDetails.method}</p>
          <p><strong>URL:</strong> ${requestDetails.url}</p>
          <p><strong>IP Address:</strong> ${requestDetails.ip}</p>
          <p><strong>User Agent:</strong> ${requestDetails.userAgent}</p>
        </div>
        ` : ''}
        
        <div class="details">
          <h4>Recommended Actions</h4>
          <ul>
            ${severity === 'critical' ? '<li>Immediate investigation required</li>' : ''}
            <li>Check application logs for correlation ID: ${correlationId || 'N/A'}</li>
            <li>Monitor error frequency and patterns</li>
            ${category === 'external_api' ? '<li>Verify external API service status</li>' : ''}
            ${category === 'network' ? '<li>Check network connectivity and DNS resolution</li>' : ''}
            <li>Review monitoring dashboard for related metrics</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>This is an automated alert from Weather API Monitoring System</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send error alert email
 * @param {Object} alertData - Error alert data
 */
const sendErrorAlert = async (alertData) => {
  if (!isEmailConfigured()) {
    console.warn("Email configuration incomplete. Error alert not sent.");
    return;
  }

  if (process.env.NODE_ENV === 'test') {
    console.log("Skipping error alert in test environment");
    return;
  }

  const { severity, category, statusCode, code, message } = alertData;
  const style = getSeverityStyle(severity);

  const subject = `${style.icon} [${style.priority}] Weather API Error: ${code}`;
  const htmlContent = generateErrorAlertHTML(alertData);
  const textContent = `
Weather API Error Alert - ${style.priority} Priority

Error Details:
- Timestamp: ${alertData.timestamp}
- Status Code: ${statusCode}
- Error Code: ${code}
- Category: ${category}
- Message: ${message}
- Correlation ID: ${alertData.correlationId || 'N/A'}

${alertData.requestDetails ? `
Request Details:
- Method: ${alertData.requestDetails.method}
- URL: ${alertData.requestDetails.url}
- IP: ${alertData.requestDetails.ip}
- User Agent: ${alertData.requestDetails.userAgent}
` : ''}

This is an automated alert from Weather API Monitoring System.
  `;

  try {
    await transporter.sendMail({
      from: `"Weather API Alerts" <${process.env.MAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject,
      text: textContent,
      html: htmlContent,
      priority: severity === 'critical' ? 'high' : 'normal'
    });

    console.log(`Error alert sent successfully - ${code} (${severity})`);
  } catch (error) {
    console.error("Failed to send error alert email:", error.message);
    logError(error, {
      type: 'email-alert-failure',
      originalAlert: alertData
    });
  }
};

/**
 * Send selector validation failure alert (original functionality)
 * @param {Array|string} failedSelectors - Failed selectors
 */
const sendAdminAlert = async (failedSelectors) => {
  if (!isEmailConfigured()) {
    console.warn("Email configuration incomplete. Selector alert not sent.");
    return;
  }

  if (process.env.NODE_ENV === 'test') {
    console.log("Skipping selector alert in test environment");
    return;
  }

  // Handle both array and string inputs
  const selectorList = Array.isArray(failedSelectors)
    ? failedSelectors.join(", ")
    : failedSelectors;

  const subject = "🔧 Weather API Selector Validation Failure";
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Selector Validation Failure</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px; }
        .header { background: #ffc107; color: #212529; padding: 15px; border-radius: 5px; text-align: center; }
        .content { background: white; padding: 20px; margin: 10px 0; border-radius: 5px; }
        .code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🔧 Selector Validation Failure</h2>
        </div>
        <div class="content">
          <p><strong>Failed Selectors:</strong> <span class="code">${selectorList}</span></p>
          <p>The weather data scraping selectors have failed validation. This may indicate:</p>
          <ul>
            <li>Website structure changes</li>
            <li>CSS selector updates needed</li>
            <li>Network connectivity issues</li>
          </ul>
          <p><strong>Recommended Actions:</strong></p>
          <ul>
            <li>Check the target website for layout changes</li>
            <li>Update CSS selectors in environment variables</li>
            <li>Verify fallback selectors are working</li>
            <li>Test scraping functionality manually</li>
          </ul>
        </div>
        <div style="text-align: center; color: #666; font-size: 12px; margin-top: 20px;">
          <p>Weather API Monitoring System - ${new Date().toISOString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Weather API Selector Validation Failure

Failed Selectors: ${selectorList}

The weather data scraping selectors have failed validation.
Please check the target website and update selectors if necessary.

Recommended Actions:
- Check website for layout changes
- Update CSS selectors in environment variables
- Verify fallback selectors are working
- Test scraping functionality manually

Weather API Monitoring System
  `;

  try {
    await transporter.sendMail({
      from: `"Weather API Alerts" <${process.env.MAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject,
      text: textContent,
      html: htmlContent
    });
    console.log("Selector validation alert sent successfully");
  } catch (error) {
    console.error("Failed to send selector alert email:", error.message);
    logError(error, {
      type: 'selector-alert-failure',
      failedSelectors
    });
  }
};

/**
 * Send system health alert
 * @param {Object} healthData - System health metrics
 * @param {string} alertType - Type of health alert
 */
const sendHealthAlert = async (healthData, alertType = 'warning') => {
  if (!isEmailConfigured() || process.env.NODE_ENV === 'test') {
    return;
  }

  const subject = `🏥 Weather API Health Alert: ${alertType.toUpperCase()}`;
  const htmlContent = `
    <h2>🏥 System Health Alert</h2>
    <p><strong>Alert Type:</strong> ${alertType}</p>
    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    <h3>Health Metrics:</h3>
    <pre>${JSON.stringify(healthData, null, 2)}</pre>
  `;

  try {
    await transporter.sendMail({
      from: `"Weather API Health" <${process.env.MAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject,
      html: htmlContent
    });
  } catch (error) {
    console.error("Failed to send health alert:", error.message);
  }
};

module.exports = {
  sendAdminAlert,
  sendErrorAlert,
  sendHealthAlert,
  isEmailConfigured
};