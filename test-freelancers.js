// Test script to check freelancer data in database
const db = require('./config/database');

const testFreelancers = async () => {
  try {
    console.log('🔍 Testing freelancer data...');
    
    // Test 1: Check if Freelancer table exists and has data
    const freelancerCount = await db.query('SELECT COUNT(*) FROM "Freelancer"');
    console.log('📊 Total freelancers in database:', freelancerCount.rows[0].count);
    
    // Test 2: Check table structure
    const tableStructure = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Freelancer' 
      ORDER BY ordinal_position
    `);
    console.log('🏗️  Freelancer table structure:');
    tableStructure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    
    // Test 3: Check if there are any freelancers with the new fields
    const sampleFreelancers = await db.query(`
      SELECT 
        f.freelancer_id,
        f.first_name,
        f.last_name,
        f.is_approved,
        f.is_available,
        f.admin_rating,
        u.email,
        u.is_active
      FROM "Freelancer" f
      JOIN "User" u ON f.user_id = u.user_id
      LIMIT 5
    `);
    
    console.log('👥 Sample freelancers:');
    if (sampleFreelancers.rows.length > 0) {
      sampleFreelancers.rows.forEach((freelancer, index) => {
        console.log(`   ${index + 1}. ${freelancer.first_name} ${freelancer.last_name} (${freelancer.email})`);
        console.log(`      Approved: ${freelancer.is_approved}, Available: ${freelancer.is_available}, Rating: ${freelancer.admin_rating}`);
      });
    } else {
      console.log('   No freelancers found');
    }
    
    // Test 4: Check User table for freelancer users
    const freelancerUsers = await db.query(`
      SELECT user_id, email, user_type, is_active, created_at
      FROM "User" 
      WHERE user_type = 'freelancer'
      LIMIT 5
    `);
    
    console.log('👤 Freelancer users in User table:');
    if (freelancerUsers.rows.length > 0) {
      freelancerUsers.rows.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.user_type}) - Active: ${user.is_active}, Created: ${user.created_at}`);
      });
    } else {
      console.log('   No freelancer users found');
    }
    
  } catch (error) {
    console.error('❌ Error testing freelancers:', error);
  } finally {
    process.exit(0);
  }
};

testFreelancers();

