const { pool } = require('./config/database');

async function checkTableStructure() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking table structures...\n');
    
    // Check CV table structure
    console.log('📋 CV TABLE STRUCTURE:');
    const cvStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'CV'
      ORDER BY ordinal_position
    `);
    
    cvStructure.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    console.log('');
    
    // Check Message table structure
    console.log('📋 MESSAGE TABLE STRUCTURE:');
    const messageStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Message'
      ORDER BY ordinal_position
    `);
    
    messageStructure.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    console.log('');
    
    // Check if CV table has any data
    console.log('📊 CV TABLE DATA SAMPLE:');
    const cvData = await client.query('SELECT * FROM "CV" LIMIT 3');
    if (cvData.rows.length > 0) {
      console.log('CV table columns:', Object.keys(cvData.rows[0]));
      cvData.rows.forEach((row, index) => {
        console.log(`  Row ${index + 1}:`, row);
      });
    } else {
      console.log('  CV table is empty');
    }
    console.log('');
    
    // Check if Message table has any data
    console.log('📊 MESSAGE TABLE DATA SAMPLE:');
    const messageData = await client.query('SELECT * FROM "Message" LIMIT 3');
    if (messageData.rows.length > 0) {
      console.log('Message table columns:', Object.keys(messageData.rows[0]));
      messageData.rows.forEach((row, index) => {
        console.log(`  Row ${index + 1}:`, row);
      });
    } else {
      console.log('  Message table is empty');
    }
    console.log('');
    
  } catch (error) {
    console.error('❌ Error checking table structure:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTableStructure();

