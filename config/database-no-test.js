// config/database-no-test.js - Start server without initial DB test
const { Pool } = require('pg');
require('dotenv').config();

// Debug: Log all environment variables
console.log('=== Database Configuration Debug ===');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '[HIDDEN]' : 'NOT_SET');
console.log('DB_SSL:', process.env.DB_SSL);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('=====================================');

// Use direct connection string
const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?sslmode=verify-full`;

console.log('Connection String (without password):', `postgresql://${process.env.DB_USER}:[HIDDEN]@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?sslmode=verify-full`);

const pool = new Pool({
  connectionString: connectionString,
  // Force IPv4
  family: 4,
  // SSL options
  ssl: {
    rejectUnauthorized: false
  }
});

// Test the database connection (but don't fail the server)
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    console.log('⚠️  Server will start anyway - database connection will be retried');
    return false; // Don't fail the server startup
  }
};

module.exports = {
  pool,
  testConnection,
  query: (text, params) => pool.query(text, params)
};
