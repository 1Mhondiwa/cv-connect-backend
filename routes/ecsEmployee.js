// routes/ecsEmployee.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../config/database');
const { logActivity } = require('../utils/activityLogger');

// Get all associate requests (ECS Employee)
router.get('/associate-requests', authenticateToken, requireRole(['ecs_employee']), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    const params = [];

    // Filter by status
    if (status && status !== 'all') {
      whereConditions.push(`ar.status = $${params.length + 1}`);
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `
      SELECT COUNT(*) 
      FROM "Associate_Request" ar
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Main query
    const requestsResult = await db.query(
      `SELECT 
         ar.*,
         u.email
       FROM "Associate_Request" ar
       LEFT JOIN "User" u ON ar.email = u.email
       ${whereClause}
       ORDER BY ar.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    console.log(`✅ ECS Employee found ${requestsResult.rowCount} associate requests`);

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

// Get specific associate request with details (ECS Employee)
router.get('/associate-requests/:requestId', authenticateToken, requireRole(['ecs_employee']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const ecsEmployeeUserId = req.user.user_id;

    console.log(`🔍 ECS Employee ${ecsEmployeeUserId} fetching associate request ${requestId}`);

    // Get request details
    const requestResult = await db.query(
      `SELECT * FROM "Associate_Request" WHERE request_id = $1`,
      [requestId]
    );

    if (requestResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    return res.status(200).json({
      success: true,
      request: requestResult.rows[0]
    });
  } catch (error) {
    console.error('❌ Get associate request by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Review associate request (ECS Employee)
router.put('/associate-requests/:requestId/review', authenticateToken, requireRole(['ecs_employee']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, notes } = req.body;
    const ecsEmployeeUserId = req.user.user_id;

    console.log(`🔍 ECS Employee ${ecsEmployeeUserId} reviewing associate request ${requestId} with status: ${status}`);

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "approved" or "rejected"'
      });
    }

    // Get the request details
    const requestResult = await db.query(
      'SELECT * FROM "Associate_Request" WHERE request_id = $1',
      [requestId]
    );

    if (requestResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Associate request not found'
      });
    }

    const request = requestResult.rows[0];

    // Check if request is already reviewed
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request has already been reviewed'
      });
    }

    // Begin transaction
    await db.query('BEGIN');

    // Update request status
    await db.query(
      `UPDATE "Associate_Request"
       SET status = $1, 
           notes = $2,
           reviewed_at = CURRENT_TIMESTAMP,
           reviewed_by = $3
       WHERE request_id = $4`,
      [status, notes, ecsEmployeeUserId, requestId]
    );

    // If approved, create associate user and company
    if (status === 'approved') {
      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      const salt = await require('bcryptjs').genSalt(10);
      const hashedPassword = await require('bcryptjs').hash(tempPassword, salt);

      // Create user record
      const userResult = await db.query(
        'INSERT INTO "User" (email, hashed_password, user_type, is_active, is_verified) VALUES ($1, $2, $3, $4, $5) RETURNING user_id',
        [request.email, hashedPassword, 'associate', true, true]
      );

      const userId = userResult.rows[0].user_id;

      // Create associate record
      await db.query(
        `INSERT INTO "Associate" 
         (user_id, company_name, industry, contact_person, phone, address, website)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, request.company_name, request.industry, request.contact_person, request.phone, request.address, request.website]
      );

      // Log the activity
      await logActivity({
        user_id: ecsEmployeeUserId,
        role: 'ecs_employee',
        activity_type: 'associate_request_approved',
        details: `Approved associate request for ${request.email}`
      });

      console.log(`✅ Successfully approved associate request ${requestId} for ${request.email}`);
      console.log(`📧 Temporary password: ${tempPassword}`);

      return res.status(200).json({
        success: true,
        message: 'Associate request approved successfully',
        data: {
          tempPassword,
          email: request.email
        }
      });
    } else {
      // Log the rejection
      await logActivity({
        user_id: ecsEmployeeUserId,
        role: 'ecs_employee',
        activity_type: 'associate_request_rejected',
        details: `Rejected associate request for ${request.email}`
      });

      console.log(`✅ Successfully rejected associate request ${requestId} for ${request.email}`);

      return res.status(200).json({
        success: true,
        message: 'Associate request rejected successfully'
      });
    }

    // Commit transaction
    await db.query('COMMIT');

  } catch (error) {
    // Rollback transaction on error
    await db.query('ROLLBACK');
    
    console.error('❌ Review associate request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all associate freelancer requests (ECS Employee)
router.get('/associate-freelancer-requests', authenticateToken, requireRole(['ecs_employee']), async (req, res) => {
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

    console.log(`✅ ECS Employee found ${requestsResult.rowCount} associate freelancer requests`);

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
    console.error('❌ Get associate freelancer requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get specific associate freelancer request with details (ECS Employee)
router.get('/associate-freelancer-requests/:requestId', authenticateToken, requireRole(['ecs_employee']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const ecsEmployeeUserId = req.user.user_id;

    console.log(`🔍 ECS Employee ${ecsEmployeeUserId} fetching associate freelancer request ${requestId}`);

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

    return res.status(200).json({
      success: true,
      request: requestResult.rows[0]
    });
  } catch (error) {
    console.error('❌ Get associate freelancer request by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Add freelancer recommendations to a request (ECS Employee)
router.post('/associate-freelancer-requests/:requestId/recommendations', authenticateToken, requireRole(['ecs_employee']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { freelancer_ids, admin_notes, highlighted_freelancers } = req.body;
    const ecsEmployeeUserId = req.user.user_id;

    console.log(`🔍 ECS Employee ${ecsEmployeeUserId} adding recommendations to request ${requestId}`);

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
      [ecsEmployeeUserId, requestId]
    );

    // Log the activity
    await logActivity({
      user_id: ecsEmployeeUserId,
      role: 'ecs_employee',
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

// Update associate freelancer request status (ECS Employee)
router.put('/associate-freelancer-requests/:requestId/status', authenticateToken, requireRole(['ecs_employee']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, admin_notes } = req.body;
    const ecsEmployeeUserId = req.user.user_id;

    console.log(`🔍 ECS Employee ${ecsEmployeeUserId} updating request ${requestId} status to ${status}`);

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
      user_id: ecsEmployeeUserId,
      role: 'ecs_employee',
      activity_type: 'Request Status Updated',
      details: `Request ID: ${requestId}, New Status: ${status}`
    });

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

module.exports = router;
