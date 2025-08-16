const db = require('./config/database');

async function testTopSkills() {
  try {
    console.log('🔍 Testing Top Skills Query...\n');
    
    // Test the exact query from the updated endpoint
    const result = await db.query(`
      SELECT 
        skill->>'name' as skill,
        COUNT(*) as count
      FROM "CV", 
           jsonb_array_elements(parsed_data->'skills') as skill
      WHERE parsed_data->'skills' IS NOT NULL 
        AND skill->>'name' IS NOT NULL
        AND skill->>'name' != ''
      GROUP BY skill->>'name'
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log('✅ Query executed successfully!');
    console.log(`📊 Found ${result.rows.length} unique skills\n`);
    
    if (result.rows.length > 0) {
      console.log('🏆 Top Skills Ranking:');
      result.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.skill}: ${row.count} occurrences`);
      });
    } else {
      console.log('❌ No skills found in CV data');
    }
    
    // Also check total CVs with skills
    const cvCount = await db.query(`
      SELECT COUNT(*) as total_cvs
      FROM "CV"
      WHERE parsed_data->'skills' IS NOT NULL
    `);
    
    console.log(`\n📁 Total CVs with skills: ${cvCount.rows[0].total_cvs}`);
    
  } catch (error) {
    console.error('❌ Error testing top skills:', error);
  } finally {
    process.exit(0);
  }
}

testTopSkills();

