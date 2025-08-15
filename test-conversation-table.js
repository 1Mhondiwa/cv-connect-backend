// test-conversation-table.js
const db = require('./config/database');

async function testConversationTable() {
  try {
    console.log('🔍 Testing Conversation table...');
    
    // Check if table exists
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Conversation'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('✅ Conversation table exists');
      
      // Check table structure
      const tableStructure = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'Conversation'
        ORDER BY ordinal_position;
      `);
      
      console.log('📋 Table structure:');
      tableStructure.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
      
      // Check if table has data
      const rowCount = await db.query('SELECT COUNT(*) FROM "Conversation"');
      console.log(`📊 Table has ${rowCount.rows[0].count} rows`);
      
    } else {
      console.log('❌ Conversation table does not exist');
    }
    
    // Check if Associate table exists
    const associateExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Associate'
      );
    `);
    
    if (associateExists.rows[0].exists) {
      console.log('✅ Associate table exists');
      const associateCount = await db.query('SELECT COUNT(*) FROM "Associate"');
      console.log(`📊 Associate table has ${associateCount.rows[0].count} rows`);
    } else {
      console.log('❌ Associate table does not exist');
    }
    
    // Check if Freelancer table exists
    const freelancerExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Freelancer'
      );
    `);
    
    if (freelancerExists.rows[0].exists) {
      console.log('✅ Freelancer table exists');
      const freelancerCount = await db.query('SELECT COUNT(*) FROM "Freelancer"');
      console.log(`📊 Freelancer table has ${freelancerCount.rows[0].count} rows`);
    } else {
      console.log('❌ Freelancer table does not exist');
    }
    
  } catch (error) {
    console.error('❌ Error testing tables:', error);
  } finally {
    process.exit(0);
  }
}

testConversationTable();
