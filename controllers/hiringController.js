// controllers/hiringController.js
const db = require('../config/database');
const { logActivity } = require('../utils/activityLogger');
const { updateExpiredContracts, checkFreelancerAvailability } = require('../utils/contractManager');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'contracts');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `contract-${uniqueSuffix}.pdf`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Associate hires a freelancer
const hireFreelancer = async (req, res) => {
  let client;
  
  try {
    const userId = req.user.user_id;
    const { 
      request_id, 
      freelancer_id, 
      project_title, 
      project_description, 
      agreed_rate, 
      rate_type, 
      start_date, 
      expected_end_date
    } = req.body;

    console.log(`🔍 Associate ${userId} hiring freelancer ${freelancer_id} for request ${request_id}`);

    // Validate required fields
    if (!request_id || !freelancer_id || !project_title) {
      return res.status(400).json({
        success: false,
        message: 'Request ID, freelancer ID, and project title are required'
      });
    }

    // Check if contract PDF was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Contract PDF file is required'
      });
    }

    const contractPdfPath = `/uploads/contracts/${req.file.filename}`;

    // Get database client
    client = await db.pool.connect();

    // Begin transaction
    await client.query('BEGIN');

    // Verify the request belongs to this associate
    const requestResult = await client.query(
      `SELECT r.*, a.associate_id, a.user_id as associate_user_id
       FROM "Associate_Freelancer_Request" r
       JOIN "Associate" a ON r.associate_id = a.associate_id
       WHERE r.request_id = $1`,
      [request_id]
    );

    if (requestResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    const request = requestResult.rows[0];
    
    if (request.associate_user_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied - this request does not belong to you'
      });
    }

    // Verify the freelancer was recommended for this request
    const recommendationResult = await client.query(
      'SELECT * FROM "Freelancer_Recommendation" WHERE request_id = $1 AND freelancer_id = $2',
      [request_id, freelancer_id]
    );

    if (recommendationResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This freelancer was not recommended for this request'
      });
    }

    // Check if freelancer is available for hiring (considers expired contracts)
    console.log(`🔍 Checking availability for freelancer ${freelancer_id}`);
    
    // Update any expired contracts first
    await updateExpiredContracts();
    
    // Check if freelancer has any active contracts (including this specific request)
    const existingHireResult = await client.query(
      'SELECT * FROM "Freelancer_Hire" WHERE request_id = $1 AND freelancer_id = $2 AND status = $3',
      [request_id, freelancer_id, 'active']
    );

    if (existingHireResult.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This freelancer is already hired for this request'
      });
    }

    // Check if freelancer has any other active contracts that haven't expired
    const freelancerAvailability = await checkFreelancerAvailability(freelancer_id);
    
    if (!freelancerAvailability.success) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        message: 'Error checking freelancer availability',
        error: freelancerAvailability.error
      });
    }

    if (!freelancerAvailability.is_available && freelancerAvailability.active_contracts.length > 0) {
      await client.query('ROLLBACK');
      const activeContract = freelancerAvailability.active_contracts[0];
      return res.status(400).json({
        success: false,
        message: `This freelancer is currently engaged in another project: "${activeContract.project_title}" (Ends: ${activeContract.expected_end_date || 'TBD'})`
      });
    }

    // Create the hiring record
    const hireResult = await client.query(
      `INSERT INTO "Freelancer_Hire" 
       (request_id, associate_id, freelancer_id, project_title, project_description, 
        agreed_rate, rate_type, start_date, expected_end_date, contract_pdf_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING hire_id`,
      [
        request_id, 
        request.associate_id, 
        freelancer_id, 
        project_title, 
        project_description || null,
        agreed_rate || null, 
        rate_type || 'hourly',
        start_date || null,
        expected_end_date || null,
        contractPdfPath
      ]
    );

    const hireId = hireResult.rows[0].hire_id;

    // Update the request response to 'hired'
    await client.query(
      `UPDATE "Request_Response" 
       SET associate_response = 'hired', response_date = CURRENT_TIMESTAMP
       WHERE request_id = $1 AND freelancer_id = $2`,
      [request_id, freelancer_id]
    );

    // If no response exists, create one
    const responseCheck = await client.query(
      'SELECT * FROM "Freelancer_Response" WHERE request_id = $1 AND freelancer_id = $2',
      [request_id, freelancer_id]
    );

    if (responseCheck.rowCount === 0) {
      await client.query(
        `INSERT INTO "Request_Response" 
         (request_id, freelancer_id, associate_response, response_date)
         VALUES ($1, $2, 'hired', CURRENT_TIMESTAMP)`,
        [request_id, freelancer_id]
      );
    }

    // Log the activity
    await logActivity({
      user_id: userId,
      role: 'associate',
      activity_type: 'freelancer_hired',
      details: `Hired freelancer ${freelancer_id} for project: ${project_title}`
    });

    // Commit transaction
    await client.query('COMMIT');

    console.log(`✅ Freelancer ${freelancer_id} hired successfully by associate ${userId} for request ${request_id}`);

    return res.status(201).json({
      success: true,
      message: 'Freelancer hired successfully',
      data: {
        hire_id: hireId,
        project_title,
        hire_date: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Hire freelancer error:', error);
    
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to hire freelancer',
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Get recent hires for ECS Employee dashboard
const getRecentHires = async (req, res) => {
  try {
    console.log('🔍 Fetching recent hires for ECS Employee dashboard');

    // Get recent hires with associate and freelancer details
    const hiresResult = await db.query(
      `SELECT 
         h.hire_id,
         h.hire_date,
         h.project_title,
         h.status,
         a.contact_person as associate_name,
         f.first_name as freelancer_first_name,
         f.last_name as freelancer_last_name,
         f.headline as freelancer_role,
         u.email as associate_email
       FROM "Freelancer_Hire" h
       JOIN "Associate" a ON h.associate_id = a.associate_id
       JOIN "Freelancer" f ON h.freelancer_id = f.freelancer_id
       JOIN "User" u ON a.user_id = u.user_id
       ORDER BY h.hire_date DESC
       LIMIT 20`
    );

    console.log(`✅ Found ${hiresResult.rowCount} recent hires`);

    return res.status(200).json({
      success: true,
      hires: hiresResult.rows
    });

  } catch (error) {
    console.error('❌ Get recent hires error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recent hires',
      error: error.message
    });
  }
};

// Get hiring statistics for ECS Employee
const getHiringStats = async (req, res) => {
  try {
    console.log('🔍 Fetching hiring statistics for ECS Employee');

    // Get total hires count
    const totalHiresResult = await db.query(
      'SELECT COUNT(*) as total_hires FROM "Freelancer_Hire"'
    );

    // Get recent hires count (last 7 days)
    const recentHiresResult = await db.query(
      `SELECT COUNT(*) as recent_hires 
       FROM "Freelancer_Hire" 
       WHERE hire_date >= CURRENT_DATE - INTERVAL '7 days'`
    );

    // Get active projects count
    const activeProjectsResult = await db.query(
      `SELECT COUNT(*) as active_projects 
       FROM "Freelancer_Hire" 
       WHERE status = 'active'`
    );

    const stats = {
      total_hires: parseInt(totalHiresResult.rows[0].total_hires),
      recent_hires: parseInt(recentHiresResult.rows[0].recent_hires),
      active_projects: parseInt(activeProjectsResult.rows[0].active_projects)
    };

    console.log('✅ Hiring statistics fetched successfully');

    return res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Get hiring stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch hiring statistics',
      error: error.message
    });
  }
};

// Manually trigger contract expiration check (for admin/testing)
const checkExpiredContracts = async (req, res) => {
  try {
    console.log('🔍 Manual contract expiration check requested');
    
    const result = await updateExpiredContracts();
    
    return res.status(200).json({
      success: result.success,
      message: result.message,
      updated_count: result.updated_count,
      error: result.error || null
    });
    
  } catch (error) {
    console.error('❌ Manual contract check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check expired contracts',
      error: error.message
    });
  }
};

module.exports = {
  hireFreelancer,
  getRecentHires,
  getHiringStats,
  checkExpiredContracts,
  upload
};

