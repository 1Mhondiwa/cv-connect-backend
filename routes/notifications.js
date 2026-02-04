const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, type } = req.query;
    const userId = req.user.user_id;
    
    let query = `
      SELECT 
        n.*,
        u.first_name,
        u.last_name,
        u.email
      FROM "Notification" n
      LEFT JOIN "User" u ON n.sender_id = u.user_id
      WHERE n.user_id = $1
    `;
    
    const params = [userId];
    
    if (type) {
      query += ` AND n.notification_type = $${params.length + 1}`;
      params.push(type);
    }
    
    query += ` ORDER BY n.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

// Get notification count
router.get('/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const result = await pool.query(`
      SELECT COUNT(*) as total_count,
             COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count
      FROM "Notification"
      WHERE user_id = $1
    `, [userId]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching notification count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification count'
    });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    
    const result = await pool.query(`
      UPDATE "Notification" 
      SET is_read = true, updated_at = NOW()
      WHERE notification_id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const result = await pool.query(`
      UPDATE "Notification" 
      SET is_read = true, updated_at = NOW()
      WHERE user_id = $1 AND is_read = false
      RETURNING notification_id
    `, [userId]);
    
    res.json({
      success: true,
      message: `Marked ${result.rows.length} notifications as read`
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    
    const result = await pool.query(`
      DELETE FROM "Notification" 
      WHERE notification_id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
});

// Create notification (for internal use)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      user_id, 
      notification_type, 
      title, 
      message, 
      data, 
      sender_id 
    } = req.body;
    
    const result = await pool.query(`
      INSERT INTO "Notification" (
        user_id, notification_type, title, message, data, sender_id, 
        is_read, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, false, NOW(), NOW())
      RETURNING *
    `, [user_id, notification_type, title, message, JSON.stringify(data), sender_id]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification'
    });
  }
});

module.exports = router;
