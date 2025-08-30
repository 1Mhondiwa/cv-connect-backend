// run-cv-fix-migration.js
const fs = require('fs');
const path = require('path');
const { pool } = require('./config/database');

async function runCVMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running CV table fix migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'fix_cv_table_updated_at.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ CV table fix migration completed successfully!');
    
    // Verify the fix by checking the CV table structure
    console.log('\n🔍 Verifying CV table structure...');
    const cvStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'CV'
      ORDER BY ordinal_position
    `);
    
    console.log('CV table columns:');
    cvStructure.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check if updated_at column exists
    const hasUpdatedAt = cvStructure.rows.some(row => row.column_name === 'updated_at');
    if (hasUpdatedAt) {
      console.log('\n✅ updated_at column is now present in CV table');
    } else {
      console.log('\n❌ updated_at column is still missing from CV table');
    }
    
  } catch (error) {
    console.error('❌ Error running CV migration:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runCVMigration();
