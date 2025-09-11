// Script to fix only address sync for all freelancers (without email field)
const db = require('./config/database');

async function fixAddressesOnly() {
  try {
    console.log('🔍 Fixing address sync for all freelancers...');
    
    // Get all freelancers with their CV data
    const result = await db.query(`
      SELECT 
        f.freelancer_id,
        f.first_name,
        f.last_name,
        f.address as freelancer_address,
        cv.parsed_data
      FROM "Freelancer" f
      LEFT JOIN "CV" cv ON f.freelancer_id = cv.freelancer_id
      WHERE cv.parsed_data IS NOT NULL
      ORDER BY f.first_name, f.last_name
    `);
    
    console.log(`📋 Found ${result.rows.length} freelancers with CV data`);
    console.log('=====================================');
    
    let updatedCount = 0;
    let alreadyCorrectCount = 0;
    let noAddressCount = 0;
    
    for (const freelancer of result.rows) {
      try {
        const cvData = typeof freelancer.parsed_data === 'string' 
          ? JSON.parse(freelancer.parsed_data) 
          : freelancer.parsed_data;
        
        const cvAddress = cvData.address;
        const freelancerAddress = freelancer.freelancer_address;
        
        console.log(`\n👤 ${freelancer.first_name} ${freelancer.last_name}:`);
        console.log(`   Freelancer Address: "${freelancerAddress}"`);
        console.log(`   CV Address: "${cvAddress}"`);
        
        if (cvAddress && cvAddress.trim()) {
          if (!freelancerAddress || freelancerAddress !== cvAddress) {
            console.log(`   📝 Updating address...`);
            
            await db.query(
              'UPDATE "Freelancer" SET address = $1, updated_at = CURRENT_TIMESTAMP WHERE freelancer_id = $2',
              [cvAddress, freelancer.freelancer_id]
            );
            
            console.log(`   ✅ Updated to: "${cvAddress}"`);
            updatedCount++;
          } else {
            console.log(`   ✅ Address already correct`);
            alreadyCorrectCount++;
          }
        } else {
          console.log(`   ⚠️ No address in CV data`);
          noAddressCount++;
        }
      } catch (error) {
        console.log(`   ❌ Error processing: ${error.message}`);
      }
    }
    
    console.log('\n=====================================');
    console.log('📊 ADDRESS SYNC SUMMARY:');
    console.log(`✅ Updated: ${updatedCount} freelancers`);
    console.log(`✅ Already correct: ${alreadyCorrectCount} freelancers`);
    console.log(`⚠️ No address in CV: ${noAddressCount} freelancers`);
    console.log(`📋 Total processed: ${result.rows.length} freelancers`);
    
  } catch (error) {
    console.error('❌ Error fixing addresses:', error);
  } finally {
    process.exit(0);
  }
}

// Run the fix
fixAddressesOnly();
