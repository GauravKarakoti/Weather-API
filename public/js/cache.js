let refreshInterval;

// Initialize dashboard
document.addEventListener("DOMContentLoaded", function () {
    loadCacheData();
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(loadCacheData, 30000);
});

// Load all cache data
async function loadCacheData() {
    showLoading(true);

    try {
        await Promise.all([loadHealthStatus(), loadAnalytics()]);
        showAlert("Cache data loaded successfully", "success");
    } catch (error) {
        showAlert("Error loading cache data: " + error.message, "error");
    } finally {
        showLoading(false);
    }
}

// Load health status
async function loadHealthStatus() {
    try {
        const response = await fetch("/admin/cache/health");
        const data = await response.json();

        if (data.success) {
            updateHealthStatus(data.health);
        } else {
            throw new Error("Health check failed");
        }
    } catch (error) {
        console.error("Error loading health status:", error);
        updateHealthStatus(null);
    }
}

// Load analytics
async function loadAnalytics() {
    try {
        const response = await fetch("/admin/cache/analytics?days=7");
        const data = await response.json();

        if (data.success) {
            updateAnalytics(data.analytics, data.redis);
        } else {
            throw new Error("Analytics load failed");
        }
    } catch (error) {
        console.error("Error loading analytics:", error);
        document.getElementById("analytics-data").innerHTML =
            '<p style="color: #dc3545;">Error loading analytics data</p>';
    }
}

// Update health status display
function updateHealthStatus(health) {
    const redisStatus = document.getElementById("redis-status");
    const cacheKeysCount = document.getElementById("cache-keys-count");
    const weatherKeys = document.getElementById("weather-keys");
    const forecastKeys = document.getElementById("forecast-keys");
    const analyticsKeys = document.getElementById("analytics-keys");

    if (health && health.redis) {
        redisStatus.innerHTML =
            '<span class="status-indicator status-connected"></span>Connected';
        cacheKeysCount.textContent =
            health.cacheKeys.weather +
            health.cacheKeys.forecast +
            health.cacheKeys.analytics;
        weatherKeys.textContent = health.cacheKeys.weather;
        forecastKeys.textContent = health.cacheKeys.forecast;
        analyticsKeys.textContent = health.cacheKeys.analytics;
    } else {
        redisStatus.innerHTML =
            '<span class="status-indicator status-disconnected"></span>Disconnected';
        cacheKeysCount.textContent = "N/A";
        weatherKeys.textContent = "N/A";
        forecastKeys.textContent = "N/A";
        analyticsKeys.textContent = "N/A";
    }
}

// Update analytics display
function updateAnalytics(analytics, redis) {
    document.getElementById("hit-rate").textContent = redis.hitRate || "0%";
    document.getElementById("total-hits").textContent = redis.hits || 0;
    document.getElementById("total-misses").textContent = redis.misses || 0;
    document.getElementById("compression-saved").textContent =
        redis.compressionSavedKB ? redis.compressionSavedKB + " KB" : "0 KB";

    // Display daily analytics
    const analyticsContainer = document.getElementById("analytics-data");
    if (analytics.summary.totalHits + analytics.summary.totalMisses > 0) {
        analyticsContainer.innerHTML = `
            <div class="stat-grid">
                <div class="stat-item">
                    <span class="stat-value">${analytics.summary.hitRate}%</span>
                    <div class="stat-label">7-Day Hit Rate</div>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${analytics.summary.totalHits}</span>
                    <div class="stat-label">Total Hits</div>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${analytics.summary.totalMisses}</span>
                    <div class="stat-label">Total Misses</div>
                </div>
            </div>
        `;
    } else {
        analyticsContainer.innerHTML =
            "<p>No analytics data available yet. Start using the API to see metrics.</p>";
    }
}

// Cache management functions
async function warmCache() {
    showLoading(true);
    try {
        const response = await fetch("/admin/cache/warm", { method: "POST" });
        const data = await response.json();

        if (data.success) {
            showAlert(
                `Cache warming initiated for ${data.citiesToWarm.length} cities`,
                "success",
            );
            setTimeout(loadCacheData, 2000); // Refresh after 2 seconds
        } else {
            throw new Error(data.message || "Cache warming failed");
        }
    } catch (error) {
        showAlert("Error warming cache: " + error.message, "error");
    } finally {
        showLoading(false);
    }
}

async function invalidateCity() {
    const city = document.getElementById("city-input").value.trim();
    if (!city) {
        showAlert("Please enter a city name", "error");
        return;
    }

    try {
        const response = await fetch("/admin/cache/invalidate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ city }),
        });
        const data = await response.json();

        if (data.success) {
            showAlert(data.message, "success");
            document.getElementById("city-input").value = "";
            setTimeout(loadCacheData, 1000);
        } else {
            throw new Error(data.error || "Invalidation failed");
        }
    } catch (error) {
        showAlert("Error invalidating cache: " + error.message, "error");
    }
}

async function invalidatePattern() {
    const pattern = document.getElementById("pattern-input").value.trim();
    if (!pattern) {
        showAlert("Please enter a cache pattern", "error");
        return;
    }

    try {
        const response = await fetch("/admin/cache/invalidate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pattern }),
        });
        const data = await response.json();

        if (data.success) {
            showAlert(data.message, "success");
            document.getElementById("pattern-input").value = "";
            setTimeout(loadCacheData, 1000);
        } else {
            throw new Error(data.error || "Invalidation failed");
        }
    } catch (error) {
        showAlert("Error invalidating cache: " + error.message, "error");
    }
}

function refreshData() {
    loadCacheData();
}

// Utility functions
function showLoading(show) {
    document.getElementById("loading").style.display = show
        ? "block"
        : "none";
    document.getElementById("dashboard").style.display = show
        ? "none"
        : "grid";
}

function showAlert(message, type) {
    const alertsContainer = document.getElementById("alerts");
    const alertDiv = document.createElement("div");

    // Extract nested ternary into independent statement
    let alertType = "info";
    if (type === "success") {
        alertType = "success";
    } else if (type === "error") {
        alertType = "error";
    }

    alertDiv.className = `alert alert-${alertType}`;
    alertDiv.textContent = message;

    alertsContainer.appendChild(alertDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

// Cleanup on page unload
window.addEventListener("beforeunload", function () {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});