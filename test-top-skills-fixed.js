const db = require('./config/database');

async function testTopSkillsFixed() {
  try {
    console.log('🔍 Testing Fixed Top Skills Query...\n');
    
    // Test the new query using normalized tables
    const result = await db.query(`
      SELECT 
        s.skill_name as skill,
        COUNT(fs.freelancer_id) as count
      FROM "Skill" s
      LEFT JOIN "Freelancer_Skill" fs ON s.skill_id = fs.skill_id
      WHERE s.skill_name IS NOT NULL 
        AND s.skill_name != ''
      GROUP BY s.skill_id, s.skill_name
      HAVING COUNT(fs.freelancer_id) > 0
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log('✅ Fixed Query executed successfully!');
    console.log(`📊 Found ${result.rows.length} unique skills with freelancers\n`);
    
    if (result.rows.length > 0) {
      console.log('🏆 Top Skills Ranking (Fixed):');
      result.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.skill}: ${row.count} freelancers`);
      });
    } else {
      console.log('❌ No skills found with freelancers');
    }
    
    // Also check total skills and freelancers
    const skillCount = await db.query('SELECT COUNT(*) as total_skills FROM "Skill"');
    const freelancerSkillCount = await db.query('SELECT COUNT(*) as total_freelancer_skills FROM "Freelancer_Skill"');
    const freelancerCount = await db.query('SELECT COUNT(DISTINCT freelancer_id) as unique_freelancers FROM "Freelancer_Skill"');
    
    console.log(`\n📁 Total Skills in database: ${skillCount.rows[0].total_skills}`);
    console.log(`📁 Total Freelancer-Skill relationships: ${freelancerSkillCount.rows[0].total_freelancer_skills}`);
    console.log(`📁 Unique Freelancers with skills: ${freelancerCount.rows[0].unique_freelancers}`);
    
    // Compare with old query for debugging
    console.log('\n🔍 Comparing with old CV JSON query:');
    try {
      const oldResult = await db.query(`
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
      
      console.log(`Old query found ${oldResult.rows.length} skills:`);
      oldResult.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.skill}: ${row.count} occurrences`);
      });
    } catch (oldError) {
      console.log('❌ Old query failed:', oldError.message);
    }
    
  } catch (error) {
    console.error('❌ Error testing fixed top skills:', error);
  } finally {
    process.exit(0);
  }
}

testTopSkillsFixed();
