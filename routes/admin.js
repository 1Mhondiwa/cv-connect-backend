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
    const { availability_status, approval_status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

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
      if (approval_status === 'approved') {
        whereConditions.push(`f.is_approved = true`);
      } else if (approval_status === 'pending') {
        whereConditions.push(`f.is_approved = false`);
      }
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

    // Main query with all new ECS Admin management fields
    const freelancersResult = await db.query(
      `SELECT 
         f.freelancer_id,
         f.user_id,
         f.first_name,
         f.last_name,
         f.headline,
         f.phone,
         f.is_approved,
         f.approval_date,
         f.approved_by,
         f.is_available,
         f.availability_notes,
         f.admin_rating,
         f.admin_notes,
         f.last_admin_review,
         u.email,
         u.created_at,
         u.last_login,
         u.is_active,
         u.is_verified
       FROM "Freelancer" f
       JOIN "User" u ON f.user_id = u.user_id
       ${whereClause}
       ORDER BY f.is_approved DESC, f.admin_rating DESC, f.freelancer_id DESC
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

// Freelancer approval endpoint
router.put('/freelancers/:freelancerId/approve', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const adminUserId = req.user.user_id;

    console.log(`🔐 ECS Admin ${adminUserId} approving freelancer ${freelancerId}`);

    // Update freelancer approval status
    const result = await db.query(
      `UPDATE "Freelancer" 
       SET is_approved = TRUE, 
           approval_date = CURRENT_TIMESTAMP, 
           approved_by = $1,
           last_admin_review = CURRENT_TIMESTAMP
       WHERE freelancer_id = $2`,
      [adminUserId, freelancerId]
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
      activity_type: 'Freelancer Approved',
      details: `Approved freelancer ID: ${freelancerId}`
    });

    console.log(`✅ Freelancer ${freelancerId} approved successfully by ECS Admin ${adminUserId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Freelancer approved successfully'
    });
  } catch (error) {
    console.error('❌ Freelancer approval error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Freelancer rejection endpoint
router.put('/freelancers/:freelancerId/reject', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const adminUserId = req.user.user_id;

    console.log(`🔐 ECS Admin ${adminUserId} rejecting freelancer ${freelancerId}`);

    // Update freelancer approval status
    const result = await db.query(
      `UPDATE "Freelancer" 
       SET is_approved = FALSE, 
           approval_date = NULL, 
           approved_by = NULL,
           last_admin_review = CURRENT_TIMESTAMP
       WHERE freelancer_id = $2`,
      [adminUserId, freelancerId]
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
      activity_type: 'Freelancer Rejected',
      details: `Rejected freelancer ID: ${freelancerId}`
    });

    console.log(`✅ Freelancer ${freelancerId} rejected successfully by ECS Admin ${adminUserId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Freelancer rejected successfully'
    });
  } catch (error) {
    console.error('❌ Freelancer rejection error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update freelancer admin rating
router.put('/freelancers/:freelancerId/rating', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const { rating } = req.body;
    const adminUserId = req.user.user_id;

    console.log(`🔐 ECS Admin ${adminUserId} updating rating for freelancer ${freelancerId} to ${rating}`);

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Update freelancer rating
    const result = await db.query(
      `UPDATE "Freelancer" 
       SET admin_rating = $1, 
           last_admin_review = CURRENT_TIMESTAMP
       WHERE freelancer_id = $2`,
      [rating, freelancerId]
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
      activity_type: 'Freelancer Rating Updated',
      details: `Updated rating to ${rating}/5 for freelancer ID: ${freelancerId}`
    });

    console.log(`✅ Freelancer ${freelancerId} rating updated to ${rating} by ECS Admin ${adminUserId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Freelancer rating updated successfully'
    });
  } catch (error) {
    console.error('❌ Freelancer rating update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update freelancer admin notes
router.put('/freelancers/:freelancerId/notes', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const { notes } = req.body;
    const adminUserId = req.user.user_id;

    console.log(`🔐 ECS Admin ${adminUserId} updating notes for freelancer ${freelancerId}`);

    // Update freelancer notes
    const result = await db.query(
      `UPDATE "Freelancer" 
       SET admin_notes = $1, 
           last_admin_review = CURRENT_TIMESTAMP
       WHERE freelancer_id = $2`,
      [notes, freelancerId]
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
      activity_type: 'Freelancer Notes Updated',
      details: `Updated admin notes for freelancer ID: ${freelancerId}`
    });

    console.log(`✅ Freelancer ${freelancerId} notes updated by ECS Admin ${adminUserId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Freelancer notes updated successfully'
    });
  } catch (error) {
    console.error('❌ Freelancer notes update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update freelancer availability
router.put('/freelancers/:freelancerId/availability', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const { is_available } = req.body;
    const adminUserId = req.user.user_id;

    console.log(`🔐 ECS Admin ${adminUserId} updating availability for freelancer ${freelancerId} to ${is_available}`);

    // Update freelancer availability
    const result = await db.query(
      `UPDATE "Freelancer" 
       SET is_available = $1, 
           last_admin_review = CURRENT_TIMESTAMP
       WHERE freelancer_id = $2`,
      [is_available, freelancerId]
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
      details: `Updated availability to ${is_available ? 'Available' : 'Unavailable'} for freelancer ID: ${freelancerId}`
    });

    console.log(`✅ Freelancer ${freelancerId} availability updated to ${is_available} by ECS Admin ${adminUserId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Freelancer availability updated successfully'
    });
  } catch (error) {
    console.error('❌ Freelancer availability update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all associate freelancer requests (ESC Admin)
router.get('/associate-requests', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    const params = [];

    // Filter by status
    if (status && status !== 'all') {
      whereConditions.push(`r.status = $${params.length + 1}`);
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `
      SELECT COUNT(*) 
      FROM "Associate_Freelancer_Request" r
      JOIN "Associate" a ON r.associate_id = a.associate_id
      JOIN "User" u ON a.user_id = u.user_id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Main query
    const requestsResult = await db.query(
      `SELECT 
         r.*,
         a.contact_person,
         a.industry,
         u.email as associate_email,
         COUNT(fr.recommendation_id) as recommendation_count,
         COUNT(rr.response_id) as response_count
       FROM "Associate_Freelancer_Request" r
       JOIN "Associate" a ON r.associate_id = a.associate_id
       JOIN "User" u ON a.user_id = u.user_id
       LEFT JOIN "Freelancer_Recommendation" fr ON r.request_id = fr.request_id
       LEFT JOIN "Request_Response" rr ON r.request_id = rr.request_id
       ${whereClause}
       GROUP BY r.request_id, a.contact_person, a.industry, u.email
       ORDER BY r.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    console.log(`✅ Found ${requestsResult.rowCount} associate freelancer requests`);

    return res.status(200).json({
      success: true,
      requests: requestsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('❌ Get associate requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get specific associate request with details (ESC Admin)
router.get('/associate-requests/:requestId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminUserId = req.user.user_id;

    console.log(`🔍 ECS Admin ${adminUserId} fetching associate request ${requestId}`);

    // Get request details
    const requestResult = await db.query(
      `SELECT 
         r.*,
         a.contact_person,
         a.industry,
         a.phone,
         a.address,
         u.email as associate_email
       FROM "Associate_Freelancer_Request" r
       JOIN "Associate" a ON r.associate_id = a.associate_id
       JOIN "User" u ON a.user_id = u.user_id
       WHERE r.request_id = $1`,
      [requestId]
    );

    if (requestResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const request = requestResult.rows[0];

    // Get existing recommendations
    const recommendationsResult = await db.query(
      `SELECT 
         fr.*,
         f.first_name,
         f.last_name,
         f.headline,
         f.admin_rating,
         f.is_available,
         u.email as freelancer_email
       FROM "Freelancer_Recommendation" fr
       JOIN "Freelancer" f ON fr.freelancer_id = f.freelancer_id
       JOIN "User" u ON f.user_id = u.user_id
       WHERE fr.request_id = $1
       ORDER BY fr.is_highlighted DESC, fr.admin_rating DESC`,
      [requestId]
    );

    // Get associate responses
    const responsesResult = await db.query(
      `SELECT 
         rr.*,
         f.first_name,
         f.last_name,
         u.email as freelancer_email
       FROM "Request_Response" rr
       JOIN "Freelancer" f ON rr.freelancer_id = f.freelancer_id
       JOIN "User" u ON f.user_id = u.user_id
       WHERE rr.request_id = $1`,
      [requestId]
    );

    console.log(`✅ Request ${requestId} details fetched successfully`);

    return res.status(200).json({
      success: true,
      request,
      recommendations: recommendationsResult.rows,
      responses: responsesResult.rows
    });
  } catch (error) {
    console.error('❌ Get request details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Add freelancer recommendations to a request (ESC Admin)
router.post('/associate-requests/:requestId/recommendations', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { freelancer_ids, admin_notes, highlighted_freelancers } = req.body;
    const adminUserId = req.user.user_id;

    console.log(`🔍 ECS Admin ${adminUserId} adding recommendations to request ${requestId}`);

    if (!freelancer_ids || freelancer_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one freelancer must be selected'
      });
    }

    // Verify the request exists
    const requestResult = await db.query(
      'SELECT status FROM "Associate_Freelancer_Request" WHERE request_id = $1',
      [requestId]
    );

    if (requestResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check if request is already reviewed
    if (requestResult.rows[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request has already been reviewed'
      });
    }

    // Clear existing recommendations
    await db.query(
      'DELETE FROM "Freelancer_Recommendation" WHERE request_id = $1',
      [requestId]
    );

    // Add new recommendations
    for (let i = 0; i < freelancer_ids.length; i++) {
      const freelancerId = freelancer_ids[i];
      const isHighlighted = highlighted_freelancers && highlighted_freelancers.includes(freelancerId);
      
      await db.query(
        `INSERT INTO "Freelancer_Recommendation" 
         (request_id, freelancer_id, admin_notes, is_highlighted)
         VALUES ($1, $2, $3, $4)`,
        [requestId, freelancerId, admin_notes || '', isHighlighted]
      );
    }

    // Update request status
    await db.query(
      `UPDATE "Associate_Freelancer_Request" 
       SET status = 'provided', 
           reviewed_at = CURRENT_TIMESTAMP,
           reviewed_by = $1
       WHERE request_id = $2`,
      [adminUserId, requestId]
    );

    // Log the activity
    await logActivity({
      user_id: adminUserId,
      role: 'admin',
      activity_type: 'Freelancer Recommendations Provided',
      details: `Request ID: ${requestId}, Freelancers: ${freelancer_ids.length}`
    });

    console.log(`✅ ${freelancer_ids.length} recommendations added to request ${requestId}`);

    return res.status(200).json({
      success: true,
      message: 'Recommendations added successfully'
    });
  } catch (error) {
    console.error('❌ Add recommendations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update request status (ESC Admin)
router.put('/associate-requests/:requestId/status', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, admin_notes } = req.body;
    const adminUserId = req.user.user_id;

    console.log(`🔍 ECS Admin ${adminUserId} updating request ${requestId} status to ${status}`);

    if (!['pending', 'reviewed', 'provided', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Update request
    const result = await db.query(
      `UPDATE "Associate_Freelancer_Request" 
       SET status = $1, 
           admin_notes = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $3`,
      [status, admin_notes, requestId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Log the activity
    await logActivity({
      user_id: adminUserId,
      role: 'admin',
      activity_type: 'Request Status Updated',
      details: `Request ID: ${requestId}, New Status: ${status}`
    });

    console.log(`✅ Request ${requestId} status updated to ${status}`);

    return res.status(200).json({
      success: true,
      message: 'Request status updated successfully'
    });
  } catch (error) {
    console.error('❌ Update request status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all associate freelancer requests (ESC Admin)
router.get('/associate-requests', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    const params = [];

    // Filter by status
    if (status && status !== 'all') {
      whereConditions.push(`r.status = $${params.length + 1}`);
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `
      SELECT COUNT(*) 
      FROM "Associate_Freelancer_Request" r
      JOIN "Associate" a ON r.associate_id = a.associate_id
      JOIN "User" u ON a.user_id = u.user_id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Main query
    const requestsResult = await db.query(
      `SELECT 
         r.*,
         a.contact_person,
         a.industry,
         u.email as associate_email,
         COUNT(fr.recommendation_id) as recommendation_count,
         COUNT(rr.response_id) as response_count
       FROM "Associate_Freelancer_Request" r
       JOIN "Associate" a ON r.associate_id = a.associate_id
       JOIN "User" u ON a.user_id = u.user_id
       LEFT JOIN "Freelancer_Recommendation" fr ON r.request_id = fr.request_id
       LEFT JOIN "Request_Response" rr ON r.request_id = rr.request_id
       ${whereClause}
       GROUP BY r.request_id, a.contact_person, a.industry, u.email
       ORDER BY r.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    console.log(`✅ Found ${requestsResult.rowCount} associate freelancer requests`);

    return res.status(200).json({
      success: true,
      requests: requestsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('❌ Get associate requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;