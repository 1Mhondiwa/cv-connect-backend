// utils/contractManager.js
const db = require('../config/database');

/**
 * Updates expired contracts to completed status
 * This function should be called before checking freelancer availability
 * @returns {Promise<Object>} Result object with updated count and details
 */
const updateExpiredContracts = async () => {
  try {
    console.log('🔄 Checking for expired contracts...');
    
    // Call the database function to update expired contracts
    const result = await db.query('SELECT update_expired_contracts() as updated_count');
    const updatedCount = parseInt(result.rows[0].updated_count);
    
    if (updatedCount > 0) {
      console.log(`✅ Updated ${updatedCount} expired contracts to completed status`);
      
      // Log activity for each updated contract (optional - for audit trail)
      const expiredContracts = await db.query(
        `SELECT hire_id, freelancer_id, associate_id, project_title, expected_end_date
         FROM "Freelancer_Hire" 
         WHERE status = 'completed' 
         AND actual_end_date = CURRENT_DATE
         AND expected_end_date < CURRENT_DATE`
      );
      
      for (const contract of expiredContracts.rows) {
        console.log(`📋 Contract ${contract.hire_id} for freelancer ${contract.freelancer_id} marked as completed`);
      }
    } else {
      console.log('✅ No expired contracts found');
    }
    
    return {
      success: true,
      updated_count: updatedCount,
      message: updatedCount > 0 ? `Updated ${updatedCount} expired contracts` : 'No expired contracts found'
    };
    
  } catch (error) {
    console.error('❌ Error updating expired contracts:', error);
    return {
      success: false,
      updated_count: 0,
      error: error.message
    };
  }
};

/**
 * Checks if a freelancer is available for hiring
 * This function considers both active status and contract end dates
 * @param {number} freelancerId - The freelancer ID to check
 * @returns {Promise<Object>} Availability status object
 */
const checkFreelancerAvailability = async (freelancerId) => {
  try {
    // First, update any expired contracts
    await updateExpiredContracts();
    
    // Check for any active contracts that haven't expired
    const activeContractsResult = await db.query(
      `SELECT hire_id, project_title, expected_end_date, status
       FROM "Freelancer_Hire" 
       WHERE freelancer_id = $1 
       AND status = 'active' 
       AND (expected_end_date IS NULL OR expected_end_date > CURRENT_DATE)`,
      [freelancerId]
    );
    
    const isAvailable = activeContractsResult.rowCount === 0;
    
    return {
      success: true,
      is_available: isAvailable,
      active_contracts: activeContractsResult.rows,
      message: isAvailable ? 'Freelancer is available for hiring' : 'Freelancer has active contracts'
    };
    
  } catch (error) {
    console.error('❌ Error checking freelancer availability:', error);
    return {
      success: false,
      is_available: false,
      error: error.message
    };
  }
};

/**
 * Gets all expired contracts for a specific freelancer
 * @param {number} freelancerId - The freelancer ID
 * @returns {Promise<Object>} Expired contracts result
 */
const getExpiredContracts = async (freelancerId) => {
  try {
    const result = await db.query(
      `SELECT hire_id, project_title, expected_end_date, actual_end_date, status
       FROM "Freelancer_Hire" 
       WHERE freelancer_id = $1 
       AND status = 'active' 
       AND expected_end_date IS NOT NULL 
       AND expected_end_date < CURRENT_DATE`,
      [freelancerId]
    );
    
    return {
      success: true,
      expired_contracts: result.rows,
      count: result.rowCount
    };
    
  } catch (error) {
    console.error('❌ Error getting expired contracts:', error);
    return {
      success: false,
      expired_contracts: [],
      error: error.message
    };
  }
};

module.exports = {
  updateExpiredContracts,
  checkFreelancerAvailability,
  getExpiredContracts
};
