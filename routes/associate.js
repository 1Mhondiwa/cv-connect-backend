// routes/associate.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { uploadProfileImage } = require('../middleware/upload');
const db = require('../config/database');
const fs = require('fs-extra');
const path = require('path');
const { logActivity } = require('../utils/activityLogger');
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../utils/passwordValidator');

// Get associate profile
router.get('/profile', authenticateToken, requireRole(['associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Get user information
    const userResult = await db.query(
      'SELECT email, created_at, last_login FROM "User" WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get associate information
    const associateResult = await db.query(
      'SELECT * FROM "Associate" WHERE user_id = $1',
      [userId]
    );
    
    if (associateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Associate profile not found'
      });
    }
    
    // Combine all data
    const profileData = {
      ...userResult.rows[0],
      ...associateResult.rows[0]
    };
    
    return res.status(200).json({
      success: true,
      profile: profileData
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update associate profile
router.put('/profile', authenticateToken, requireRole(['associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const {
      industry,
      contact_person,
      phone,
      address,
      website
    } = req.body;
    
    // Check if associate exists
    const checkResult = await db.query(
      'SELECT associate_id FROM "Associate" WHERE user_id = $1',
      [userId]
    );
    
    if (checkResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Associate profile not found'
      });
    }
    
    const associateId = checkResult.rows[0].associate_id;
    
    // Update profile
    await db.query(
      `UPDATE "Associate" 
       SET industry = $1, 
           contact_person = $2, 
           phone = $3, 
           address = $4, 
           website = $5
       WHERE associate_id = $6`,
      [
        industry,
        contact_person,
        phone,
        address,
        website,
        associateId
      ]
    );
    
    // After successful profile update
    await logActivity({
      user_id: userId,
      role: 'associate',
      activity_type: 'Profile Updated'
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Upload profile image for associate
router.post('/profile-image', authenticateToken, requireRole(['associate']), uploadProfileImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded'
      });
    }
    const userId = req.user.user_id;
    // Get associate info
    const associateResult = await db.query(
      'SELECT associate_id, profile_picture_url FROM "Associate" WHERE user_id = $1',
      [userId]
    );
    if (associateResult.rowCount === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Associate profile not found'
      });
    }
    const associateId = associateResult.rows[0].associate_id;
    const oldImageUrl = associateResult.rows[0].profile_picture_url;
    // Delete old image if it exists
    if (oldImageUrl) {
      const oldImagePath = path.join(__dirname, '..', oldImageUrl);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    // Update associate with new image URL
    const imageUrl = `/uploads/profile_images/${req.file.filename}`;
    await db.query(
      'UPDATE "Associate" SET profile_picture_url = $1 WHERE associate_id = $2',
      [imageUrl, associateId]
    );
    return res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      image_url: imageUrl
    });
  } catch (error) {
    console.error('Associate profile image upload error:', error);
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

// Delete profile image for associate
router.delete('/profile-image', authenticateToken, requireRole(['associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    // Get associate info
    const associateResult = await db.query(
      'SELECT associate_id, profile_picture_url FROM "Associate" WHERE user_id = $1',
      [userId]
    );
    if (associateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Associate profile not found'
      });
    }
    const associateId = associateResult.rows[0].associate_id;
    const imageUrl = associateResult.rows[0].profile_picture_url;
    // Delete image file if it exists
    if (imageUrl) {
      const imagePath = path.join(__dirname, '..', imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      // Update associate record
      await db.query(
        'UPDATE "Associate" SET profile_picture_url = NULL WHERE associate_id = $1',
        [associateId]
      );
    }
    return res.status(200).json({
      success: true,
      message: 'Profile image deleted successfully'
    });
  } catch (error) {
    console.error('Associate profile image deletion error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Create job posting
router.post('/job', authenticateToken, requireRole(['associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const {
      title,
      description,
      required_skills,
      required_yrs_experience,
      job_type,
      work_mode,
      deadline,
      categories = []
    } = req.body;
    
    if (!title || !description || !required_skills || !job_type || !work_mode || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Get associate ID
    const associateResult = await db.query(
      'SELECT associate_id FROM "Associate" WHERE user_id = $1',
      [userId]
    );
    
    if (associateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Associate profile not found'
      });
    }
    
    const associateId = associateResult.rows[0].associate_id;
    
    // Create job posting
    const jobResult = await db.query(
      `INSERT INTO "Job_Posting" (
        associate_id, 
        title, 
        description, 
        required_skills, 
        required_yrs_experience, 
        job_type, 
        work_mode,
        posted_date,
        deadline,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, true) RETURNING job_id`,
      [
        associateId,
        title,
        description,
        required_skills,
        required_yrs_experience,
        job_type,
        work_mode,
        deadline
      ]
    );
    
    const jobId = jobResult.rows[0].job_id;
    
    // Add job categories if provided
    if (categories.length > 0) {
      for (const categoryId of categories) {
        await db.query(
          'INSERT INTO "Job_Category" (job_post_id, category_id) VALUES ($1, $2)',
          [jobId, categoryId]
        );
      }
    }
    
    // After successful job posting
    await logActivity({
      user_id: userId,
      role: 'associate',
      activity_type: 'Job Posted'
    });

    return res.status(201).json({
      success: true,
      message: 'Job posting created successfully',
      job_id: jobId
    });
  } catch (error) {
    console.error('Job posting error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all job postings for this associate
router.get('/jobs', authenticateToken, requireRole(['associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Get associate ID
    const associateResult = await db.query(
      'SELECT associate_id FROM "Associate" WHERE user_id = $1',
      [userId]
    );
    
    if (associateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Associate profile not found'
      });
    }
    
    const associateId = associateResult.rows[0].associate_id;
    
    // Get all jobs
    const jobsResult = await db.query(
      'SELECT * FROM "Job_Posting" WHERE associate_id = $1 ORDER BY posted_date DESC',
      [associateId]
    );
    
    return res.status(200).json({
      success: true,
      jobs: jobsResult.rows
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get dashboard data
router.get('/dashboard', authenticateToken, requireRole(['associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Get associate ID
    const associateResult = await db.query(
      'SELECT associate_id FROM "Associate" WHERE user_id = $1',
      [userId]
    );
    
    if (associateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Associate profile not found'
      });
    }
    
    const associateId = associateResult.rows[0].associate_id;
    
    // Get active job count
    const activeJobsResult = await db.query(
      'SELECT COUNT(*) FROM "Job_Posting" WHERE associate_id = $1 AND is_active = true',
      [associateId]
    );
    
    const activeJobCount = parseInt(activeJobsResult.rows[0].count);
    
    // Get total job count
    const totalJobsResult = await db.query(
      'SELECT COUNT(*) FROM "Job_Posting" WHERE associate_id = $1',
      [associateId]
    );
    
    const totalJobCount = parseInt(totalJobsResult.rows[0].count);
    
    // Get conversation count
    const conversationsResult = await db.query(
      'SELECT COUNT(*) FROM "Conversation" WHERE associate_id = $1',
      [associateId]
    );
    
    const conversationCount = parseInt(conversationsResult.rows[0].count);
    
    // For MVP, some stats can be dummy data
    const dashboardData = {
      active_jobs: activeJobCount,
      total_jobs: totalJobCount,
      total_conversations: conversationCount,
      unread_messages: 3,
      recent_freelancer_matches: 5
    };
    
    return res.status(200).json({
      success: true,
      dashboard: dashboardData
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get recent activity
router.get('/activity', authenticateToken, requireRole(['associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const result = await db.query(
      `SELECT activity_date, activity_type, status
       FROM "Activity"
       WHERE user_id = $1 AND role = 'associate'
       ORDER BY activity_date DESC
       LIMIT 10`,
      [userId]
    );
    res.json({ success: true, activities: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch activity', error: error.message });
  }
});

// Change password for associate
router.post('/change-password', authenticateToken, requireRole(['associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { oldPassword, newPassword } = req.body;
    
    console.log(`🔍 Change password request for user ${userId}`);
    
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }
    
    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.errors[0] // Return first error
      });
    }
    
    // Get current user with hashed password and temp password status
    const userResult = await db.query(
      'SELECT hashed_password, has_changed_temp_password FROM "User" WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const currentHashedPassword = userResult.rows[0].hashed_password;
    const hasChangedTempPassword = userResult.rows[0].has_changed_temp_password;
    

    
    // Always require old password (for first-time users, this will be their temporary password)
    if (!oldPassword) {
      return res.status(400).json({
        success: false,
        message: 'Old password is required'
      });
    }
    
    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, currentHashedPassword);
    
    if (!isOldPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Old password is incorrect'
      });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password and mark temp password as changed
    await db.query(
      'UPDATE "User" SET hashed_password = $1, has_changed_temp_password = $2 WHERE user_id = $3',
      [newHashedPassword, true, userId]
    );
    
    // Log the activity
    await logActivity({
      user_id: userId,
      role: 'associate',
      activity_type: 'Password Changed'
    });
    
    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Submit freelancer service request
router.post('/freelancer-request', authenticateToken, requireRole(['associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { title, description, required_skills, min_experience, preferred_location, budget_range, urgency_level } = req.body;

    console.log(`🔍 Associate ${userId} submitting freelancer request:`, { title, required_skills });

    // Validate required fields
    if (!title || !description || !required_skills || required_skills.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and required skills are required'
      });
    }

    // Get associate ID
    const associateResult = await db.query(
      'SELECT associate_id FROM "Associate" WHERE user_id = $1',
      [userId]
    );

    if (associateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Associate profile not found'
      });
    }

    const associateId = associateResult.rows[0].associate_id;

    // Create the request
    const requestResult = await db.query(
      `INSERT INTO "Associate_Freelancer_Request" 
       (associate_id, title, description, required_skills, min_experience, preferred_location, budget_range, urgency_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING request_id`,
      [associateId, title, description, required_skills, min_experience || 0, preferred_location, budget_range, urgency_level || 'normal']
    );

    const requestId = requestResult.rows[0].request_id;

    // Log the activity
    await logActivity({
      user_id: userId,
      role: 'associate',
      activity_type: 'Freelancer Request Submitted',
      details: `Request ID: ${requestId}, Title: ${title}`
    });

    console.log(`✅ Freelancer request ${requestId} submitted successfully by associate ${userId}`);

    return res.status(201).json({
      success: true,
      message: 'Freelancer request submitted successfully',
      request_id: requestId
    });
  } catch (error) {
    console.error('❌ Freelancer request submission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get associate's freelancer requests
router.get('/freelancer-requests', authenticateToken, requireRole(['associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;

    console.log(`🔍 Fetching freelancer requests for associate ${userId}`);

    // Get associate ID
    const associateResult = await db.query(
      'SELECT associate_id FROM "Associate" WHERE user_id = $1',
      [userId]
    );

    if (associateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Associate profile not found'
      });
    }

    const associateId = associateResult.rows[0].associate_id;

    // Get all requests for this associate with accurate recommendation counts
    const requestsResult = await db.query(
      `SELECT 
         r.*,
         COALESCE(rec_counts.rec_count, 0) as recommendation_count,
         COALESCE(resp_counts.resp_count, 0) as response_count
       FROM "Associate_Freelancer_Request" r
       LEFT JOIN (
         SELECT 
           request_id, 
           COUNT(*) as rec_count
         FROM "Freelancer_Recommendation"
         GROUP BY request_id
       ) rec_counts ON r.request_id = rec_counts.request_id
       LEFT JOIN (
         SELECT 
           request_id, 
           COUNT(*) as resp_count
         FROM "Freelancer_Response"
         GROUP BY request_id
       ) resp_counts ON r.request_id = resp_counts.request_id
       WHERE r.associate_id = $1
       ORDER BY r.created_at DESC`,
      [associateId]
    );

    console.log(`✅ Found ${requestsResult.rowCount} freelancer requests for associate ${userId}`);
    
    // Log recommendation counts for debugging
    requestsResult.rows.forEach(request => {
      console.log(`   Request ID: ${request.request_id} - "${request.title}" - Recommendations: ${request.recommendation_count}`);
    });

    return res.status(200).json({
      success: true,
      requests: requestsResult.rows
    });
  } catch (error) {
    console.error('❌ Fetch freelancer requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get freelancer recommendations for a specific request
router.get('/freelancer-requests/:requestId/recommendations', authenticateToken, requireRole(['associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { requestId } = req.params;

    console.log(`🔍 Associate ${userId} fetching recommendations for request ${requestId}`);

    // Verify the request belongs to this associate
    const requestResult = await db.query(
      `SELECT r.*, a.user_id as associate_user_id 
       FROM "Associate_Freelancer_Request" r
       JOIN "Associate" a ON r.associate_id = a.associate_id
       WHERE r.request_id = $1`,
      [requestId]
    );

    if (requestResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (requestResult.rows[0].associate_user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get recommendations with freelancer details and completed jobs
    const recommendationsResult = await db.query(
      `SELECT 
         fr.*,
         f.first_name,
         f.last_name,
         f.headline,
         f.phone,
         f.availability_status,
         f.hourly_rate,
         u.email,
         u.is_verified,
         (
           SELECT COALESCE(
             json_agg(
               json_build_object(
                 'hire_id', h.hire_id,
                 'project_title', h.project_title,
                 'agreed_rate', h.agreed_rate,
                 'rate_type', h.rate_type,
                 'start_date', h.start_date,
                 'end_date', h.end_date,
                 'status', h.status,
                 'company_contact', a.contact_person,
                 'company_industry', a.industry
               ) ORDER BY h.end_date DESC
             ),
             '[]'::json
           )
           FROM "Freelancer_Hire" h
           JOIN "Associate" a ON h.associate_id = a.associate_id
           WHERE h.freelancer_id = f.freelancer_id AND h.status = 'completed'
         ) as completed_jobs
       FROM "Freelancer_Recommendation" fr
       JOIN "Freelancer" f ON fr.freelancer_id = f.freelancer_id
       JOIN "User" u ON f.user_id = u.user_id
       WHERE fr.request_id = $1
       ORDER BY fr.is_highlighted DESC, fr.created_at DESC`,
      [requestId]
    );

    console.log(`✅ Found ${recommendationsResult.rowCount} recommendations for request ${requestId}`);
    
    // Log each recommendation for debugging
    recommendationsResult.rows.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec.first_name} ${rec.last_name} (${rec.headline})`);
      console.log(`      Completed jobs: ${rec.completed_jobs ? rec.completed_jobs.length : 0}`);
    });

    return res.status(200).json({
      success: true,
      recommendations: recommendationsResult.rows
    });
  } catch (error) {
    console.error('❌ Fetch recommendations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Submit response to a freelancer recommendation
router.post('/freelancer-requests/:requestId/respond', authenticateToken, requireRole(['associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { requestId } = req.params;
    const { freelancer_id, response, notes } = req.body;

    console.log(`🔍 Associate ${userId} responding to recommendation for request ${requestId}, freelancer ${freelancer_id}`);

    if (!freelancer_id || !response) {
      return res.status(400).json({
        success: false,
        message: 'Freelancer ID and response are required'
      });
    }

    if (!['interested', 'not_interested', 'hired'].includes(response)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid response type'
      });
    }

    // Verify the request belongs to this associate
    const requestResult = await db.query(
      `SELECT r.*, a.user_id as associate_user_id 
       FROM "Associate_Freelancer_Request" r
       JOIN "Associate" a ON r.associate_id = a.associate_id
       WHERE r.request_id = $1`,
      [requestId]
    );

    if (requestResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (requestResult.rows[0].associate_user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if response already exists
    const existingResponse = await db.query(
      'SELECT freelancer_response_id FROM "Freelancer_Response" WHERE request_id = $1 AND freelancer_id = $2',
      [requestId, freelancer_id]
    );

    if (existingResponse.rowCount > 0) {
      // Update existing response
      await db.query(
        `UPDATE "Freelancer_Response" 
         SET associate_response = $1, associate_notes = $2, response_date = CURRENT_TIMESTAMP
         WHERE request_id = $3 AND freelancer_id = $4`,
        [response, notes, requestId, freelancer_id]
      );
    } else {
      // Create new response
      await db.query(
        `INSERT INTO "Freelancer_Response" 
         (request_id, freelancer_id, associate_response, associate_notes)
         VALUES ($1, $2, $3, $4)`,
        [requestId, freelancer_id, response, notes]
      );
    }

    // Log the activity
    await logActivity({
      user_id: userId,
      role: 'associate',
      activity_type: 'Freelancer Recommendation Response',
      details: `Request ID: ${requestId}, Freelancer ID: ${freelancer_id}, Response: ${response}`
    });

    console.log(`✅ Response submitted successfully for request ${requestId}, freelancer ${freelancer_id}`);

    return res.status(200).json({
      success: true,
      message: 'Response submitted successfully'
    });
  } catch (error) {
    console.error('❌ Submit response error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get associate's hired freelancers with contracts
router.get('/hired-freelancers', authenticateToken, requireRole(['associate']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    console.log(`🔍 Fetching hired freelancers for associate ${userId}`);
    
    // Get associate ID
    const associateResult = await db.query(
      'SELECT associate_id FROM "Associate" WHERE user_id = $1',
      [userId]
    );
    
    if (associateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Associate profile not found'
      });
    }
    
    const associateId = associateResult.rows[0].associate_id;
    
    // Get hired freelancers with contract information
    const hiredFreelancersResult = await db.query(
      `SELECT 
         h.hire_id,
         h.created_at as hire_date,
         h.project_title,
         h.project_description,
         h.agreed_terms,
         h.agreed_rate,
         h.rate_type,
         h.start_date,
         h.end_date,
         h.status,
         h.contract_pdf_path,
         h.signed_contract_pdf_path,
         h.signed_contract_uploaded_at,
         f.first_name,
         f.last_name,
         f.phone,
         f.profile_picture_url,
         u.email as freelancer_email
       FROM "Freelancer_Hire" h
       JOIN "Freelancer" f ON h.freelancer_id = f.freelancer_id
       JOIN "User" u ON f.user_id = u.user_id
       WHERE h.associate_id = $1
       ORDER BY h.created_at DESC`,
      [associateId]
    );
    
    console.log(`✅ Found ${hiredFreelancersResult.rowCount} hired freelancers for associate ${userId}`);
    
    return res.status(200).json({
      success: true,
      hired_freelancers: hiredFreelancersResult.rows
    });
    
  } catch (error) {
    console.error('❌ Get hired freelancers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch hired freelancers',
      error: error.message
    });
  }
});

module.exports = router;
