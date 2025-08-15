const db = require('./config/database');

async function testRecommendationSystem() {
  try {
    console.log('🧪 Testing Freelancer Recommendation System...\n');

    // 1. Check if Freelancer_Recommendation table exists
    console.log('1. Checking Freelancer_Recommendation table...');
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'Freelancer_Recommendation'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Freelancer_Recommendation table exists');
    } else {
      console.log('❌ Freelancer_Recommendation table does not exist');
      return;
    }

    // 2. Check table structure
    console.log('\n2. Checking table structure...');
    const structureCheck = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Freelancer_Recommendation'
      ORDER BY ordinal_position;
    `);
    
    console.log('Table columns:');
    structureCheck.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    // 3. Check if there are any existing recommendations
    console.log('\n3. Checking existing recommendations...');
    const existingRecs = await db.query('SELECT COUNT(*) FROM "Freelancer_Recommendation"');
    console.log(`   Found ${existingRecs.rows[0].count} existing recommendations`);

    // 4. Check if there are any associate freelancer requests
    console.log('\n4. Checking associate freelancer requests...');
    const requests = await db.query('SELECT COUNT(*) FROM "Associate_Freelancer_Request"');
    console.log(`   Found ${requests.rows[0].count} associate freelancer requests`);

    // 5. Check if there are any freelancers available
    console.log('\n5. Checking available freelancers...');
    const freelancers = await db.query('SELECT COUNT(*) FROM "Freelancer"');
    console.log(`   Found ${freelancers.rows[0].count} freelancers`);

    // 6. Check if there are any associates
    console.log('\n6. Checking associates...');
    const associates = await db.query('SELECT COUNT(*) FROM "Associate"');
    console.log(`   Found ${associates.rows[0].count} associates`);

    // 7. Check if there are any ECS Employees
    console.log('\n7. Checking ECS Employees...');
    const ecsEmployees = await db.query(`
      SELECT COUNT(*) FROM "User" WHERE user_type = 'ecs_employee'
    `);
    console.log(`   Found ${ecsEmployees.rows[0].count} ECS Employees`);

    // 8. Check sample data structure
    console.log('\n8. Checking sample data...');
    
    if (freelancers.rows[0].count > 0) {
      const sampleFreelancer = await db.query(`
        SELECT f.freelancer_id, f.first_name, f.last_name, f.headline, f.phone,
               u.email, u.is_verified
        FROM "Freelancer" f
        JOIN "User" u ON f.user_id = u.user_id
        LIMIT 1
      `);
      
      if (sampleFreelancer.rows[0]) {
        console.log('   Sample freelancer:');
        console.log(`     ID: ${sampleFreelancer.rows[0].freelancer_id}`);
        console.log(`     Name: ${sampleFreelancer.rows[0].first_name} ${sampleFreelancer.rows[0].last_name}`);
        console.log(`     Headline: ${sampleFreelancer.rows[0].headline || 'N/A'}`);
        console.log(`     Email: ${sampleFreelancer.rows[0].email}`);
        console.log(`     Phone: ${sampleFreelancer.rows[0].phone || 'N/A'}`);
        console.log(`     Verified: ${sampleFreelancer.rows[0].is_verified ? 'Yes' : 'No'}`);
      }
    }

         if (requests.rows[0].count > 0) {
       const sampleRequest = await db.query(`
         SELECT r.request_id, r.title, r.description, r.status, r.created_at,
                a.contact_person
         FROM "Associate_Freelancer_Request" r
         JOIN "Associate" a ON r.associate_id = a.associate_id
         LIMIT 1
       `);
       
       if (sampleRequest.rows[0]) {
         console.log('\n   Sample request:');
         console.log(`     ID: ${sampleRequest.rows[0].request_id}`);
         console.log(`     Title: ${sampleRequest.rows[0].title}`);
         console.log(`     Status: ${sampleRequest.rows[0].status}`);
         console.log(`     Contact: ${sampleRequest.rows[0].contact_person || 'N/A'}`);
         console.log(`     Created: ${sampleRequest.rows[0].created_at}`);
       }
     }

    console.log('\n✅ Recommendation system test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Freelancer_Recommendation table: ✅ Exists`);
    console.log(`   - Freelancers available: ${freelancers.rows[0].count}`);
    console.log(`   - Associate requests: ${requests.rows[0].count}`);
    console.log(`   - Associates: ${associates.rows[0].count}`);
    console.log(`   - ECS Employees: ${ecsEmployees.rows[0].count}`);
    console.log(`   - Existing recommendations: ${existingRecs.rows[0].count}`);

     } catch (error) {
     console.error('❌ Test failed:', error);
   }
 }

testRecommendationSystem();
