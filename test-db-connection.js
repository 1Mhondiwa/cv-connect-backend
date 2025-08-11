// Test database connection and table structure
const db = require('./config/database');

const testDatabase = async () => {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    const client = await db.pool.connect();
    console.log('✅ Database connection successful');
    
    // Test Associate_Request table
    console.log('\n🔍 Testing Associate_Request table...');
    const tableResult = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'Associate_Request' 
      ORDER BY ordinal_position
    `);
    
    if (tableResult.rowCount > 0) {
      console.log('✅ Associate_Request table exists with columns:');
      tableResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    } else {
      console.log('❌ Associate_Request table not found!');
    }
    
    // Test User table
    console.log('\n🔍 Testing User table...');
    const userTableResult = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      ORDER BY ordinal_position
    `);
    
    if (userTableResult.rowCount > 0) {
      console.log('✅ User table exists with columns:');
      userTableResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    } else {
      console.log('❌ User table not found!');
    }
    
    // Test Associate table
    console.log('\n🔍 Testing Associate table...');
    const associateTableResult = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'Associate' 
      ORDER BY ordinal_position
    `);
    
    if (associateTableResult.rowCount > 0) {
      console.log('✅ Associate table exists with columns:');
      associateTableResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    } else {
      console.log('❌ Associate table not found!');
    }
    
    // Test sample data
    console.log('\n🔍 Testing sample data...');
    const sampleRequests = await client.query('SELECT COUNT(*) as count FROM "Associate_Request"');
    console.log(`✅ Associate_Request count: ${sampleRequests.rows[0].count}`);
    
    const sampleUsers = await client.query('SELECT COUNT(*) as count FROM "User"');
    console.log(`✅ User count: ${sampleUsers.rows[0].count}`);
    
    const sampleAssociates = await client.query('SELECT COUNT(*) as count FROM "Associate"');
    console.log(`✅ Associate count: ${sampleAssociates.rows[0].count}`);
    
    // Test bcrypt functionality
    console.log('\n🔍 Testing bcrypt functionality...');
    const bcrypt = require('bcryptjs');
    const testPassword = 'test123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(testPassword, salt);
    const isValid = await bcrypt.compare(testPassword, hash);
    console.log(`✅ Bcrypt test: ${isValid ? 'PASSED' : 'FAILED'}`);
    
    client.release();
    console.log('\n🎉 All database tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
  }
};

// Run the test
testDatabase();
