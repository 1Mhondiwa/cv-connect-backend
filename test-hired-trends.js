const db = require('./config/database');

async function testHiredTrends() {
  try {
    console.log('🔍 Testing Hired Freelancers Trends...');
    
    // Check if Freelancer_Hire table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'Freelancer_Hire'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Freelancer_Hire table does not exist');
      return;
    }
    
    console.log('✅ Freelancer_Hire table exists');
    
    // Check table structure
    const structureCheck = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Freelancer_Hire' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Table structure:');
    structureCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Check total hires
    const totalHires = await db.query('SELECT COUNT(*) FROM "Freelancer_Hire"');
    console.log(`📊 Total hires in system: ${totalHires.rows[0].count}`);
    
    // Test the actual query logic
    const startDate = new Date('2025-06-19');
    const endDate = new Date();
    
    console.log(`📅 Date range: ${startDate} to ${endDate}`);
    
    // Get hired freelancers data grouped by date
    const result = await db.query(`
      SELECT 
        DATE(h.hire_date) as date,
        COUNT(*) as hires,
        COUNT(CASE WHEN h.status = 'active' THEN 1 END) as active_hires,
        COUNT(CASE WHEN h.status = 'completed' THEN 1 END) as completed_hires
      FROM "Freelancer_Hire" h
      WHERE h.hire_date >= $1 AND h.hire_date <= $2
      GROUP BY DATE(h.hire_date)
      ORDER BY date ASC
    `, [startDate, endDate]);
    
    console.log(`🔍 Testing query from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    console.log(`📊 Query returned ${result.rows.length} rows`);
    
    if (result.rows.length > 0) {
      console.log('📈 Sample data:');
      result.rows.forEach(row => {
        console.log(`  ${row.date}: ${row.hires} hires (${row.active_hires} active, ${row.completed_hires} completed)`);
      });
    }
    
    // Test date generation logic
    console.log('🔍 Testing date generation logic...');
    const hireDataMap = new Map();
    result.rows.forEach(row => {
      hireDataMap.set(row.date.toISOString().split('T')[0], {
        date: row.date,
        hires: parseInt(row.hires),
        active_hires: parseInt(row.active_hires),
        completed_hires: parseInt(row.completed_hires)
      });
    });
    
    // Generate complete date range from June 19 to today
    const hiredTrends = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      const existingData = hireDataMap.get(dateString);
      
      if (existingData) {
        hiredTrends.push(existingData);
      } else {
        // Add entry with 0 values for days with no activity
        hiredTrends.push({
          date: new Date(currentDate),
          hires: 0,
          active_hires: 0,
          completed_hires: 0
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`📅 Generated ${hiredTrends.length} dates from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    console.log('📊 Final data sample:');
    hiredTrends.slice(0, 10).forEach(item => {
      console.log(`  ${item.date.toISOString().split('T')[0]}: ${item.hires} hires`);
    });
    
    if (hiredTrends.length > 10) {
      console.log(`  ... and ${hiredTrends.length - 10} more dates`);
    }
    
  } catch (error) {
    console.error('❌ Error testing hired trends:', error);
  } finally {
    process.exit(0);
  }
}

testHiredTrends();

