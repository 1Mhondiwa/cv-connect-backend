// controllers/associateRequestController.js
const db = require('../config/database');
const { logActivity } = require('../utils/activityLogger');

// Submit associate request (public endpoint)
const submitAssociateRequest = async (req, res) => {
    try {
        const {
          email,
          industry,
          contact_person,
          phone,
          address,
          website,
          company_name,
          request_reason
        } = req.body;
    
        // Validate required fields
        if (!email || !industry || !contact_person || !phone) {
          return res.status(400).json({
            success: false,
            message: 'Email, industry, contact person, and phone are required'
          });
        }

        // Check if email already exists in User table
    const existingUser = await db.query(
        'SELECT user_id FROM "User" WHERE email = $1',
        [email]
      );
  
      if (existingUser.rowCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists in the system'
        });
      }

      // Check if there's already a pending request for this email
    const existingRequest = await db.query(
        'SELECT request_id FROM "Associate_Request" WHERE email = $1 AND status = $2',
        [email, 'pending']
      );
  
      if (existingRequest.rowCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'A request for this email is already pending review'
        });
      }

      // Create the associate request
    const requestResult = await db.query(
        `INSERT INTO "Associate_Request" 
         (email, industry, contact_person, phone, address, website, company_name, request_reason) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING request_id`,
        [email, industry, contact_person, phone, address || null, website || null, company_name || null, request_reason || null]
      );

      const requestId = requestResult.rows[0].request_id;

    return res.status(201).json({
      success: true,
      message: 'Associate request submitted successfully. ESC will review your request.',
      data: {
        request_id: requestId,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Submit associate request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all associate requests (ESC Admin only)
const getAllAssociateRequests = async (req, res) => {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;
  
      let whereClause = '';
      const params = [];
  
      if (status && status !== 'all') {
        whereClause = 'WHERE status = $1';
        params.push(status);
      }
  
      // Count query
      const countQuery = `
        SELECT COUNT(*) 
        FROM "Associate_Request" 
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].count);
  
      // Main query
      const query = `
        SELECT ar.*, 
               u.email as reviewer_email,
               u.user_type as reviewer_type
        FROM "Associate_Request" ar
        LEFT JOIN "User" u ON ar.reviewed_by = u.user_id
        ${whereClause}
        ORDER BY ar.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      
      params.push(limit, offset);
      const result = await db.query(query, params);
  
      return res.status(200).json({
        success: true,
        data: {
          requests: result.rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get associate requests error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  // Review associate request (ESC Admin only)
const reviewAssociateRequest = async (req, res) => {
    const client = await db.pool.connect();
    
    try {
      const { requestId } = req.params;
      const { status, review_notes, password } = req.body;
      const adminUserId = req.user.user_id;
  
      // Validate status
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be either "approved" or "rejected"'
        });
      }
  
      // Get the request
      const requestResult = await client.query(
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
  
      // Check if already reviewed
      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Request has already been reviewed'
        });
      }
  
      // Begin transaction
      await client.query('BEGIN');
  
      // Update request status
      await client.query(
        `UPDATE "Associate_Request" 
         SET status = $1, reviewed_at = NOW(), reviewed_by = $2, review_notes = $3 
         WHERE request_id = $4`,
        [status, adminUserId, review_notes || null, requestId]
      );
  
      // If approved, create the associate account
      if (status === 'approved') {
        if (!password) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Password is required when approving a request'
          });
        }
  
        // Import bcrypt for password hashing
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
  
        // Create user record
        const userResult = await client.query(
          'INSERT INTO "User" (email, hashed_password, user_type, is_active, is_verified) VALUES ($1, $2, $3, $4, $5) RETURNING user_id',
          [request.email, hashedPassword, 'associate', true, true]
        );
  
        const userId = userResult.rows[0].user_id;
  
        // Create associate record
        await client.query(
          'INSERT INTO "Associate" (user_id, industry, contact_person, phone, address, website, verified) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [userId, request.industry, request.contact_person, request.phone, request.address, request.website, true]
        );
  
        // Log activity
        await logActivity({
          user_id: adminUserId,
          role: 'admin',
          activity_type: 'associate_request_approved',
          details: `Approved associate request for ${request.email}`
        });
      } else {
        // Log rejection
        await logActivity({
          user_id: adminUserId,
          role: 'admin',
          activity_type: 'associate_request_rejected',
          details: `Rejected associate request for ${request.email}`
        });
      }
  
      // Commit transaction
      await client.query('COMMIT');
  
      return res.status(200).json({
        success: true,
        message: `Associate request ${status} successfully`,
        data: {
          request_id: requestId,
          status: status
        }
      });
    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      
      console.error('Review associate request error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    } finally {
      // Release client back to pool
      client.release();
    }
  };

  // Get associate request by ID (ESC Admin only)
const getAssociateRequestById = async (req, res) => {
    try {
      const { requestId } = req.params;
  
      const result = await db.query(
        `SELECT ar.*, 
                u.email as reviewer_email,
                u.user_type as reviewer_type
         FROM "Associate_Request" ar
         LEFT JOIN "User" u ON ar.reviewed_by = u.user_id
         WHERE ar.request_id = $1`,
        [requestId]
      );
  
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Associate request not found'
        });
      }
  
      return res.status(200).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Get associate request by ID error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };
  
  module.exports = {
    submitAssociateRequest,
    getAllAssociateRequests,
    reviewAssociateRequest,
    getAssociateRequestById
  }; 
  
  



