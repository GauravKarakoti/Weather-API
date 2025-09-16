// Dashboard functionality
let dashboardData = {};

// Authentication helpers
function getAuthHeaders() {
    const auth = sessionStorage.getItem("adminAuth");
    if (!auth) {
        window.location.href = "/admin/login";
        return {};
    }
    return {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
    };
}

function logout() {
    if (confirm("Are you sure you want to logout?")) {
        sessionStorage.removeItem("adminAuth");
        window.location.href = "/admin/login";
    }
}

// Enhanced fetch with authentication
async function authenticatedFetch(url, options = {}) {
    const authHeaders = getAuthHeaders();
    const response = await fetch(url, {
        ...options,
        headers: {
            ...authHeaders,
            ...options.headers,
        },
    });

    if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem("adminAuth");
        if (window.location.pathname !== "/admin/login") {
            window.location.href = "/admin/login";
        }
        throw new Error("Authentication failed");
    }

    return response;
}

// Initialize dashboard
document.addEventListener("DOMContentLoaded", function () {
    // Check authentication first
    const auth = sessionStorage.getItem("adminAuth");
    if (!auth) {
        // stay on page; individual fetches will handle redirect to login
    }

    refreshDashboard();

    // Auto-refresh every 30 seconds
    setInterval(refreshDashboard, 30000);
});

// Refresh all dashboard data
async function refreshDashboard() {
    try {
        await Promise.all([
            loadHealth(),
            loadPerformance(),
            loadErrors(),
            loadConfig(),
            loadLogs(),
        ]);
    } catch (error) {
        console.error("Failed to refresh dashboard:", error);
    }
}

// Load system health
async function loadHealth() {
    try {
        const response = await authenticatedFetch("/admin/health");
        const health = await response.json();
        dashboardData.health = health;

        const container = document.getElementById("health-metrics");
        const statusClass =
            health.status === "healthy" ? "status-healthy" : "status-error";

        container.innerHTML = `
                    <div class="metric">
                        <span class="metric-label">
                            <span class="status-indicator ${statusClass}"></span>Status
                        </span>
                        <span class="metric-value">${health.status}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Uptime</span>
                        <span class="metric-value">${formatUptime(health.uptime)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Memory (RSS)</span>
                        <span class="metric-value">${formatBytes(health.memory.rss)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Heap Used</span>
                        <span class="metric-value">${formatBytes(health.memory.heapUsed)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Load Average</span>
                        <span class="metric-value">${health.system.loadAverage[0].toFixed(2)}</span>
                    </div>
                `;
    } catch (error) {
        console.error("Failed to load health data:", error);
        document.getElementById("health-metrics").innerHTML =
            '<div class="error-message">Failed to load health data</div>';
    }
}

// Load performance metrics
async function loadPerformance() {
    try {
        const response = await authenticatedFetch("/admin/performance");
        const performance = await response.json();
        dashboardData.performance = performance;

        const container = document.getElementById("performance-metrics");
        container.innerHTML = `
                    <div class="metric">
                        <span class="metric-label">Uptime</span>
                        <span class="metric-value">${formatUptime(performance.uptime)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Metrics Count</span>
                        <span class="metric-value">${performance.metricsCount}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Last Updated</span>
                        <span class="metric-value">${new Date(performance.timestamp).toLocaleTimeString()}</span>
                    </div>
                `;
    } catch (error) {
        console.error("Failed to load performance data:", error);
        document.getElementById("performance-metrics").innerHTML =
            '<div class="error-message">Failed to load performance data</div>';
    }
}

// Load error summary
async function loadErrors() {
    try {
        const response = await authenticatedFetch("/admin/errors?hours=24");
        const errorData = await response.json();
        dashboardData.errors = errorData;

        const container = document.getElementById("error-metrics");
        const summary = errorData.summary;

        let categoryHtml = "";
        for (const [category, count] of Object.entries(summary.byCategory)) {
            categoryHtml += `
                        <div class="metric">
                            <span class="metric-label">${category}</span>
                            <span class="metric-value">${count}</span>
                        </div>
                    `;
        }

        container.innerHTML = `
                    <div class="metric">
                        <span class="metric-label">Total Errors</span>
                        <span class="metric-value">${summary.total}</span>
                    </div>
                    ${categoryHtml}
                `;
    } catch (error) {
        console.error("Failed to load error data:", error);
        document.getElementById("error-metrics").innerHTML =
            '<div class="error-message">Failed to load error data</div>';
    }
}

// Load configuration
async function loadConfig() {
    try {
        const response = await authenticatedFetch("/admin/config");
        const config = await response.json();
        dashboardData.config = config;

        const container = document.getElementById("config-info");
        container.innerHTML = `
                    <div class="metric">
                        <span class="metric-label">Environment</span>
                        <span class="metric-value">${config.environment}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Log Level</span>
                        <span class="metric-value">${config.logLevel}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Node Version</span>
                        <span class="metric-value">${config.nodeVersion}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Email Alerts</span>
                        <span class="metric-value">${config.emailConfigured ? "Enabled" : "Disabled"}</span>
                    </div>
                `;
    } catch (error) {
        console.error("Failed to load configuration:", error);
        document.getElementById("config-info").innerHTML =
            '<div class="error-message">Failed to load configuration</div>';
    }
}

