const { pool } = require('./config/database');

const fixECSEmployeeTable = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing ECS_Employee table structure...\n');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Add missing position column
    console.log('📝 Adding missing position column...');
    await client.query(`
      ALTER TABLE "ECS_Employee" 
      ADD COLUMN IF NOT EXISTS position VARCHAR(255)
    `);
    console.log('✅ Position column added');
    
    // Add missing indexes if they don't exist
    console.log('📊 Creating missing indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ecs_employee_user_id 
      ON "ECS_Employee"(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ecs_employee_active 
      ON "ECS_Employee"(is_active)
    `);
    console.log('✅ Indexes created');
    
    // Add comments if they don't exist
    console.log('💬 Adding table comments...');
    await client.query(`
      COMMENT ON TABLE "ECS_Employee" IS 'Stores ECS Employee specific information'
    `);
    await client.query(`
      COMMENT ON COLUMN "ECS_Employee".position IS 'Employee job position/title'
    `);
    console.log('✅ Comments added');
    
    // Create or replace the trigger function
    console.log('⚡ Creating timestamp trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_ecs_employee_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    // Create the trigger
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_update_ecs_employee_updated_at ON "ECS_Employee"
    `);
    await client.query(`
      CREATE TRIGGER trigger_update_ecs_employee_updated_at
          BEFORE UPDATE ON "ECS_Employee"
          FOR EACH ROW
          EXECUTE FUNCTION update_ecs_employee_updated_at()
    `);
    console.log('✅ Timestamp trigger created');
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n🎉 ECS_Employee table fixed successfully!');
    console.log('');
    console.log('📋 What was fixed:');
    console.log('   - Added missing position column');
    console.log('   - Created missing indexes');
    console.log('   - Added table comments');
    console.log('   - Created timestamp trigger');
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

fixECSEmployeeTable();
