// Script to fix years_experience for freelancers based on their CV parsed data
const db = require('./config/database');

async function fixYearsExperience() {
  try {
    console.log('🔍 Checking freelancers with missing or incorrect years_experience...');
    
    // Get all freelancers with their CV data
    const result = await db.query(`
      SELECT 
        f.freelancer_id,
        f.user_id,
        f.first_name,
        f.last_name,
        f.years_experience as current_years,
        cv.parsed_data
      FROM "Freelancer" f
      LEFT JOIN "CV" cv ON f.freelancer_id = cv.freelancer_id
      WHERE cv.parsed_data IS NOT NULL
      ORDER BY f.freelancer_id
    `);
    
    console.log(`Found ${result.rows.length} freelancers with CV data`);
    
    let updatedCount = 0;
    
    for (const freelancer of result.rows) {
      const { freelancer_id, first_name, last_name, current_years, parsed_data } = freelancer;
      
      // Parse the JSON data
      let cvData;
      try {
        cvData = typeof parsed_data === 'string' ? JSON.parse(parsed_data) : parsed_data;
      } catch (error) {
        console.log(`❌ Error parsing CV data for ${first_name} ${last_name}:`, error.message);
        continue;
      }
      
      // Check if CV has years_experience
      const cvYears = cvData.years_experience;
      
      if (cvYears && cvYears > 0) {
        // Check if freelancer profile needs updating
        if (!current_years || current_years === 0 || current_years !== cvYears) {
          console.log(`📝 Updating ${first_name} ${last_name}:`);
          console.log(`   Current: ${current_years || 0} years`);
          console.log(`   CV Data: ${cvYears} years`);
          
          // Update the freelancer profile
          await db.query(
            'UPDATE "Freelancer" SET years_experience = $1 WHERE freelancer_id = $2',
            [cvYears, freelancer_id]
          );
          
          updatedCount++;
          console.log(`   ✅ Updated to ${cvYears} years`);
        } else {
          console.log(`✅ ${first_name} ${last_name}: Already correct (${cvYears} years)`);
        }
      } else {
        console.log(`⚠️  ${first_name} ${last_name}: No years_experience in CV data`);
      }
    }
    
    console.log(`\n🎉 Fix completed! Updated ${updatedCount} freelancer profiles.`);
    
  } catch (error) {
    console.error('❌ Error fixing years_experience:', error);
  } finally {
    process.exit(0);
  }
}

// Run the fix
fixYearsExperience();
