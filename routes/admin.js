// routes/admin.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../config/database');
const { uploadProfileImage } = require('../middleware/upload');
const fs = require('fs-extra');
const path = require('path');
const { logActivity } = require('../utils/activityLogger'); // Added for new endpoints

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

// Get all freelancers with ECS Admin management fields (ESC Admin)
router.get('/freelancers', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { availability_status, approval_status, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    console.log('🔍 Admin freelancers query - Query params:', { availability_status, approval_status, page, limit });

    let whereConditions = ['u.is_active = true'];
    const params = [];

    // Filter by availability status (new field)
    if (availability_status && availability_status !== 'all') {
      if (availability_status === 'available') {
        whereConditions.push(`f.is_available = true`);
      } else if (availability_status === 'unavailable') {
        whereConditions.push(`f.is_available = false`);
      }
    }

    // Filter by approval status
    if (approval_status && approval_status !== 'all') {
      whereConditions.push(`f.approval_status = $${params.length + 1}`);
      params.push(approval_status);
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

    // Main query
    const freelancersResult = await db.query(
      `SELECT 
         f.*,
         u.email,
         u.is_active,
         u.created_at as user_created_at,
         u.last_login,
         COALESCE(cv.cv_id, 0) as has_cv,
         COALESCE(cv.upload_date, NULL) as cv_upload_date,
         COALESCE(cv.file_name, '') as cv_file_name
       FROM "Freelancer" f
       JOIN "User" u ON f.user_id = u.user_id
       LEFT JOIN "CV" cv ON f.user_id = cv.user_id
       ${whereClause}
       ORDER BY f.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    console.log(`✅ Found ${freelancersResult.rowCount} freelancers`);

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
    console.error('❌ Get freelancers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update freelancer approval status (ESC Admin)
router.put('/freelancers/:freelancerId/approval', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const { approval_status, admin_notes } = req.body;
    const adminUserId = req.user.user_id;

    console.log(`🔍 ECS Admin ${adminUserId} updating freelancer ${freelancerId} approval status to ${approval_status}`);

    if (!['pending', 'approved', 'rejected'].includes(approval_status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid approval status'
      });
    }

    // Update freelancer approval status
    const result = await db.query(
      `UPDATE "Freelancer" 
       SET approval_status = $1, 
           admin_notes = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE freelancer_id = $3`,
      [approval_status, admin_notes, freelancerId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Freelancer not found'
      });
    }

    // Log the activity
    await logActivity({
      user_id: adminUserId,
      role: 'admin',
      activity_type: 'Freelancer Approval Status Updated',
      details: `Freelancer ID: ${freelancerId}, New Status: ${approval_status}`
    });

    return res.status(200).json({
      success: true,
      message: 'Freelancer approval status updated successfully'
    });
  } catch (error) {
    console.error('❌ Update freelancer approval status error:', error);
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
    const { is_available, admin_notes } = req.body;
    const adminUserId = req.user.user_id;

    console.log(`🔍 ECS Admin ${adminUserId} updating freelancer ${freelancerId} availability to ${is_available}`);

    // Update freelancer availability status
    const result = await db.query(
      `UPDATE "Freelancer" 
       SET is_available = $1, 
           admin_notes = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE freelancer_id = $3`,
      [is_available, admin_notes, freelancerId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Freelancer not found'
      });
    }

    // Log the activity
    await logActivity({
      user_id: adminUserId,
      role: 'admin',
      activity_type: 'Freelancer Availability Updated',
      details: `Freelancer ID: ${freelancerId}, Available: ${is_available}`
    });

    return res.status(200).json({
      success: true,
      message: 'Freelancer availability updated successfully'
    });
  } catch (error) {
    console.error('❌ Update freelancer availability error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Analytics Endpoints for Real-time Data
// Get registration trends with real-time dates
router.get('/analytics/registration-trends', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Get registration data for the last N days
    const result = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_users,
        COUNT(CASE WHEN user_type = 'associate' THEN 1 END) as associates,
        COUNT(CASE WHEN user_type = 'freelancer' THEN 1 END) as freelancers,
        COUNT(CASE WHEN user_type = 'admin' THEN 1 END) as admins
      FROM "User"
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Format the data for the chart
    const trends = result.rows.map(row => ({
      date: row.date,
      users: parseInt(row.total_users),
      associates: parseInt(row.associates),
      freelancers: parseInt(row.freelancers),
      admins: parseInt(row.admins)
    }));

    return res.status(200).json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Analytics registration trends error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch registration trends',
      error: error.message
    });
  }
});

// Get user type distribution
router.get('/analytics/user-type-distribution', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        user_type as type,
        COUNT(*) as count,
        CASE 
          WHEN user_type = 'freelancer' THEN '#fd680e'
          WHEN user_type = 'associate' THEN '#10b981'
          WHEN user_type = 'admin' THEN '#3b82f6'
          ELSE '#6b7280'
        END as fill
      FROM "User"
      WHERE is_active = true
      GROUP BY user_type
      ORDER BY count DESC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows.map(row => ({
        type: row.type.charAt(0).toUpperCase() + row.type.slice(1) + 's',
        count: parseInt(row.count),
        fill: row.fill
      }))
    });
  } catch (error) {
    console.error('Analytics user type distribution error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user type distribution',
      error: error.message
    });
  }
});

// Get user activity status
router.get('/analytics/user-activity-status', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        CASE 
          WHEN is_active = true THEN 'Active'
          ELSE 'Inactive'
        END as status,
        COUNT(*) as count,
        CASE 
          WHEN is_active = true THEN '#10b981'
          ELSE '#6b7280'
        END as fill
      FROM "User"
      GROUP BY is_active
      ORDER BY count DESC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows.map(row => ({
        status: row.status,
        count: parseInt(row.count),
        fill: row.fill
      }))
    });
  } catch (error) {
    console.error('Analytics user activity status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user activity status',
      error: error.message
    });
  }
});

// Get system performance metrics
router.get('/analytics/system-performance', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Get real-time system metrics
    const userCountResult = await db.query('SELECT COUNT(*) FROM "User" WHERE is_active = true');
    const cvCountResult = await db.query('SELECT COUNT(*) FROM "CV"');
    const jobCountResult = await db.query('SELECT COUNT(*) FROM "Job_Posting"');
    const messageCountResult = await db.query('SELECT COUNT(*) FROM "Message"');
    
    // Get recent activity (last 24 hours)
    const recentActivityResult = await db.query(`
      SELECT COUNT(*) as recent_users
      FROM "User" 
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `);

    const performance = {
      total_users: parseInt(userCountResult.rows[0].count),
      total_cvs: parseInt(cvCountResult.rows[0].count),
      total_jobs: parseInt(jobCountResult.rows[0].count),
      total_messages: parseInt(messageCountResult.rows[0].count),
      recent_users_24h: parseInt(recentActivityResult.rows[0].recent_users),
      timestamp: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error('Analytics system performance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch system performance metrics',
      error: error.message
    });
  }
});

module.exports = router;