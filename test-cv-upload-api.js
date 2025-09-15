const { pool } = require('./config/database');

async function testCVUploadAPI() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Testing CV Upload API endpoint...\n');
    
    // Test 1: Check if CV table exists and has data
    console.log('📊 1. Checking CV table structure and data:');
    const tableCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'CV' 
      ORDER BY ordinal_position
    `);
    
    console.log('CV table columns:');
    tableCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Test 2: Check CV data
    const cvCount = await client.query('SELECT COUNT(*) as count FROM "CV"');
    console.log(`\nTotal CV records: ${cvCount.rows[0].count}`);
    
    if (cvCount.rows[0].count > 0) {
      const sampleData = await client.query(`
        SELECT cv_id, upload_date, created_at, freelancer_id 
        FROM "CV" 
        ORDER BY upload_date DESC 
        LIMIT 5
      `);
      
      console.log('\nSample CV records:');
      sampleData.rows.forEach(row => {
        console.log(`  - CV ID: ${row.cv_id}, Upload Date: ${row.upload_date}, Created: ${row.created_at}`);
      });
    }
    
    // Test 3: Test the exact query used in the API
    console.log('\n📊 2. Testing CV upload trends query:');
    
    const startDate = new Date('2025-06-19');
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const result = await client.query(`
      SELECT 
        DATE(upload_date) as date,
        COUNT(*) as uploads
      FROM "CV"
      WHERE upload_date >= $1 AND upload_date <= $2
      GROUP BY DATE(upload_date)
      ORDER BY date ASC
    `, [startDate, endDate]);
    
    console.log(`\nQuery returned ${result.rows.length} records:`);
    result.rows.forEach(row => {
      console.log(`  - ${row.date}: ${row.uploads} uploads`);
    });
    
    // Test 4: Test with days parameter (last 30 days)
    console.log('\n📊 3. Testing with days parameter (last 30 days):');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    
    const daysResult = await client.query(`
      SELECT 
        DATE(upload_date) as date,
        COUNT(*) as uploads
      FROM "CV"
      WHERE upload_date >= $1 AND upload_date <= $2
      GROUP BY DATE(upload_date)
      ORDER BY date ASC
    `, [thirtyDaysAgo, endDate]);
    
    console.log(`\nLast 30 days query returned ${daysResult.rows.length} records:`);
    daysResult.rows.forEach(row => {
      console.log(`  - ${row.date}: ${row.uploads} uploads`);
    });
    
    // Test 5: Test custom date range
    console.log('\n📊 4. Testing custom date range (last 7 days):');
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    
    const customResult = await client.query(`
      SELECT 
        DATE(upload_date) as date,
        COUNT(*) as uploads
      FROM "CV"
      WHERE upload_date >= $1 AND upload_date <= $2
      GROUP BY DATE(upload_date)
      ORDER BY date ASC
    `, [sevenDaysAgo, endDate]);
    
    console.log(`\nLast 7 days query returned ${customResult.rows.length} records:`);
    customResult.rows.forEach(row => {
      console.log(`  - ${row.date}: ${row.uploads} uploads`);
    });
    
    console.log('\n✅ CV Upload API testing completed!');
    
  } catch (error) {
    console.error('❌ Error testing CV Upload API:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testCVUploadAPI();
