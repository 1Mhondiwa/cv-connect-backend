// services/contractScheduler.js
const cron = require('node-cron');
const { updateExpiredContracts } = require('../utils/contractManager');
const logger = require('../utils/logger');

/**
 * Contract Expiration Scheduler
 * Runs daily at 2 AM to automatically update expired contracts
 */
class ContractScheduler {
  constructor() {
    this.isRunning = false;
    this.job = null;
  }

  /**
   * Start the contract expiration scheduler
   */
  start() {
    if (this.isRunning) {
      logger.info('âš ï¸ Contract scheduler is already running');
      return;
    }

    // Schedule job to run daily at 2:00 AM
    this.job = cron.schedule('0 2 * * *', async () => {
      logger.info('ðŸ• Running scheduled contract expiration check...');
      try {
        const result = await updateExpiredContracts();
        if (result.success && result.updated_count > 0) {
          logger.info(`âœ… Scheduled job completed: ${result.message}`);
        } else {
          logger.info('âœ… Scheduled job completed: No expired contracts found');
        }
      } catch (error) {
        logger.error('âŒ Scheduled contract expiration check failed:', error);
      }
    }, {
      scheduled: false, // Don't start immediately
      timezone: 'UTC'
    });

    this.job.start();
    this.isRunning = true;
    
    logger.info('âœ… Contract expiration scheduler started - runs daily at 2:00 AM UTC');
  }

  /**
   * Stop the contract expiration scheduler
   */
  stop() {
    if (!this.isRunning || !this.job) {
      logger.info('âš ï¸ Contract scheduler is not running');
      return;
    }

    this.job.stop();
    this.job = null;
    this.isRunning = false;
    
    logger.info('ðŸ›‘ Contract expiration scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.job ? this.job.nextDate() : null
    };
  }

  /**
   * Run the contract expiration check manually (for testing or immediate execution)
   */
  async runNow() {
    logger.info('ðŸ”„ Running manual contract expiration check...');
    try {
      const result = await updateExpiredContracts();
      logger.info(result.success ? `âœ… Manual check completed: ${result.message}` : `âŒ Manual check failed: ${result.error}`);
      return result;
    } catch (error) {
      logger.error('âŒ Manual contract expiration check failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const contractScheduler = new ContractScheduler();

module.exports = contractScheduler;
