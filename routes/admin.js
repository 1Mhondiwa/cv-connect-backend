// routes/admin.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../config/database');

// Get system stats
router.get('/stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Get user count by type
    const userCountResult = await db.query(
      `SELECT user_type, COUNT(*) 
       FROM "User" 
       GROUP BY user_type`
    );
    
    // Get CV count
    const cvCountResult = await db.query('SELECT COUNT(*) FROM "CV"');
    
    // Get job posting count
    const jobCountResult = await db.query('SELECT COUNT(*) FROM "Job_Posting"');
    
    // Get message count
    const messageCountResult = await db.query('SELECT COUNT(*) FROM "Message"');
    
    // Format the user counts
    const userCounts = {};
    userCountResult.rows.forEach(row => {
      userCounts[row.user_type] = parseInt(row.count);
    });
    
    const stats = {
      users: userCounts,
      total_cvs: parseInt(cvCountResult.rows[0].count),
      total_jobs: parseInt(jobCountResult.rows[0].count),
      total_messages: parseInt(messageCountResult.rows[0].count)
    };
    
    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all freelancers
router.get('/freelancers', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const freelancersResult = await db.query(
      `SELECT f.*, u.email, u.created_at, u.last_login, u.is_active, u.is_verified
       FROM "Freelancer" f
       JOIN "User" u ON f.user_id = u.user_id
       ORDER BY f.freelancer_id DESC`
    );
    
    return res.status(200).json({
      success: true,
      freelancers: freelancersResult.rows
    });
  } catch (error) {
    console.error('Get freelancers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all associates
router.get('/associates', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const associatesResult = await db.query(
      `SELECT a.*, u.email, u.created_at, u.last_login, u.is_active, u.is_verified
       FROM "Associate" a
       JOIN "User" u ON a.user_id = u.user_id
       ORDER BY a.associate_id DESC`
    );
    
    return res.status(200).json({
      success: true,
      associates: associatesResult.rows
    });
  } catch (error) {
    console.error('Get associates error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Toggle user active status
router.put('/users/:userId/toggle-active', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get current status
    const userResult = await db.query(
      'SELECT is_active FROM "User" WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const currentStatus = userResult.rows[0].is_active;
    
    // Toggle status
    await db.query(
      'UPDATE "User" SET is_active = $1 WHERE user_id = $2',
      [!currentStatus, userId]
    );

    return res.status(200).json({
      success: true,
      message: `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      is_active: !currentStatus
    });
  } catch (error) {
    console.error('Toggle user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;