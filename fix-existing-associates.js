// Fix existing associate users to mark them as having already changed their temporary password
const db = require('./config/database');

const fixExistingAssociates = async () => {
  try {
    console.log('🔍 Fixing existing associate users...');
    
    // Get all existing associate users
    const existingAssociates = await db.query(`
      SELECT user_id, email, created_at, has_changed_temp_password
      FROM "User" 
      WHERE user_type = 'associate'
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Found ${existingAssociates.rowCount} existing associate users`);
    
    // Update all existing associates to have changed their temp password
    const updateResult = await db.query(`
      UPDATE "User" 
      SET has_changed_temp_password = true 
      WHERE user_type = 'associate' AND has_changed_temp_password = false
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount} associate users`);
    
    // Verify the changes
    const verifyResult = await db.query(`
      SELECT user_type, COUNT(*) as count, 
             COUNT(CASE WHEN has_changed_temp_password = true THEN 1 END) as changed_count,
             COUNT(CASE WHEN has_changed_temp_password = false THEN 1 END) as not_changed_count
      FROM "User" 
      WHERE user_type = 'associate'
      GROUP BY user_type
    `);
    
    console.log('\n📊 Updated data status:');
    verifyResult.rows.forEach(row => {
      console.log(`   ${row.user_type}: ${row.count} total, ${row.changed_count} changed, ${row.not_changed_count} not changed`);
    });
    
    console.log('\n🎉 Existing associates have been updated successfully!');
    console.log('💡 New associates created from now on will start with has_changed_temp_password = false');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    process.exit(0);
  }
};

// Run the fix
fixExistingAssociates();
