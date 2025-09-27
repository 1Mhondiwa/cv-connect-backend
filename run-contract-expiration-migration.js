// run-contract-expiration-migration.js
const { pool } = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runContractExpirationMigration() {
  let client;
  
  try {
    console.log('🔄 Running contract expiration migration...');
    
    // Connect to database
    client = await pool.connect();
    
    // Read and execute the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'auto_update_expired_contracts.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Contract expiration migration completed successfully');
    
    // Test the function
    console.log('🧪 Testing the update_expired_contracts function...');
    const testResult = await client.query('SELECT update_expired_contracts() as updated_count');
    const updatedCount = parseInt(testResult.rows[0].updated_count);
    
    console.log(`✅ Function test completed. Updated ${updatedCount} expired contracts.`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  runContractExpirationMigration()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = runContractExpirationMigration;
