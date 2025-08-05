// routes/admin.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../config/database');
const { uploadProfileImage } = require('../middleware/upload');
const fs = require('fs-extra');
const path = require('path');

// Get system stats (ESC Admin)
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
    
    // Get associate request counts by status
    const requestCountResult = await db.query(
      `SELECT status, COUNT(*) 
       FROM "Associate_Request" 
       GROUP BY status`
    );
    
    // Get freelancer availability counts
    const availabilityCountResult = await db.query(
      `SELECT availability_status, COUNT(*) 
       FROM "Freelancer" 
       GROUP BY availability_status`
    );
    
    // Format the user counts
    const userCounts = {};
    userCountResult.rows.forEach(row => {
      userCounts[row.user_type] = parseInt(row.count);
    });
    
    // Format the request counts
    const requestCounts = {};
    requestCountResult.rows.forEach(row => {
      requestCounts[row.status] = parseInt(row.count);
    });
    
    // Format the availability counts
    const availabilityCounts = {};
    availabilityCountResult.rows.forEach(row => {
      availabilityCounts[row.availability_status] = parseInt(row.count);
    });
    
    const stats = {
      users: userCounts,
      total_cvs: parseInt(cvCountResult.rows[0].count),
      total_jobs: parseInt(jobCountResult.rows[0].count),
      total_messages: parseInt(messageCountResult.rows[0].count),
      associate_requests: requestCounts,
      freelancer_availability: availabilityCounts
    };
    
    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('ESC Admin stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all freelancers with availability status (ESC Admin)
router.get('/freelancers', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { availability_status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['u.is_active = true'];
    const params = [];

    // Filter by availability status
    if (availability_status && availability_status !== 'all') {
      whereConditions.push(`f.availability_status = $${params.length + 1}`);
      params.push(availability_status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `
      SELECT COUNT(*) 
      FROM "Freelancer" f
      JOIN "User" u ON f.user_id = u.user_id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Main query with availability status
    const freelancersResult = await db.query(
      `SELECT f.*, u.email, u.created_at, u.last_login, u.is_active, u.is_verified
       FROM "Freelancer" f
       JOIN "User" u ON f.user_id = u.user_id
       ${whereClause}
       ORDER BY f.freelancer_id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    
    return res.status(200).json({
      success: true,
      freelancers: freelancersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
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

// Update freelancer availability status (ESC Admin)
router.put('/freelancers/:freelancerId/availability', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const { availability_status } = req.body;

    // Validate availability status
    if (!['available', 'unavailable', 'busy'].includes(availability_status)) {
      return res.status(400).json({
        success: false,
        message: 'Availability status must be: available, unavailable, or busy'
      });
    }

    // Check if freelancer exists
    const freelancerResult = await db.query(
      'SELECT freelancer_id FROM "Freelancer" WHERE freelancer_id = $1',
      [freelancerId]
    );

    if (freelancerResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Freelancer not found'
      });
    }

    // Update availability status
    await db.query(
      'UPDATE "Freelancer" SET availability_status = $1 WHERE freelancer_id = $2',
      [availability_status, freelancerId]
    );

    return res.status(200).json({
      success: true,
      message: `Freelancer availability updated to ${availability_status}`,
      availability_status: availability_status
    });
  } catch (error) {
    console.error('Update freelancer availability error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Upload or update admin profile image
router.post('/profile-image', authenticateToken, requireRole(['admin']), uploadProfileImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded'
      });
    }
    const userId = req.user.user_id;
    // Get current admin info
    const userResult = await db.query(
      'SELECT profile_picture_url FROM "User" WHERE user_id = $1',
      [userId]
    );
    if (userResult.rowCount === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    const oldImageUrl = userResult.rows[0].profile_picture_url;
    // Delete old image if it exists
    if (oldImageUrl) {
      const oldImagePath = path.join(__dirname, '..', oldImageUrl);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    // Update user with new image URL
    const imageUrl = `/uploads/profile_images/${req.file.filename}`;
    await db.query(
      'UPDATE "User" SET profile_picture_url = $1 WHERE user_id = $2',
      [imageUrl, userId]
    );
    return res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      image_url: imageUrl
    });
  } catch (error) {
    console.error('Admin profile image upload error:', error);
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Delete admin profile image
router.delete('/profile-image', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    // Get current admin info
    const userResult = await db.query(
      'SELECT profile_picture_url FROM "User" WHERE user_id = $1',
      [userId]
    );
    if (userResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    const imageUrl = userResult.rows[0].profile_picture_url;
    // Delete image file if it exists
    if (imageUrl) {
      const imagePath = path.join(__dirname, '..', imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      // Update user record
      await db.query(
        'UPDATE "User" SET profile_picture_url = NULL WHERE user_id = $1',
        [userId]
      );
    }
    return res.status(200).json({
      success: true,
      message: 'Profile image deleted successfully'
    });
  } catch (error) {
    console.error('Admin profile image deletion error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;