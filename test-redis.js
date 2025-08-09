const Redis = require('ioredis');

// Upstash Redis configuration
const redis = new Redis({
  host: 'winning-crab-19100.upstash.io',
  port: 6379,
  password: 'AUqcAAIjcDFiNjhlY2EzZTI4ODY0NjA4OTdhYzYyZTliNTJjNGY3OXAxMA',
  db: 0,
  tls: {},
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
});

async function testRedisConnection() {
  try {
    console.log('🔄 Testing Upstash Redis connection...');
    
    // Connect to Redis
    await redis.connect();
    console.log('✅ Connected to Upstash Redis successfully!');
    
    // Test basic operations
    await redis.set('test:connection', 'Hello from Weather API!');
    console.log('✅ Set test key successfully');
    
    const value = await redis.get('test:connection');
    console.log('✅ Retrieved test key:', value);
    
    // Test with TTL
    await redis.setex('test:ttl', 60, 'This expires in 60 seconds');
    const ttl = await redis.ttl('test:ttl');
    console.log('✅ Set key with TTL:', ttl, 'seconds');
    
    // Clean up
    await redis.del('test:connection', 'test:ttl');
    console.log('✅ Cleaned up test keys');
    
    console.log('🎉 All Redis operations successful!');
    console.log('Your Upstash Redis is working perfectly.');
    
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.error('Please check your Upstash credentials and network connection.');
  } finally {
    await redis.quit();
    console.log('🔌 Disconnected from Redis');
  }
}

// Run the test
testRedisConnection();
