const { pool } = require('./config/database');

async function testAnalyticsEndpoints() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing analytics endpoints...\n');
    
    // Test 1: User Registration Trends
    console.log('📊 1. Testing User Registration Trends:');
    try {
      const userResult = await client.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_users,
          COUNT(CASE WHEN user_type = 'associate' THEN 1 END) as associates,
          COUNT(CASE WHEN user_type = 'freelancer' THEN 1 END) as freelancers,
          COUNT(CASE WHEN user_type = 'admin' THEN 1 END) as admins
        FROM "User"
        WHERE created_at >= '2025-06-19' AND created_at <= NOW()
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);
      
      console.log(`✅ Success: ${userResult.rows.length} date records found`);
      if (userResult.rows.length > 0) {
        console.log(`   Sample: ${userResult.rows[0].date} - ${userResult.rows[0].total_users} users`);
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
    
    // Test 2: CV Upload Trends
    console.log('\n📊 2. Testing CV Upload Trends:');
    try {
      const cvResult = await client.query(`
        SELECT 
          DATE(upload_date) as date,
          COUNT(*) as uploads,
          COUNT(CASE WHEN is_approved = true THEN 1 END) as approved,
          COUNT(CASE WHEN is_approved = false THEN 1 END) as rejected
        FROM "CV"
        WHERE upload_date >= '2025-06-19' AND upload_date <= NOW()
        GROUP BY DATE(upload_date)
        ORDER BY date ASC
      `);
      
      console.log(`✅ Success: ${cvResult.rows.length} date records found`);
      if (cvResult.rows.length > 0) {
        console.log(`   Sample: ${cvResult.rows[0].date} - ${cvResult.rows[0].uploads} uploads`);
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
    
    // Test 3: Message Trends
    console.log('\n📊 3. Testing Message Trends:');
    try {
      const messageResult = await client.query(`
        SELECT 
          DATE(sent_at) as date,
          COUNT(*) as messages,
          COUNT(DISTINCT conversation_id) as conversations
        FROM "Message"
        WHERE sent_at >= '2025-06-19' AND sent_at <= NOW()
        GROUP BY DATE(sent_at)
        ORDER BY date ASC
      `);
      
      console.log(`✅ Success: ${messageResult.rows.length} date records found`);
      if (messageResult.rows.length > 0) {
        console.log(`   Sample: ${messageResult.rows[0].date} - ${messageResult.rows[0].messages} messages`);
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
    
    // Test 4: Hired Freelancers Trends
    console.log('\n📊 4. Testing Hired Freelancers Trends:');
    try {
      const hireResult = await client.query(`
        SELECT 
          DATE(hire_date) as date,
          COUNT(*) as hires,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_hires,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_hires
        FROM "Freelancer_Hire"
        WHERE hire_date >= '2025-06-19' AND hire_date <= NOW()
        GROUP BY DATE(hire_date)
        ORDER BY date ASC
      `);
      
      console.log(`✅ Success: ${hireResult.rows.length} date records found`);
      if (hireResult.rows.length > 0) {
        console.log(`   Sample: ${hireResult.rows[0].date} - ${hireResult.rows[0].hires} hires`);
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
    
    // Test 5: Top Skills
    console.log('\n📊 5. Testing Top Skills:');
    try {
      // First check if Skills table exists
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'Skill'
        );
      `);
      
      if (tableExists.rows[0].exists) {
        const skillsResult = await client.query(`
          SELECT 
            skill_name as skill,
            COUNT(*) as count
          FROM "Skill"
          GROUP BY skill_name
          ORDER BY count DESC
          LIMIT 10
        `);
        console.log(`✅ Success: ${skillsResult.rows.length} skills found`);
      } else {
        // Try to get skills from CV parsed_data
        const skillsResult = await client.query(`
          SELECT 
            skill->>'name' as skill,
            COUNT(*) as count
          FROM "CV", jsonb_array_elements(parsed_data->'skills') as skill
          WHERE parsed_data->'skills' IS NOT NULL
          GROUP BY skill->>'name'
          ORDER BY count DESC
          LIMIT 10
        `);
        console.log(`✅ Success: ${skillsResult.rows.length} skills from CV data found`);
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
    
    // Test 6: CV File Types
    console.log('\n📊 6. Testing CV File Types:');
    try {
      const fileTypeResult = await client.query(`
        SELECT 
          file_type as type,
          COUNT(*) as count
        FROM "CV"
        GROUP BY file_type
        ORDER BY count DESC
      `);
      
      console.log(`✅ Success: ${fileTypeResult.rows.length} file types found`);
      if (fileTypeResult.rows.length > 0) {
        console.log(`   Sample: ${fileTypeResult.rows[0].type} - ${fileTypeResult.rows[0].count} files`);
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
    
    // Test 7: User Communication Activity
    console.log('\n📊 7. Testing User Communication Activity:');
    try {
      const commResult = await client.query(`
        SELECT 
          CASE 
            WHEN u.user_type = 'associate' THEN COALESCE(a.contact_person, u.email)
            WHEN u.user_type = 'freelancer' THEN COALESCE(f.first_name || ' ' || f.last_name, u.email)
            ELSE u.email
          END as user,
          COUNT(m.message_id) as messages,
          COUNT(DISTINCT m.conversation_id) as conversations
        FROM "User" u
        LEFT JOIN "Message" m ON u.user_id = m.sender_id
        LEFT JOIN "Associate" a ON u.user_id = a.user_id
        LEFT JOIN "Freelancer" f ON u.user_id = f.user_id
        WHERE m.message_id IS NOT NULL
        GROUP BY u.user_id, u.user_type, a.contact_person, f.first_name, f.last_name, u.email
        ORDER BY messages DESC
        LIMIT 10
      `);
      
      console.log(`✅ Success: ${commResult.rows.length} users with communication activity found`);
      if (commResult.rows.length > 0) {
        console.log(`   Sample: ${commResult.rows[0].user} - ${commResult.rows[0].messages} messages`);
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing analytics endpoints:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testAnalyticsEndpoints();

