// test-hired-trends.js
const db = require('./config/database');

async function testHiredTrends() {
  try {
    console.log('🔍 Testing Hired Freelancers Trends...');
    
    // Check if Freelancer_Hire table exists and has data
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
    structureCheck.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Check row count
    const countResult = await db.query('SELECT COUNT(*) FROM "Freelancer_Hire"');
    console.log(`📊 Total hires in system: ${countResult.rows[0].count}`);
    
    // Check date range
    const dateRangeResult = await db.query(`
      SELECT 
        MIN(hire_date) as earliest_hire,
        MAX(hire_date) as latest_hire
      FROM "Freelancer_Hire"
    `);
    
    if (dateRangeResult.rows[0].earliest_hire) {
      console.log(`📅 Date range: ${dateRangeResult.rows[0].earliest_hire} to ${dateRangeResult.rows[0].latest_hire}`);
    } else {
      console.log('📅 No hire dates found');
    }
    
    // Test the actual query logic
    const systemStartDate = new Date('2025-06-19');
    const today = new Date();
    
    console.log(`🔍 Testing query from ${systemStartDate.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);
    
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
    `, [systemStartDate, today]);
    
    console.log(`📊 Query returned ${result.rows.length} rows`);
    
    if (result.rows.length > 0) {
      console.log('📈 Sample data:');
      result.rows.slice(0, 5).forEach(row => {
        console.log(`  ${row.date}: ${row.hires} hires (${row.active_hires} active, ${row.completed_hires} completed)`);
      });
    }
    
    // Test date generation logic
    console.log('🔍 Testing date generation logic...');
    const dataMap = new Map();
    result.rows.forEach(row => {
      dataMap.set(row.date.toISOString().split('T')[0], {
        date: row.date,
        hires: parseInt(row.hires),
        active_hires: parseInt(row.active_hires),
        completed_hires: parseInt(row.completed_hires)
      });
    });
    
    const hiredTrends = [];
    const currentDate = new Date(systemStartDate);
    
    while (currentDate <= today) {
      const dateString = currentDate.toISOString().split('T')[0];
      const existingData = dataMap.get(dateString);
      
      if (existingData) {
        hiredTrends.push(existingData);
      } else {
        hiredTrends.push({
          date: new Date(currentDate),
          hires: 0,
          active_hires: 0,
          completed_hires: 0
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`📅 Generated ${hiredTrends.length} dates from ${systemStartDate.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);
    console.log('📊 Final data sample:');
    hiredTrends.slice(0, 10).forEach(item => {
      console.log(`  ${item.date.toISOString().split('T')[0]}: ${item.hires} hires`);
    });
    
  } catch (error) {
    console.error('❌ Error testing hired trends:', error);
  } finally {
    process.exit(0);
  }
}

testHiredTrends();
