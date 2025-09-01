const db = require('./config/database');

async function fixFreelancerData() {
  try {
    console.log('🔧 Fixing freelancer data...');
    
    // Update freelancers with basic data (removed default headline/current_status assumptions)
    const result = await db.query(`
      UPDATE "Freelancer" 
      SET 
        years_experience = CASE 
          WHEN years_experience IS NULL THEN 0
          ELSE years_experience
        END,
        address = CASE 
          WHEN address IS NULL THEN 'Not specified'
          ELSE address
        END,
        is_approved = true,
        admin_rating = 3
      WHERE years_experience IS NULL 
         OR address IS NULL
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
        f.address
      FROM "Freelancer" f
      LIMIT 3
    `);
    
    console.log('🔍 Verification - Sample data:');
    verify.rows.forEach(row => {
      console.log(`${row.first_name}: ${row.headline || 'No headline'}, ${row.years_experience} years, Status: ${row.current_status || 'Not set'}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing data:', error);
  }
}

fixFreelancerData();

