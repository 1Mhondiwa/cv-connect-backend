// config/database.js
const { Pool } = require('pg');
const logger = require('../utils/logger');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Connection pool configuration
  max: parseInt(process.env.DB_POOL_MAX) || 10,
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
  maxUses: parseInt(process.env.DB_MAX_USES) || 7500,
  // Force IPv4 to avoid DNS resolution issues with managed databases
  family: 4,
  // SSL configuration (e.g. Supabase requires it)
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
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

// Test the database connection with retry logic
const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      logger.production('Database connection successful');
      client.release();
      return true;
    } catch (error) {
      logger.error(`Database connection attempt ${i + 1} failed:`, error.message);

      if (i === retries - 1) {
        logger.production('All database connection attempts failed; server will start without a database connection');
        return false;
      }

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