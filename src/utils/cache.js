const client = require("./redisClient");

const DEFAULT_EXPIRATION = 3600; // 1 hour

/**
 * Checks cache for a key. If missing, calls fetchFunction and caches the result.
 * @param {string} key - Redis key
 * @param {Function} fetchFunction - async function to fetch fresh data
 * @param {number} expiration - TTL in seconds
 */
async function getOrSetCache(key, fetchFunction, expiration = DEFAULT_EXPIRATION) {
    try {
        const cachedData = await client.get(key);
        if (cachedData) return JSON.parse(cachedData);

        const freshData = await fetchFunction();
        await client.setEx(key, expiration, JSON.stringify(freshData));
        return freshData;
    } catch (err) {
        console.error("Cache error:", err);
        return fetchFunction(); // fallback if Redis fails
    }
}

module.exports = { getOrSetCache };
