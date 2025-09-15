const fs = require('fs');
const path = require('path');
const { pool } = require('./config/database');

async function runContractPdfMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting contract PDF migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_contract_pdf_to_hiring.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration SQL...');
    await client.query(migrationSQL);
    
    console.log('✅ Contract PDF migration completed successfully!');
    console.log('📊 Added contract_pdf_path column to Freelancer_Hire table');
    console.log('🔍 Created index for efficient querying by contract PDF');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runContractPdfMigration()
  .then(() => {
    console.log('🎉 Migration process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
  });


