// check-completed-freelancers.js
const { pool } = require('./config/database');

async function getCompletedFreelancers() {
  let client;
  
  try {
    console.log('🔍 Finding freelancers with completed contracts...\n');
    
    client = await pool.connect();
    
    // Get all completed contracts with freelancer details
    const result = await client.query(`
      SELECT 
        h.hire_id,
        h.freelancer_id,
        h.project_title,
        h.expected_end_date,
        h.actual_end_date,
        h.status,
        h.updated_at,
        f.first_name,
        f.last_name,
        u.email as freelancer_email,
        a.contact_person as associate_name,
        a.industry as company_industry
      FROM "Freelancer_Hire" h
      JOIN "Freelancer" f ON h.freelancer_id = f.freelancer_id
      JOIN "User" u ON f.user_id = u.user_id
      JOIN "Associate" a ON h.associate_id = a.associate_id
      WHERE h.status = 'completed'
      ORDER BY h.updated_at DESC, f.first_name, f.last_name
    `);
    
    if (result.rowCount === 0) {
      console.log('❌ No completed contracts found');
      return;
    }
    
    console.log(`✅ Found ${result.rowCount} completed contracts:\n`);
    
    // Group by freelancer
    const freelancerMap = new Map();
    
    result.rows.forEach(contract => {
      const freelancerId = contract.freelancer_id;
      const freelancerKey = `${contract.first_name} ${contract.last_name} (${contract.freelancer_email})`;
      
      if (!freelancerMap.has(freelancerId)) {
        freelancerMap.set(freelancerId, {
          name: freelancerKey,
          contracts: []
        });
      }
      
      freelancerMap.get(freelancerId).contracts.push({
        hire_id: contract.hire_id,
        project_title: contract.project_title,
        expected_end_date: contract.expected_end_date,
        actual_end_date: contract.actual_end_date,
        updated_at: contract.updated_at,
        associate_name: contract.associate_name,
        company_industry: contract.company_industry
      });
    });
    
    // Display results
    let totalCompleted = 0;
    freelancerMap.forEach((freelancer, freelancerId) => {
      console.log(`👤 Freelancer: ${freelancer.name}`);
      console.log(`   ID: ${freelancerId}`);
      console.log(`   Completed Contracts: ${freelancer.contracts.length}`);
      console.log(`   Details:`);
      
      freelancer.contracts.forEach((contract, index) => {
        console.log(`     ${index + 1}. Contract #${contract.hire_id}: "${contract.project_title}"`);
        console.log(`        Expected End: ${contract.expected_end_date || 'No end date'}`);
        console.log(`        Actual End: ${contract.actual_end_date || 'Not set'}`);
        console.log(`        Updated: ${contract.updated_at}`);
        console.log(`        Company: ${contract.company_industry} (${contract.associate_name})`);
        console.log(``);
      });
      
      totalCompleted += freelancer.contracts.length;
      console.log(`   ────────────────────────────────────────────────────────────────\n`);
    });
    
    console.log(`📊 Summary:`);
    console.log(`   Total Freelancers with completed contracts: ${freelancerMap.size}`);
    console.log(`   Total completed contracts: ${totalCompleted}`);
    
    // Also show recently updated contracts (likely the ones updated by our system)
    console.log(`\n🕐 Recently Updated Contracts (likely from our system):`);
    const recentResult = await client.query(`
      SELECT 
        h.hire_id,
        h.freelancer_id,
        h.project_title,
        h.expected_end_date,
        h.actual_end_date,
        h.updated_at,
        f.first_name,
        f.last_name,
        u.email as freelancer_email
      FROM "Freelancer_Hire" h
      JOIN "Freelancer" f ON h.freelancer_id = f.freelancer_id
      JOIN "User" u ON f.user_id = u.user_id
      WHERE h.status = 'completed' 
      AND h.updated_at >= CURRENT_DATE - INTERVAL '1 day'
      ORDER BY h.updated_at DESC
    `);
    
    if (recentResult.rowCount > 0) {
      console.log(`\n   Recently updated contracts (last 24 hours):`);
      recentResult.rows.forEach((contract, index) => {
        console.log(`   ${index + 1}. ${contract.first_name} ${contract.last_name} - "${contract.project_title}"`);
        console.log(`      Expected End: ${contract.expected_end_date}`);
        console.log(`      Updated: ${contract.updated_at}`);
      });
    } else {
      console.log(`   No contracts updated in the last 24 hours`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  getCompletedFreelancers()
    .then(() => {
      console.log('\n✅ Query completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Query failed:', error);
      process.exit(1);
    });
}

module.exports = getCompletedFreelancers;
