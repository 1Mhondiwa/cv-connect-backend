const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testWorkExperienceDebug() {
  try {
    console.log('Testing Work Experience Debug...\n');
    
    // Test 1: Check CV table structure
    console.log('1. Checking CV table structure...');
    const structureResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'CV' 
      ORDER BY ordinal_position
    `);
    console.log('CV table columns:', structureResult.rows.map(row => `${row.column_name} (${row.data_type})`));
    
    // Test 2: Check if there are any CV records
    console.log('\n2. Checking CV records...');
    const cvResult = await pool.query('SELECT COUNT(*) as count FROM "CV"');
    console.log('Total CV records:', cvResult.rows[0].count);
    
    if (parseInt(cvResult.rows[0].count) > 0) {
      // Test 3: Check a sample CV record
      console.log('\n3. Checking sample CV record...');
      const sampleCv = await pool.query('SELECT cv_id, freelancer_id, parsed_data FROM "CV" LIMIT 1');
      console.log('Sample CV:', {
        cv_id: sampleCv.rows[0].cv_id,
        freelancer_id: sampleCv.rows[0].freelancer_id,
        has_parsed_data: !!sampleCv.rows[0].parsed_data,
        parsed_data_keys: sampleCv.rows[0].parsed_data ? Object.keys(sampleCv.rows[0].parsed_data) : 'none'
      });
      
      if (sampleCv.rows[0].parsed_data) {
        const parsedData = sampleCv.rows[0].parsed_data;
        console.log('\n4. Parsed data structure:');
        console.log('- work_experience:', parsedData.work_experience ? `${parsedData.work_experience.length} entries` : 'none');
        if (parsedData.work_experience && parsedData.work_experience.length > 0) {
          console.log('- First work experience entry:', parsedData.work_experience[0]);
          console.log('- Work experience IDs:', parsedData.work_experience.map(w => w.id || 'no-id'));
        }
        
        console.log('- education:', parsedData.education ? `${parsedData.education.length} entries` : 'none');
        if (parsedData.education && parsedData.education.length > 0) {
          console.log('- First education entry:', parsedData.education[0]);
          console.log('- Education IDs:', parsedData.education.map(e => e.id || 'no-id'));
        }
      }
    }
    
    // Test 4: Check freelancer table
    console.log('\n5. Checking freelancer table...');
    const freelancerResult = await pool.query('SELECT COUNT(*) as count FROM "Freelancer"');
    console.log('Total freelancers:', freelancerResult.rows[0].count);
    
    if (parseInt(freelancerResult.rows[0].count) > 0) {
      const sampleFreelancer = await pool.query('SELECT freelancer_id, user_id FROM "Freelancer" LIMIT 1');
      console.log('Sample freelancer:', sampleFreelancer.rows[0]);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testWorkExperienceDebug();
