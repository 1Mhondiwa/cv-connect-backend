// routes/freelancer.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateFreelancerProfile } = require('../middleware/validation');
const { uploadCV, uploadProfileImage } = require('../middleware/upload');
const cvParser = require('../services/cvParser');
const fs = require('fs-extra');
const path = require('path');
const db = require('../config/database');
const { logActivity } = require('../utils/activityLogger');

// Get freelancer profile
router.get('/profile', authenticateToken, requireRole(['freelancer']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log('Fetching profile for freelancer user_id:', userId);
    
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
    // Get freelancer information
    const freelancerResult = await db.query(
      'SELECT * FROM "Freelancer" WHERE user_id = $1',
      [userId]
    );
    if (freelancerResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Freelancer profile not found'
      });
    }
    
    // Get freelancer skills
    const skillsResult = await db.query(
      `SELECT fs.*, s.skill_name 
       FROM "Freelancer_Skill" fs 
       JOIN "Skill" s ON fs.skill_id = s.skill_id 
       WHERE fs.freelancer_id = $1`,
      [freelancerResult.rows[0].freelancer_id]
    );
    
    // Get freelancer CV
    const cvResult = await db.query(
      'SELECT * FROM "CV" WHERE freelancer_id = $1',
      [freelancerResult.rows[0].freelancer_id]
    );
    
    // Combine all data
    const profileData = {
      ...userResult.rows[0],
      ...freelancerResult.rows[0],
      skills: skillsResult.rows,
      cv: cvResult.rows[0] || null
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

// Update freelancer profile
router.put('/profile', authenticateToken, requireRole(['freelancer']), validateFreelancerProfile, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const {
      first_name,
      last_name,
      phone,
      address,
      years_experience,
      summary,
      headline,
      current_status,
      linkedin_url,
      github_url
    } = req.body;
    
    // Check if freelancer exists
    const checkResult = await db.query(
      'SELECT freelancer_id FROM "Freelancer" WHERE user_id = $1',
      [userId]
    );
    
    if (checkResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Freelancer profile not found'
      });
    }
    
    const freelancerId = checkResult.rows[0].freelancer_id;
    
    // Update profile
    await db.query(
      `UPDATE "Freelancer" 
       SET first_name = $1, 
           last_name = $2, 
           phone = $3, 
           address = $4, 
           years_experience = $5, 
           summary = $6, 
           headline = $7, 
           current_status = $8, 
           linkedin_url = $9, 
           github_url = $10 
       WHERE freelancer_id = $11`,
      [
        first_name,
        last_name,
        phone,
        address,
        years_experience,
        summary,
        headline,
        current_status,
        linkedin_url,
        github_url,
        freelancerId
      ]
    );
    
    // After successful profile update
    await logActivity({
      user_id: userId,
      role: 'freelancer',
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

// Upload CV
router.post('/cv/upload', authenticateToken, requireRole(['freelancer']), uploadCV.single('cv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const userId = req.user.user_id;
    
    // Get freelancer ID
    const freelancerResult = await db.query(
      'SELECT freelancer_id FROM "Freelancer" WHERE user_id = $1',
      [userId]
    );
    
    if (freelancerResult.rowCount === 0) {
      // Delete the uploaded file since we can't use it
      fs.unlinkSync(req.file.path);
      
      return res.status(404).json({
        success: false,
        message: 'Freelancer profile not found'
      });
    }
    
    const freelancerId = freelancerResult.rows[0].freelancer_id;
    
    // Check if CV already exists and delete it
    const existingCVResult = await db.query(
      'SELECT cv_id, stored_filename FROM "CV" WHERE freelancer_id = $1',
      [freelancerId]
    );
    
    if (existingCVResult.rowCount > 0) {
      // Delete the old file
      const oldFilePath = path.join('./uploads/cvs', existingCVResult.rows[0].stored_filename);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
      
      // Delete the old record
      await db.query(
        'DELETE FROM "CV" WHERE cv_id = $1',
        [existingCVResult.rows[0].cv_id]
      );
    }
    
    // Parse the CV
    let parsedData = {};
    try {
      parsedData = await cvParser.parseCV(req.file.path);
    } catch (parseError) {
      console.error('CV parsing error:', parseError);
      parsedData = { parsing_error: 'Failed to parse CV' };
    }
    
    // Determine file type
    let fileType = 'TXT';
    const extension = path.extname(req.file.originalname).toLowerCase();
    if (extension === '.pdf') {
      fileType = 'PDF';
    } else if (extension === '.docx' || extension === '.doc') {
      fileType = 'DOCX';
    }
    
    // Insert CV record
    const cvInsertResult = await db.query(
      `INSERT INTO "CV" (
        freelancer_id, 
        original_filename, 
        stored_filename, 
        file_type, 
        file_size, 
        parsed_data, 
        is_approved, 
        parsing_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING cv_id`,
      [
        freelancerId,
        req.file.originalname,
        req.file.filename,
        fileType,
        req.file.size,
        JSON.stringify(parsedData),
        false,
        parsedData.parsing_error ? 'failed' : 'completed'
      ]
    );
    
    const cvId = cvInsertResult.rows[0].cv_id;
    
    // Update freelancer profile with parsed data if available
    if (!parsedData.parsing_error && Object.keys(parsedData).length > 0) {
      // Update freelancer record with any extracted information
      const fieldsToUpdate = [];
      const values = [];
      let paramIndex = 1;
      
      if (parsedData.first_name && parsedData.first_name.trim()) {
        fieldsToUpdate.push(`first_name = $${paramIndex++}`);
        values.push(parsedData.first_name);
      }
      
      if (parsedData.last_name && parsedData.last_name.trim()) {
        fieldsToUpdate.push(`last_name = $${paramIndex++}`);
        values.push(parsedData.last_name);
      }
      
      if (parsedData.phone && parsedData.phone.trim()) {
        fieldsToUpdate.push(`phone = $${paramIndex++}`);
        values.push(parsedData.phone);
      }
      
      if (parsedData.years_experience) {
        fieldsToUpdate.push(`years_experience = $${paramIndex++}`);
        values.push(parsedData.years_experience);
      }
      
      if (parsedData.summary && parsedData.summary.trim()) {
        fieldsToUpdate.push(`summary = $${paramIndex++}`);
        values.push(parsedData.summary);
      }
      
      if (parsedData.linkedin_url && parsedData.linkedin_url.trim()) {
        fieldsToUpdate.push(`linkedin_url = $${paramIndex++}`);
        values.push(parsedData.linkedin_url);
      }
      
      if (parsedData.github_url && parsedData.github_url.trim()) {
        fieldsToUpdate.push(`github_url = $${paramIndex++}`);
        values.push(parsedData.github_url);
      }
      
      if (fieldsToUpdate.length > 0) {
        // Add the last parameter for freelancer_id
        values.push(freelancerId);
        
        await db.query(
          `UPDATE "Freelancer" SET ${fieldsToUpdate.join(', ')} WHERE freelancer_id = $${paramIndex}`,
          values
        );
      }
      
      // Add extracted skills if available
      if (parsedData.skills && Array.isArray(parsedData.skills) && parsedData.skills.length > 0) {
        for (const skill of parsedData.skills) {
          // Check if skill exists in database
          let skillId;
          const skillResult = await db.query(
            'SELECT skill_id FROM "Skill" WHERE LOWER(skill_name) = LOWER($1)',
            [skill.name]
          );
          
          if (skillResult.rowCount === 0) {
            // Create new skill
            const newSkillResult = await db.query(
              'INSERT INTO "Skill" (skill_name, normalized_name) VALUES ($1, $2) RETURNING skill_id',
              [skill.name, skill.name.toLowerCase()]
            );
            skillId = newSkillResult.rows[0].skill_id;
          } else {
            skillId = skillResult.rows[0].skill_id;
          }
          
          // Check if freelancer already has this skill
          const existingSkillResult = await db.query(
            'SELECT freelancer_skill_id FROM "Freelancer_Skill" WHERE freelancer_id = $1 AND skill_id = $2',
            [freelancerId, skillId]
          );
          
          if (existingSkillResult.rowCount === 0) {
            // Add skill to freelancer
            await db.query(
              'INSERT INTO "Freelancer_Skill" (freelancer_id, skill_id, proficiency_level, years_experience) VALUES ($1, $2, $3, $4)',
              [
                freelancerId,
                skillId,
                skill.proficiency || 'Intermediate',
                skill.years_experience || 1
              ]
            );
          }
        }
      }
    }
    
    // After successful CV upload
    await logActivity({
      user_id: userId,
      role: 'freelancer',
      activity_type: 'CV Uploaded'
    });
    
    return res.status(200).json({
      success: true,
      message: 'CV uploaded and processed successfully',
      cv_id: cvId,
      file: {
        originalname: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        path: req.file.path
      },
      parsed_data: parsedData
    });
  } catch (error) {
    console.error('CV upload error:', error);
    
    // Delete the uploaded file if there was an error
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

// Upload profile image
router.post('/profile-image', authenticateToken, requireRole(['freelancer']), uploadProfileImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded'
      });
    }
    
    const userId = req.user.user_id;
    
    // Get freelancer info
    const freelancerResult = await db.query(
      'SELECT freelancer_id, profile_picture_url FROM "Freelancer" WHERE user_id = $1',
      [userId]
    );
    
    if (freelancerResult.rowCount === 0) {
      // Delete the uploaded file
      fs.unlinkSync(req.file.path);
      
      return res.status(404).json({
        success: false,
        message: 'Freelancer profile not found'
      });
    }
    
    const freelancerId = freelancerResult.rows[0].freelancer_id;
    const oldImageUrl = freelancerResult.rows[0].profile_picture_url;
    
    // Delete old image if it exists
    if (oldImageUrl) {
      const oldImagePath = path.join(__dirname, '..', oldImageUrl);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    
    // Update freelancer with new image URL
    const imageUrl = `/uploads/profile_images/${req.file.filename}`;
    await db.query(
      'UPDATE "Freelancer" SET profile_picture_url = $1 WHERE freelancer_id = $2',
      [imageUrl, freelancerId]
    );
    
    return res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      image_url: imageUrl
    });
  } catch (error) {
    console.error('Profile image upload error:', error);
    
    // Delete the uploaded file if there was an error
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

// Delete profile image
router.delete('/profile-image', authenticateToken, requireRole(['freelancer']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Get freelancer info
    const freelancerResult = await db.query(
      'SELECT freelancer_id, profile_picture_url FROM "Freelancer" WHERE user_id = $1',
      [userId]
    );
    
    if (freelancerResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Freelancer profile not found'
      });
    }
    
    const freelancerId = freelancerResult.rows[0].freelancer_id;
    const imageUrl = freelancerResult.rows[0].profile_picture_url;
    
    // Delete image file if it exists
    if (imageUrl) {
      const imagePath = path.join(__dirname, '..', imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      
      // Update freelancer record
      await db.query(
        'UPDATE "Freelancer" SET profile_picture_url = NULL WHERE freelancer_id = $1',
        [freelancerId]
      );
    }
    
    return res.status(200).json({
      success: true,
      message: 'Profile image deleted successfully'
    });
  } catch (error) {
    console.error('Profile image deletion error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Add a skill to freelancer
router.post('/skills', authenticateToken, requireRole(['freelancer']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { skill_name, proficiency_level, years_experience } = req.body;
    
    if (!skill_name || !proficiency_level) {
      return res.status(400).json({
        success: false,
        message: 'Skill name and proficiency level are required'
      });
    }
    
    // Get freelancer ID
    const freelancerResult = await db.query(
      'SELECT freelancer_id FROM "Freelancer" WHERE user_id = $1',
      [userId]
    );
    
    if (freelancerResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Freelancer profile not found'
      });
    }
    
    const freelancerId = freelancerResult.rows[0].freelancer_id;
    
    // Check if skill exists or create it
    let skillId;
    const skillResult = await db.query(
      'SELECT skill_id FROM "Skill" WHERE LOWER(skill_name) = LOWER($1)',
      [skill_name]
    );
    
    if (skillResult.rowCount === 0) {
      // Create new skill
      const newSkillResult = await db.query(
        'INSERT INTO "Skill" (skill_name, normalized_name) VALUES ($1, $2) RETURNING skill_id',
        [skill_name, skill_name.toLowerCase()]
      );
      skillId = newSkillResult.rows[0].skill_id;
    } else {
      skillId = skillResult.rows[0].skill_id;
    }
    
    // Check if freelancer already has this skill
    const existingSkillResult = await db.query(
      'SELECT freelancer_skill_id FROM "Freelancer_Skill" WHERE freelancer_id = $1 AND skill_id = $2',
      [freelancerId, skillId]
    );
    
    if (existingSkillResult.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have this skill in your profile'
      });
    }
    
    // Add skill to freelancer
    const freelancerSkillResult = await db.query(
      'INSERT INTO "Freelancer_Skill" (freelancer_id, skill_id, proficiency_level, years_experience) VALUES ($1, $2, $3, $4) RETURNING freelancer_skill_id',
      [freelancerId, skillId, proficiency_level, years_experience || 0]
    );
    
    // After successful skill add/update/delete
    await logActivity({
      user_id: userId,
      role: 'freelancer',
      activity_type: 'Skills Updated'
    });
    
    return res.status(201).json({
      success: true,
      message: 'Skill added successfully',
      freelancer_skill_id: freelancerSkillResult.rows[0].freelancer_skill_id
    });
  } catch (error) {
    console.error('Add skill error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update a skill
router.put('/skills/:skillId', authenticateToken, requireRole(['freelancer']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { skillId } = req.params;
    const { proficiency_level, years_experience } = req.body;
    
    // Get freelancer ID
    const freelancerResult = await db.query(
      'SELECT freelancer_id FROM "Freelancer" WHERE user_id = $1',
      [userId]
    );
    
    if (freelancerResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Freelancer profile not found'
      });
    }
    
    const freelancerId = freelancerResult.rows[0].freelancer_id;
    
    // Check if skill belongs to this freelancer
    const skillResult = await db.query(
      'SELECT freelancer_skill_id FROM "Freelancer_Skill" WHERE freelancer_skill_id = $1 AND freelancer_id = $2',
      [skillId, freelancerId]
    );
    
    if (skillResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found in your profile'
      });
    }
    
    // Update skill
    await db.query(
      'UPDATE "Freelancer_Skill" SET proficiency_level = $1, years_experience = $2 WHERE freelancer_skill_id = $3',
      [proficiency_level, years_experience, skillId]
    );
    
    // After successful skill add/update/delete
    await logActivity({
      user_id: userId,
      role: 'freelancer',
      activity_type: 'Skills Updated'
    });
    
    return res.status(200).json({
      success: true,
      message: 'Skill updated successfully'
    });
  } catch (error) {
    console.error('Update skill error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});


// Delete a skill
router.delete('/skills/:skillId', authenticateToken, requireRole(['freelancer']), async (req, res) => {
    try {
      const userId = req.user.user_id;
      const { skillId } = req.params;
      
      // Get freelancer ID
      const freelancerResult = await db.query(
        'SELECT freelancer_id FROM "Freelancer" WHERE user_id = $1',
        [userId]
      );
      
      if (freelancerResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Freelancer profile not found'
        });
      }
      
      const freelancerId = freelancerResult.rows[0].freelancer_id;
      
      // Check if skill belongs to this freelancer
      const skillResult = await db.query(
        'SELECT freelancer_skill_id FROM "Freelancer_Skill" WHERE freelancer_skill_id = $1 AND freelancer_id = $2',
        [skillId, freelancerId]
      );
      
      if (skillResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Skill not found in your profile'
        });
      }
      
      // Delete skill
      await db.query(
        'DELETE FROM "Freelancer_Skill" WHERE freelancer_skill_id = $1',
        [skillId]
      );
      
      // After successful skill add/update/delete
      await logActivity({
        user_id: userId,
        role: 'freelancer',
        activity_type: 'Skills Updated'
      });
      
      return res.status(200).json({
        success: true,
        message: 'Skill deleted successfully'
      });
    } catch (error) {
      console.error('Delete skill error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  });
  
  // Work Experience CRUD Operations
  
  // Add work experience
  router.post('/work-experience', authenticateToken, requireRole(['freelancer']), async (req, res) => {
    try {
      const userId = req.user.user_id;
      const { title, company, start_date, end_date, description } = req.body;
      
      if (!title || !company) {
        return res.status(400).json({
          success: false,
          message: 'Job title and company are required'
        });
      }
      
      // Get freelancer ID
      const freelancerResult = await db.query(
        'SELECT freelancer_id FROM "Freelancer" WHERE user_id = $1',
        [userId]
      );
      
      if (freelancerResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Freelancer profile not found'
        });
      }
      
      const freelancerId = freelancerResult.rows[0].freelancer_id;
      
      // Get existing CV record
      const cvResult = await db.query(
        'SELECT cv_id, parsed_data FROM "CV" WHERE freelancer_id = $1 ORDER BY created_at DESC LIMIT 1',
        [freelancerId]
      );
      
      if (cvResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No CV found. Please upload a CV first.'
        });
      }
      
      const cvId = cvResult.rows[0].cv_id;
      const existingParsedData = cvResult.rows[0].parsed_data ? JSON.parse(cvResult.rows[0].parsed_data) : {};
      
      // Create new work experience entry
      const newWorkExperience = {
        id: `work_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: title.trim(),
        company: company.trim(),
        start_date: start_date || '',
        end_date: end_date || '',
        description: description || ''
      };
      
      // Add to existing work experience array or create new one
      const updatedWorkExperience = [
        ...(existingParsedData.work_experience || []),
        newWorkExperience
      ];
      
      // Update CV record with new work experience
      const updatedParsedData = {
        ...existingParsedData,
        work_experience: updatedWorkExperience
      };
      
      await db.query(
        'UPDATE "CV" SET parsed_data = $1, updated_at = NOW() WHERE cv_id = $2',
        [JSON.stringify(updatedParsedData), cvId]
      );
      
      // Log activity
      await logActivity({
        user_id: userId,
        role: 'freelancer',
        activity_type: 'Work Experience Added'
      });
      
      return res.status(201).json({
        success: true,
        message: 'Work experience added successfully',
        work_experience: newWorkExperience
      });
    } catch (error) {
      console.error('Add work experience error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  });
  
  // Update work experience
  router.put('/work-experience/:workId', authenticateToken, requireRole(['freelancer']), async (req, res) => {
    try {
      const userId = req.user.user_id;
      const { workId } = req.params;
      const { title, company, start_date, end_date, description } = req.body;
      
      if (!title || !company) {
        return res.status(400).json({
          success: false,
          message: 'Job title and company are required'
        });
      }
      
      // Get freelancer ID
      const freelancerResult = await db.query(
        'SELECT freelancer_id FROM "Freelancer" WHERE user_id = $1',
        [userId]
      );
      
      if (freelancerResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Freelancer profile not found'
        });
      }
      
      const freelancerId = freelancerResult.rows[0].freelancer_id;
      
      // Get existing CV record
      const cvResult = await db.query(
        'SELECT cv_id, parsed_data FROM "CV" WHERE freelancer_id = $1 ORDER BY created_at DESC LIMIT 1',
        [freelancerId]
      );
      
      if (cvResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No CV found. Please upload a CV first.'
        });
      }
      
      const cvId = cvResult.rows[0].cv_id;
      const existingParsedData = cvResult.rows[0].parsed_data ? JSON.parse(cvResult.rows[0].parsed_data) : {};
      
      // Find and update the specific work experience entry
      const workExperience = existingParsedData.work_experience || [];
      const workIndex = workExperience.findIndex(work => work.id === workId);
      
      if (workIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Work experience not found'
        });
      }
      
      // Update the work experience entry
      workExperience[workIndex] = {
        ...workExperience[workIndex],
        title: title.trim(),
        company: company.trim(),
        start_date: start_date || '',
        end_date: end_date || '',
        description: description || ''
      };
      
      // Update CV record
      const updatedParsedData = {
        ...existingParsedData,
        work_experience: workExperience
      };
      
      await db.query(
        'UPDATE "CV" SET parsed_data = $1, updated_at = NOW() WHERE cv_id = $2',
        [JSON.stringify(updatedParsedData), cvId]
      );
      
      // Log activity
      await logActivity({
        user_id: userId,
        role: 'freelancer',
        activity_type: 'Work Experience Updated'
      });
      
      return res.status(200).json({
        success: true,
        message: 'Work experience updated successfully',
        work_experience: workExperience[workIndex]
      });
    } catch (error) {
      console.error('Update work experience error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  });
  
  // Delete work experience
  router.delete('/work-experience/:workId', authenticateToken, requireRole(['freelancer']), async (req, res) => {
    try {
      const userId = req.user.user_id;
      const { workId } = req.params;
      
      // Get freelancer ID
      const freelancerResult = await db.query(
        'SELECT freelancer_id FROM "Freelancer" WHERE user_id = $1',
        [userId]
      );
      
      if (freelancerResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Freelancer profile not found'
        });
      }
      
      const freelancerId = freelancerResult.rows[0].freelancer_id;
      
      // Get existing CV record
      const cvResult = await db.query(
        'SELECT cv_id, parsed_data FROM "CV" WHERE freelancer_id = $1 ORDER BY created_at DESC LIMIT 1',
        [freelancerId]
      );
      
      if (cvResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No CV found. Please upload a CV first.'
        });
      }
      
      const cvId = cvResult.rows[0].cv_id;
      const existingParsedData = cvResult.rows[0].parsed_data ? JSON.parse(cvResult.rows[0].parsed_data) : {};
      
      // Remove the specific work experience entry
      const workExperience = existingParsedData.work_experience || [];
      const filteredWorkExperience = workExperience.filter(work => work.id !== workId);
      
      if (filteredWorkExperience.length === workExperience.length) {
        return res.status(404).json({
          success: false,
          message: 'Work experience not found'
        });
      }
      
      // Update CV record
      const updatedParsedData = {
        ...existingParsedData,
        work_experience: filteredWorkExperience
      };
      
      await db.query(
        'UPDATE "CV" SET parsed_data = $1, updated_at = NOW() WHERE cv_id = $2',
        [JSON.stringify(updatedParsedData), cvId]
      );
      
      // Log activity
      await logActivity({
        user_id: userId,
        role: 'freelancer',
        activity_type: 'Work Experience Deleted'
      });
      
      return res.status(200).json({
        success: true,
        message: 'Work experience deleted successfully'
      });
    } catch (error) {
      console.error('Delete work experience error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  });
  
  // Update CV parsed data (work experience and education)
  router.put('/cv/parsed-data', authenticateToken, requireRole(['freelancer']), async (req, res) => {
    try {
      const userId = req.user.user_id;
      const { parsed_data } = req.body;
      
      if (!parsed_data) {
        return res.status(400).json({
          success: false,
          message: 'Parsed data is required'
        });
      }
      
      // Get freelancer ID
      const freelancerResult = await db.query(
        'SELECT freelancer_id FROM "Freelancer" WHERE user_id = $1',
        [userId]
      );
      
      if (freelancerResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Freelancer profile not found'
        });
      }
      
      const freelancerId = freelancerResult.rows[0].freelancer_id;
      
      // Get existing CV record
      const cvResult = await db.query(
        'SELECT cv_id, parsed_data FROM "CV" WHERE freelancer_id = $1 ORDER BY created_at DESC LIMIT 1',
        [freelancerId]
      );
      
      if (cvResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No CV found. Please upload a CV first.'
        });
      }
      
      const cvId = cvResult.rows[0].cv_id;
      const existingParsedData = cvResult.rows[0].parsed_data ? JSON.parse(cvResult.rows[0].parsed_data) : {};
      
      // Merge existing parsed data with new data
      const updatedParsedData = {
        ...existingParsedData,
        ...parsed_data
      };
      
      // Update CV record with new parsed data
      await db.query(
        'UPDATE "CV" SET parsed_data = $1, updated_at = NOW() WHERE cv_id = $2',
        [JSON.stringify(updatedParsedData), cvId]
      );
      
      // After successful CV parsed data update
      await logActivity({
        user_id: userId,
        role: 'freelancer',
        activity_type: 'CV Data Updated'
      });
      
      return res.status(200).json({
        success: true,
        message: 'CV parsed data updated successfully',
        parsed_data: updatedParsedData
      });
    } catch (error) {
      console.error('Update CV parsed data error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  });
  
  // Get dashboard data
  router.get('/dashboard', authenticateToken, requireRole(['freelancer']), async (req, res) => {
    try {
      const userId = req.user.user_id;
      
      // Get freelancer ID
      const freelancerResult = await db.query(
        'SELECT freelancer_id FROM "Freelancer" WHERE user_id = $1',
        [userId]
      );
      
      if (freelancerResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Freelancer profile not found'
        });
      }
      
      const freelancerId = freelancerResult.rows[0].freelancer_id;
      
      // This would include things like:
      // - Job applications stats
      // - Messaging stats
      // - Profile completion percentage
      // - Recent job postings matching skills
      
      // For MVP, we'll just return dummy data
      const dashboardData = {
        profile_completion: 75,
        total_applications: 5,
        pending_applications: 2,
        accepted_applications: 1,
        rejected_applications: 2,
        total_conversations: 3,
        unread_messages: 2,
        recent_jobs_matching: 8
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
router.get('/activity', authenticateToken, requireRole(['freelancer']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const result = await db.query(
      `SELECT activity_date, activity_type, status
       FROM "Activity"
       WHERE user_id = $1 AND role = 'freelancer'
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