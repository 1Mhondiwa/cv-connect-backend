const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testWorkExperienceParsing() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Testing Work Experience Parsing...\n');
    
    // Check CV table structure
    console.log('1. Checking CV table structure...');
    const structureResult = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'CV' 
      ORDER BY ordinal_position
    `);
    
    console.log('CV Table Columns:');
    structureResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Check sample CV data
    console.log('\n2. Checking sample CV data...');
    const cvResult = await client.query(`
      SELECT cv_id, freelancer_id, 
             pg_typeof(parsed_data) as parsed_data_type,
             parsed_data IS NULL as is_null,
             CASE 
               WHEN parsed_data IS NULL THEN 'NULL'
               WHEN jsonb_typeof(parsed_data) = 'object' THEN 'JSONB Object'
               WHEN jsonb_typeof(parsed_data) = 'array' THEN 'JSONB Array'
               ELSE 'Other: ' || jsonb_typeof(parsed_data)
             END as jsonb_type
      FROM "CV" 
      LIMIT 3
    `);
    
    console.log('Sample CV Data:');
    cvResult.rows.forEach((row, index) => {
      console.log(`  CV ${index + 1}:`);
      console.log(`    - cv_id: ${row.cv_id}`);
      console.log(`    - freelancer_id: ${row.freelancer_id}`);
      console.log(`    - parsed_data_type: ${row.parsed_data_type}`);
      console.log(`    - is_null: ${row.is_null}`);
      console.log(`    - jsonb_type: ${row.jsonb_type}`);
    });
    
    // Check if work_experience exists in parsed_data
    console.log('\n3. Checking work_experience in parsed_data...');
    const workExpResult = await client.query(`
      SELECT cv_id, 
             parsed_data->>'work_experience' as work_exp_raw,
             jsonb_typeof(parsed_data->'work_experience') as work_exp_type,
             CASE 
               WHEN parsed_data->'work_experience' IS NULL THEN 'No work_experience field'
               WHEN jsonb_typeof(parsed_data->'work_experience') = 'array' THEN 
                 'Array with ' || jsonb_array_length(parsed_data->'work_experience') || ' items'
               ELSE 'Other: ' || jsonb_typeof(parsed_data->'work_experience')
             END as work_exp_status
      FROM "CV" 
      WHERE parsed_data->'work_experience' IS NOT NULL
      LIMIT 3
    `);
    
    if (workExpResult.rows.length > 0) {
      console.log('Work Experience Data Found:');
      workExpResult.rows.forEach((row, index) => {
        console.log(`  CV ${index + 1}:`);
        console.log(`    - cv_id: ${row.cv_id}`);
        console.log(`    - work_exp_type: ${row.work_exp_type}`);
        console.log(`    - work_exp_status: ${row.work_exp_status}`);
        console.log(`    - work_exp_raw: ${row.work_exp_raw ? row.work_exp_raw.substring(0, 100) + '...' : 'NULL'}`);
      });
    } else {
      console.log('No work_experience data found in any CV');
    }
    
    // Test JSON parsing logic
    console.log('\n4. Testing JSON parsing logic...');
    const testCvResult = await client.query(`
      SELECT cv_id, parsed_data 
      FROM "CV" 
      WHERE parsed_data IS NOT NULL 
      LIMIT 1
    `);
    
    if (testCvResult.rows.length > 0) {
      const testCv = testCvResult.rows[0];
      console.log(`Testing with CV ID: ${testCv.cv_id}`);
      
      try {
        // Test current logic (this will fail if parsed_data is already an object)
        console.log('Current logic test:');
        const existingParsedData = testCv.parsed_data ? JSON.parse(testCv.parsed_data) : {};
        console.log('✅ JSON.parse() succeeded');
        console.log('  - parsed_data type:', typeof testCv.parsed_data);
        console.log('  - existingParsedData type:', typeof existingParsedData);
        console.log('  - work_experience:', existingParsedData.work_experience ? 'exists' : 'missing');
      } catch (parseError) {
        console.log('❌ JSON.parse() failed:', parseError.message);
        console.log('  - parsed_data type:', typeof testCv.parsed_data);
        console.log('  - parsed_data is object:', typeof testCv.parsed_data === 'object');
        
        // Test fixed logic
        console.log('\nFixed logic test:');
        const existingParsedData = testCv.parsed_data || {};
        console.log('✅ Direct assignment succeeded');
        console.log('  - existingParsedData type:', typeof existingParsedData);
        console.log('  - work_experience:', existingParsedData.work_experience ? 'exists' : 'missing');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testWorkExperienceParsing();


