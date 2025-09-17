// run-signed-contract-migration.js
const db = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runSignedContractMigration() {
  try {
    console.log('🚀 Starting signed contract migration...');
    
    // Read and execute the migration SQL
    const migrationPath = path.join(__dirname, 'migrations', 'add_signed_contract_support.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration SQL...');
    await db.query(migrationSQL);
    
    console.log('✅ Signed contract migration completed successfully!');
    console.log('📋 Added fields:');
    console.log('  - signed_contract_pdf_path VARCHAR(500)');
    console.log('  - signed_contract_uploaded_at TIMESTAMP');
    console.log('  - Created index on signed_contract_pdf_path');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close database connection if it has a close method
    if (db.close) {
      await db.close();
    } else if (db.pool && db.pool.end) {
      await db.pool.end();
    }
  }
}

runSignedContractMigration();
