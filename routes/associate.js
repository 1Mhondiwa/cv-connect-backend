// routes/associate.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { uploadProfileImage } = require('../middleware/upload');
const db = require('../config/database');
const fs = require('fs-extra');
const path = require('path');
const { logActivity } = require('../utils/activityLogger');

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

module.exports = router;