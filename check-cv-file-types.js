const db = require('./config/database');

async function checkCVFileTypes() {
  try {
    console.log('🔍 Checking CV file types in database...\n');
    
    // Check the actual file_type values
    const result = await db.query(`
      SELECT 
        file_type,
        COUNT(*) as count
      FROM "CV"
      GROUP BY file_type
      ORDER BY count DESC
    `);
    
    console.log('📊 CV File Types found:');
    result.rows.forEach(row => {
      console.log(`  ${row.file_type}: ${row.count} CVs`);
    });
    
    // Check if there are any invalid file types
    console.log('\n🔍 Checking for potential issues...');
    const invalidTypes = result.rows.filter(row => 
      row.file_type && typeof row.file_type === 'string' && 
      (row.file_type.includes('"') || row.file_type.includes("'"))
    );
    
    if (invalidTypes.length > 0) {
      console.log('⚠️  Potentially problematic file types:');
      invalidTypes.forEach(row => {
        console.log(`  "${row.file_type}" (${row.count} CVs)`);
      });
    } else {
      console.log('✅ All file types look clean');
    }
    
  } catch (error) {
    console.error('❌ Error checking CV file types:', error);
  } finally {
    await db.end();
  }
}

checkCVFileTypes();
