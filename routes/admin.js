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
    // If availability_status is 'all' or not provided, don't filter by availability

    // Filter by approval status
    if (approval_status && approval_status !== 'all') {
      if (approval_status === 'approved') {
        whereConditions.push(`f.is_approved = true`);
      } else if (approval_status === 'pending') {
        whereConditions.push(`f.is_approved = false`);
      }
    }
    // If approval_status is 'all' or not provided, don't filter by approval status

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    console.log('🔍 Admin freelancers query - Where conditions:', whereConditions);
    console.log('🔍 Admin freelancers query - Final WHERE clause:', whereClause);
    console.log('🔍 Admin freelancers query - Params:', params);

    // Count query
    const countQuery = `
      SELECT COUNT(*) 
      FROM "Freelancer" f
      JOIN "User" u ON f.user_id = u.user_id
      ${whereClause}
    `;
    console.log('🔍 Admin freelancers query - Count query:', countQuery);
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);
    console.log('🔍 Admin freelancers query - Count result:', totalCount);

    // Main query with all new ECS Admin management fields
    const mainQuery = `
      SELECT 
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
         f.years_experience as experience_years,
         f.summary,
         f.profile_picture_url,
         f.current_status,
         f.linkedin_url,
         f.github_url,
         f.education_summary,
         f.work_history,
         f.availability_status,
         ARRAY[f.headline, f.current_status] as skills,
         f.address as location,
         u.email,
         u.created_at,
         u.last_login,
         u.is_active,
         u.is_verified
       FROM "Freelancer" f
       JOIN "User" u ON f.user_id = u.user_id
       ${whereClause}
       ORDER BY f.is_approved DESC, f.admin_rating DESC, f.freelancer_id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    
    console.log('🔍 Admin freelancers query - Main query:', mainQuery);
    console.log('🔍 Admin freelancers query - Query params:', [...params, limit, offset]);
    
    const freelancersResult = await db.query(mainQuery, [...params, limit, offset]);
    console.log('🔍 Admin freelancers query - Results count:', freelancersResult.rows.length);
    
    const response = {
      success: true,
      freelancers: freelancersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    };
    
    console.log('🔍 Admin freelancers query - Final response:', {
      success: response.success,
      freelancerCount: response.freelancers.length,
      totalCount: response.pagination.total
    });
    
    return res.status(200).json(response);
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

// Get CV upload trends
router.get('/analytics/cv-upload-trends', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as uploads,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
      FROM "CV"
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    const trends = result.rows.map(row => ({
      date: row.date,
      uploads: parseInt(row.uploads),
      approved: parseInt(row.approved),
      rejected: parseInt(row.rejected)
    }));

    return res.status(200).json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Analytics CV upload trends error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch CV upload trends',
      error: error.message
    });
  }
});

// Get top skills
router.get('/analytics/top-skills', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        skill_name as skill,
        COUNT(*) as count,
        CASE 
          WHEN skill_name = 'JavaScript' THEN '#fd680e'
          WHEN skill_name = 'React' THEN '#10b981'
          WHEN skill_name = 'Python' THEN '#3b82f6'
          WHEN skill_name = 'Node.js' THEN '#8b5cf6'
          WHEN skill_name = 'SQL' THEN '#f59e0b'
          WHEN skill_name = 'AWS' THEN '#ef4444'
          ELSE '#6b7280'
        END as fill
      FROM "Skill"
      GROUP BY skill_name
      ORDER BY count DESC
      LIMIT 10
    `);

    return res.status(200).json({
      success: true,
      data: result.rows.map(row => ({
        skill: row.skill,
        count: parseInt(row.count),
        fill: row.fill
      }))
    });
  } catch (error) {
    console.error('Analytics top skills error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch top skills',
      error: error.message
    });
  }
});

// Get CV file types
router.get('/analytics/cv-file-types', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        file_type as type,
        COUNT(*) as count,
        CASE 
          WHEN file_type = 'PDF' THEN '#ef4444'
          WHEN file_type = 'DOCX' THEN '#3b82f6'
          WHEN file_type = 'DOC' THEN '#10b981'
          WHEN file_type = 'TXT' THEN '#f59e0b'
          ELSE '#6b7280'
        END as fill
      FROM "CV"
      GROUP BY file_type
      ORDER BY count DESC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows.map(row => ({
        type: row.type,
        count: parseInt(row.count),
        fill: row.fill
      }))
    });
  } catch (error) {
    console.error('Analytics CV file types error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch CV file types',
      error: error.message
    });
  }
});

