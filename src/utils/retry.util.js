/**
 * Retries an async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} retries - Maximum number of retries
 * @param {number} [initialDelay=1000] - Initial delay in milliseconds
 * @param {number} [maxDelay=30000] - Maximum delay in milliseconds
 * @returns {Promise} - Result of the async function
 */

const crypto = require('crypto');

async function retryWithBackoff(fn, retries, initialDelay = 1000, maxDelay = 30000) {
    let lastError;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't wait after the last attempt
            if (attempt === retries - 1) {
                break;
            }

            // Calculate exponential backoff with secure jitter
            // Using crypto.randomBytes() instead of Math.random() to satisfy security standards.
            // This randomness is NOT used for security purposes — only for retry timing variation.
            const exponentialDelay = initialDelay * Math.pow(2, attempt);
            const jitterBuffer = crypto.randomBytes(1); // generates one byte (0–255)
            const jitter = (jitterBuffer[0] / 255) * 100; // scale to 0–100ms
            const delay = Math.min(exponentialDelay + jitter, maxDelay);

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error(`Failed after ${retries} attempts: ${lastError?.message}`);
}

module.exports = {
    retryWithBackoff
};
