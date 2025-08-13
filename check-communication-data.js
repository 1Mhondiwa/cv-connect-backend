// check-communication-data.js
// Script to check actual communication data in the database
require('dotenv').config();
const db = require('./config/database');

async function checkCommunicationData() {
  try {
    console.log('🔍 Checking actual communication data in database...\n');
    
    // Check if Message table exists and has data
    console.log('📧 Checking Message table...');
    try {
      const messageCountResult = await db.query('SELECT COUNT(*) FROM "Message"');
      console.log(`   Total messages: ${messageCountResult.rows[0].count}`);
      
      if (parseInt(messageCountResult.rows[0].count) > 0) {
        const recentMessagesResult = await db.query(`
          SELECT 
            m.message_id,
            m.sender_id,
            m.conversation_id,
            m.created_at,
            u.first_name || ' ' || u.last_name as sender_name,
            u.user_type
          FROM "Message" m
          JOIN "User" u ON m.sender_id = u.user_id
          ORDER BY m.created_at DESC
          LIMIT 5
        `);
        
        console.log('\n   Recent messages:');
        recentMessagesResult.rows.forEach(msg => {
          console.log(`     ${msg.sender_name} (${msg.user_type}): ${msg.created_at}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Message table error:', error.message);
    }
    
    // Check User table for active users
    console.log('\n👥 Checking active users...');
    const activeUsersResult = await db.query(`
      SELECT 
        user_id,
        first_name,
        last_name,
        user_type,
        created_at,
        is_active
      FROM "User"
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`   Total active users: ${activeUsersResult.rows.length}`);
    activeUsersResult.rows.forEach(user => {
      console.log(`     ${user.first_name} ${user.last_name} (${user.user_type}) - Created: ${user.created_at}`);
    });
    
    // Check if there are any conversations
    console.log('\n💬 Checking conversations...');
    try {
      const conversationResult = await db.query(`
        SELECT 
          conversation_id,
          COUNT(*) as message_count,
          MIN(created_at) as first_message,
          MAX(created_at) as last_message
        FROM "Message"
        GROUP BY conversation_id
        ORDER BY message_count DESC
        LIMIT 5
      `);
      
      console.log(`   Total conversations: ${conversationResult.rows.length}`);
      conversationResult.rows.forEach(conv => {
        console.log(`     Conversation ${conv.conversation_id}: ${conv.message_count} messages (${conv.first_message} to ${conv.last_message})`);
      });
    } catch (error) {
      console.log('   ❌ Conversation query error:', error.message);
    }
    
    // Check for any other communication-related tables
    console.log('\n🔍 Checking for other communication tables...');
    try {
      const tablesResult = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%message%' 
        OR table_name LIKE '%conversation%'
        OR table_name LIKE '%chat%'
        OR table_name LIKE '%communication%'
      `);
      
      if (tablesResult.rows.length > 0) {
        console.log('   Found communication-related tables:');
        tablesResult.rows.forEach(table => {
          console.log(`     - ${table.table_name}`);
        });
      } else {
        console.log('   No additional communication tables found');
      }
    } catch (error) {
      console.log('   ❌ Table check error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error checking communication data:', error);
  } finally {
    process.exit(0);
  }
}

checkCommunicationData();
