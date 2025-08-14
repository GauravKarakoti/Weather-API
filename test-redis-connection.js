const Redis = require("ioredis");

// Test Redis connection with better error handling
async function testRedisConnection() {
  console.log("🔄 Testing Redis connection...");
  
  // Check if Redis environment variables are set
  const redisHost = process.env.REDIS_HOST || "localhost";
  const redisPort = parseInt(process.env.REDIS_PORT) || 6379;
  const redisPassword = process.env.REDIS_PASSWORD || undefined;
  const redisDb = parseInt(process.env.REDIS_DB) || 0;
  const redisTls = process.env.REDIS_TLS === "true";
  
  console.log(`📍 Redis Configuration:`);
  console.log(`   Host: ${redisHost}`);
  console.log(`   Port: ${redisPort}`);
  console.log(`   Database: ${redisDb}`);
  console.log(`   TLS: ${redisTls}`);
  console.log(`   Password: ${redisPassword ? "***" : "none"}`);
  
  const redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    db: redisDb,
    tls: redisTls ? {} : undefined,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 3000,
    enableOfflineQueue: false,
  });

  try {
    // Test connection
    console.log("\n🔌 Attempting to connect...");
    await redis.connect();
    console.log("✅ Connected to Redis successfully!");
    
    // Test basic operations
    console.log("\n🧪 Testing basic operations...");
    await redis.set("test:connection", "Hello from Weather API!");
    console.log("✅ Set test key successfully");
    
    const value = await redis.get("test:connection");
    console.log("✅ Retrieved test key:", value);
    
    // Test with TTL
    await redis.setex("test:ttl", 60, "This expires in 60 seconds");
    const ttl = await redis.ttl("test:ttl");
    console.log("✅ Set key with TTL:", ttl, "seconds");
    
    // Clean up
    await redis.del("test:connection", "test:ttl");
    console.log("✅ Cleaned up test keys");
    
    console.log("\n🎉 All Redis operations successful!");
    console.log("Your Redis connection is working perfectly.");
    
  } catch (error) {
    console.error("\n❌ Redis connection failed:", error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error("\n💡 Possible solutions:");
      console.error("1. Start Redis server: docker-compose up redis");
      console.error("2. Check if Redis is running on the correct port");
      console.error("3. Verify Redis host and port in your environment");
    } else if (error.code === 'ENOTFOUND') {
      console.error("\n💡 Possible solutions:");
      console.error("1. Check if Redis hostname is correct");
      console.error("2. Verify network connectivity");
    } else if (error.message.includes('WRONGPASS')) {
      console.error("\n💡 Possible solutions:");
      console.error("1. Check Redis password in your environment");
      console.error("2. Verify Redis authentication settings");
    }
    
    console.error("\n📋 Environment check:");
    console.error(`   REDIS_HOST: ${process.env.REDIS_HOST || "not set (default: localhost)"}`);
    console.error(`   REDIS_PORT: ${process.env.REDIS_PORT || "not set (default: 6379)"}`);
    console.error(`   REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? "set" : "not set"}`);
    console.error(`   REDIS_DB: ${process.env.REDIS_DB || "not set (default: 0)"}`);
    console.error(`   REDIS_TLS: ${process.env.REDIS_TLS || "not set (default: false)"}`);
    
  } finally {
    try {
      await redis.quit();
      console.log("\n🔌 Disconnected from Redis");
    } catch (error) {
      console.error("Error during disconnect:", error.message);
    }
  }
}

// Run the test
testRedisConnection();
