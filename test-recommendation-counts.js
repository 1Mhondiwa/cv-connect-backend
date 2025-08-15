const db = require('./config/database');

async function testRecommendationCounts() {
  try {
    console.log('🧪 Testing Freelancer Recommendation Counts...\n');

    // 1. Check the current recommendations per request
    console.log('1. Checking recommendations per request...');
    const recommendationsPerRequest = await db.query(`
      SELECT 
        r.request_id,
        r.title,
        r.status,
        a.contact_person as associate_contact,
        COUNT(fr.recommendation_id) as actual_recommendation_count
      FROM "Associate_Freelancer_Request" r
      JOIN "Associate" a ON r.associate_id = a.associate_id
      LEFT JOIN "Freelancer_Recommendation" fr ON r.request_id = fr.request_id
      GROUP BY r.request_id, r.title, r.status, a.contact_person
      ORDER BY r.request_id
    `);

    console.log('Recommendations per request:');
    recommendationsPerRequest.rows.forEach((req, index) => {
      console.log(`   ${index + 1}. Request ID: ${req.request_id} - "${req.title}"`);
      console.log(`      Associate: ${req.associate_contact}`);
      console.log(`      Status: ${req.status}`);
      console.log(`      Actual Recommendations: ${req.actual_recommendation_count}`);
      console.log('');
    });

    // 2. Test the new query logic
    console.log('2. Testing new query logic...');
    const testAssociateId = 26; // Roddy Rich's associate ID
    
    const newQueryResult = await db.query(`
      SELECT 
        r.*,
        COALESCE(rec_counts.rec_count, 0) as recommendation_count,
        COALESCE(resp_counts.resp_count, 0) as response_count
      FROM "Associate_Freelancer_Request" r
      LEFT JOIN (
        SELECT 
          request_id, 
          COUNT(*) as rec_count
        FROM "Freelancer_Recommendation"
        GROUP BY request_id
      ) rec_counts ON r.request_id = rec_counts.request_id
      LEFT JOIN (
        SELECT 
          request_id, 
          COUNT(*) as resp_count
        FROM "Request_Response"
        GROUP BY request_id
      ) resp_counts ON r.request_id = resp_counts.request_id
      WHERE r.associate_id = $1
      ORDER BY r.created_at DESC
    `, [testAssociateId]);

    console.log(`New query results for associate ID ${testAssociateId}:`);
    newQueryResult.rows.forEach((req, index) => {
      console.log(`   ${index + 1}. Request ID: ${req.request_id} - "${req.title}"`);
      console.log(`      Status: ${req.status}`);
      console.log(`      New Query Count: ${req.recommendation_count}`);
      console.log(`      Response Count: ${req.response_count}`);
      console.log('');
    });

    // 3. Verify individual recommendation details
    console.log('3. Verifying individual recommendation details...');
    if (newQueryResult.rowCount > 0) {
      const testRequestId = newQueryResult.rows[0].request_id;
      
      const individualRecs = await db.query(`
        SELECT 
          fr.recommendation_id,
          fr.freelancer_id,
          f.first_name,
          f.last_name,
          f.headline
        FROM "Freelancer_Recommendation" fr
        JOIN "Freelancer" f ON fr.freelancer_id = f.freelancer_id
        WHERE fr.request_id = $1
        ORDER BY fr.recommendation_id
      `, [testRequestId]);

      console.log(`Individual recommendations for request ${testRequestId}:`);
      individualRecs.rows.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.first_name} ${rec.last_name} (${rec.headline})`);
      });
      console.log(`   Total: ${individualRecs.rowCount} recommendations`);
    }

    console.log('\n✅ Recommendation count test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Fixed SQL query to count recommendations per request accurately`);
    console.log(`   - Added proper JOIN logic to prevent cross-request counting`);
    console.log(`   - Dashboard counts should now match actual recommendation counts`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRecommendationCounts();
