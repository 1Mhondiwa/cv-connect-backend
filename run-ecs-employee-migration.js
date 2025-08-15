const { pool } = require('./config/database');
const fs = require('fs');
const path = require('path');

const runECSEmployeeMigration = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting ECS Employee Database Migration...');
    console.log('This will create the ECS_Employee table and related functionality.\n');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'add_ecs_employee_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Executing migration SQL...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ ECS Employee migration completed successfully!');
    console.log('');
    console.log('📊 What was created:');
    console.log('   - ECS_Employee table with all necessary fields');
    console.log('   - Indexes for efficient querying');
    console.log('   - Trigger for automatic updated_at timestamp updates');
    console.log('');
    console.log('🔑 Next steps:');
    console.log('1. Add ECS_EMPLOYEE_SECRET_KEY to your .env file');
    console.log('2. Restart your backend server: npm start');
    console.log('3. Test ECS Employee creation at /ecs-employee/create');
    console.log('');
    console.log('💡 Example .env addition:');
    console.log('   ECS_EMPLOYEE_SECRET_KEY=your-secure-secret-key-here');
    
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('🔍 Common issues:');
    console.error('   - Database connection problems');
    console.error('   - Insufficient database permissions');
    console.error('   - Migration file not found');
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('1. Check your database connection');
    console.error('2. Ensure you have proper database permissions');
    console.error('3. Verify the migration file exists');
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
};

runECSEmployeeMigration();
