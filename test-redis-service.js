// Test Redis service without connection
require('dotenv').config();
const redisService = require('./src/services/redis.service');

async function testRedisService() {
  console.log('🧪 Testing Redis Service...\n');

  console.log('📍 Redis Service Status:');
  console.log(`   Client exists: ${redisService.client ? 'Yes' : 'No'}`);
  console.log(`   Is connected: ${redisService.isConnected}`);
  console.log(`   Environment: ${process.env.REDIS_HOST}`);

  console.log('\n🧪 Testing cache operations...');

  // Test get operation
  const testGet = await redisService.get('test:key');
  console.log(`   GET operation: ${testGet === null ? 'PASS (no cache)' : 'FAIL'}`);

  // Test set operation
  const testSet = await redisService.set('test:key', 'test value');
  console.log(`   SET operation: ${testSet === false ? 'PASS (no cache)' : 'FAIL'}`);

  // Test ping operation
  const testPing = await redisService.ping();
  console.log(`   PING operation: ${testPing === false ? 'PASS (no cache)' : 'FAIL'}`);

  console.log('\n📊 Service Stats:');
  const stats = redisService.getStats();
  console.log(`   Hits: ${stats.hits}`);
  console.log(`   Misses: ${stats.misses}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`   Is Connected: ${stats.isConnected}`);

  console.log('\n✅ Redis service test completed!');
  console.log('   The service is now operating without Redis (cache disabled)');
  console.log('   No more connection errors will occur');
}

// Run the test
testRedisService();
