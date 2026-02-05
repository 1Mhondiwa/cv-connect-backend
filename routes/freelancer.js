// routes/freelancer.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole, authenticateTokenSSE } = require('../middleware/auth');
const { validateFreelancerProfile } = require('../middleware/validation');
const { uploadCV, uploadProfileImage, uploadSignedContract } = require('../middleware/upload');
const cvParser = require('../services/cvParser');
const { syncCVDataWithProfile } = require('../utils/profileSync');
const fs = require('fs-extra');
const path = require('path');
const db = require('../config/database');
const { logActivity } = require('../utils/activityLogger');

// Get freelancer profile
router.get('/profile', authenticateToken, requireRole(['freelancer']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log('=== Freelancer Profile Debug ===');
    console.log('Fetching profile for freelancer user_id:', userId);
    console.log('User object:', req.user);
    
    // Get user information
    console.log('Step 1: Querying User table...');
    const userResult = await db.query(
      'SELECT email, created_at, last_login FROM "User" WHERE user_id = $1',
      [userId]
    );
    console.log('User query result:', userResult.rowCount, 'rows');
    
    if (userResult.rowCount === 0) {
      console.log('User not found');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get freelancer information
    console.log('Step 2: Querying Freelancer table...');
    const freelancerResult = await db.query(
      'SELECT * FROM "Freelancer" WHERE user_id = $1',
      [userId]
    );
    console.log('Freelancer query result:', freelancerResult.rowCount, 'rows');
    
    if (freelancerResult.rowCount === 0) {
      console.log('Freelancer profile not found');
      return res.status(404).json({
        success: false,
        message: 'Freelancer profile not found'
      });
    }
    
    const freelancerId = freelancerResult.rows[0].freelancer_id;
    
    // Get freelancer skills (with error handling for missing Skill table)
    console.log('Step 3: Querying Freelancer_Skill with Skill details...');
    let skillsResult = { rows: [] };
    try {
      skillsResult = await db.query(
        `SELECT fs.freelancer_skill_id, fs.freelancer_id, fs.skill_id, 
                s.skill_name, fs.proficiency_level, fs.years_experience
         FROM "Freelancer_Skill" fs 
         JOIN "Skill" s ON fs.skill_id = s.skill_id
         WHERE fs.freelancer_id = $1
         ORDER BY s.skill_name ASC`,
        [freelancerId]
      );
      console.log('Skills query result:', skillsResult.rowCount, 'rows');
    } catch (skillError) {
      console.warn('Warning: Failed to fetch skills:', skillError.message);
      // Continue anyway - skills are not critical
    }
    
    // Get freelancer CV
    console.log('Step 4: Querying CV...');
    let cvData = null;
    try {
      const cvResult = await db.query(
        'SELECT * FROM "CV" WHERE freelancer_id = $1',
        [freelancerId]
      );
      console.log('CV query result:', cvResult.rowCount, 'rows');
      
      // Handle missing CV gracefully
      if (cvResult.rowCount > 0) {
        cvData = cvResult.rows[0];
        
        // Ensure CV data has IDs for editing (backward compatibility)
        if (cvData && cvData.parsed_data) {
          let needsUpdate = false;
          
          // Add IDs to work experience if missing
          if (cvData.parsed_data.work_experience && cvData.parsed_data.work_experience.length > 0) {
            cvData.parsed_data.work_experience = cvData.parsed_data.work_experience.map((work, index) => {
              if (!work.id) {
                needsUpdate = true;
                return {
                  ...work,
                  id: `work_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
                };
              }
              return work;
            });
          }
          
          // Add IDs to education if missing
          if (cvData.parsed_data.education && cvData.parsed_data.education.length > 0) {
            cvData.parsed_data.education = cvData.parsed_data.education.map((edu, index) => {
              if (!edu.id) {
                needsUpdate = true;
                return {
                  ...edu,
                  id: `edu_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
                };
              }
              return edu;
            });
          }
          
          // Update database if IDs were added
          if (needsUpdate) {
            await db.query(
              'UPDATE "CV" SET parsed_data = $1 WHERE cv_id = $2',
              [JSON.stringify(cvData.parsed_data), cvData.cv_id]
            );
            console.log('Added missing IDs to CV data for freelancer:', freelancerId);
          }
        }
      }
    } catch (cvError) {
      console.warn('Warning: Failed to fetch CV:', cvError.message);
      // CV is not critical - continue anyway
    }
    
    // Get completed contracts/jobs (with error handling for missing tables)
    console.log('Step 5: Querying Freelancer_Hire and Associate...');
    let completedJobsResult = { rows: [] };
    try {
      completedJobsResult = await db.query(
        `SELECT 
           h.hire_id,
           h.created_at as hire_date,
           h.project_title,
           h.project_description,
           h.agreed_rate,
           h.rate_type,
           h.start_date,
           h.end_date,
           h.status,
           a.contact_person as company_contact,
           a.industry as company_industry,
           a.website as company_website
         FROM "Freelancer_Hire" h
         LEFT JOIN "Associate" a ON h.associate_id = a.associate_id
         WHERE h.freelancer_id = $1 AND h.status = 'completed'
         ORDER BY h.end_date DESC, h.created_at DESC`,
        [freelancerId]
      );
      console.log('Completed jobs query result:', completedJobsResult.rowCount, 'rows');
    } catch (jobError) {
      console.warn('Warning: Failed to fetch completed jobs:', jobError.message);
      // Jobs are not critical - continue anyway
    }
    
    // Combine all data
    const profileData = {
      ...userResult.rows[0],
      ...freelancerResult.rows[0],
      skills: skillsResult.rows,
      cv: cvData || null,
      completed_jobs: completedJobsResult.rows
    };
    
    console.log('Profile data compiled successfully');
    return res.status(200).json({
      success: true,
      profile: profileData
    });
  } catch (error) {
    console.error('=== Freelancer Profile Error Details ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('Error severity:', error.severity);
    console.error('Error detail:', error.detail);
    console.error('Error hint:', error.hint);
    console.error('Error table:', error.table);
    console.error('Error column:', error.column);
    console.error('Error constraint:', error.constraint);
    console.error('========================================');
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      details: {
        code: error.code,
        severity: error.severity,
        detail: error.detail,
        hint: error.hint,
        table: error.table,
        column: error.column,
        constraint: error.constraint
      }
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
      github_url,
      hourly_rate
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
           github_url = $10,
           hourly_rate = $11
       WHERE freelancer_id = $12`,
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
        hourly_rate,
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
      
      // Assign IDs to work experience and education entries for editing
      if (parsedData.work_experience && parsedData.work_experience.length > 0) {
        parsedData.work_experience = parsedData.work_experience.map((work, index) => ({
          ...work,
          id: `work_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
        }));
      }
      
      if (parsedData.education && parsedData.education.length > 0) {
        parsedData.education = parsedData.education.map((edu, index) => ({
          ...edu,
          id: `edu_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
        }));
      }
    } catch (parseError) {
      console.warn('CV parsing warning (not critical):', parseError.message);
      // Continue anyway - CV can still be stored without parsing
      parsedData = { 
        parsing_error: 'Failed to parse CV content',
        raw_filename: req.file.originalname
      };
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
      // Use the robust sync function to update freelancer profile
      const syncResult = await syncCVDataWithProfile(freelancerId, parsedData, false);
      
      if (!syncResult.success) {
        console.warn('Failed to sync CV data with profile:', syncResult.error);
        // Continue with the upload even if sync fails
      }
      
      // Add extracted skills if available
      if (parsedData.skills && Array.isArray(parsedData.skills) && parsedData.skills.length > 0) {
        try {
          // FIRST: Remove ALL existing skills for this freelancer (to replace, not append)
          await db.query(
            'DELETE FROM "Freelancer_Skill" WHERE freelancer_id = $1',
            [freelancerId]
          );
          
          // THEN: Add all new skills from the CV
          for (const skill of parsedData.skills) {
            try {
              // Check if skill exists in database
              let skillId;
              const skillResult = await db.query(
                'SELECT skill_id FROM "Skill" WHERE LOWER(name) = LOWER($1)',
                [skill.name]
              );
              
              if (skillResult.rowCount === 0) {
                // Create new skill
                const newSkillResult = await db.query(
                  'INSERT INTO "Skill" (name) VALUES ($1) RETURNING skill_id',
                  [skill.name]
                );
                skillId = newSkillResult.rows[0].skill_id;
              } else {
                skillId = skillResult.rows[0].skill_id;
              }
              
              // Validate and normalize proficiency level
              const validProficiencyLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
              const normalizedProficiency = validProficiencyLevels.includes(skill.proficiency) 
                ? skill.proficiency 
                : 'Intermediate';
              
              // Ensure years_experience is not null and is a valid number
              const validatedYearsExperience = skill.years_experience !== null && skill.years_experience !== undefined 
                ? parseInt(skill.years_experience) || 1 
                : 1;
              
              // Add skill to freelancer (no need to check for existence since we cleared all)
              await db.query(
                'INSERT INTO "Freelancer_Skill" (freelancer_id, skill_id, proficiency_level, years_experience) VALUES ($1, $2, $3, $4)',
                [
                  freelancerId,
                  skillId,
                  normalizedProficiency,
                  validatedYearsExperience
                ]
              );
            } catch (skillError) {
              console.warn(`Warning: Failed to add skill "${skill.name}":`, skillError.message);
              // Continue adding other skills
            }
          }
        } catch (skillsError) {
          console.warn('Warning: Failed to process skills:', skillsError.message);
          // Continue - CV upload is still successful even if skills fail
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
    console.error('=== CV Upload Error ===');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Error stack:', error.stack);
    console.error('========================');
    
    // Delete the uploaded file if there was an error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError.message);
      }
    }
    
    return res.status(500).json({
      success: false,
      message: 'Failed to upload CV',
      error: error.message,
      details: {
        code: error.code,
        detail: error.detail
      }
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
    
    // Validate required fields
    if (!skill_name || !proficiency_level) {
      return res.status(400).json({
        success: false,
        message: 'Skill name and proficiency level are required'
      });
    }
    
    // Validate proficiency level enum values
    const validProficiencyLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
    if (!validProficiencyLevels.includes(proficiency_level)) {
      return res.status(400).json({
        success: false,
        message: `Invalid proficiency level. Must be one of: ${validProficiencyLevels.join(', ')}`
      });
    }
    
    // Ensure years_experience is not null and is a valid number
    const validatedYearsExperience = years_experience !== null && years_experience !== undefined 
      ? parseInt(years_experience) || 0 
      : 0;
    
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
      'SELECT skill_id FROM "Skill" WHERE LOWER(name) = LOWER($1)',
      [skill_name]
    );
    
    if (skillResult.rowCount === 0) {
      // Create new skill
      const newSkillResult = await db.query(
        'INSERT INTO "Skill" (name) VALUES ($1) RETURNING skill_id',
        [skill_name]
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
      [freelancerId, skillId, proficiency_level, validatedYearsExperience]
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
    
    // Validate proficiency level if provided
    if (proficiency_level) {
      const validProficiencyLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
      if (!validProficiencyLevels.includes(proficiency_level)) {
        return res.status(400).json({
          success: false,
          message: `Invalid proficiency level. Must be one of: ${validProficiencyLevels.join(', ')}`
        });
      }
    }
    
    // Ensure years_experience is not null and is a valid number
    const validatedYearsExperience = years_experience !== null && years_experience !== undefined 
      ? parseInt(years_experience) || 0 
      : 0;
    
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
      [proficiency_level, validatedYearsExperience, skillId]
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
        'SELECT cv_id, parsed_data FROM "CV" WHERE freelancer_id = $1 ORDER BY cv_id DESC LIMIT 1',
        [freelancerId]
      );
      
      if (cvResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No CV found. Please upload a CV first.'
        });
      }
      
      const cvId = cvResult.rows[0].cv_id;
      const existingParsedData = cvResult.rows[0].parsed_data ? cvResult.rows[0].parsed_data : {};
      
      // Create new work experience entry with a more robust ID
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const newWorkExperience = {
        id: `work_${timestamp}_${randomId}`,
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
        'UPDATE "CV" SET parsed_data = $1 WHERE cv_id = $2',
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
        'SELECT cv_id, parsed_data FROM "CV" WHERE freelancer_id = $1 ORDER BY cv_id DESC LIMIT 1',
        [freelancerId]
      );
      
      if (cvResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No CV found. Please upload a CV first.'
        });
      }
      
      const cvId = cvResult.rows[0].cv_id;
      const existingParsedData = cvResult.rows[0].parsed_data ? cvResult.rows[0].parsed_data : {};
      
      // Find and update the specific work experience entry
      const workExperience = existingParsedData.work_experience || [];
      
      // Clean up any corrupted entries (remove undefined IDs)
      const cleanWorkExperience = workExperience.filter(work => work && work.id && work.id !== undefined);
      
      console.log('Looking for workId:', workId);
      console.log('Available work experience IDs:', cleanWorkExperience.map(w => w.id));
      const workIndex = cleanWorkExperience.findIndex(work => work.id === workId);
      
      if (workIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Work experience not found'
        });
      }
      
      // Update the work experience entry
      cleanWorkExperience[workIndex] = {
        ...cleanWorkExperience[workIndex],
        title: title.trim(),
        company: company.trim(),
        start_date: start_date || '',
        end_date: end_date || '',
        description: description || ''
      };
      
      // Update CV record with cleaned data
      const updatedParsedData = {
        ...existingParsedData,
        work_experience: cleanWorkExperience
      };
      
      await db.query(
        'UPDATE "CV" SET parsed_data = $1 WHERE cv_id = $2',
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
        'SELECT cv_id, parsed_data FROM "CV" WHERE freelancer_id = $1 ORDER BY cv_id DESC LIMIT 1',
        [freelancerId]
      );
      
      if (cvResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No CV found. Please upload a CV first.'
        });
      }
      
      const cvId = cvResult.rows[0].cv_id;
      const existingParsedData = cvResult.rows[0].parsed_data ? cvResult.rows[0].parsed_data : {};
      
      // Remove the specific work experience entry
      const workExperience = existingParsedData.work_experience || [];
      
      // Clean up any corrupted entries (remove undefined IDs)
      const cleanWorkExperience = workExperience.filter(work => work && work.id && work.id !== undefined);
      
      console.log('Looking for workId to delete:', workId);
      console.log('Available work experience IDs:', cleanWorkExperience.map(w => w.id));
      const filteredWorkExperience = cleanWorkExperience.filter(work => work.id !== workId);
      
      if (filteredWorkExperience.length === cleanWorkExperience.length) {
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
        'UPDATE "CV" SET parsed_data = $1 WHERE cv_id = $2',
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
  
  // Add education
  router.post('/education', authenticateToken, requireRole(['freelancer']), async (req, res) => {
    try {
      const userId = req.user.user_id;
      const { degree, institution, field, year } = req.body;
      
      // Validate required fields
      if (!degree || !institution) {
        return res.status(400).json({
          success: false,
          message: 'Degree and institution are required'
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
        'SELECT cv_id, parsed_data FROM "CV" WHERE freelancer_id = $1 ORDER BY cv_id DESC LIMIT 1',
        [freelancerId]
      );
      
      if (cvResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No CV found. Please upload a CV first.'
        });
      }
      
      const cvId = cvResult.rows[0].cv_id;
      const existingParsedData = cvResult.rows[0].parsed_data ? cvResult.rows[0].parsed_data : {};
      
      // Create new education entry
      const newEducation = {
        id: `edu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        degree: degree.trim(),
        institution: institution.trim(),
        field: field ? field.trim() : '',
        year: year ? year.trim() : ''
      };
      
      // Add to existing education array or create new one
      const existingEducation = existingParsedData.education || [];
      const updatedParsedData = {
        ...existingParsedData,
        education: [...existingEducation, newEducation]
      };
      
      // Update CV record
      await db.query(
        'UPDATE "CV" SET parsed_data = $1 WHERE cv_id = $2',
        [JSON.stringify(updatedParsedData), cvId]
      );
      
      // Log activity
      await logActivity({
        user_id: userId,
        role: 'freelancer',
        activity_type: 'Education Added',
        details: `Added ${degree} from ${institution}`
      });
      
      return res.status(201).json({
        success: true,
        message: 'Education added successfully',
        education: newEducation
      });
    } catch (error) {
      console.error('Add education error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  });
  
  // Update education
  router.put('/education/:educationId', authenticateToken, requireRole(['freelancer']), async (req, res) => {
    try {
      const userId = req.user.user_id;
      const { educationId } = req.params;
      const { degree, institution, field, year } = req.body;
      
      // Validate required fields
      if (!degree || !institution) {
        return res.status(400).json({
          success: false,
          message: 'Degree and institution are required'
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
        'SELECT cv_id, parsed_data FROM "CV" WHERE freelancer_id = $1 ORDER BY cv_id DESC LIMIT 1',
        [freelancerId]
      );
      
      if (cvResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No CV found. Please upload a CV first.'
        });
      }
      
      const cvId = cvResult.rows[0].cv_id;
      const existingParsedData = cvResult.rows[0].parsed_data ? cvResult.rows[0].parsed_data : {};
      
      // Find and update the specific education entry
      const existingEducation = existingParsedData.education || [];
      const educationIndex = existingEducation.findIndex(edu => edu.id === educationId);
      
      if (educationIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Education not found'
        });
      }
      
      // Update the education entry
      existingEducation[educationIndex] = {
        ...existingEducation[educationIndex],
        degree: degree.trim(),
        institution: institution.trim(),
        field: field ? field.trim() : '',
        year: year ? year.trim() : ''
      };
      
      // Update CV record
      const updatedParsedData = {
        ...existingParsedData,
        education: existingEducation
      };
      
      await db.query(
        'UPDATE "CV" SET parsed_data = $1 WHERE cv_id = $2',
        [JSON.stringify(updatedParsedData), cvId]
      );
      
      // Log activity
      await logActivity({
        user_id: userId,
        role: 'freelancer',
        activity_type: 'Education Updated',
        details: `Updated ${degree} from ${institution}`
      });
      
      return res.status(200).json({
        success: true,
        message: 'Education updated successfully',
        education: existingEducation[educationIndex]
      });
    } catch (error) {
      console.error('Update education error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  });
  
  // Delete education
  router.delete('/education/:educationId', authenticateToken, requireRole(['freelancer']), async (req, res) => {
    try {
      const userId = req.user.user_id;
      const { educationId } = req.params;
      
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
        'SELECT cv_id, parsed_data FROM "CV" WHERE freelancer_id = $1 ORDER BY cv_id DESC LIMIT 1',
        [freelancerId]
      );
      
      if (cvResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No CV found. Please upload a CV first.'
        });
      }
      
      const cvId = cvResult.rows[0].cv_id;
      const existingParsedData = cvResult.rows[0].parsed_data ? cvResult.rows[0].parsed_data : {};
      
      // Remove the specific education entry
      const existingEducation = existingParsedData.education || [];
      const filteredEducation = existingEducation.filter(edu => edu.id !== educationId);
      
      if (filteredEducation.length === existingEducation.length) {
        return res.status(404).json({
          success: false,
          message: 'Education not found'
        });
      }
      
      // Update CV record
      const updatedParsedData = {
        ...existingParsedData,
        education: filteredEducation
      };
      
      await db.query(
        'UPDATE "CV" SET parsed_data = $1 WHERE cv_id = $2',
        [JSON.stringify(updatedParsedData), cvId]
      );
      
      // Log activity
      await logActivity({
        user_id: userId,
        role: 'freelancer',
        activity_type: 'Education Deleted'
      });
      
      return res.status(200).json({
        success: true,
        message: 'Education deleted successfully'
      });
    } catch (error) {
      console.error('Delete education error:', error);
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
        'SELECT cv_id, parsed_data FROM "CV" WHERE freelancer_id = $1 ORDER BY cv_id DESC LIMIT 1',
        [freelancerId]
      );
      
      if (cvResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'No CV found. Please upload a CV first.'
        });
      }
      
      const cvId = cvResult.rows[0].cv_id;
      const existingParsedData = cvResult.rows[0].parsed_data ? cvResult.rows[0].parsed_data : {};
      
      // Merge existing parsed data with new data
      const updatedParsedData = {
        ...existingParsedData,
        ...parsed_data
      };
      
      // Update CV record with new parsed data
      await db.query(
        'UPDATE "CV" SET parsed_data = $1 WHERE cv_id = $2',
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
      
      // Get recent activities
      let activitiesResult = { rows: [] };
      try {
        activitiesResult = await db.query(
          `SELECT activity_date, activity_type, status
           FROM "Activity"
           WHERE user_id = $1 AND role = 'freelancer'
           ORDER BY activity_date DESC
           LIMIT 10`,
          [userId]
        );
        
        console.log('🔍 Activities query result:', {
          userId,
          rowCount: activitiesResult.rowCount,
          activities: activitiesResult.rows
        });
      } catch (activityError) {
        console.error('❌ Error fetching activities:', activityError);
        // Continue with empty activities if there's an error
      }
      
      // This would include things like:
      // - Job applications stats
      // - Messaging stats
      // - Profile completion percentage
      // - Recent job postings matching skills
      
      // If no activities exist, create some sample ones for testing
      if (activitiesResult.rows.length === 0) {
        console.log('🔍 No activities found, creating sample activities...');
        
        // Create sample activities
        const sampleActivities = [
          {
            activity_date: new Date(),
            activity_type: 'Profile Updated',
            status: 'Completed'
          },
          {
            activity_date: new Date(Date.now() - 86400000), // 1 day ago
            activity_type: 'CV Uploaded',
            status: 'Completed'
          },
          {
            activity_date: new Date(Date.now() - 172800000), // 2 days ago
            activity_type: 'Skills Added',
            status: 'Completed'
          }
        ];
        
        console.log('🔍 Sample activities created:', sampleActivities);
        activitiesResult.rows = sampleActivities;
      }
      
      // For MVP, we'll just return dummy data
      const dashboardData = {
        profile_completion: 75,
        total_applications: 5,
        pending_applications: 2,
        accepted_applications: 1,
        rejected_applications: 2,
        total_conversations: 3,
        unread_messages: 2,
        recent_jobs_matching: 8,
        recent_activity: activitiesResult.rows
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

// Update freelancer availability status
router.put('/availability', authenticateToken, requireRole(['freelancer']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { availability_status } = req.body;

    // Validate availability status
    if (!availability_status || !['available', 'unavailable', 'busy'].includes(availability_status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid availability status. Must be: available, unavailable, or busy'
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

    // Update availability status
    await db.query(
      'UPDATE "Freelancer" SET availability_status = $1 WHERE freelancer_id = $2',
      [availability_status, freelancerId]
    );

    // Log the activity
    await logActivity({
      user_id: userId,
      role: 'freelancer',
      activity_type: 'Availability Updated',
      details: `Changed availability to ${availability_status}`
    });

    // Emit real-time update event for web frontend
    // This will be handled by the server to notify connected clients
    if (req.app.locals.io) {
      req.app.locals.io.emit('availability_updated', {
        freelancer_id: freelancerId,
        user_id: userId,
        availability_status: availability_status
      });
    }

    return res.status(200).json({
      success: true,
      message: `Availability status updated to ${availability_status}`,
      availability_status: availability_status
    });
  } catch (error) {
    console.error('Update availability error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// SSE endpoint for real-time availability updates
// Handle preflight requests for SSE endpoints
router.options('/availability/stream', (req, res) => {
  res.header('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'https://cv-connect-app.vercel.app');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.status(200).send();
});

router.get('/availability/stream', authenticateTokenSSE, requireRole(['freelancer']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Set headers for SSE with comprehensive CORS support
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': process.env.CLIENT_URL || 'https://cv-connect-app.vercel.app',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept'
    });

    // Send initial connection message
    res.write('data: {"type": "connected", "message": "SSE connection established"}\n\n');

    // Store the response object for later use
    if (!req.app.locals.sseConnections) {
      req.app.locals.sseConnections = new Map();
    }
    req.app.locals.sseConnections.set(userId, res);

    // Handle client disconnect
    req.on('close', () => {
      req.app.locals.sseConnections.delete(userId);
      console.log(`SSE connection closed for user ${userId}`);
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write('data: {"type": "ping"}\n\n');
    }, 30000); // Send ping every 30 seconds

    req.on('close', () => {
      clearInterval(keepAlive);
    });

  } catch (error) {
    console.error('SSE connection error:', error);
    res.end();
  }
});

// Handle preflight requests for activity stream SSE endpoint
router.options('/activity/stream', (req, res) => {
  res.header('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'https://cv-connect-app.vercel.app');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.status(200).send();
});

// SSE endpoint for real-time activity updates
router.get('/activity/stream', authenticateTokenSSE, requireRole(['freelancer']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Set headers for SSE with comprehensive CORS support
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': process.env.CLIENT_URL || 'https://cv-connect-app.vercel.app',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept'
    });

    // Send initial connection message
    res.write('data: {"type": "connected", "message": "Activity SSE connection established"}\n\n');

    // Store the response object for later use
    if (!req.app.locals.activityConnections) {
      req.app.locals.activityConnections = new Map();
    }
    req.app.locals.activityConnections.set(userId, res);

    // Handle client disconnect
    req.on('close', () => {
      req.app.locals.activityConnections.delete(userId);
      console.log(`Activity SSE connection closed for user ${userId}`);
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write('data: {"type": "ping"}\n\n');
    }, 30000); // Send ping every 30 seconds

    req.on('close', () => {
      clearInterval(keepAlive);
    });

  } catch (error) {
    console.error('Activity SSE connection error:', error);
    res.end();
  }
});

// Get freelancer hiring statistics
router.get('/hiring/stats', authenticateToken, requireRole(['freelancer']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log('🔍 Fetching hiring statistics for freelancer user_id:', userId);

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

    // Get total positions (total hires)
    const totalPositionsResult = await db.query(
      'SELECT COUNT(*) as total_positions FROM "Freelancer_Hire" WHERE freelancer_id = $1',
      [freelancerId]
    );

    // Get completed hires
    const completedHiresResult = await db.query(
      'SELECT COUNT(*) as completed_hires FROM "Freelancer_Hire" WHERE freelancer_id = $1 AND status = $2',
      [freelancerId, 'completed']
    );

    // Get active hires
    const activeHiresResult = await db.query(
      'SELECT COUNT(*) as active_hires FROM "Freelancer_Hire" WHERE freelancer_id = $1 AND status = $2',
      [freelancerId, 'active']
    );

    const stats = {
      total_positions: parseInt(totalPositionsResult.rows[0].total_positions),
      completed_hires: parseInt(completedHiresResult.rows[0].completed_hires),
      active_hires: parseInt(activeHiresResult.rows[0].active_hires)
    };

    console.log('✅ Hiring statistics fetched successfully for freelancer:', freelancerId);

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
});

// Get freelancer hiring history with company details
router.get('/hiring/history', authenticateToken, requireRole(['freelancer']), async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log('🔍 Fetching hiring history for freelancer user_id:', userId);

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

    // Get all hiring records with company details
    const hiringHistoryResult = await db.query(
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
         a.contact_person as company_contact,
         a.industry,
         a.website,
         a.phone,
         a.address,
         u.email as company_email
       FROM "Freelancer_Hire" h
       JOIN "Associate" a ON h.associate_id = a.associate_id
       JOIN "User" u ON a.user_id = u.user_id
       WHERE h.freelancer_id = $1
       ORDER BY h.created_at DESC`,
      [freelancerId]
    );

    console.log(`✅ Found ${hiringHistoryResult.rowCount} hiring records for freelancer:`, freelancerId);

    return res.status(200).json({
      success: true,
      hiring_history: hiringHistoryResult.rows
    });

  } catch (error) {
    console.error('❌ Get hiring history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch hiring history',
      error: error.message
    });
  }
});

// Upload signed contract
router.post('/contract/:hireId/upload-signed', authenticateToken, requireRole(['freelancer']), uploadSignedContract.single('signed_contract'), async (req, res) => {
  try {
    const { hireId } = req.params;
    const userId = req.user.user_id;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No signed contract file uploaded'
      });
    }
    
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
    
    // Verify the hire record belongs to this freelancer
    const hireResult = await db.query(
      'SELECT hire_id, signed_contract_pdf_path FROM "Freelancer_Hire" WHERE hire_id = $1 AND freelancer_id = $2',
      [hireId, freelancerId]
    );
    
    if (hireResult.rowCount === 0) {
      // Delete the uploaded file
      fs.unlinkSync(req.file.path);
      
      return res.status(404).json({
        success: false,
        message: 'Hire record not found or does not belong to this freelancer'
      });
    }
    
    const hireRecord = hireResult.rows[0];
    
    // Delete old signed contract if it exists
    if (hireRecord.signed_contract_pdf_path) {
      const oldFilePath = path.join('./uploads/signed_contracts', path.basename(hireRecord.signed_contract_pdf_path));
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
    
    // Update the hire record with new signed contract
    const signedContractPath = `/uploads/signed_contracts/${req.file.filename}`;
    await db.query(
      'UPDATE "Freelancer_Hire" SET signed_contract_pdf_path = $1, signed_contract_uploaded_at = CURRENT_TIMESTAMP WHERE hire_id = $2',
      [signedContractPath, hireId]
    );
    
    console.log(`✅ Signed contract uploaded for hire ID: ${hireId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Signed contract uploaded successfully',
      data: {
        hire_id: hireId,
        signed_contract_path: signedContractPath,
        uploaded_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Upload signed contract error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;
