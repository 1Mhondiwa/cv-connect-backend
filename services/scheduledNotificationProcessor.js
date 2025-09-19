// services/scheduledNotificationProcessor.js
const NotificationService = require('./notificationService');

class ScheduledNotificationProcessor {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
  }

  // Start the scheduled notification processor
  start() {
    if (this.isRunning) {
      console.log('📱 Scheduled notification processor already running');
      return;
    }

    this.isRunning = true;
    console.log('📱 Starting scheduled notification processor');

    // Check for pending notifications every 30 seconds
    this.intervalId = setInterval(async () => {
      try {
        await this.processPendingNotifications();
      } catch (error) {
        console.error('❌ Error processing pending notifications:', error);
      }
    }, 30000); // 30 seconds
  }

  // Stop the scheduled notification processor
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('📱 Scheduled notification processor stopped');
  }

  // Process pending scheduled notifications
  async processPendingNotifications() {
    try {
      const pendingNotifications = await NotificationService.getPendingScheduledNotifications();
      
      if (pendingNotifications.length === 0) {
        return;
      }

      console.log(`📱 Processing ${pendingNotifications.length} pending notifications`);

      for (const notification of pendingNotifications) {
        try {
          // Send notification via WebSocket if available
          if (global.io) {
            await NotificationService.sendNotification(global.io, notification);
            console.log(`📱 Scheduled notification sent: ${notification.title}`);
          } else {
            console.log('⚠️ WebSocket not available, notification queued for later');
          }
        } catch (error) {
          console.error(`❌ Failed to send notification ${notification.notification_id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error processing pending notifications:', error);
    }
  }

  // Process notifications immediately (for testing)
  async processNow() {
    console.log('📱 Processing notifications immediately...');
    await this.processPendingNotifications();
  }
}

// Create singleton instance
const scheduledNotificationProcessor = new ScheduledNotificationProcessor();

module.exports = scheduledNotificationProcessor;
