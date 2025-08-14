const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Redis environment variables...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (fs.existsSync(envPath)) {
  console.log('✅ .env file already exists');
  
  // Read current .env content
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check if Redis variables are already set
  const hasRedisHost = envContent.includes('REDIS_HOST=');
  const hasRedisPort = envContent.includes('REDIS_PORT=');
  
  if (hasRedisHost && hasRedisPort) {
    console.log('✅ Redis environment variables are already configured');
    console.log('\n📋 Current Redis configuration:');
    
    const lines = envContent.split('\n');
    lines.forEach(line => {
      if (line.startsWith('REDIS_') || line.startsWith('CACHE_')) {
        console.log(`   ${line}`);
      }
    });
  } else {
    console.log('⚠️  .env file exists but Redis variables are missing');
    console.log('   Adding Redis configuration...');
    
    // Add Redis variables to existing .env
    const redisConfig = `
# Redis Cache Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TLS=false

# Cache Configuration
CACHE_WARMING_ENABLED=true
CACHE_WARMING_INTERVAL_HOURS=6
`;
    
    fs.appendFileSync(envPath, redisConfig);
    console.log('✅ Redis configuration added to .env file');
  }
} else {
  console.log('📝 Creating new .env file...');
  
  // Read .env.example if it exists
  let baseContent = '';
  if (fs.existsSync(envExamplePath)) {
    baseContent = fs.readFileSync(envExamplePath, 'utf8');
    console.log('✅ Using .env.example as base');
  }
  
  // Add Redis configuration
  const redisConfig = `
# Redis Cache Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TLS=false

# Cache Configuration
CACHE_WARMING_ENABLED=true
CACHE_WARMING_INTERVAL_HOURS=6
`;
  
  const fullContent = baseContent + redisConfig;
  fs.writeFileSync(envPath, fullContent);
  console.log('✅ .env file created with Redis configuration');
}

console.log('\n🚀 Next steps:');
console.log('1. Start Redis server: docker-compose up redis');
console.log('2. Test connection: node test-redis-connection.js');
console.log('3. Start your app: npm start');
console.log('\n💡 If you want to use a different Redis host, edit the .env file');
console.log('   and change REDIS_HOST and REDIS_PORT values');
