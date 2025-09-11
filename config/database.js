// config/database.js
const { Pool } = require('pg');
const logger = require('../utils/logger');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Connection pool configuration
  max: parseInt(process.env.DB_POOL_MAX) || 20, // Maximum number of clients in the pool
  min: parseInt(process.env.DB_POOL_MIN) || 2,  // Minimum number of clients in the pool
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000, // Return an error after 2 seconds if connection could not be established
  maxUses: parseInt(process.env.DB_MAX_USES) || 7500, // Close (and replace) a connection after it has been used this many times
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Pool event handlers for monitoring
pool.on('connect', (client) => {
  logger.debug('New client connected to database pool');
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', err);
});

pool.on('remove', (client) => {
  logger.debug('Client removed from database pool');
});

// Test the database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    logger.production('Database connection successful');
    client.release();
    return true;
  } catch (error) {
    logger.error('Database connection error:', error);
    return false;
  }
};

module.exports = {
  pool,
  testConnection,
  query: (text, params) => pool.query(text, params)
};