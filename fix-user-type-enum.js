const { pool } = require('./config/database');

const fixUserTypeEnum = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing user_type enum to include ecs_employee...\n');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Get the enum type name
    const enumTypeResult = await client.query(`
      SELECT udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name = 'user_type'
    `);
    
    if (enumTypeResult.rows.length === 0) {
      throw new Error('Could not find user_type column in User table');
    }
    
    const enumTypeName = enumTypeResult.rows[0].udt_name;
    console.log(`📝 Found enum type: ${enumTypeName}`);
    
    // Check if ecs_employee already exists
    const existingValues = await client.query(`
      SELECT enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = $1
      ORDER BY enumsortorder;
    `, [enumTypeName]);
    
    const hasEcsEmployee = existingValues.rows.some(row => row.enumlabel === 'ecs_employee');
    
    if (hasEcsEmployee) {
      console.log('✅ ecs_employee is already in the enum');
    } else {
      console.log('📝 Adding ecs_employee to the enum...');
      
      // Add ecs_employee to the enum
      await client.query(`
        ALTER TYPE ${enumTypeName} ADD VALUE 'ecs_employee'
      `);
      
      console.log('✅ ecs_employee added to the enum');
    }
    
    // Verify the change
    const newValues = await client.query(`
      SELECT enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = $1
      ORDER BY enumsortorder;
    `, [enumTypeName]);
    
    console.log('\n📋 Updated enum values:');
    newValues.rows.forEach(row => {
      console.log(`   - ${row.enumlabel}`);
    });
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n🎉 User type enum fixed successfully!');
    console.log('');
    console.log('🔑 Next steps:');
    console.log('1. Add ECS_EMPLOYEE_SECRET_KEY to your .env file');
    console.log('2. Restart your backend server: npm start');
    console.log('3. Test ECS Employee creation at /ecs-employee/create');
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('');
    console.error('❌ Fix failed:', error.message);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('1. Check your database connection');
    console.error('2. Ensure you have proper database permissions');
    console.error('3. Check if there are any conflicting constraints');
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
};

fixUserTypeEnum();
