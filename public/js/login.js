// Update current time
function updateTime() {
const now = new Date();
document.getElementById("current-time").textContent =
    now.toLocaleString();
}

updateTime();
setInterval(updateTime, 1000);

// Toggle password visibility
function togglePassword() {
const passwordInput = document.getElementById("password");
const toggleIcon = document.getElementById("toggle-icon");

if (passwordInput.type === "password") {
    passwordInput.type = "text";
    toggleIcon.className = "fas fa-eye-slash";
    document.querySelector(".show").title = "Hide";
} else {
    passwordInput.type = "password";
    toggleIcon.className = "fas fa-eye";
    document.querySelector(".show").title = "Show";
    // Log password visibility toggle for security monitoring
    console.warn("Password visibility toggled - security event logged");
}
}

// Show/hide messages
function showMessage(type, message) {
const errorDiv = document.getElementById("error-message");
const successDiv = document.getElementById("success-message");

// Hide all messages first
errorDiv.style.display = "none";
successDiv.style.display = "none";

if (type === "error") {
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
} else if (type === "success") {
    successDiv.textContent = message;
    successDiv.style.display = "block";
}

// Auto-hide after 5 seconds
setTimeout(() => {
    errorDiv.style.display = "none";
    successDiv.style.display = "none";
}, 5000);
}

// Set loading state
function setLoading(loading) {
const button = document.getElementById("login-button");
const spinner = document.getElementById("loading-spinner");
const buttonText = document.getElementById("button-text");

if (loading) {
    button.disabled = true;
    spinner.style.display = "block";
    buttonText.textContent = "Authenticating...";
} else {
    button.disabled = false;
    spinner.style.display = "none";
    buttonText.textContent = "🚀 Access Dashboard";
}
}

// Handle form submission
document
.getElementById("login-form")
.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    // Validate inputs
    if (!username || !password) {
    showMessage("error", "Please enter both username and password.");
    return;
    }

    setLoading(true);

    try {
    // Create basic auth header
    const credentials = btoa(`${username}:${password}`);

    // Test authentication by accessing a protected endpoint
    const response = await fetch("/admin/health", {
        method: "GET",
        headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
        },
    });

    if (response.ok) {
        // Store credentials for subsequent requests (in a real app, use proper session management)
        sessionStorage.setItem("adminAuth", credentials);

        showMessage(
        "success",
        "Login successful! Redirecting to dashboard...",
        );

        // Redirect to dashboard after a short delay
        setTimeout(() => {
        window.location.replace("/admin/dashboard");
        }, 1500);
    } else if (response.status === 401 || response.status === 403) {
        showMessage(
        "error",
        "Invalid username or password. Please try again.",
        );
    } else {
        showMessage("error", "Server error. Please try again later.");
    }
    } catch (error) {
    console.error("Login error:", error);
    showMessage(
        "error",
        "Connection error. Please check your network and try again.",
    );
    } finally {
    setLoading(false);
    }
});

// Check if already authenticated
window.addEventListener("load", function () {
// Check for error parameters in URL
const urlParams = new URLSearchParams(window.location.search);
const error = urlParams.get("error");

if (error === "invalid") {
    showMessage("error", "Invalid credentials. Please try again.");
    // Clear the URL parameter
    window.history.replaceState({}, document.title, "/admin/login");
}

const storedAuth = sessionStorage.getItem("adminAuth");
if (storedAuth) {
    // Test if the stored credentials are still valid
    fetch("/admin/health", {
    headers: {
        Authorization: `Basic ${storedAuth}`,
    },
    })
    .then((response) => {
        if (response.ok) {
        // Already authenticated, redirect to dashboard and replace history
        window.location.replace("/admin/dashboard");
        } else {
        // Credentials expired, clear them
        sessionStorage.removeItem("adminAuth");
        }
    })
    .catch(() => {
        // Error checking auth, stay on login page
        sessionStorage.removeItem("adminAuth");
    });
}
});

// Handle Enter key on form inputs
document
.getElementById("username")
.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
    document.getElementById("password").focus();
    }
});

document
.getElementById("password")
.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
    document
        .getElementById("login-form")
        .dispatchEvent(new Event("submit"));
    }
});

// Auto-focus username field
document.getElementById("username").focus();