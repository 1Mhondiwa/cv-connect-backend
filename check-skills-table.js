const { pool } = require('./config/database');

async function checkSkillsTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking Skills table...\n');
    
    // Check if Skills table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'Skill'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('✅ Skills table exists');
      
      // Check Skills table structure
      const skillsStructure = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'Skill'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Skills table structure:');
      skillsStructure.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
      
      // Check Skills data
      const skillsData = await client.query('SELECT * FROM "Skill" LIMIT 5');
      console.log(`\n📊 Skills data (showing ${skillsData.rows.length} records):`);
      skillsData.rows.forEach((row, index) => {
        console.log(`  Row ${index + 1}:`, row);
      });
      
    } else {
      console.log('❌ Skills table does not exist');
      
      // Check what tables exist that might contain skills
      const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%skill%'
        ORDER BY table_name
      `);
      
      if (tables.rows.length > 0) {
        console.log('🔍 Tables with "skill" in name:');
        tables.rows.forEach(row => {
          console.log(`  ${row.table_name}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking Skills table:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSkillsTable();

