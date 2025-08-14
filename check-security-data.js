const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function checkSecurityData() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking Security & Communication Data in Database...\n');

    // 0. Check Message table structure
    console.log('📋 0. MESSAGE TABLE STRUCTURE:');
    try {
      const tableStructure = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'Message'
        ORDER BY ordinal_position
      `);
      
      console.log('   Message table columns:');
      tableStructure.rows.forEach(col => {
        console.log(`     - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });
      console.log();
    } catch (error) {
      console.log('   Could not check table structure:', error.message);
    }

    // 1. Check total messages
    console.log('📊 1. TOTAL MESSAGES:');
    const totalMessages = await client.query(`
      SELECT COUNT(*) as total_messages,
             MIN(sent_at) as earliest_message,
             MAX(sent_at) as latest_message
      FROM "Message"
    `);
    console.log(`   Total Messages: ${totalMessages.rows[0].total_messages}`);
    console.log(`   Date Range: ${totalMessages.rows[0].earliest_message} to ${totalMessages.rows[0].latest_message}\n`);

    // 2. Check messages in last 30 days
    console.log('📅 2. MESSAGES IN LAST 30 DAYS:');
    const recentMessages = await client.query(`
      SELECT COUNT(*) as recent_count
      FROM "Message" 
      WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days'
    `);
    console.log(`   Messages in last 30 days: ${recentMessages.rows[0].recent_count}\n`);

    // 3. Check for suspicious content patterns
    console.log('🚨 3. SUSPICIOUS CONTENT DETECTION:');
    const suspiciousContent = await client.query(`
      SELECT 
        COUNT(CASE WHEN content ILIKE '%spam%' THEN 1 END) as spam_count,
        COUNT(CASE WHEN content ILIKE '%scam%' THEN 1 END) as scam_count,
        COUNT(CASE WHEN content ILIKE '%phishing%' THEN 1 END) as phishing_count,
        COUNT(CASE WHEN content ILIKE '%suspicious%' THEN 1 END) as suspicious_count,
        COUNT(CASE WHEN content ILIKE '%inappropriate%' THEN 1 END) as inappropriate_count,
        COUNT(CASE WHEN content ILIKE '%abuse%' THEN 1 END) as abuse_count
      FROM "Message"
      WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days'
    `);
    
    const row = suspiciousContent.rows[0];
    console.log(`   Spam: ${row.spam_count}`);
    console.log(`   Scam: ${row.scam_count}`);
    console.log(`   Phishing: ${row.phishing_count}`);
    console.log(`   Suspicious: ${row.suspicious_count}`);
    console.log(`   Inappropriate: ${row.inappropriate_count}`);
    console.log(`   Abuse: ${row.abuse_count}\n`);

    // 4. Check unique users communicating
    console.log('👥 4. USERS COMMUNICATING:');
    const communicatingUsers = await client.query(`
      SELECT 
        COUNT(DISTINCT sender_id) as unique_senders
      FROM "Message"
      WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days'
    `);
    console.log(`   Unique Senders: ${communicatingUsers.rows[0].unique_senders}\n`);

    // 5. Check user types
    console.log('👤 5. USER TYPE BREAKDOWN:');
    const userTypes = await client.query(`
      SELECT 
        u.user_type,
        COUNT(DISTINCT u.user_id) as user_count,
        COUNT(m.message_id) as message_count
      FROM "User" u
      LEFT JOIN "Message" m ON u.user_id = m.sender_id AND m.sent_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY u.user_type
      ORDER BY user_count DESC
    `);
    
    userTypes.rows.forEach(type => {
      console.log(`   ${type.user_type}: ${type.user_count} users, ${type.message_count} messages`);
    });
    console.log();

    // 6. Sample flagged messages
    console.log('🚩 6. SAMPLE FLAGGED MESSAGES:');
    const flaggedMessages = await client.query(`
      SELECT 
        m.message_id,
        m.content,
        m.sent_at,
        u.user_type,
        CASE 
          WHEN u.user_type = 'associate' THEN a.contact_person
          WHEN u.user_type = 'freelancer' THEN f.first_name || ' ' || f.last_name
          ELSE u.email
        END as sender_name,
        u.email as sender_email
      FROM "Message" m
      JOIN "User" u ON m.sender_id = u.user_id
      LEFT JOIN "Associate" a ON u.user_id = a.user_id
      LEFT JOIN "Freelancer" f ON u.user_id = f.user_id
      WHERE m.sent_at >= CURRENT_DATE - INTERVAL '30 days'
      AND (
        m.content ILIKE '%spam%' OR 
        m.content ILIKE '%scam%' OR 
        m.content ILIKE '%phishing%' OR 
        m.content ILIKE '%suspicious%' OR 
        m.content ILIKE '%inappropriate%' OR 
        m.content ILIKE '%abuse%'
      )
      ORDER BY m.sent_at DESC
      LIMIT 5
    `);

    if (flaggedMessages.rows.length > 0) {
      flaggedMessages.rows.forEach((msg, index) => {
        console.log(`   ${index + 1}. ${msg.sender_name} (${msg.sender_email}) - ${msg.sent_at}`);
        console.log(`      Content: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
        console.log();
      });
    } else {
      console.log('   No flagged messages found in the last 30 days.\n');
    }

    // 7. Check message content samples
    console.log('💬 7. RECENT MESSAGE SAMPLES:');
    const recentSamples = await client.query(`
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

    recentSamples.rows.forEach((msg, index) => {
      console.log(`   ${index + 1}. ${msg.sender_name} (${msg.user_type}) - ${msg.sent_at}`);
      console.log(`      Content: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
      console.log();
    });

    console.log('✅ Security data check completed!');

  } catch (error) {
    console.error('❌ Error checking security data:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSecurityData();
