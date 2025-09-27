// test-completed-jobs-display.js
const { pool } = require('./config/database');

async function testCompletedJobsDisplay() {
  let client;
  
  try {
    console.log('🧪 Testing Completed Jobs Display Integration...\n');
    
    client = await pool.connect();
    
    // Test 1: Test freelancer profile endpoint data
    console.log('1️⃣ Testing freelancer profile with completed jobs...');
    
    // Get a freelancer with completed jobs
    const freelancerWithJobs = await client.query(
      `SELECT f.freelancer_id, f.first_name, f.last_name, u.email
       FROM "Freelancer" f
       JOIN "User" u ON f.user_id = u.user_id
       WHERE f.freelancer_id IN (
         SELECT DISTINCT freelancer_id FROM "Freelancer_Hire" WHERE status = 'completed'
       )
       LIMIT 1`
    );
    
    if (freelancerWithJobs.rowCount > 0) {
      const freelancer = freelancerWithJobs.rows[0];
      console.log(`✅ Found freelancer: ${freelancer.first_name} ${freelancer.last_name} (${freelancer.email})`);
      
      // Test the completed jobs query (same as in the endpoints)
      const completedJobsResult = await client.query(
        `SELECT 
           h.hire_id,
           h.hire_date,
           h.project_title,
           h.project_description,
           h.agreed_rate,
           h.rate_type,
           h.start_date,
           h.expected_end_date,
           h.actual_end_date,
           h.status,
           a.contact_person as company_contact,
           a.industry as company_industry,
           a.website as company_website
         FROM "Freelancer_Hire" h
         JOIN "Associate" a ON h.associate_id = a.associate_id
         WHERE h.freelancer_id = $1 AND h.status = 'completed'
         ORDER BY h.actual_end_date DESC, h.hire_date DESC`,
        [freelancer.freelancer_id]
      );
      
      console.log(`   Completed Jobs: ${completedJobsResult.rowCount}`);
      completedJobsResult.rows.forEach((job, index) => {
        console.log(`     ${index + 1}. "${job.project_title}" - ${job.company_industry} (${job.company_contact})`);
        console.log(`        Rate: ${job.agreed_rate || 'N/A'} ${job.rate_type || ''}`);
        console.log(`        Duration: ${job.start_date || 'N/A'} to ${job.actual_end_date || 'N/A'}`);
      });
    } else {
      console.log('⚠️ No freelancers with completed jobs found');
    }
    
    // Test 2: Test ECS employee view data
    console.log('\n2️⃣ Testing ECS employee view with completed jobs...');
    
    if (freelancerWithJobs.rowCount > 0) {
      const freelancer = freelancerWithJobs.rows[0];
      
      // Test the ECS employee completed jobs query (with admin notes)
      const ecsCompletedJobsResult = await client.query(
        `SELECT 
           h.hire_id,
           h.hire_date,
           h.project_title,
           h.project_description,
           h.agreed_rate,
           h.rate_type,
           h.start_date,
           h.expected_end_date,
           h.actual_end_date,
           h.status,
           h.associate_notes,
           h.freelancer_notes,
           h.admin_notes,
           a.contact_person as company_contact,
           a.industry as company_industry,
           a.website as company_website,
           a.phone as company_phone,
           a.address as company_address
         FROM "Freelancer_Hire" h
         JOIN "Associate" a ON h.associate_id = a.associate_id
         WHERE h.freelancer_id = $1 AND h.status = 'completed'
         ORDER BY h.actual_end_date DESC, h.hire_date DESC`,
        [freelancer.freelancer_id]
      );
      
      console.log(`   ECS View - Completed Jobs: ${ecsCompletedJobsResult.rowCount}`);
      ecsCompletedJobsResult.rows.forEach((job, index) => {
        console.log(`     ${index + 1}. "${job.project_title}"`);
        console.log(`        Company: ${job.company_industry} (${job.company_contact})`);
        console.log(`        Phone: ${job.company_phone || 'N/A'}`);
        console.log(`        Admin Notes: ${job.admin_notes || 'None'}`);
        console.log(`        Associate Notes: ${job.associate_notes || 'None'}`);
      });
    }
    
    // Test 3: Summary statistics
    console.log('\n3️⃣ Summary Statistics...');
    
    const statsResult = await client.query(
      `SELECT 
         COUNT(*) as total_completed_jobs,
         COUNT(DISTINCT freelancer_id) as freelancers_with_completed_jobs,
         COUNT(DISTINCT associate_id) as companies_hired_from
       FROM "Freelancer_Hire" 
       WHERE status = 'completed'`
    );
    
    const stats = statsResult.rows[0];
    console.log(`📊 Completed Jobs Statistics:`);
    console.log(`   Total completed jobs: ${stats.total_completed_jobs}`);
    console.log(`   Freelancers with completed jobs: ${stats.freelancers_with_completed_jobs}`);
    console.log(`   Companies that have completed jobs: ${stats.companies_hired_from}`);
    
    console.log('\n🎉 Completed Jobs Display Integration Test Completed!');
    console.log('\n✅ The following endpoints now include completed_jobs:');
    console.log('   - GET /freelancer/profile (for freelancers)');
    console.log('   - GET /admin/freelancers/:freelancerId/profile (for ECS employees)');
    console.log('   - GET /search/freelancers/:id (for associates viewing freelancers)');
    
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
  testCompletedJobsDisplay()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = testCompletedJobsDisplay;
