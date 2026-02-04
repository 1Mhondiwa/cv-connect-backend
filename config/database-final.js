// config/database-final.js - Final attempt with different approach
const { Pool } = require('pg');
require('dotenv').config();

console.log('=== Database Configuration Debug ===');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '[HIDDEN]' : 'NOT_SET');
console.log('DB_SSL:', process.env.DB_SSL);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('=====================================');

// Try different connection methods
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Try without SSL first, then with SSL
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false,
    // Try different SSL options
    sslmode: 'require'
  } : false,
  // Connection timeout
  connectionTimeoutMillis: 10000,
  // Force IPv4
  family: 4,
  // Pool settings
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
});

// Test connection with retry logic
const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1} to connect to database...`);
      const client = await pool.connect();
      console.log('✅ Database connection successful!');
      
      // Test a simple query
      const result = await client.query('SELECT NOW() as current_time');
      console.log('📊 Database query test:', result.rows[0]);
      
      client.release();
      return true;
    } catch (error) {
      console.error(`❌ Attempt ${i + 1} failed:`, error.message);
      
      // If it's the last attempt, return false
      if (i === retries - 1) {
        console.log('⚠️  All connection attempts failed');
        console.log('⚠️  Server will start without database connection');
        return false;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return false;
};

module.exports = {
  pool,
  testConnection,
  query: (text, params) => pool.query(text, params)
};
