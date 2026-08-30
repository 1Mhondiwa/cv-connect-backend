// Utility functions for syncing CV parsed data with freelancer profile
const db = require('../config/database');
const logger = require('./logger');

/**
 * Sync CV parsed data with freelancer profile
 * @param {number} freelancerId - The freelancer ID
 * @param {object} parsedData - The parsed CV data
 * @param {boolean} forceUpdate - Whether to force update even if data exists
 * @returns {object} - Result of the sync operation
 */
async function syncCVDataWithProfile(freelancerId, parsedData, forceUpdate = false) {
  try {
    logger.info(`Syncing CV data for freelancer ID: ${freelancerId}`);
    
    const fieldsToUpdate = [];
    const values = [];
    let paramIndex = 1;
    
    // Define the fields to sync with their validation
    // Note: Only include fields that actually exist in the Freelancer table
    const syncFields = [
      { key: 'first_name', required: true },
      { key: 'last_name', required: true },
      { key: 'phone', required: false },
      { key: 'address', required: false },
      { key: 'headline', required: false },
      { key: 'summary', required: false },
      { key: 'linkedin_url', required: false },
      { key: 'github_url', required: false },
      { key: 'years_experience', required: false, type: 'number' }
    ];
    
    // Check current profile data if not forcing update
    let currentProfile = null;
    if (!forceUpdate) {
      const profileResult = await db.query(
        'SELECT * FROM "Freelancer" WHERE freelancer_id = $1',
        [freelancerId]
      );
      currentProfile = profileResult.rows[0];
    }
    
    // Process each field
    for (const field of syncFields) {
      const value = parsedData[field.key];
      
      if (value && (typeof value === 'string' ? value.trim() : value)) {
        // Check if we should update this field
        const shouldUpdate = forceUpdate || 
          !currentProfile || 
          !currentProfile[field.key] || 
          currentProfile[field.key] !== value;
        
        if (shouldUpdate) {
          // Validate and format the value
          let processedValue = value;
          
          if (field.type === 'number') {
            processedValue = parseInt(value) || 0;
          } else if (typeof value === 'string') {
            processedValue = value.trim();
          }
          
          fieldsToUpdate.push(`${field.key} = $${paramIndex++}`);
          values.push(processedValue);
          
          logger.debug(`${field.key}: "${currentProfile?.[field.key] || 'null'}" → "${processedValue}"`);
        } else {
          logger.debug(`${field.key}: Already up to date`);
        }
      } else if (field.required) {
        logger.warn(`${field.key}: Missing required field`);
      }
    }
    
    // Update the profile if there are changes
    if (fieldsToUpdate.length > 0) {
      values.push(freelancerId);
      
      const updateQuery = `
        UPDATE "Freelancer" 
        SET ${fieldsToUpdate.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE freelancer_id = $${paramIndex}
      `;
      
      await db.query(updateQuery, values);
      
      logger.info(`Updated ${fieldsToUpdate.length} fields for freelancer ${freelancerId}`);
      
      return {
        success: true,
        updatedFields: fieldsToUpdate.length,
        message: `Successfully synced ${fieldsToUpdate.length} fields`
      };
    } else {
      logger.info(`No updates needed for freelancer ${freelancerId}`);
      
      return {
        success: true,
        updatedFields: 0,
        message: 'No updates needed - profile already up to date'
      };
    }
    
  } catch (error) {
    logger.error(`Error syncing CV data for freelancer ${freelancerId}:`, error);
    
    return {
      success: false,
      error: error.message,
      message: 'Failed to sync CV data'
    };
  }
}

/**
 * Sync all freelancers with their CV data
 * @param {boolean} forceUpdate - Whether to force update all fields
 * @returns {object} - Summary of sync results
 */
async function syncAllFreelancers(forceUpdate = false) {
  try {
    logger.info('Syncing all freelancers with their CV data...');
    
    const result = await db.query(`
      SELECT 
        f.freelancer_id,
        f.first_name,
        f.last_name,
        cv.parsed_data
      FROM "Freelancer" f
      LEFT JOIN "CV" cv ON f.freelancer_id = cv.freelancer_id
      WHERE cv.parsed_data IS NOT NULL
      ORDER BY f.first_name, f.last_name
    `);
    
    logger.info(`Found ${result.rows.length} freelancers with CV data`);
    logger.info('=====================================');
    
    let successCount = 0;
    let errorCount = 0;
    let totalUpdatedFields = 0;
    
    for (const freelancer of result.rows) {
      try {
        const cvData = typeof freelancer.parsed_data === 'string' 
          ? JSON.parse(freelancer.parsed_data) 
          : freelancer.parsed_data;
        
        logger.info(`Processing: ${freelancer.first_name} ${freelancer.last_name}`);
        
        const syncResult = await syncCVDataWithProfile(
          freelancer.freelancer_id, 
          cvData, 
          forceUpdate
        );
        
        if (syncResult.success) {
          successCount++;
          totalUpdatedFields += syncResult.updatedFields;
        } else {
          errorCount++;
        }
        
      } catch (error) {
        logger.error(`Error processing ${freelancer.first_name} ${freelancer.last_name}:`, error);
        errorCount++;
      }
    }
    
    logger.info('=====================================');
    logger.info('SYNC SUMMARY:');
    logger.info(`Successful: ${successCount} freelancers`);
    logger.info(`Errors: ${errorCount} freelancers`);
    logger.info(`Total fields updated: ${totalUpdatedFields}`);
    logger.info(`Total processed: ${result.rows.length} freelancers`);
    
    return {
      success: true,
      totalProcessed: result.rows.length,
      successful: successCount,
      errors: errorCount,
      totalUpdatedFields
    };
    
  } catch (error) {
    logger.error('Error in syncAllFreelancers:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  syncCVDataWithProfile,
  syncAllFreelancers
};
