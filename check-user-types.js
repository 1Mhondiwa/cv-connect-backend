const { pool } = require('./config/database');

const checkUserTypes = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking User table structure and constraints...\n');
    
    // Check if User table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'User'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('✅ User table exists');
      
      // Get table structure
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'User'
        ORDER BY ordinal_position;
      `);
      
      console.log('\n📋 User table structure:');
      columns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
      
      // Check for user_type or user_role column
      const userTypeColumn = columns.rows.find(col => 
        col.column_name === 'user_type' || col.column_name === 'user_role'
      );
      
      if (userTypeColumn) {
        console.log(`\n🎯 Found user type column: ${userTypeColumn.column_name}`);
        
        // Check if it's an enum
        if (userTypeColumn.data_type === 'USER-DEFINED') {
          console.log('📝 This appears to be an enum type');
          
          // Get enum values
          const enumValues = await client.query(`
            SELECT enumlabel
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = (
              SELECT udt_name 
              FROM information_schema.columns 
              WHERE table_name = 'User' 
              AND column_name = $1
            )
            ORDER BY enumsortorder;
          `, [userTypeColumn.column_name]);
          
          console.log('\n📋 Allowed enum values:');
          enumValues.rows.forEach(row => {
            console.log(`   - ${row.enumlabel}`);
          });
          
          // Check if ecs_employee is allowed
          const hasEcsEmployee = enumValues.rows.some(row => row.enumlabel === 'ecs_employee');
          if (!hasEcsEmployee) {
            console.log('\n❌ "ecs_employee" is NOT in the allowed enum values');
            console.log('💡 We need to add it to the enum type');
          } else {
            console.log('\n✅ "ecs_employee" is already allowed');
          }
        }
      } else {
        console.log('\n❌ No user type column found');
      }
      
    } else {
      console.log('❌ User table does NOT exist');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    client.release();
    process.exit(0);
  }
};

checkUserTypes();
