const db = require('./config/database');

async function testSearchData() {
  try {
    console.log('🔍 Testing freelancer data structure...');
    
    // Test basic freelancer query
    const result = await db.query(`
      SELECT 
        f.freelancer_id,
        f.first_name,
        f.last_name,
        f.headline,
        f.years_experience,
        f.is_approved,
        f.is_available,
        f.admin_rating,
        ARRAY[f.headline, f.current_status] as skills,
        f.address as location
      FROM "Freelancer" f
      JOIN "User" u ON f.user_id = u.user_id
      WHERE u.is_active = true
      LIMIT 5
    `);
    
    console.log('✅ Query successful');
    console.log('📊 Found freelancers:', result.rows.length);
    
    if (result.rows.length > 0) {
      console.log('\n🔍 Sample freelancer data:');
      const sample = result.rows[0];
      console.log('ID:', sample.freelancer_id);
      console.log('Name:', sample.first_name, sample.last_name);
      console.log('Headline:', sample.headline);
      console.log('Experience:', sample.years_experience);
      console.log('Approved:', sample.is_approved);
      console.log('Available:', sample.is_available);
      console.log('Admin Rating:', sample.admin_rating);
      console.log('Skills array:', sample.skills);
      console.log('Location:', sample.location);
      
      // Test search functionality
      console.log('\n🔍 Testing search functionality...');
      
      // Test skills search
      const skillsResult = await db.query(`
        SELECT COUNT(*) as count
        FROM "Freelancer" f
        JOIN "User" u ON f.user_id = u.user_id
        WHERE u.is_active = true
        AND (
          f.headline ILIKE $1 
          OR f.current_status ILIKE $1
        )
      `, ['%developer%']);
      
      console.log('🔍 Freelancers with "developer" in skills:', skillsResult.rows[0].count);
      
      // Test experience filter
      const expResult = await db.query(`
        SELECT COUNT(*) as count
        FROM "Freelancer" f
        JOIN "User" u ON f.user_id = u.user_id
        WHERE u.is_active = true
        AND f.years_experience >= $1
      `, [3]);
      
      console.log('🔍 Freelancers with 3+ years experience:', expResult.rows[0].count);
      
      // Test status filter
      const statusResult = await db.query(`
        SELECT COUNT(*) as count
        FROM "Freelancer" f
        JOIN "User" u ON f.user_id = u.user_id
        WHERE u.is_active = true
        AND f.is_available = true
      `);
      
      console.log('🔍 Available freelancers:', statusResult.rows[0].count);
      
    } else {
      console.log('❌ No freelancers found in database');
    }
    
  } catch (error) {
    console.error('❌ Error testing search data:', error);
  }
}

testSearchData();
