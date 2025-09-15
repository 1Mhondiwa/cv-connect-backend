const fs = require('fs');
const path = require('path');
const { pool } = require('./config/database');

async function runHourlyRateMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting hourly rate migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_freelancer_hourly_rate.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration SQL...');
    await client.query(migrationSQL);
    
    console.log('✅ Hourly rate migration completed successfully!');
    console.log('📊 Added hourly_rate column to Freelancer table');
    console.log('🔍 Created index for efficient querying by hourly rate');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runHourlyRateMigration()
  .then(() => {
    console.log('🎉 Migration process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
  });
