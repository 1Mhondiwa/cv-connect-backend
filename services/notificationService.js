// services/notificationService.js
const db = require('../config/database');

class NotificationService {
  // Create a new notification
  static async createNotification({
    user_id,
    notification_type,
    title,
    message,
    data = null,
    scheduled_for = null
  }) {
    try {
      const result = await db.query(
        `INSERT INTO "Notification" (user_id, notification_type, title, message, data, scheduled_for)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [user_id, notification_type, title, message, data ? JSON.stringify(data) : null, scheduled_for]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Send notification via WebSocket
  static async sendNotification(io, notification) {
    try {
      // Emit to specific user
      io.to(`user_${notification.user_id}`).emit('notification', {
        type: 'interview_notification',
        notification: {
          notification_id: notification.notification_id,
          notification_type: notification.notification_type,
          title: notification.title,
          message: notification.message,
          data: notification.data, // Already an object from database
          created_at: notification.created_at
        }
      });

      // Mark as sent
      await db.query(
        'UPDATE "Notification" SET is_sent = true WHERE notification_id = $1',
        [notification.notification_id]
      );

      console.log(`📱 Notification sent to user ${notification.user_id}: ${notification.title}`);
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  // Create interview scheduled notification
  static async createInterviewScheduledNotification({
    freelancer_user_id,
    associate_user_id,
    interview_id,
    interview_type,
    scheduled_date,
    job_title,
    associate_name
  }) {
    const notificationData = {
      interview_id,
      interview_type,
      scheduled_date,
      job_title,
      associate_name
    };

    // Create notification for freelancer
    const freelancerNotification = await this.createNotification({
      user_id: freelancer_user_id,
      notification_type: 'interview_scheduled',
      title: 'New Interview Scheduled',
      message: `${associate_name} has scheduled a ${interview_type} interview with you for "${job_title}" on ${new Date(scheduled_date).toLocaleDateString()} at ${new Date(scheduled_date).toLocaleTimeString()}`,
      data: notificationData
    });

    return freelancerNotification;
  }

  // Create a single smart interview reminder notification
  static async createInterviewReminders(interview_id, freelancer_user_id, scheduled_date, job_title, associate_name) {
    // Create a single reminder notification that will show real-time countdown
    const notificationData = {
      interview_id,
      job_title,
      associate_name,
      scheduled_date: scheduled_date.toISOString(),
      interview_type: 'video' // Default, can be enhanced later
    };

    const reminderNotification = await this.createNotification({
      user_id: freelancer_user_id,
      notification_type: 'interview_reminder',
      title: 'Interview Reminder',
      message: `You have an upcoming interview for "${job_title}" with ${associate_name}`,
      data: notificationData,
      scheduled_for: null // No scheduled sending, always visible with countdown
    });

    return [reminderNotification];
  }

  // Get user notifications
  static async getUserNotifications(user_id, limit = 50) {
    try {
      const result = await db.query(
        `SELECT * FROM "Notification" 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [user_id, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  static async markAsRead(notification_id, user_id) {
    try {
      await db.query(
        'UPDATE "Notification" SET is_read = true WHERE notification_id = $1 AND user_id = $2',
        [notification_id, user_id]
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Get pending scheduled notifications
  static async getPendingScheduledNotifications() {
    try {
      const result = await db.query(
        `SELECT * FROM "Notification" 
         WHERE scheduled_for <= NOW() 
         AND is_sent = false 
         ORDER BY scheduled_for ASC`
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting pending scheduled notifications:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
