# 🚨 Weather API Monitoring and Logging System

## Overview

The Weather API now includes a comprehensive logging and monitoring system that provides:

- **Structured Logging**: JSON-formatted logs with correlation IDs for request tracing
- **Performance Monitoring**: Prometheus metrics for response times, error rates, and system health
- **Error Tracking**: Categorized error logging with automatic alerting for critical issues
- **Admin Dashboard**: Real-time monitoring dashboard with system metrics and log management
- **Health Monitoring**: System health checks with automatic alerts

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Request       │    │   Logging       │    │   Monitoring    │
│   Middleware    │───▶│   Middleware    │───▶│   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Correlation   │    │   Structured    │    │   Prometheus    │
│   ID Tracking   │    │   Logs          │    │   Metrics       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Error         │    │   Email         │    │   Admin         │
│   Tracking      │───▶│   Alerts        │    │   Dashboard     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📊 Features

### 1. Structured Logging
- **Winston-based logging** with multiple transport options
- **Daily log rotation** with configurable retention
- **Correlation IDs** for request tracing across the system
- **Multiple log levels**: error, warn, info, debug
- **JSON format** for easy parsing and analysis

### 2. Performance Monitoring
- **HTTP request metrics**: response time, status codes, throughput
- **System metrics**: memory usage, CPU load, uptime
- **External API metrics**: response times for weather data sources
- **Custom business metrics**: popular cities, cache performance
- **Prometheus-compatible metrics** for integration with monitoring tools

### 3. Error Tracking and Alerting
- **Categorized error tracking**: validation, network, parsing, etc.
- **Severity-based alerting**: low, medium, high, critical
- **Automatic email alerts** for high-severity errors
- **Error aggregation** and pattern detection
- **Context-rich error logging** with request details

### 4. Admin Dashboard
- **Real-time system health** monitoring
- **Interactive log viewer** with filtering
- **Performance metrics** and graphs
- **Configuration management**
- **Admin actions**: log management, alert testing

## 🚀 Getting Started

### Installation

1. **Install dependencies** (already added to package.json):
```bash
npm install
```

2. **Configure environment variables**:
```env
# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=./logs
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d

# Monitoring Configuration
ENABLE_METRICS=true
METRICS_PORT=9090
ADMIN_EMAIL=admin@example.com

# Admin Dashboard
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-password-here
```

3. **Start the server**:
```bash
npm start
```

### Accessing the Admin Dashboard

Visit `http://localhost:5000/admin/dashboard` to access the monitoring dashboard.

**Default credentials**:
- Username: `admin`
- Password: `admin123` (⚠️ Change this in production!)

## 📈 Metrics

### HTTP Metrics
- `weather_api_http_request_duration_seconds` - Request duration histogram
- `weather_api_http_requests_total` - Total HTTP requests counter
- `weather_api_active_connections` - Current active connections

### Weather API Metrics
- `weather_api_weather_requests_total` - Weather API requests by city and status
- `weather_api_external_api_duration_seconds` - External API call durations
- `weather_api_errors_total` - Error counts by type and route

### System Metrics
- `weather_api_memory_usage_bytes` - Memory usage by type
- `weather_api_cpu_usage_percent` - CPU usage percentage
- Node.js default metrics (garbage collection, event loop, etc.)

## 📝 Logging

### Log Levels
- **ERROR**: System errors, failed requests, critical issues
- **WARN**: Warnings, rate limiting, selector validation failures
- **INFO**: Normal operations, successful requests, system events
- **DEBUG**: Detailed debugging information, request/response details

### Log Structure
```json
{
  "timestamp": "2023-12-01T10:30:45.123Z",
  "level": "INFO",
  "message": "Weather request successful for london",
  "correlationId": "abc123-def456-ghi789",
  "service": "weather-api",
  "duration": 150,
  "city": "london",
  "statusCode": 200
}
```

### Log Files
- `logs/combined-YYYY-MM-DD.log` - All log levels
- `logs/app-YYYY-MM-DD.log` - Application logs (info and above)
- `logs/error-YYYY-MM-DD.log` - Error logs only
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Unhandled promise rejections

## 🚨 Alerting

### Email Alerts
Automatic email alerts are sent for:
- **Critical errors** (5xx status codes)
- **High error rates** (configurable threshold)
- **Selector validation failures**
- **System health issues**

### Alert Types
1. **Error Alerts**: Detailed error information with context
2. **Health Alerts**: System performance and resource usage
3. **Security Alerts**: Suspicious request patterns
4. **Selector Alerts**: Weather data scraping issues

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level (error, warn, info, debug) |
| `LOG_FILE_PATH` | `./logs` | Directory for log files |
| `ENABLE_METRICS` | `true` | Enable Prometheus metrics |
| `ADMIN_EMAIL` | - | Email for alerts |
| `ADMIN_USERNAME` | `admin` | Dashboard username |
| `ADMIN_PASSWORD` | `admin123` | Dashboard password |

