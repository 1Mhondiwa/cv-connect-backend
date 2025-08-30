// run-comprehensive-fix-migration.js
const fs = require('fs');
const path = require('path');
const { pool } = require('./config/database');

async function runComprehensiveMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running comprehensive fix migration for all tables...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'fix-all-tables-updated-at.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Comprehensive migration completed successfully!');
    
    // Verify the fixes by checking key tables
    console.log('\n🔍 Verifying fixes...');
    
    const tablesToCheck = [
      'Associate', 'Freelancer', 'Associate_Request', 
      'Freelancer_Recommendation', 'Questionaire'
    ];
    
    for (const tableName of tablesToCheck) {
      try {
        const structureResult = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name = 'updated_at'
        `, [tableName]);
        
        if (structureResult.rows.length > 0) {
          console.log(`✅ ${tableName}: updated_at column exists`);
        } else {
          console.log(`❌ ${tableName}: updated_at column missing`);
        }
      } catch (error) {
        console.log(`❌ ${tableName}: Error checking - ${error.message}`);
      }
    }
    
    // Check triggers
    console.log('\n🔧 Checking triggers...');
    const triggersResult = await client.query(`
      SELECT event_object_table, trigger_name, action_statement
      FROM information_schema.triggers
      WHERE action_statement LIKE '%update_updated_at_column%'
      ORDER BY event_object_table
    `);
    
    console.log('Tables with update_updated_at_column triggers:');
    triggersResult.rows.forEach(row => {
      console.log(`  ${row.event_object_table}: ${row.trigger_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error running comprehensive migration:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runComprehensiveMigration();