// Load logs
async function loadLogs() {
    try {
        const level = document.getElementById("log-level")?.value || "info";
        const response = await authenticatedFetch(
            `/admin/logs?level=${level}&limit=50`,
        );
        const logData = await response.json();

        const container = document.getElementById("logs-content");
        if (logData.logs.length === 0) {
            container.innerHTML = '<div class="loading">No logs found</div>';
            return;
        }

        const logsHtml = logData.logs
            .map((log) => {
                const levelClass = `log-${log.level.toLowerCase()}`;
                return `
                        <div class="${levelClass} log-entry">
                            <strong>${log.timestamp}</strong> [${log.level}] ${log.message}
                            ${log.correlationId ? `<br><small>ID: ${log.correlationId}</small>` : ""}
                        </div>
                    `;
            })
            .join("");

        container.innerHTML = logsHtml;
    } catch (error) {
        console.error("Failed to load logs:", error);
        document.getElementById("logs-content").innerHTML =
            '<div class="error-message">Failed to load logs</div>';
    }
}

// Load raw metrics
async function loadMetrics() {
    try {
        const response = await authenticatedFetch("/admin/metrics");
        const metrics = await response.text();
        document.getElementById("metrics-content").textContent = metrics;
    } catch (error) {
        console.error("Failed to load metrics:", error);
        document.getElementById("metrics-content").innerHTML =
            '<div class="error-message">Failed to load metrics</div>';
    }
}

// Tab functionality
function showTab(tabName) {
    // Hide all tab panes
    document.querySelectorAll(".tab-pane").forEach((pane) => {
        pane.classList.remove("active");
    });

    // Remove active class from all buttons
    document.querySelectorAll(".tab-button").forEach((button) => {
        button.classList.remove("active");
    });

    // Show selected tab and activate button
    document.getElementById(`${tabName}-tab`).classList.add("active");
    event.target.classList.add("active");

    // Load tab-specific data
    if (tabName === "metrics") {
        loadMetrics();
    } else if (tabName === "errors") {
        loadErrorDetails();
    }
}

// Load detailed error information
async function loadErrorDetails() {
    try {
        const container = document.getElementById("error-details");
        if (!dashboardData.errors) {
            container.innerHTML =
                '<div class="loading">Loading error details...</div>';
            await loadErrors();
        }

        const errors = dashboardData.errors;
        const recentErrors = errors.summary.recent
            .map(
                (error) => `
                    <div class="log-entry log-error">
                        <strong>${error.timestamp}</strong> [${error.severity?.toUpperCase()}] 
                        ${error.code}: ${error.message}
                        <br><small>Category: ${error.category} | ID: ${error.correlationId || "N/A"}</small>
                    </div>
                `,
            )
            .join("");

        container.innerHTML = `
                    <h5>Error Summary by Severity</h5>
                    ${Object.entries(errors.summary.bySeverity)
                .map(
                    ([severity, count]) =>
                        `<div class="metric"><span class="metric-label">${severity}</span><span class="metric-value">${count}</span></div>`,
                )
                .join("")}
                    
                    <h5 style="margin-top: 1rem;">Recent Errors</h5>
                    ${recentErrors || '<div class="loading">No recent errors</div>'}
                `;
    } catch (error) {
        console.error("Failed to load error details:", error);
        document.getElementById("error-details").innerHTML =
            '<div class="error-message">Failed to load error details</div>';
    }
}

// Admin actions
async function clearLogs(type) {
    if (!confirm(`Are you sure you want to clear ${type} logs?`)) return;

    try {
        const response = await fetch(`/admin/logs?type=${type}`, {
            method: "DELETE",
        });
        const result = await response.json();

        document.getElementById("action-results").innerHTML =
            `<div style="background: #d4edda; color: #155724; padding: 0.75rem; border-radius: 4px; margin-top: 1rem;">
                        ${result.message}
                    </div>`;

        // Refresh logs
        loadLogs();
    } catch (error) {
        document.getElementById("action-results").innerHTML =
            `<div class="error-message">Failed to clear logs: ${error.message}</div>`;
    }
}

async function updateLogLevel() {
    const newLevel = document.getElementById("new-log-level").value;

    try {
        const response = await fetch("/admin/config/log-level", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ level: newLevel }),
        });
        const result = await response.json();

        document.getElementById("action-results").innerHTML =
            `<div style="background: #d4edda; color: #155724; padding: 0.75rem; border-radius: 4px; margin-top: 1rem;">
                        ${result.message}
                    </div>`;

        // Refresh config
        loadConfig();
    } catch (error) {
        document.getElementById("action-results").innerHTML =
            `<div class="error-message">Failed to update log level: ${error.message}</div>`;
    }
}

async function sendTestAlert(type, severity) {
    try {
        const response = await fetch("/admin/test-alert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, severity }),
        });
        const result = await response.json();

        document.getElementById("action-results").innerHTML =
            `<div style="background: #d4edda; color: #155724; padding: 0.75rem; border-radius: 4px; margin-top: 1rem;">
                        ${result.message}
                    </div>`;
    } catch (error) {
        document.getElementById("action-results").innerHTML =
            `<div class="error-message">Failed to send test alert: ${error.message}</div>`;
    }
}

async function downloadMetrics() {
    try {
        const response = await fetch("/admin/metrics");
        const metrics = await response.text();

        const blob = new Blob([metrics], { type: "text/plain" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `weather-api-metrics-${new Date().toISOString().split("T")[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error("Failed to download metrics:", error);
        alert("Failed to download metrics: " + error.message);
    }
}

// Utility functions
function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}