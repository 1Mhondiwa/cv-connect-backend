// Script to check the actual Freelancer table schema
const db = require('./config/database');

async function checkFreelancerSchema() {
  try {
    console.log('🔍 Checking Freelancer table schema...');
    
    // Get the table structure
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Freelancer' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Freelancer Table Schema:');
    console.log('=====================================');
    
    result.rows.forEach((column, index) => {
      console.log(`${index + 1}. ${column.column_name} (${column.data_type}) - ${column.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log('=====================================');
    console.log(`Total columns: ${result.rows.length}`);
    
    // Also check if there are any constraints
    const constraintsResult = await db.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints 
      WHERE table_name = 'Freelancer'
    `);
    
    if (constraintsResult.rows.length > 0) {
      console.log('\n🔒 Constraints:');
      constraintsResult.rows.forEach(constraint => {
        console.log(`   • ${constraint.constraint_name} (${constraint.constraint_type})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkFreelancerSchema();
