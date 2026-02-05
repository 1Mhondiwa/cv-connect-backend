const express = require('express');
const router = express.Router();
const { pool } = require('../config/database-final');

// Submit associate request
const submitAssociateRequest = async (req, res) => {
  try {
    const { email, company_name, industry, contact_person, phone, address, website, request_reason } = req.body;
    
    // Validate required fields
    if (!email || !company_name || !industry || !contact_person || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Insert into Associate_Request table
    const result = await pool.query(
      `INSERT INTO "Associate_Request" (email, company_name, industry, contact_person, phone, address, website, request_reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING request_id, email, company_name`,
      [email, company_name, industry, contact_person, phone, address || null, website || null, request_reason || null, 'pending']
    );

    return res.status(201).json({
      success: true,
      message: 'Associate request submitted successfully',
      data: {
        request_id: result.rows[0].request_id,
        email: result.rows[0].email,
        company_name: result.rows[0].company_name
      }
    });
  } catch (error) {
    console.error('Error submitting associate request:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getAllAssociateRequests = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM "Associate_Request" ORDER BY created_at DESC`
    );
    
    return res.json({
      success: true,
      requests: result.rows
    });
  } catch (error) {
    console.error('Error fetching associate requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getAssociateRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM "Associate_Request" WHERE request_id = $1`,
      [requestId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }
    
    return res.json({
      success: true,
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching associate request:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const reviewAssociateRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, reviewer_comments } = req.body;
    const reviewedBy = req.user?.user_id;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const result = await pool.query(
      `UPDATE "Associate_Request" 
       SET status = $1, reviewed_by = $2, reviewer_comments = $3, reviewed_at = NOW()
       WHERE request_id = $4
       RETURNING *`,
      [status, reviewedBy, reviewer_comments || null, requestId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    return res.json({
      success: true,
      message: 'Associate request reviewed successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error reviewing associate request:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Routes
router.post('/submit', submitAssociateRequest);
router.get('/requests', getAllAssociateRequests);
router.get('/requests/:requestId', getAssociateRequestById);
router.put('/requests/:requestId/review', reviewAssociateRequest);

module.exports = router;
