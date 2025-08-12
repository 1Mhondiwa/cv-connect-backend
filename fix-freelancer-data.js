const db = require('./config/database');

async function fixFreelancerData() {
  try {
    console.log('🔧 Fixing freelancer data...');
    
    // Update freelancers with sample data
    const result = await db.query(`
      UPDATE "Freelancer" 
      SET 
        headline = CASE 
          WHEN headline IS NULL THEN 'Software Developer'
          ELSE headline
        END,
        current_status = CASE 
          WHEN current_status IS NULL THEN 'Full Stack Developer'
          ELSE current_status
        END,
        years_experience = CASE 
          WHEN years_experience IS NULL THEN 3
          ELSE years_experience
        END,
        address = CASE 
          WHEN address IS NULL THEN 'Remote'
          ELSE address
        END,
        is_approved = true,
        admin_rating = 3
      WHERE headline IS NULL 
         OR current_status IS NULL 
         OR years_experience IS NULL
    `);
    
    console.log('✅ Updated freelancers:', result.rowCount);
    
    // Verify the fix
    const verify = await db.query(`
      SELECT 
        f.freelancer_id,
        f.first_name,
        f.last_name,
        f.headline,
        f.years_experience,
        f.current_status,
        ARRAY[f.headline, f.current_status] as skills
      FROM "Freelancer" f
      LIMIT 3
    `);
    
    console.log('🔍 Verification - Sample data:');
    verify.rows.forEach(row => {
      console.log(`${row.first_name}: ${row.headline}, ${row.years_experience} years, Skills: [${row.skills}]`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing data:', error);
  }
}

fixFreelancerData();
