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

}