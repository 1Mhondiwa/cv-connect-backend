// Script to run the temporary password tracking migration
const { pool } = require('./config/database');
const fs = require('fs');
const path = require('path');

const runMigration = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running temporary password tracking migration...\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_temp_password_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Migration SQL:');
    console.log(migrationSQL);
    console.log('\n🔄 Executing migration...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the changes
    console.log('\n🔍 Verifying changes...');
    
    const columnCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'User' 
        AND column_name = 'has_changed_temp_password'
      );
    `);
    
    if (columnCheck.rows[0].exists) {
      console.log('✅ has_changed_temp_password column added to User table');
      
      // Check the data
      const dataCheck = await client.query(`
        SELECT user_type, COUNT(*) as count, 
               COUNT(CASE WHEN has_changed_temp_password = true THEN 1 END) as changed_count,
               COUNT(CASE WHEN has_changed_temp_password = false THEN 1 END) as not_changed_count
        FROM "User" 
        GROUP BY user_type;
      `);
      
      console.log('\n📊 Current data status:');
      dataCheck.rows.forEach(row => {
        console.log(`   ${row.user_type}: ${row.count} total, ${row.changed_count} changed, ${row.not_changed_count} not changed`);
      });
    } else {
      console.log('❌ Migration may have failed - column not found');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

// Run the migration
runMigration();


