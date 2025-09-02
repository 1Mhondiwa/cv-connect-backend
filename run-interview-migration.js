// run-interview-migration.js
const fs = require('fs');
const path = require('path');
const { pool } = require('./config/database');

async function runInterviewMigration() {
  let client;
  
  try {
    console.log('🚀 Starting Interview System Migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_interview_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    
    // Get database client
    client = await pool.connect();
    console.log('🔗 Database connection established');
    
    // Begin transaction
    await client.query('BEGIN');
    console.log('🔄 Transaction started');
    
    // Execute the migration
    await client.query(migrationSQL);
    console.log('✅ Migration SQL executed successfully');
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('💾 Transaction committed');
    
    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'Interview%'
      ORDER BY table_name
    `);
    
    console.log('📊 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    // Check indexes
    const indexesResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename LIKE 'Interview%'
      ORDER BY indexname
    `);
    
    console.log('🔍 Created indexes:');
    indexesResult.rows.forEach(row => {
      console.log(`   ✅ ${row.indexname}`);
    });
    
    console.log('🎉 Interview System Migration Completed Successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   • Interview table created');
    console.log('   • Interview_Feedback table created');
    console.log('   • Interview_Invitation table created');
    console.log('   • All indexes and constraints applied');
    console.log('   • Triggers and comments added');
    console.log('');
    console.log('🚀 Ready for frontend implementation!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.log('🔄 Transaction rolled back');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError.message);
      }
    }
    
    process.exit(1);
  } finally {
    if (client) {
      client.release();
      console.log('🔌 Database connection released');
    }
  }
}

// Run the migration
runInterviewMigration();
