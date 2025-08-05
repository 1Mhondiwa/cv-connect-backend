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



}