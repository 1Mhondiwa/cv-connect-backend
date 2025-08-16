const { pool } = require('./config/database');

async function checkAnalyticsData() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking real analytics data in your database...\n');
    
    // 1. Check User Registration Trends
    console.log('📊 1. USER REGISTRATION TRENDS:');
    const userResult = await client.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_users,
        COUNT(CASE WHEN user_type = 'associate' THEN 1 END) as associates,
        COUNT(CASE WHEN user_type = 'freelancer' THEN 1 END) as freelancers,
        COUNT(CASE WHEN user_type = 'admin' THEN 1 END) as admins
      FROM "User"
      WHERE created_at >= '2025-06-19'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    
    console.log('User registrations by date:');
    userResult.rows.forEach(row => {
      console.log(`  ${row.date}: ${row.total_users} users (${row.associates} associates, ${row.freelancers} freelancers, ${row.admins} admins)`);
    });
    console.log(`Total user records: ${userResult.rowCount}\n`);
    
    // 2. Check CV Upload Trends
    console.log('📊 2. CV UPLOAD TRENDS:');
    const cvResult = await client.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as uploads,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
      FROM "CV"
      WHERE created_at >= '2025-06-19'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    
    console.log('CV uploads by date:');
    cvResult.rows.forEach(row => {
      console.log(`  ${row.date}: ${row.uploads} uploads (${row.approved} approved, ${row.rejected} rejected)`);
    });
    console.log(`Total CV records: ${cvResult.rowCount}\n`);
    
    // 3. Check Message Trends
    console.log('📊 3. MESSAGE TRENDS:');
    const messageResult = await client.query(`
      SELECT 
        DATE(sent_at) as date,
        COUNT(*) as messages,
        COUNT(DISTINCT conversation_id) as conversations
      FROM "Message"
      WHERE sent_at >= '2025-06-19'
      GROUP BY DATE(sent_at)
      ORDER BY date ASC
    `);
    
    console.log('Messages by date:');
    messageResult.rows.forEach(row => {
      console.log(`  ${row.date}: ${row.messages} messages, ${row.conversations} conversations`);
    });
    console.log(`Total message records: ${messageResult.rowCount}\n`);
    
    // 4. Check Hired Freelancers Trends
    console.log('📊 4. HIRED FREELANCERS TRENDS:');
    const hireResult = await client.query(`
      SELECT 
        DATE(hire_date) as date,
        COUNT(*) as hires,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_hires,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_hires
      FROM "Freelancer_Hire"
      WHERE hire_date >= '2025-06-19'
      GROUP BY DATE(hire_date)
      ORDER BY date ASC
    `);
    
    console.log('Hires by date:');
    hireResult.rows.forEach(row => {
      console.log(`  ${row.date}: ${row.hires} hires (${row.active_hires} active, ${row.completed_hires} completed)`);
    });
    console.log(`Total hire records: ${hireResult.rowCount}\n`);
    
    // 5. Check User Type Distribution
    console.log('📊 5. USER TYPE DISTRIBUTION:');
    const userTypeResult = await client.query(`
      SELECT 
        user_type as type,
        COUNT(*) as count
      FROM "User"
      WHERE is_active = true
      GROUP BY user_type
      ORDER BY count DESC
    `);
    
    console.log('User types:');
    userTypeResult.rows.forEach(row => {
      console.log(`  ${row.type}: ${row.count}`);
    });
    console.log('');
    
    // 6. Check User Activity Status
    console.log('📊 6. USER ACTIVITY STATUS:');
    const activityResult = await client.query(`
      SELECT 
        CASE 
          WHEN is_active = true THEN 'Active'
          ELSE 'Inactive'
        END as status,
        COUNT(*) as count
      FROM "User"
      GROUP BY is_active
      ORDER BY count DESC
    `);
    
    console.log('User activity:');
    activityResult.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });
    console.log('');
    
    // 7. Check Top Skills
    console.log('📊 7. TOP SKILLS:');
    const skillsResult = await client.query(`
      SELECT 
        skill_name as skill,
        COUNT(*) as count
      FROM "Skill"
      GROUP BY skill_name
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log('Top skills:');
    skillsResult.rows.forEach(row => {
      console.log(`  ${row.skill}: ${row.count}`);
    });
    console.log('');
    
    // 8. Check CV File Types
    console.log('📊 8. CV FILE TYPES:');
    const fileTypeResult = await client.query(`
      SELECT 
        file_type as type,
        COUNT(*) as count
      FROM "CV"
      GROUP BY file_type
      ORDER BY count DESC
    `);
    
    console.log('CV file types:');
    fileTypeResult.rows.forEach(row => {
      console.log(`  ${row.type}: ${row.count}`);
    });
    console.log('');
    
    // 9. Check User Communication Activity
    console.log('📊 9. USER COMMUNICATION ACTIVITY:');
    const commResult = await client.query(`
      SELECT 
        CASE 
          WHEN u.user_type = 'associate' THEN a.contact_person
          WHEN u.user_type = 'freelancer' THEN f.first_name || ' ' || f.last_name
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
    
    console.log('Top communicators:');
    commResult.rows.forEach(row => {
      console.log(`  ${row.user}: ${row.messages} messages, ${row.conversations} conversations`);
    });
    console.log('');
    
    // 10. Check Visitor Data (User registrations by type)
    console.log('📊 10. VISITOR DATA (User registrations by type):');
    const visitorResult = await client.query(`
      SELECT 
        DATE(u.created_at) as date,
        COUNT(*) as total_users,
        COUNT(CASE WHEN u.user_type = 'associate' THEN 1 END) as web_users,
        COUNT(CASE WHEN u.user_type = 'freelancer' THEN 1 END) as mobile_users
      FROM "User" u
      WHERE u.created_at >= '2025-06-19'
      GROUP BY DATE(u.created_at)
      ORDER BY date ASC
    `);
    
    console.log('Visitor data by date:');
    visitorResult.rows.forEach(row => {
      console.log(`  ${row.date}: ${row.total_users} total (${row.web_users} web, ${row.mobile_users} mobile)`);
    });
    console.log('');
    
  } catch (error) {
    console.error('❌ Error checking analytics data:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAnalyticsData();

