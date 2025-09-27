// services/contractScheduler.js
const cron = require('node-cron');
const { updateExpiredContracts } = require('../utils/contractManager');

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
      console.log('⚠️ Contract scheduler is already running');
      return;
    }

    // Schedule job to run daily at 2:00 AM
    this.job = cron.schedule('0 2 * * *', async () => {
      console.log('🕐 Running scheduled contract expiration check...');
      try {
        const result = await updateExpiredContracts();
        if (result.success && result.updated_count > 0) {
          console.log(`✅ Scheduled job completed: ${result.message}`);
        } else {
          console.log('✅ Scheduled job completed: No expired contracts found');
        }
      } catch (error) {
        console.error('❌ Scheduled contract expiration check failed:', error);
      }
    }, {
      scheduled: false, // Don't start immediately
      timezone: 'UTC'
    });

    this.job.start();
    this.isRunning = true;
    
    console.log('✅ Contract expiration scheduler started - runs daily at 2:00 AM UTC');
  }

  /**
   * Stop the contract expiration scheduler
   */
  stop() {
    if (!this.isRunning || !this.job) {
      console.log('⚠️ Contract scheduler is not running');
      return;
    }

    this.job.stop();
    this.job = null;
    this.isRunning = false;
    
    console.log('🛑 Contract expiration scheduler stopped');
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
    console.log('🔄 Running manual contract expiration check...');
    try {
      const result = await updateExpiredContracts();
      console.log(result.success ? `✅ Manual check completed: ${result.message}` : `❌ Manual check failed: ${result.error}`);
      return result;
    } catch (error) {
      console.error('❌ Manual contract expiration check failed:', error);
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
