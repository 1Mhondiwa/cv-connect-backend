// Script to check Sipho Dlamini's profile data
const db = require('./config/database');

async function checkSiphoData() {
  try {
    console.log('🔍 Checking Sipho Dlamini\'s profile data...');
    
    // Get Sipho Dlamini's profile data
    const result = await db.query(`
      SELECT 
        f.freelancer_id,
        f.user_id,
        f.first_name,
        f.last_name,
        f.address as freelancer_address,
        f.years_experience,
        cv.parsed_data
      FROM "Freelancer" f
      LEFT JOIN "CV" cv ON f.freelancer_id = cv.freelancer_id
      WHERE f.first_name = 'Sipho' AND f.last_name = 'Dlamini'
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Sipho Dlamini not found');
      return;
    }
    
    const sipho = result.rows[0];
    console.log('📋 Sipho Dlamini\'s Profile Data:');
    console.log('=====================================');
    console.log(`Freelancer ID: ${sipho.freelancer_id}`);
    console.log(`User ID: ${sipho.user_id}`);
    console.log(`Name: ${sipho.first_name} ${sipho.last_name}`);
    console.log(`Freelancer Address: "${sipho.freelancer_address}"`);
    console.log(`Years Experience: ${sipho.years_experience}`);
    
    if (sipho.parsed_data) {
      let cvData;
      try {
        cvData = typeof sipho.parsed_data === 'string' ? JSON.parse(sipho.parsed_data) : sipho.parsed_data;
        console.log(`CV Address: "${cvData.address}"`);
        console.log(`CV Email: "${cvData.email}"`);
        console.log(`CV Phone: "${cvData.phone}"`);
      } catch (error) {
        console.log('❌ Error parsing CV data:', error.message);
      }
    } else {
      console.log('❌ No CV data found');
    }
    
    console.log('=====================================');
    
  } catch (error) {
    console.error('❌ Error checking Sipho data:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkSiphoData();
