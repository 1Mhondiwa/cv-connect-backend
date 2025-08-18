const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function cleanupWorkExperience() {
  try {
    console.log('Cleaning up corrupted work experience data...\n');
    
    // Get all CV records
    const cvResult = await pool.query('SELECT cv_id, freelancer_id, parsed_data FROM "CV"');
    console.log(`Found ${cvResult.rowCount} CV records`);
    
    for (const cv of cvResult.rows) {
      if (cv.parsed_data && cv.parsed_data.work_experience) {
        const workExperience = cv.parsed_data.work_experience;
        console.log(`\nCV ${cv.cv_id} has ${workExperience.length} work experience entries`);
        
        // Filter out entries with undefined or missing IDs
        const validWorkExperience = workExperience.filter(work => work && work.id && work.id !== undefined);
        const removedCount = workExperience.length - validWorkExperience.length;
        
        if (removedCount > 0) {
          console.log(`- Removing ${removedCount} corrupted entries`);
          console.log(`- Keeping ${validWorkExperience.length} valid entries`);
          
          // Update the CV with cleaned data
          const updatedParsedData = {
            ...cv.parsed_data,
            work_experience: validWorkExperience
          };
          
          await pool.query(
            'UPDATE "CV" SET parsed_data = $1 WHERE cv_id = $2',
            [JSON.stringify(updatedParsedData), cv.cv_id]
          );
          
          console.log(`✓ CV ${cv.cv_id} updated successfully`);
        } else {
          console.log(`- All entries are valid`);
        }
      }
    }
    
    console.log('\n✅ Cleanup completed successfully!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await pool.end();
  }
}

cleanupWorkExperience();

