// Script to fix Sipho Dlamini's address from CV data
const db = require('./config/database');

async function fixSiphoAddress() {
  try {
    console.log('🔍 Checking and fixing Sipho Dlamini\'s address...');
    
    // Get Sipho Dlamini's data
    const result = await db.query(`
      SELECT 
        f.freelancer_id,
        f.first_name,
        f.last_name,
        f.address as freelancer_address,
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
    console.log(`📋 Found: ${sipho.first_name} ${sipho.last_name}`);
    console.log(`Current Freelancer Address: "${sipho.freelancer_address}"`);
    
    if (sipho.parsed_data) {
      let cvData;
      try {
        cvData = typeof sipho.parsed_data === 'string' ? JSON.parse(sipho.parsed_data) : sipho.parsed_data;
        console.log(`CV Address: "${cvData.address}"`);
        
        // Check if we need to update the address
        if (cvData.address && cvData.address.trim()) {
          if (!sipho.freelancer_address || sipho.freelancer_address !== cvData.address) {
            console.log('📝 Updating address from CV data...');
            
            await db.query(
              'UPDATE "Freelancer" SET address = $1 WHERE freelancer_id = $2',
              [cvData.address, sipho.freelancer_id]
            );
            
            console.log(`✅ Updated address to: "${cvData.address}"`);
          } else {
            console.log('✅ Address is already correct');
          }
        } else {
          console.log('⚠️ No address found in CV data');
        }
      } catch (error) {
        console.log('❌ Error parsing CV data:', error.message);
      }
    } else {
      console.log('❌ No CV data found');
    }
    
  } catch (error) {
    console.error('❌ Error fixing address:', error);
  } finally {
    process.exit(0);
  }
}

// Run the fix
fixSiphoAddress();
