/**
 * Retries an async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} retries - Maximum number of retries
 * @param {number} [initialDelay=1000] - Initial delay in milliseconds
 * @param {number} [maxDelay=30000] - Maximum delay in milliseconds
 * @returns {Promise} - Result of the async function
 */
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
            
            // Calculate exponential backoff with jitter
            // Math.random() is safe here - used for timing jitter, not security
            const exponentialDelay = initialDelay * Math.pow(2, attempt);
            const jitter = Math.random() * 100;
            const delay = Math.min(exponentialDelay + jitter, maxDelay);
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw new Error(`Failed after ${retries} attempts: ${lastError?.message}`);
}

module.exports = {
    retryWithBackoff
};
