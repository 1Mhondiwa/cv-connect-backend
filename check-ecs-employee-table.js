const { pool } = require('./config/database');

const checkECSEmployeeTable = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking ECS_Employee table status...\n');
    
    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ECS_Employee'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('✅ ECS_Employee table exists');
      
      // Get table structure
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'ECS_Employee'
        ORDER BY ordinal_position;
      `);
      
      console.log('\n📋 Current table structure:');
      columns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
      
      // Check if position column exists
      const hasPosition = columns.rows.some(col => col.column_name === 'position');
      if (!hasPosition) {
        console.log('\n❌ Missing column: position');
        console.log('💡 This column is required by the backend code');
      }
      
    } else {
      console.log('❌ ECS_Employee table does NOT exist');
      console.log('💡 Run the migration first: npm run migrate:ecs-employee');
    }
    
    // Check if there are any existing records
    try {
      const recordCount = await client.query('SELECT COUNT(*) FROM "ECS_Employee"');
      console.log(`\n📊 Current record count: ${recordCount.rows[0].count}`);
    } catch (error) {
      console.log('\n📊 Cannot check record count - table may not exist or have issues');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    client.release();
    process.exit(0);
  }
};

checkECSEmployeeTable();
