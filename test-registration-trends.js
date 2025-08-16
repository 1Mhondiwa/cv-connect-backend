const db = require('./config/database');

async function testRegistrationTrends() {
  try {
    console.log('🔍 Testing Registration Trends Query...\n');
    
    // Test the exact query from the endpoint
    const startDate = new Date('2025-06-19');
    const endDate = new Date();
    
    console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    const result = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_users,
        COUNT(CASE WHEN user_type = 'associate' THEN 1 END) as associates,
        COUNT(CASE WHEN user_type = 'freelancer' THEN 1 END) as freelancers,
        COUNT(CASE WHEN user_type = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN user_type = 'ecs_employee' THEN 1 END) as ecs_employees
      FROM "User"
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [startDate, endDate]);

    console.log('📊 Raw query results:');
    console.log(`Total rows returned: ${result.rows.length}`);
    
    if (result.rows.length > 0) {
      console.log('\n📈 Sample data:');
      result.rows.slice(0, 5).forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.date}: ${row.total_users} users (${row.associates} associates, ${row.freelancers} freelancers, ${row.admins} admins, ${row.ecs_employees} ecs_employees)`);
      });
      
      if (result.rows.length > 5) {
        console.log(`  ... and ${result.rows.length - 5} more rows`);
      }
    }
    
    // Test total user count
    const totalUsersResult = await db.query(`
      SELECT 
        user_type,
        COUNT(*) as count
      FROM "User"
      WHERE is_active = true
      GROUP BY user_type
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Total user counts by type:');
    let totalUsers = 0;
    totalUsersResult.rows.forEach(row => {
      console.log(`  ${row.user_type}: ${row.count}`);
      totalUsers += parseInt(row.count);
    });
    console.log(`  Total: ${totalUsers} users`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

testRegistrationTrends();

