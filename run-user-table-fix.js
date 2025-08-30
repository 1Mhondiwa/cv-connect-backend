const { pool } = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runUserTableFix() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running User table fix migration...\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'fix_user_table_updated_at.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Migration SQL:');
    console.log(migrationSQL);
    console.log('\n🚀 Executing migration...\n');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    // Verify the changes
    console.log('✅ Migration executed successfully!');
    console.log('\n🔍 Verifying changes...');
    
    // Check if updated_at column exists
    const columnCheck = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'User' AND column_name = 'updated_at'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ updated_at column added successfully');
      console.log(`   - Type: ${columnCheck.rows[0].data_type}`);
      console.log(`   - Nullable: ${columnCheck.rows[0].is_nullable}`);
      console.log(`   - Default: ${columnCheck.rows[0].column_default}`);
    } else {
      console.log('❌ updated_at column not found');
    }
    
    // Check if trigger exists
    const triggerCheck = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers 
      WHERE event_object_table = 'User' AND trigger_name = 'trigger_update_user_updated_at'
    `);
    
    if (triggerCheck.rows.length > 0) {
      console.log('✅ Trigger created successfully');
      console.log(`   - Name: ${triggerCheck.rows[0].trigger_name}`);
      console.log(`   - Event: ${triggerCheck.rows[0].event_manipulation}`);
    } else {
      console.log('❌ Trigger not found');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n🎉 User table fix completed successfully!');
    console.log('💡 You should now be able to log in without the updated_at error.');
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

runUserTableFix();