### Monitoring Configuration
```javascript
const monitoringConfig = {
  // Error thresholds
  ALERT_THRESHOLD_ERROR_RATE: 10, // errors per minute
  ALERT_THRESHOLD_RESPONSE_TIME: 5000, // milliseconds
  
  // Health check settings
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  HEALTH_CHECK_MEMORY_THRESHOLD: 500, // MB
  HEALTH_CHECK_CPU_THRESHOLD: 80, // percentage
  
  // Performance monitoring
  PERFORMANCE_SAMPLING_RATE: 1.0, // 100% sampling
  SECURITY_ALERT_THRESHOLD: 5 // suspicious requests per minute
};
```

## 📱 Admin Dashboard Features

### Overview Cards
- **System Health**: Status, uptime, memory usage
- **Performance**: Response times, throughput metrics
- **Errors**: 24-hour error summary by category
- **Configuration**: Current system settings

### Detailed Tabs
1. **Logs**: Real-time log viewer with filtering
2. **Error Details**: Error analysis and categorization
3. **Raw Metrics**: Prometheus metrics in text format
4. **Actions**: Admin tools for system management

### Admin Actions
- **Log Management**: Clear logs, change log levels
- **Testing**: Send test alerts
- **Configuration**: Update system settings
- **Monitoring**: View real-time metrics

## 🔒 Security

### Dashboard Security
- Basic authentication (enhance for production)
- HTTPS recommended for production
- Rate limiting on admin endpoints
- Input validation and sanitization

### Security Logging
- Suspicious request pattern detection
- Failed authentication attempts
- Rate limiting violations
- CORS policy violations

## 🧪 Testing

Run the monitoring system tests:

```bash
# Run all tests
npm test

# Run monitoring-specific tests
npm test test/monitoring.test.js

# Test with coverage
npm test -- --coverage
```

### Test Coverage
- Logger utility functions
- Request/response middleware
- Monitoring service metrics
- Error handling and categorization
- Admin dashboard endpoints
- Security event logging

## 📊 Integration

### Prometheus Integration
The monitoring system exposes metrics at `/admin/metrics` in Prometheus format:

```bash
# Scrape metrics
curl http://localhost:5000/admin/metrics
```

### External Monitoring Tools
- **Grafana**: Create dashboards using Prometheus metrics
- **AlertManager**: Configure advanced alerting rules
- **ELK Stack**: Aggregate and analyze JSON logs
- **DataDog/New Relic**: Send metrics to cloud monitoring

## 🚀 Production Deployment

### Recommendations
1. **Change default passwords** for admin dashboard
2. **Configure HTTPS** for secure access
3. **Set up log aggregation** (ELK, Fluentd, etc.)
4. **Configure external monitoring** (Prometheus + Grafana)
5. **Set up proper alerting** (PagerDuty, Slack, etc.)
6. **Monitor disk space** for log files
7. **Regular log rotation** and cleanup

### Docker Deployment
The monitoring system works seamlessly with Docker:

```dockerfile
# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/admin/health || exit 1
```

## 📚 API Reference

### Admin Endpoints

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/admin/dashboard` | GET | Admin dashboard HTML |
| `/admin/health` | GET | System health status |
| `/admin/metrics` | GET | Prometheus metrics |
| `/admin/performance` | GET | Performance statistics |
| `/admin/logs` | GET | Recent log entries |
| `/admin/errors` | GET | Error summary |
| `/admin/config` | GET | System configuration |
| `/admin/config/log-level` | PUT | Update log level |
| `/admin/test-alert` | POST | Send test alert |

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T10:30:45.123Z",
  "uptime": 3600000,
  "memory": {
    "rss": 67108864,
    "heapTotal": 33554432,
    "heapUsed": 16777216,
    "external": 1048576
  },
  "system": {
    "loadAverage": [0.5, 0.3, 0.2],
    "totalMemory": 8589934592,
    "freeMemory": 4294967296,
    "cpuCount": 8
  }
}
```

## 🤝 Contributing

When adding new features:

1. **Add appropriate logging** with correlation IDs
2. **Include monitoring metrics** for performance tracking
3. **Add error handling** with proper categorization
4. **Update tests** for new monitoring functionality
5. **Document configuration** options

## 🎯 Roadmap

Future enhancements:
- [ ] Advanced analytics and reporting
- [ ] Machine learning for anomaly detection
- [ ] Distributed tracing integration
- [ ] Real-time alerting via webhooks
- [ ] Custom dashboard widgets
- [ ] Log analysis and insights
- [ ] Performance optimization recommendations

---

**🚀 The Weather API monitoring system is now production-ready with comprehensive observability features!**
