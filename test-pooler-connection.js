// Test Session Pooler Connection
const { Pool } = require('pg');

// Session Pooler connection details (based on Supabase format)
const poolerConnections = [
  {
    name: 'Session Pooler',
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.gygduxakbsnpxnocjuqy',
    password: 'pt',
    ssl: { rejectUnauthorized: false }
  },
  {
    name: 'Transaction Pooler', 
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.gygduxakbsnpxnocjuqy',
    password: 'pt',
    ssl: { rejectUnauthorized: false }
  }
];

async function testPoolerConnections() {
  console.log('🔍 Testing Supabase Pooler Connections...\n');
  
  for (const config of poolerConnections) {
    console.log(`Testing ${config.name}:`);
    console.log(`Host: ${config.host}:${config.port}`);
    console.log(`User: ${config.user}`);
    
    try {
      const pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl,
        connectionTimeoutMillis: 10000,
        family: 4 // Force IPv4
      });
      
      const client = await pool.connect();
      console.log('✅ Connection successful!');
      
      // Test query
      const result = await client.query('SELECT version()');
      console.log('📊 Database version:', result.rows[0].version.substring(0, 50) + '...');
      
      client.release();
      await pool.end();
      
      console.log('\n🎉 THIS IS THE WORKING CONNECTION!');
      console.log('Use these settings in Render:');
      console.log(`DB_HOST=${config.host}`);
      console.log(`DB_PORT=${config.port}`);
      console.log(`DB_NAME=${config.database}`);
      console.log(`DB_USER=${config.user}`);
      console.log(`DB_PASSWORD=pt`);
      console.log(`DB_SSL=true`);
      
      break; // Stop after first successful connection
      
    } catch (error) {
      console.log(`❌ Connection failed: ${error.message}`);
      console.log('');
    }
  }
}

testPoolerConnections().catch(console.error);