// Get message trends
router.get('/analytics/message-trends', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await db.query(`
      SELECT 
        DATE(sent_at) as date,
        COUNT(*) as messages,
        COUNT(DISTINCT conversation_id) as conversations
      FROM "Message"
      WHERE sent_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(sent_at)
      ORDER BY date ASC
    `);

    const trends = result.rows.map(row => ({
      date: row.date,
      messages: parseInt(row.messages),
      conversations: parseInt(row.conversations)
    }));

    return res.status(200).json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Analytics message trends error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch message trends',
      error: error.message
    });
  }
});

// Get user communication activity
router.get('/analytics/user-communication-activity', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        CASE 
          WHEN u.user_type = 'associate' THEN a.contact_person
          WHEN u.user_type = 'freelancer' THEN f.first_name || ' ' || f.last_name
          ELSE u.email
        END as user,
        COUNT(m.message_id) as messages,
        COUNT(DISTINCT m.conversation_id) as conversations,
        CASE 
          WHEN u.user_type = 'freelancer' THEN '#fd680e'
          WHEN u.user_type = 'associate' THEN '#10b981'
          WHEN u.user_type = 'admin' THEN '#3b82f6'
          ELSE '#6b7280'
        END as fill
      FROM "User" u
      LEFT JOIN "Associate" a ON u.user_id = a.user_id
      LEFT JOIN "Freelancer" f ON u.user_id = f.user_id
      LEFT JOIN "Message" m ON u.user_id = m.sender_id
      WHERE u.is_active = true
      GROUP BY u.user_id, u.user_type, a.contact_person, f.first_name, f.last_name
      ORDER BY messages DESC
      LIMIT 10
    `);

    return res.status(200).json({
      success: true,
      data: result.rows.map(row => ({
        user: row.user,
        messages: parseInt(row.messages),
        conversations: parseInt(row.conversations),
        fill: row.fill
      }))
    });
  } catch (error) {
    console.error('Analytics user communication activity error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user communication activity',
      error: error.message
    });
  }
});

// Get visitor analytics data (web vs mobile activity)
router.get('/analytics/visitor-data', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { days = 90 } = req.query;
    
    // Get user activity data grouped by date and device type
    // For now, we'll simulate web vs mobile based on user activity patterns
    // In a real implementation, you'd track actual device types from login logs
    
    // First, check if we have any users at all
    const userCountResult = await db.query('SELECT COUNT(*) FROM "User"');
    const totalUsers = parseInt(userCountResult.rows[0].count);
    
    if (totalUsers === 0) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }
    
    // Get the date range of existing users
    const dateRangeResult = await db.query(`
      SELECT 
        MIN(created_at) as earliest,
        MAX(created_at) as latest
      FROM "User"
    `);
    
    const earliestDate = dateRangeResult.rows[0].earliest;
    const latestDate = dateRangeResult.rows[0].latest;
    
    // Calculate the actual date range to use
    let startDate;
    if (days === 7) {
      startDate = new Date(latestDate);
      startDate.setDate(startDate.getDate() - 7);
    } else if (days === 30) {
      startDate = new Date(latestDate);
      startDate.setDate(startDate.getDate() - 30);
    } else {
      startDate = new Date(earliestDate);
    }
    
    const result = await db.query(`
      SELECT 
        DATE(u.created_at) as date,
        COUNT(*) as total_users,
        COUNT(CASE WHEN u.user_type = 'associate' THEN 1 END) as web_users,
        COUNT(CASE WHEN u.user_type = 'freelancer' THEN 1 END) as mobile_users
      FROM "User" u
      WHERE u.created_at >= $1
      GROUP BY DATE(u.created_at)
      ORDER BY date ASC
    `, [startDate]);

    // Format the data for the chart
    const visitorData = result.rows.map(row => ({
      date: row.date,
      desktop: parseInt(row.web_users), // Associates typically use web
      mobile: parseInt(row.mobile_users) // Freelancers may use mobile more
    }));

    return res.status(200).json({
      success: true,
      data: visitorData
    });
  } catch (error) {
    console.error('Analytics visitor data error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch visitor data',
      error: error.message
    });
  }
});

module.exports = router;