// Check database setup for ESC admin functionality
const { pool } = require('./config/database');

const checkDatabase = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking database setup...\n');

    // Check if Associate_Request table exists
    console.log('1. Checking Associate_Request table...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Associate_Request'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Associate_Request table exists');
      
      // Check table structure
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'Associate_Request'
        ORDER BY ordinal_position;
      `);
      
      console.log('📋 Table structure:');
      columns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
    } else {
      console.log('❌ Associate_Request table does NOT exist');
      console.log('💡 Run the migration: backend/migrations/add_esc_functionality.sql');
    }

    // Check if Freelancer table has availability_status column
    console.log('\n2. Checking Freelancer table for availability_status...');
    const freelancerCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'Freelancer' 
        AND column_name = 'availability_status'
      );
    `);
    
    if (freelancerCheck.rows[0].exists) {
      console.log('✅ availability_status column exists in Freelancer table');
    } else {
      console.log('❌ availability_status column does NOT exist in Freelancer table');
      console.log('💡 Run the migration: backend/migrations/add_esc_functionality.sql');
    }

    // Check if routes are properly loaded
    console.log('\n3. Checking if server is running...');
    console.log('💡 Make sure the backend server is running on port 5000');
    console.log('💡 Check that associateRequestRoutes is properly imported in server.js');

  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  } finally {
    client.release();
  }
};

checkDatabase().then(() => {
  console.log('\n🏁 Database check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Check failed:', error);
  process.exit(1);
}); 