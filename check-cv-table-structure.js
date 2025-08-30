// check-cv-table-structure.js
const { pool } = require('./config/database');

async function checkCVTableStructure() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking CV table structure...\n');
    
    // Check CV table structure
    console.log('📋 CV TABLE STRUCTURE:');
    const cvStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'CV'
      ORDER BY ordinal_position
    `);
    
    if (cvStructure.rows.length === 0) {
      console.log('❌ CV table does not exist!');
      return;
    }
    
    cvStructure.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'}) ${row.column_default ? `default: ${row.column_default}` : ''}`);
    });
    
    // Check if CV table has any data
    console.log('\n📊 CV TABLE DATA SAMPLE:');
    try {
      const cvData = await client.query('SELECT * FROM "CV" LIMIT 1');
      if (cvData.rows.length > 0) {
        console.log('CV table columns:', Object.keys(cvData.rows[0]));
        console.log('Sample row:', cvData.rows[0]);
      } else {
        console.log('  CV table is empty');
      }
    } catch (dataError) {
      console.log('  Could not query CV table data:', dataError.message);
    }
    
  } catch (error) {
    console.error('❌ Error checking CV table structure:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkCVTableStructure();
