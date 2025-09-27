// test-contract-expiration-system.js
const { pool } = require('./config/database');
const { updateExpiredContracts, checkFreelancerAvailability } = require('./utils/contractManager');

async function testContractExpirationSystem() {
  let client;
  
  try {
    console.log('🧪 Testing Contract Expiration System...\n');
    
    client = await pool.connect();
    
    // Test 1: Check if the database function exists
    console.log('1️⃣ Testing database function existence...');
    try {
      const functionTest = await client.query('SELECT update_expired_contracts() as test_result');
      console.log('✅ Database function exists and is callable');
    } catch (error) {
      console.log('❌ Database function not found. Run the migration first.');
      console.log('   Run: node run-contract-expiration-migration.js');
      return;
    }
    
    // Test 2: Create test data (if needed)
    console.log('\n2️⃣ Checking for test data...');
    
    // Find a freelancer with active contracts
    const activeContractsResult = await client.query(
      `SELECT h.hire_id, h.freelancer_id, h.project_title, h.expected_end_date, h.status
       FROM "Freelancer_Hire" h 
       WHERE h.status = 'active' 
       ORDER BY h.hire_date DESC 
       LIMIT 5`
    );
    
    if (activeContractsResult.rowCount === 0) {
      console.log('⚠️ No active contracts found. Creating test data...');
      
      // Find a freelancer and associate to create test data
      const freelancerResult = await client.query('SELECT freelancer_id FROM "Freelancer" LIMIT 1');
      const associateResult = await client.query('SELECT associate_id FROM "Associate" LIMIT 1');
      
      if (freelancerResult.rowCount === 0 || associateResult.rowCount === 0) {
        console.log('❌ No freelancers or associates found. Cannot create test data.');
        return;
      }
      
      const freelancerId = freelancerResult.rows[0].freelancer_id;
      const associateId = associateResult.rows[0].associate_id;
      
      // Create a test contract that expired yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      await client.query(
        `INSERT INTO "Freelancer_Hire" 
         (associate_id, freelancer_id, project_title, expected_end_date, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [associateId, freelancerId, 'Test Expired Contract', yesterday.toISOString().split('T')[0], 'active']
      );
      
      console.log('✅ Created test contract with expired date');
    } else {
      console.log(`✅ Found ${activeContractsResult.rowCount} active contracts`);
      console.log('   Sample contracts:');
      activeContractsResult.rows.forEach((contract, index) => {
        console.log(`   ${index + 1}. Contract ${contract.hire_id}: "${contract.project_title}" (Ends: ${contract.expected_end_date || 'No end date'})`);
      });
    }
    
    // Test 3: Test the updateExpiredContracts function
    console.log('\n3️⃣ Testing updateExpiredContracts function...');
    const updateResult = await updateExpiredContracts();
    
    if (updateResult.success) {
      console.log(`✅ Function executed successfully: ${updateResult.message}`);
    } else {
      console.log(`❌ Function failed: ${updateResult.error}`);
    }
    
    // Test 4: Test freelancer availability checking
    console.log('\n4️⃣ Testing freelancer availability checking...');
    
    // Get a freelancer ID
    const freelancerResult = await client.query('SELECT freelancer_id FROM "Freelancer" LIMIT 1');
    
    if (freelancerResult.rowCount > 0) {
      const freelancerId = freelancerResult.rows[0].freelancer_id;
      const availabilityResult = await checkFreelancerAvailability(freelancerId);
      
      if (availabilityResult.success) {
        console.log(`✅ Availability check successful for freelancer ${freelancerId}`);
        console.log(`   Available: ${availabilityResult.is_available}`);
        console.log(`   Active contracts: ${availabilityResult.active_contracts.length}`);
        
        if (availabilityResult.active_contracts.length > 0) {
          console.log('   Active contracts:');
          availabilityResult.active_contracts.forEach((contract, index) => {
            console.log(`     ${index + 1}. "${contract.project_title}" (Ends: ${contract.expected_end_date || 'No end date'})`);
          });
        }
      } else {
        console.log(`❌ Availability check failed: ${availabilityResult.error}`);
      }
    }
    
    // Test 5: Check final state
    console.log('\n5️⃣ Checking final contract states...');
    
    const finalActiveContracts = await client.query(
      'SELECT COUNT(*) as count FROM "Freelancer_Hire" WHERE status = $1',
      ['active']
    );
    
    const finalCompletedContracts = await client.query(
      'SELECT COUNT(*) as count FROM "Freelancer_Hire" WHERE status = $1',
      ['completed']
    );
    
    console.log(`📊 Final Statistics:`);
    console.log(`   Active contracts: ${finalActiveContracts.rows[0].count}`);
    console.log(`   Completed contracts: ${finalCompletedContracts.rows[0].count}`);
    
    console.log('\n🎉 Contract Expiration System Test Completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testContractExpirationSystem()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = testContractExpirationSystem;
