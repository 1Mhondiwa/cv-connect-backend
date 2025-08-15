// run-hiring-migration.js
const fs = require('fs');
const path = require('path');
const db = require('./config/database');

async function runHiringMigration() {
  let client;
  
  try {
    console.log('🚀 Starting Freelancer Hiring System migration...');
    
    // Get database client
    client = await db.pool.connect();
    console.log('✅ Database connection established');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'add_freelancer_hiring_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Migration SQL file loaded');
    
    // Begin transaction
    await client.query('BEGIN');
    console.log('🔄 Transaction started');
    
    // Execute the migration
    await client.query(migrationSQL);
    console.log('✅ Migration SQL executed successfully');
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Transaction committed');
    
    console.log('🎉 Freelancer Hiring System migration completed successfully!');
    
    // Verify the table was created
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'Freelancer_Hire'
    `);
    
    if (tableCheck.rowCount > 0) {
      console.log('✅ Freelancer_Hire table verified in database');
    } else {
      console.log('❌ Freelancer_Hire table not found - migration may have failed');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.log('🔄 Transaction rolled back');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
    }
    
    process.exit(1);
  } finally {
    if (client) {
      client.release();
      console.log('🔌 Database connection released');
    }
    
    // Close the pool
    await db.pool.end();
    console.log('🔌 Database pool closed');
  }
}

// Run the migration
runHiringMigration();

