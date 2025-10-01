// Script to add 4 ECS Employees to the database
const { pool } = require('./config/database');
const fs = require('fs');
const path = require('path');

async function addECSEmployees() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting ECS Employees migration...\n');

    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'migrations', 'add-ecs-employees-fixed.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the migration
    await client.query(sql);

    // Query the newly added employees
    const result = await client.query(`
      SELECT 
        e.employee_id_number,
        e.first_name,
        e.last_name,
        e.department,
        e.position,
        u.email,
        e.phone,
        e.hire_date,
        e.is_active
      FROM "ECS_Employee" e
      JOIN "User" u ON e.user_id = u.user_id
      WHERE e.employee_id_number IN ('ECS-HR-2024-001', 'ECS-PM-2024-002', 'ECS-REC-2024-003', 'ECS-TECH-2023-004')
      ORDER BY e.hire_date DESC
    `);

    console.log('✅ Successfully added 4 ECS Employees!\n');
    console.log('📋 New ECS Employees:\n');
    
    result.rows.forEach((employee, index) => {
      console.log(`${index + 1}. ${employee.first_name} ${employee.last_name}`);
      console.log(`   Employee ID: ${employee.employee_id_number}`);
      console.log(`   Email: ${employee.email}`);
      console.log(`   Password: ECS2024!`);
      console.log(`   Department: ${employee.department}`);
      console.log(`   Position: ${employee.position}`);
      console.log(`   Phone: ${employee.phone}`);
      console.log(`   Hire Date: ${employee.hire_date.toISOString().split('T')[0]}`);
      console.log(`   Active: ${employee.is_active ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Get total count
    const countResult = await client.query(`
      SELECT COUNT(*) as total FROM "ECS_Employee" WHERE is_active = true
    `);

    console.log(`\n📊 Total Active ECS Employees: ${countResult.rows[0].total}`);
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n💡 You can now log in with any of these accounts:');
    console.log('   Email: sarah.johnson@ecs.com');
    console.log('   Email: michael.chen@ecs.com');
    console.log('   Email: priya.naidoo@ecs.com');
    console.log('   Email: james.vandermerwe@ecs.com');
    console.log('   Password: ECS2024!');
    
  } catch (error) {
    console.error('❌ Error adding ECS employees:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
addECSEmployees()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

