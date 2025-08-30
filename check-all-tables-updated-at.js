// check-all-tables-updated-at.js
const { pool } = require('./config/database');

async function checkAllTablesUpdatedAt() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking all tables for updated_at column and trigger issues...\n');
    
    // Get all tables in the database
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`📋 Found ${tablesResult.rows.length} tables:\n`);
    
    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;
      console.log(`🔍 Checking table: ${tableName}`);
      
      // Check table structure
      const structureResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      // Check if table has updated_at column
      const hasUpdatedAt = structureResult.rows.some(row => row.column_name === 'updated_at');
      const hasCreatedAt = structureResult.rows.some(row => row.column_name === 'created_at');
      
      console.log(`  Columns: ${structureResult.rows.map(row => row.column_name).join(', ')}`);
      console.log(`  Has updated_at: ${hasUpdatedAt ? '✅' : '❌'}`);
      console.log(`  Has created_at: ${hasCreatedAt ? '✅' : '❌'}`);
      
      // Check for triggers on this table
      const triggersResult = await client.query(`
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = $1
      `, [tableName]);
      
      if (triggersResult.rows.length > 0) {
        console.log(`  Triggers: ${triggersResult.rows.length}`);
        triggersResult.rows.forEach(trigger => {
          console.log(`    - ${trigger.trigger_name}: ${trigger.event_manipulation} -> ${trigger.action_statement}`);
        });
      } else {
        console.log(`  Triggers: None`);
      }
      
      console.log('');
    }
    
    // Check the update_updated_at_column function
    console.log('🔧 Checking update_updated_at_column function...');
    try {
      const functionResult = await client.query(`
        SELECT routine_definition 
        FROM information_schema.routines 
        WHERE routine_name = 'update_updated_at_column'
      `);
      
      if (functionResult.rows.length > 0) {
        console.log('✅ Function exists');
        console.log('Function definition:', functionResult.rows[0].routine_definition);
      } else {
        console.log('❌ Function does not exist');
      }
    } catch (funcError) {
      console.log('❌ Error checking function:', funcError.message);
    }
    
  } catch (error) {
    console.error('❌ Error checking tables:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAllTablesUpdatedAt();
