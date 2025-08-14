const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function testOperationsData() {
  const client = await pool.connect();
  try {
    console.log('🧪 Testing Operations Data Queries...\n');

    // Test 1: Workflow Efficiency Metrics
    console.log('📊 1. TESTING WORKFLOW EFFICIENCY:');
    try {
      const workflowResult = await client.query(`
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN sent_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_messages,
          COUNT(CASE WHEN sent_at >= CURRENT_DATE - INTERVAL '24 hours' THEN 1 END) as today_messages,
          COUNT(DISTINCT conversation_id) as active_conversations,
          COUNT(DISTINCT sender_id) as active_users
        FROM "Message"
        WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days'
      `);
      
      console.log('✅ Workflow query successful!');
      console.log(`   Total Messages: ${workflowResult.rows[0].total_messages}`);
      console.log(`   Recent Messages (7d): ${workflowResult.rows[0].recent_messages}`);
      console.log(`   Today Messages: ${workflowResult.rows[0].today_messages}`);
      console.log(`   Active Conversations: ${workflowResult.rows[0].active_conversations}`);
      console.log(`   Active Users: ${workflowResult.rows[0].active_users}\n`);
    } catch (error) {
      console.log('❌ Workflow query failed:', error.message);
    }

    // Test 2: Response Time Calculation
    console.log('⏱️ 2. TESTING RESPONSE TIME CALCULATION:');
    try {
      const responseTimeResult = await client.query(`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (m2.sent_at - m1.sent_at))/3600) as avg_response_hours
        FROM "Message" m1
        JOIN "Message" m2 ON m1.conversation_id = m2.conversation_id 
          AND m2.sent_at > m1.sent_at
          AND m2.sender_id != m1.sender_id
        WHERE m1.sent_at >= CURRENT_DATE - INTERVAL '30 days'
      `);
      
      console.log('✅ Response time query successful!');
      const avgHours = responseTimeResult.rows[0].avg_response_hours;
      if (avgHours && avgHours > 0) {
        console.log(`   Average Response Time: ${parseFloat(avgHours).toFixed(2)} hours\n`);
      } else {
        console.log(`   Average Response Time: No response data available (conversations may be one-sided)\n`);
      }
    } catch (error) {
      console.log('❌ Response time query failed:', error.message);
    }

    // Test 3: Quality Metrics
    console.log('🎯 3. TESTING QUALITY METRICS:');
    try {
      const qualityResult = await client.query(`
        SELECT 
          COUNT(CASE WHEN content ILIKE '%error%' OR content ILIKE '%issue%' OR content ILIKE '%problem%' THEN 1 END) as error_messages,
          COUNT(*) as total_messages,
          AVG(LENGTH(content)) as avg_message_length
        FROM "Message"
        WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days'
      `);
      
      console.log('✅ Quality metrics query successful!');
      const total = parseInt(qualityResult.rows[0].total_messages);
      const errors = parseInt(qualityResult.rows[0].error_messages);
      const errorRate = total > 0 ? ((errors / total) * 100).toFixed(1) : 0;
      console.log(`   Total Messages: ${total}`);
      console.log(`   Error Messages: ${errors}`);
      console.log(`   Error Rate: ${errorRate}%\n`);
    } catch (error) {
      console.log('❌ Quality metrics query failed:', error.message);
    }

    // Test 4: User Engagement
    console.log('👥 4. TESTING USER ENGAGEMENT:');
    try {
      const userEngagement = await client.query(`
        SELECT 
          COUNT(DISTINCT sender_id) as active_users,
          COUNT(DISTINCT conversation_id) as active_conversations
        FROM "Message"
        WHERE sent_at >= CURRENT_DATE - INTERVAL '7 days'
      `);
      
      const totalUsers = await client.query(`SELECT COUNT(*) as count FROM "User" WHERE user_type IN ('associate', 'freelancer')`);
      
      console.log('✅ User engagement query successful!');
      const activeUsers = parseInt(userEngagement.rows[0].active_users);
      const totalUserCount = parseInt(totalUsers.rows[0].count);
      const satisfactionScore = totalUserCount > 0 ? ((activeUsers / totalUserCount) * 5).toFixed(1) : 0;
      console.log(`   Active Users (7d): ${activeUsers}`);
      console.log(`   Total Users: ${totalUserCount}`);
      console.log(`   User Satisfaction Score: ${satisfactionScore}/5.0\n`);
    } catch (error) {
      console.log('❌ User engagement query failed:', error.message);
    }

    // Test 5: Sample Data Verification
    console.log('🔍 5. VERIFYING SAMPLE DATA:');
    try {
      const sampleMessages = await client.query(`
        SELECT 
          m.content,
          m.sent_at,
          u.user_type,
          CASE 
            WHEN u.user_type = 'associate' THEN a.contact_person
            WHEN u.user_type = 'freelancer' THEN f.first_name || ' ' || f.last_name
            ELSE u.email
          END as sender_name
        FROM "Message" m
        JOIN "User" u ON m.sender_id = u.user_id
        LEFT JOIN "Associate" a ON u.user_id = a.user_id
        LEFT JOIN "Freelancer" f ON u.user_id = f.user_id
        ORDER BY m.sent_at DESC
        LIMIT 3
      `);
      
      console.log('✅ Sample data query successful!');
      console.log('   Recent messages:');
      sampleMessages.rows.forEach((msg, index) => {
        console.log(`     ${index + 1}. ${msg.sender_name} (${msg.user_type}): "${msg.content.substring(0, 50)}..."`);
      });
      console.log();
    } catch (error) {
      console.log('❌ Sample data query failed:', error.message);
    }

    console.log('✅ All operations data tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testOperationsData();
