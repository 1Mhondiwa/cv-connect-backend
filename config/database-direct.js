// config/database-direct.js - Direct connection string approach
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
const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?sslmode=require`;

console.log('Connection String (without password):', `postgresql://${process.env.DB_USER}:[HIDDEN]@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?sslmode=require`);

const pool = new Pool({
  connectionString: connectionString,
  // Force IPv4
  family: 4,
  // Additional SSL options
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

// Test the database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    return false;
  }
};

module.exports = {
  pool,
  testConnection,
  query: (text, params) => pool.query(text, params)
};
